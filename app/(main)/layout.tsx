import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { MainShell } from "@/components/layout/main-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  const email = typeof claims.email === "string" ? claims.email : "사용자";
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("db_vendor_sidebar_collapsed_v1")?.value === "1";

  return (
    <MainShell email={email} initialCollapsed={initialCollapsed}>
      {children}
    </MainShell>
  );
}
