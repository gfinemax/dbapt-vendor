"use client";

import { useState } from "react";

import { AppSidebar, SidebarBrand } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE = "db_vendor_sidebar_collapsed_v1";

export function MainShell({
  children,
  email,
  initialCollapsed,
}: {
  children: React.ReactNode;
  email: string;
  initialCollapsed: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return next;
    });
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r bg-background transition-[width] duration-200 print:hidden md:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <AppSidebar collapsed={collapsed} />
      </aside>
      <div
        className={cn(
          "transition-[padding] duration-200 print:pl-0",
          collapsed ? "md:pl-20" : "md:pl-64",
        )}
      >
        <TopBar collapsed={collapsed} email={email} onSidebarToggle={toggleSidebar} />
        <main className="p-4 print:p-0 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
