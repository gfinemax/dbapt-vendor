import { redirect } from "next/navigation";

import { AppSidebar, SidebarBrand } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
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

  return (
    <div className="min-h-svh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background md:block">
        <SidebarBrand />
        <AppSidebar />
      </aside>
      <div className="md:pl-64">
        <TopBar email={email} />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
