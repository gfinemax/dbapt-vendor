import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

function icsDate(value: string) { return value.replaceAll("-", ""); }
function addDay(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function escapeIcs(value: string) { return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replace(/\r?\n/g, "\\n"); }

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("로그인이 필요해.", { status: 401 });
  const projectId = request.nextUrl.searchParams.get("project_id");
  let query = supabase.from("events").select("id,title,date,end_date,type,status,memo,project_id").is("deleted_at", null).order("date");
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) return new Response("일정을 불러오지 못했어.", { status: 500 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DBapt Vendor//일정//KO", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:대방동지역주택조합 용역 일정", ...(data ?? []).flatMap((event) => ["BEGIN:VEVENT", `UID:${event.id}@dbapt-vendor`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDate(event.date)}`, `DTEND;VALUE=DATE:${icsDate(addDay(event.end_date ?? event.date))}`, `SUMMARY:${escapeIcs(event.title)}`, `CATEGORIES:${escapeIcs(event.type)}`, `DESCRIPTION:${escapeIcs(`${event.status}${event.memo ? ` - ${event.memo}` : ""}`)}`, "END:VEVENT"]), "END:VCALENDAR"];
  return new Response(`${lines.join("\r\n")}\r\n`, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="dbapt-schedule${projectId ? `-${projectId}` : ""}.ics"`, "Cache-Control": "private, no-store" } });
}
