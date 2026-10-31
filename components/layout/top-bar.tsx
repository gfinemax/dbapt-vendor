"use client";

import { LogOut, Menu, UserRound } from "lucide-react";

import { signOut } from "@/app/(main)/actions";
import { AppSidebar, SidebarBrand } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function TopBar({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur print:hidden md:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button aria-label="메뉴 열기" className="md:hidden" size="icon" variant="outline">
              <Menu aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-72 p-0" side="left">
            <SheetTitle className="sr-only">주 메뉴</SheetTitle>
            <SidebarBrand />
            <AppSidebar mobile />
          </SheetContent>
        </Sheet>
        <div>
          <p className="text-sm font-semibold">대방동지역주택조합</p>
          <p className="hidden text-xs text-muted-foreground sm:block">용역 업무를 한곳에서 관리해</p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="max-w-52 gap-2" variant="ghost">
            <UserRound aria-hidden="true" />
            <span className="truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block text-xs font-normal text-muted-foreground">로그인 계정</span>
            <span className="block truncate">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={signOut}>
            <Button className="w-full justify-start" type="submit" variant="ghost">
              <LogOut aria-hidden="true" />
              로그아웃
            </Button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
