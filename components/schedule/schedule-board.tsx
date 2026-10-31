"use client";

import FullCalendar, { type EventClickInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import { CalendarDays, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { EventCompleteToggle } from "@/components/schedule/event-complete-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

export type ScheduleEvent = { id: string; projectId: string; projectTitle: string; type: string; title: string; date: string; endDate: string | null; status: string; href: string };

const eventColors: Record<string, string> = { 견적마감: "#7c3aed", 업체미팅: "#2563eb", 이사회상정: "#9333ea", 계약체결: "#0f766e", 착수: "#059669", 중간점검: "#ca8a04", 대금지급: "#ea580c", 준공: "#16a34a", 보증만료: "#dc2626", 후속조치: "#4f46e5", 기타: "#64748b" };
const calendarPlugins = [dayGridPlugin, timeGridPlugin, listPlugin];
const calendarHeader = { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" };
function exclusiveEnd(value: string | null) { if (!value) return undefined; const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }

export function ScheduleBoard({ events, projects, today, canManage }: { events: ScheduleEvent[]; projects: { id: string; title: string }[]; today: string; canManage: boolean }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("all");
  const filtered = useMemo(() => events.filter((event) => projectId === "all" || event.projectId === projectId), [events, projectId]);
  const calendarEvents = useMemo(() => filtered.map((event) => ({ id: event.id, title: event.title, start: event.date, end: exclusiveEnd(event.endDate), allDay: true, backgroundColor: event.status === "지연" ? "#dc2626" : eventColors[event.type] ?? "#64748b", borderColor: event.status === "지연" ? "#dc2626" : eventColors[event.type] ?? "#64748b", extendedProps: { href: event.href, status: event.status, type: event.type } })), [filtered]);
  const upcoming = useMemo(() => filtered.filter((event) => event.status === "지연" || event.date >= today).sort((a, b) => { if (a.status === "지연" && b.status !== "지연") return -1; if (a.status !== "지연" && b.status === "지연") return 1; return a.date.localeCompare(b.date); }), [filtered, today]);
  const openEvent = useCallback((info: EventClickInfo) => { const href = info.event.extendedProps.href as string | undefined; if (href) router.push(href); }, [router]);
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 용역 건</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent></Select><Button asChild variant="outline"><Link href={`/api/ics${projectId === "all" ? "" : `?project_id=${projectId}`}`}><Download />ICS 내보내기</Link></Button></div>
    <Card className="overflow-hidden p-3 sm:p-5"><FullCalendar dayMaxEvents height="auto" initialView="dayGridMonth" locale="ko" eventClick={openEvent} events={calendarEvents} headerToolbar={calendarHeader} plugins={calendarPlugins} timeZone="Asia/Seoul" /></Card>
    <div><h2 className="mb-3 text-lg font-bold">오늘 이후·지연 일정</h2><Card className="py-0"><div className="divide-y">{upcoming.length ? upcoming.map((event) => <div key={event.id} className="flex items-start gap-3 p-4">{canManage ? <div className="pt-1"><EventCompleteToggle complete={event.status === "완료"} id={event.id} projectId={event.projectId} title={event.title} /></div> : null}<Link className="min-w-0 flex-1" href={event.href}><div className="flex flex-wrap items-center gap-2"><Badge style={{ backgroundColor: eventColors[event.type] ?? "#64748b" }}>{event.type}</Badge><Badge variant={event.status === "지연" ? "destructive" : "outline"}>{event.status}</Badge><span className="text-sm text-muted-foreground">{formatDate(event.date)}</span></div><p className="mt-2 font-semibold">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{event.projectTitle}</p></Link></div>) : <CardContent className="flex min-h-36 flex-col items-center justify-center text-center text-muted-foreground"><CalendarDays className="mb-2 size-7" /><p>예정되거나 지연된 일정이 없어.</p></CardContent>}</div></Card></div>
  </div>;
}
