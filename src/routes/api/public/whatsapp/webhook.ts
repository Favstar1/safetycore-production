import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * WhatsApp Business Platform webhook (inbound messages).
 *
 * Requires WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET. Until those are
 * configured no inbound traffic is accepted — the intake inbox stays empty
 * rather than showing fabricated conversations.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (!verifyToken) return new Response("Not configured", { status: 503 });
        const url = new URL(request.url);
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === verifyToken
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const appSecret = process.env["WHATSAPP_APP_SECRET"];
        if (!appSecret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const header = request.headers.get("x-hub-signature-256") ?? "";
        const expected = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
        const a = Buffer.from(header);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!org) return new Response("No organization", { status: 500 });

        const payload = JSON.parse(raw) as {
          entry?: Array<{
            changes?: Array<{
              value?: {
                contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
                messages?: Array<{
                  id?: string;
                  from?: string;
                  timestamp?: string;
                  text?: { body?: string };
                  type?: string;
                }>;
              };
            }>;
          }>;
        };

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const value = change.value ?? {};
            for (const message of value.messages ?? []) {
              const from = message.from;
              if (!from || !message.id) continue;
              const contactName =
                value.contacts?.find((c) => c.wa_id === from)?.profile?.name ?? from;

              let { data: thread } = await supabaseAdmin
                .from("whatsapp_threads")
                .select("id")
                .eq("org_id", org.id)
                .eq("external_thread_id", from)
                .maybeSingle();

              if (!thread) {
                const inserted = await supabaseAdmin
                  .from("whatsapp_threads")
                  .insert({
                    org_id: org.id,
                    external_thread_id: from,
                    thread_ref: `WA-${from.slice(-4)}-${Date.now().toString().slice(-4)}`,
                    contact: from,
                    contact_name: contactName,
                    status: "New",
                    consent: false,
                  })
                  .select("id")
                  .single();
                thread = inserted.data;
              }
              if (!thread) continue;

              const sentAt = message.timestamp
                ? new Date(Number(message.timestamp) * 1000).toISOString()
                : new Date().toISOString();

              // external_message_id is unique per org — replays are ignored.
              await supabaseAdmin.from("whatsapp_messages").insert({
                thread_id: thread.id,
                org_id: org.id,
                external_message_id: message.id,
                direction: "in",
                body: message.text?.body ?? `[${message.type ?? "unsupported"} message]`,
                sender: contactName,
                sent_at: sentAt,
                delivery_status: "received",
              });

              await supabaseAdmin.from("case_audit_events").insert({
                org_id: org.id,
                entity: "whatsapp_thread",
                entity_id: thread.id,
                action: "Inbound WhatsApp message received",
                actor_id: "00000000-0000-0000-0000-000000000000",
                actor_name: "WhatsApp webhook",
                metadata: { external_message_id: message.id },
              });
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
