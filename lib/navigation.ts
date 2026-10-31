import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSignature,
  Handshake,
  LayoutDashboard,
  Settings,
  TableProperties,
} from "lucide-react";

export const navigationItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/business-projects", label: "프로젝트", icon: BriefcaseBusiness },
  { href: "/projects", label: "용역 건", icon: ClipboardList },
  { href: "/vendors", label: "용역사", icon: Building2 },
  { href: "/quotes", label: "견적 비교", icon: TableProperties },
  { href: "/contracts", label: "계약", icon: FileSignature },
  { href: "/meetings", label: "협의록", icon: Handshake },
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/settings", label: "설정", icon: Settings },
] as const;
