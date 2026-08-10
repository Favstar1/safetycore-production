import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * WhatsApp Business Platform integration boundary.
 *
 * Outbound messages are sent through the Cloud API when credentials are
 * configured. When they are not, the message is still persisted and audited
 * with delivery_status = 'queued' so the reviewer action is on record — we
 * never pretend a message left the building.
 */

export const getWhatsAppConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const configured =
      !!process.env["WHATSAPP_ACCESS_TOKEN"] && !!process.env["WHATSAPP_PHONE_NUMBER_ID"];
    return { configured };
  });

const sendInput = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4096),
});

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // RLS scopes this read to the caller's organisation.
    const { data: thread, error: threadError } = await supabase
      .from("whatsapp_threads")
      .select("id, org_id, contact, contact_name, thread_ref")
      .eq("id", data.threadId)
      .maybeSingle();
    if (threadError) throw new Error(threadError.message);
    if (!thread) throw new Error("Thread not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const token = process.env["WHATSAPP_ACCESS_TOKEN"];
    const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];

    let deliveryStatus: "sent" | "queued" | "failed" = "queued";
    let failureReason: string | null =
      "WhatsApp Business Platform is not configured — message recorded but not transmitted.";
    let externalMessageId: string | null = null;

    if (token && phoneId) {
      const to = thread.contact.replace(/[^\d]/g, "");
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: data.body },
        }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { messages?: Array<{ id?: string }>; error?: { message?: string } }
        | null;
      if (res.ok) {
        deliveryStatus = "sent";
        failureReason = null;
        externalMessageId = payload?.messages?.[0]?.id ?? null;
      } else {
        deliveryStatus = "failed";
        failureReason = `WhatsApp API [${res.status}]: ${payload?.error?.message ?? "unknown error"}`;
      }
    }

    const { error: insertError } = await supabase.from("whatsapp_messages").insert({
      thread_id: thread.id,
      org_id: thread.org_id,
      direction: "out",
      body: data.body,
      sender: profile?.full_name ?? "PV reviewer",
      sent_at: new Date().toISOString(),
      delivery_status: deliveryStatus,
      failure_reason: failureReason,
      external_message_id: externalMessageId,
    });
    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("whatsapp_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", thread.id);

    return { deliveryStatus, failureReason };
  });
