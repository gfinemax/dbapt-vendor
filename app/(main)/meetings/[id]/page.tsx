import { CalendarCheck2, FileText, Printer, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionItemToggle } from "@/components/meetings/action-item-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error || !meeting) notFound();
  const safeView = role === "agent" || role === "viewer";
  const [projectResult, vendorResult, actionsResult, documentsResult, usersResult] = await Promise.all([
    (safeView ? supabase.from("projects_public") : supabase.from("projects")).select("id,title").eq("id", meeting.project_id).maybeSingle(),
    meeting.vendor_id ? (safeView ? supabase.from("vendors_public") : supabase.from("vendors")).select("id,name").eq("id", meeting.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("action_items").select("*").eq("meeting_id", id).is("deleted_at", null).order("due_date"),
    supabase.from("documents").select("id,kind,file_name,version,created_at").eq("owner_type", "meeting").eq("owner_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("users").select("id,name").is("deleted_at", null),
  ]);
  if (!projectResult.data?.id || !projectResult.data.title) notFound();
  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, user.name]));
  const canManage = role === "admin" || role === "staff" || role === "agent";
  return <section className="mx-auto max-w-5xl space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Link className="text-sm text-muted-foreground hover:underline" href="/meetings">← 협의록 목록</Link><h1 className="mt-2 text-2xl font-bold tracking-tight">{meeting.agenda}</h1><p className="mt-1 text-sm text-muted-foreground"><Link className="hover:underline" href={`/projects/${meeting.project_id}?tab=meetings`}>{projectResult.data.title}</Link>{vendorResult.data?.name ? ` · ${vendorResult.data.name}` : ""}</p></div><Button asChild variant="outline"><Link href={`/meetings/${id}/print`} target="_blank"><Printer />업체 확인용 인쇄</Link></Button></div>
    <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>협의 내용</CardTitle></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap gap-2"><Badge variant="outline">{meeting.method}</Badge><Badge variant="secondary">{formatDateTime(meeting.held_at)}</Badge></div><div><p className="text-xs font-semibold text-muted-foreground">논의 내용</p><p className="mt-1 whitespace-pre-wrap">{meeting.notes ?? "기록된 내용이 없어."}</p></div><div className="rounded-lg bg-blue-50 p-4 text-blue-950"><p className="text-xs font-semibold">결정사항</p><p className="mt-1 whitespace-pre-wrap">{meeting.decisions ?? "기록된 결정사항이 없어."}</p></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />참석자</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-muted-foreground">조합</p><p className="mt-1">{meeting.attendees_union ?? "미입력"}</p></div><div><p className="text-xs text-muted-foreground">업체</p><p className="mt-1">{meeting.attendees_vendor ?? "미입력"}</p></div></CardContent></Card></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="size-5" />후속조치</CardTitle></CardHeader><CardContent className="space-y-2">{actionsResult.data?.length ? actionsResult.data.map((action) => <div key={action.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"><div className="font-medium">{canManage ? <ActionItemToggle complete={action.status === "완료"} id={action.id} label={action.content} meetingId={id} projectId={meeting.project_id} /> : <span className={action.status === "완료" ? "line-through" : ""}>{action.content}</span>}<p className="ml-7 mt-1 text-xs text-muted-foreground">담당 {action.assignee_user_id ? userMap.get(action.assignee_user_id) ?? "사용자" : "미배정"}</p></div><div className="flex items-center gap-2 pl-7 sm:pl-0"><span className="text-sm">{formatDate(action.due_date)}</span><Badge variant={action.status === "지연" ? "destructive" : action.status === "완료" ? "secondary" : "outline"}>{action.status}</Badge></div></div>) : <p className="text-sm text-muted-foreground">등록된 후속조치가 없어.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5" />사진·파일</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{documentsResult.data?.length ? documentsResult.data.map((document) => <div key={document.id} className="rounded-lg border p-3"><p className="truncate font-medium">{document.file_name}</p><p className="mt-1 text-xs text-muted-foreground">{document.kind} · v{document.version} · {formatDate(document.created_at)}</p></div>) : <p className="text-sm text-muted-foreground">첨부된 파일이 없어.</p>}</CardContent></Card>
  </section>;
}
