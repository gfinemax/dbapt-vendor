import { CalendarDays, Handshake, Search } from "lucide-react";
import Link from "next/link";

import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = { project?: string; vendor?: string; from?: string; to?: string; q?: string };

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectsPromise = safeView ? supabase.from("projects_public").select("id,title") : supabase.from("projects").select("id,title").is("deleted_at", null);
  const [projectsResult, linksResult, usersResult] = await Promise.all([
    projectsPromise,
    supabase.from("project_vendors").select("project_id,vendor_id").is("deleted_at", null),
    supabase.from("users").select("id,name").eq("active", true).is("deleted_at", null).order("name"),
  ]);
  const projects = (projectsResult.data ?? []).flatMap((project) => project.id && project.title ? [{ id: project.id, title: project.title }] : []);
  const projectIds = new Set(projects.map((project) => project.id));
  const vendorIds = [...new Set((linksResult.data ?? []).filter((link) => projectIds.has(link.project_id)).map((link) => link.vendor_id))];
  const vendorsResult = safeView
    ? await supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : await supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const vendors = (vendorsResult.data ?? []).flatMap((vendor) => vendor.id && vendor.name ? [{ id: vendor.id, name: vendor.name }] : []);
  let meetingQuery = supabase.from("meetings").select("id,project_id,vendor_id,held_at,method,agenda,notes,decisions").is("deleted_at", null).order("held_at", { ascending: false });
  if (filters.project) meetingQuery = meetingQuery.eq("project_id", filters.project);
  if (filters.vendor) meetingQuery = meetingQuery.eq("vendor_id", filters.vendor);
  if (filters.from) meetingQuery = meetingQuery.gte("held_at", `${filters.from}T00:00:00+09:00`);
  if (filters.to) meetingQuery = meetingQuery.lte("held_at", `${filters.to}T23:59:59+09:00`);
  const keyword = filters.q?.trim().replace(/[,%()]/g, " ").slice(0, 80);
  if (keyword) meetingQuery = meetingQuery.or(`agenda.ilike.%${keyword}%,notes.ilike.%${keyword}%,decisions.ilike.%${keyword}%`);
  const { data: meetings } = await meetingQuery;
  const projectMap = new Map(projects.map((project) => [project.id, project.title]));
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
  const projectOptions = projects.map((project) => ({ ...project, vendors: (linksResult.data ?? []).filter((link) => link.project_id === project.id).flatMap((link) => { const name = vendorMap.get(link.vendor_id); return name ? [{ id: link.vendor_id, name }] : []; }) }));
  const canManage = role === "admin" || role === "staff" || role === "agent";

  return <section className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Handshake className="size-6" /><h1 className="text-2xl font-bold tracking-tight">협의록</h1></div><p className="mt-1 text-sm text-muted-foreground">협의 내용과 후속조치, 담당자와 기한을 기록해.</p></div>{canManage ? <MeetingFormDialog projects={projectOptions} users={usersResult.data ?? []} /> : null}</div>
    <Card className="p-4"><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_150px_1.4fr_auto]" method="get"><select aria-label="용역 건 필터" className="h-8 rounded-lg border bg-background px-2.5 text-sm" defaultValue={filters.project ?? ""} name="project"><option value="">모든 용역 건</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select><select aria-label="업체 필터" className="h-8 rounded-lg border bg-background px-2.5 text-sm" defaultValue={filters.vendor ?? ""} name="vendor"><option value="">모든 업체</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><Input aria-label="시작일" defaultValue={filters.from} name="from" type="date" /><Input aria-label="종료일" defaultValue={filters.to} name="to" type="date" /><Input defaultValue={filters.q} name="q" placeholder="안건·내용·결정사항 검색" /><Button type="submit" variant="outline"><Search />검색</Button></form></Card>
    <Card className="py-0"><div className="divide-y">{meetings?.length ? meetings.map((meeting) => <Link key={meeting.id} className="block p-4 transition hover:bg-muted/40" href={`/meetings/${meeting.id}`}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{meeting.method}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(meeting.held_at)}</span><span className="text-xs text-muted-foreground">· {projectMap.get(meeting.project_id) ?? "용역 건"}</span>{meeting.vendor_id ? <span className="text-xs text-muted-foreground">· {vendorMap.get(meeting.vendor_id) ?? "업체"}</span> : null}</div><p className="mt-2 font-semibold">{meeting.agenda}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{meeting.decisions || meeting.notes || "기록된 내용이 없어."}</p></Link>) : <div className="p-12 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-2 size-8" /><p className="font-medium">조건에 맞는 협의록이 없어.</p><p className="mt-1 text-sm">검색 조건을 바꾸거나 새 협의록을 작성해 줘.</p></div>}</div></Card>
  </section>;
}
