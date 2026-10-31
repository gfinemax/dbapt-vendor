import { ArchiveRestore, ClipboardList, FileSpreadsheet, History, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AssignmentManager } from "@/components/settings/assignment-manager";
import { GoogleContactsSettings } from "@/components/settings/google-contacts-settings";
import { UserAccessManager } from "@/components/settings/user-access-manager";
import { Card, CardContent } from "@/components/ui/card";
import { getGoogleContactsMissingConfig } from "@/lib/google/contacts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: role } = await supabase.rpc("current_role");
  if (!user || role !== "admin") redirect("/dashboard");
  const [usersResult, projectsResult, assignmentsResult, googleConnectionResult] = await Promise.all([
    supabase.from("users").select("id,name,email,role,active").is("deleted_at", null).order("name"),
    supabase.from("projects").select("id,title").is("deleted_at", null).order("title"),
    supabase.from("project_assignees").select("project_id,user_id").is("deleted_at", null),
    supabase.from("google_contact_connections").select("account_email,connected_at,last_verified_at").is("deleted_at", null).maybeSingle(),
  ]);
  const missingGoogleConfig = getGoogleContactsMissingConfig();
  const navigation = [{ href: "/settings/trash", label: "휴지통", description: "삭제 항목 복원·영구 삭제", icon: ArchiveRestore }, { href: "/settings/audit", label: "변경 이력", description: "누가 언제 무엇을 바꿨는지 확인", icon: History }, { href: "/settings/reports", label: "계약 보고서", description: "이사회 보고용 엑셀·인쇄", icon: ClipboardList }, { href: "/api/admin/backup", label: "전체 백업", description: "테이블·Storage 목록 XLSX", icon: FileSpreadsheet }];
  return <section className="space-y-6"><div><div className="flex items-center gap-2"><Settings className="size-6" /><h1 className="text-2xl font-bold tracking-tight">설정</h1></div><p className="mt-1 text-sm text-muted-foreground">관리자 전용 사용자, 권한, 배정과 운영 기록을 관리해.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{navigation.map(({ href, label, description, icon: Icon }) => <Card key={href} className="transition hover:bg-muted/40"><Link href={href} prefetch={href.startsWith("/api/") ? false : undefined}><CardContent className="flex items-center gap-3"><Icon className="size-6 text-muted-foreground" /><div><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div></CardContent></Link></Card>)}</div><GoogleContactsSettings configured={missingGoogleConfig.length === 0} connection={googleConnectionResult.data} missingConfig={missingGoogleConfig} status={query.google} /><UserAccessManager currentUserId={user.id} users={usersResult.data ?? []} /><AssignmentManager assignments={assignmentsResult.data ?? []} projects={projectsResult.data ?? []} users={(usersResult.data ?? []).filter((item) => item.active).map((item) => ({ id: item.id, name: item.name, role: item.role }))} /></section>;
}
