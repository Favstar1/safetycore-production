import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/pv";

export type SessionProfile = {
  userId: string;
  email: string;
  fullName: string;
  title: string;
  orgId: string;
  role: AppRole;
};

async function loadSession(): Promise<SessionProfile | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const order: AppRole[] = ["ADMIN", "PV_MANAGER", "PV_COORDINATOR", "FIELD_ASSOCIATE"];
  const role =
    order.find((r) => (roles ?? []).some((x) => x.role === r)) ?? ("FIELD_ASSOCIATE" as AppRole);
  return {
    userId: user.id,
    email: user.email ?? profile?.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "User",
    title: profile?.title ?? "",
    orgId: profile?.org_id ?? "",
    role,
  };
}

export function useSession() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["session"], queryFn: loadSession, staleTime: 0 });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      queryClient.removeQueries({ queryKey: ["session"] });
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  return query;
}

export function canSubmit(role?: AppRole) {
  return role === "PV_MANAGER" || role === "ADMIN";
}
export function canReview(role?: AppRole) {
  return role === "PV_MANAGER" || role === "ADMIN";
}
export function isFieldOnly(role?: AppRole) {
  return role === "FIELD_ASSOCIATE";
}
