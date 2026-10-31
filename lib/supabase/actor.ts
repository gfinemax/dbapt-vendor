import { createClient } from "@/lib/supabase/server";

export async function getActor() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return { error: "로그인이 필요해.", supabase: null, userId: null, role: null } as const;
  }

  const { data: role, error: roleError } = await supabase.rpc("current_role");
  if (roleError || !role) {
    return { error: "사용자 권한을 확인할 수 없어.", supabase: null, userId: null, role: null } as const;
  }

  return { error: null, supabase, userId, role } as const;
}
