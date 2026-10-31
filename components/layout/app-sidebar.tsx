"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/navigation";

function NavigationLink({
  href,
  icon: Icon,
  label,
  mobile = false,
}: (typeof navigationItems)[number] & { mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const link = (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      href={href}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );

  return mobile ? <SheetClose asChild>{link}</SheetClose> : link;
}

export function SidebarBrand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b px-5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">DB-Vendor</p>
        <p className="truncate text-xs text-muted-foreground">용역사 관리 시스템</p>
      </div>
    </div>
  );
}

export function AppSidebar({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label="주 메뉴" className="space-y-1 p-3">
      {navigationItems.map((item) => (
        <NavigationLink key={item.href} {...item} mobile={mobile} />
      ))}
    </nav>
  );
}
