import { CalendarDays } from "lucide-react";

import { EventFormDialog } from "@/components/schedule/event-form-dialog";
import { ScheduleBoard, type ScheduleEvent } from "@/components/schedule/schedule-board";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayKst() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()); }

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const [eventsResult, projectsResult] = await Promise.all([
    supabase.from("events").select("*").is("deleted_at", null).order("date"),
    safeView ? supabase.from("projects_public").select("id,title") : supabase.from("projects").select("id,title").is("deleted_at", null),
  ]);
  const events = eventsResult.data ?? [];
  const projects = (projectsResult.data ?? []).flatMap((project) => project.id && project.title ? [{ id: project.id, title: project.title }] : []);
  const projectMap = new Map(projects.map((project) => [project.id, project.title]));
  const paymentIds = events.filter((event) => event.source_type === "payment_schedule" && event.source_id).map((event) => event.source_id!);
  const guaranteeIds = events.filter((event) => event.source_type === "guarantee" && event.source_id).map((event) => event.source_id!);
  const actionIds = events.filter((event) => event.source_type === "action_item" && event.source_id).map((event) => event.source_id!);
  const [paymentsResult, guaranteesResult, actionsResult] = await Promise.all([
    supabase.from("payment_schedules").select("id,contract_id").in("id", paymentIds.length ? paymentIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("guarantees").select("id,contract_id").in("id", guaranteeIds.length ? guaranteeIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("action_items").select("id,meeting_id").in("id", actionIds.length ? actionIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const paymentMap = new Map((paymentsResult.data ?? []).map((item) => [item.id, item.contract_id]));
  const guaranteeMap = new Map((guaranteesResult.data ?? []).map((item) => [item.id, item.contract_id]));
  const actionMap = new Map((actionsResult.data ?? []).map((item) => [item.id, item.meeting_id]));
  function hrefFor(event: (typeof events)[number]) {
    if ((event.source_type === "contract_start" || event.source_type === "contract_end") && event.source_id) return `/contracts/${event.source_id}`;
    if (event.source_type === "payment_schedule" && event.source_id) return `/contracts/${paymentMap.get(event.source_id) ?? ""}`;
    if (event.source_type === "guarantee" && event.source_id) return `/contracts/${guaranteeMap.get(event.source_id) ?? ""}`;
    if (event.source_type === "action_item" && event.source_id) return `/meetings/${actionMap.get(event.source_id) ?? ""}`;
    return event.project_id ? `/projects/${event.project_id}?tab=schedule` : "/schedule";
  }
  const rows: ScheduleEvent[] = events.flatMap((event) => event.project_id && projectMap.has(event.project_id) ? [{ id: event.id, projectId: event.project_id, projectTitle: projectMap.get(event.project_id)!, type: event.type, title: event.title, date: event.date, endDate: event.end_date, status: event.status, href: hrefFor(event) }] : []);
  const canManage = role === "admin" || role === "staff" || role === "agent";
  return <section className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><CalendarDays className="size-6" /><h1 className="text-2xl font-bold tracking-tight">일정</h1></div><p className="mt-1 text-sm text-muted-foreground">계약, 지급, 보증, 후속조치와 수동 일정을 함께 확인해.</p></div>{canManage ? <EventFormDialog projects={projects} /> : null}</div><ScheduleBoard canManage={canManage} events={rows} projects={projects} today={todayKst()} /></section>;
}
