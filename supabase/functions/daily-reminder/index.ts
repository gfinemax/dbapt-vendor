import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type ReminderStage = "D-7" | "D-3" | "D-day" | "지연";
type ReminderEvent = { id: string; title: string; date: string; status: string; type: string; project_id: string | null; source_type: string | null; source_id: string | null; projectTitle: string; ownerUserId: string | null; stage: ReminderStage };

function kstToday() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()); }
function dayDifference(date: string, today: string) { return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000); }
function stageFor(event: { date: string; status: string }, today: string): ReminderStage | null { if (event.status === "지연") return "지연"; const difference = dayDifference(event.date, today); return difference === 7 ? "D-7" : difference === 3 ? "D-3" : difference === 0 ? "D-day" : null; }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function formatKoreanDate(value: string) { const [year, month, day] = value.split("-"); return `${year}.${month}.${day}.`; }

export function buildReminderHtml(name: string, events: ReminderEvent[]) {
  const rows = events.map((event) => `<tr><td style="padding:10px;border:1px solid #ddd">${escapeHtml(event.stage)}</td><td style="padding:10px;border:1px solid #ddd">${escapeHtml(formatKoreanDate(event.date))}</td><td style="padding:10px;border:1px solid #ddd">${escapeHtml(event.projectTitle)}</td><td style="padding:10px;border:1px solid #ddd">${escapeHtml(event.title)}</td><td style="padding:10px;border:1px solid #ddd">${escapeHtml(event.type)}</td></tr>`).join("");
  return `<!doctype html><html lang="ko"><body style="font-family:Arial,'Apple SD Gothic Neo',sans-serif;color:#111"><h2>용역 일정 알림</h2><p>${escapeHtml(name)}님, 확인할 일정이 있어.</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f3f4f6"><th style="padding:10px;border:1px solid #ddd">단계</th><th style="padding:10px;border:1px solid #ddd">일자</th><th style="padding:10px;border:1px solid #ddd">용역 건</th><th style="padding:10px;border:1px solid #ddd">일정</th><th style="padding:10px;border:1px solid #ddd">유형</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:20px;color:#666;font-size:12px">대방동지역주택조합 용역사 관리 시스템 자동 알림</p></body></html>`;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST 요청만 허용돼." }), { status: 405, headers: { "Content-Type": "application/json" } });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ error: "Supabase 환경 변수가 없어." }), { status: 500, headers: { "Content-Type": "application/json" } });
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const token = request.headers.get("x-cron-token") ?? "";
  const { data: verified, error: verifyError } = await supabase.rpc("verify_daily_reminder_token", { input_token: token });
  if (verifyError || !verified) return new Response(JSON.stringify({ error: "Cron 인증에 실패했어." }), { status: 401, headers: { "Content-Type": "application/json" } });
  const body = await request.json().catch(() => ({})) as { dry_run?: boolean };
  await supabase.rpc("mark_overdue_events");
  const today = kstToday();
  const { data: rawEvents, error: eventsError } = await supabase.from("events").select("id,title,date,status,type,project_id,source_type,source_id").is("deleted_at", null).in("status", ["예정", "진행", "지연"]);
  if (eventsError) return new Response(JSON.stringify({ error: eventsError.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  const staged = (rawEvents ?? []).flatMap((event) => { const stage = stageFor(event, today); return stage ? [{ ...event, stage }] : []; });
  if (!staged.length) return new Response(JSON.stringify({ ok: true, event_count: 0, recipient_count: 0, dry_run: Boolean(body.dry_run) }), { headers: { "Content-Type": "application/json" } });
  const projectIds = [...new Set(staged.flatMap((event) => event.project_id ? [event.project_id] : []))];
  const actionIds = staged.filter((event) => event.source_type === "action_item" && event.source_id).map((event) => event.source_id!);
  const [{ data: projects }, { data: actions }] = await Promise.all([
    supabase.from("projects").select("id,title,owner_user_id").in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("action_items").select("id,assignee_user_id").in("id", actionIds.length ? actionIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const projectMap = new Map((projects ?? []).map((project) => [project.id, project]));
  const actionMap = new Map((actions ?? []).map((action) => [action.id, action.assignee_user_id]));
  const events: ReminderEvent[] = staged.map((event) => ({ ...event, projectTitle: projectMap.get(event.project_id ?? "")?.title ?? "용역", ownerUserId: projectMap.get(event.project_id ?? "")?.owner_user_id ?? null }));
  const recipientIds = [...new Set(events.flatMap((event) => [event.ownerUserId, event.source_type === "action_item" && event.source_id ? actionMap.get(event.source_id) : null].filter((value): value is string => Boolean(value))))];
  const [{ data: users }, { data: logs }] = await Promise.all([
    supabase.from("users").select("id,name,email").in("id", recipientIds.length ? recipientIds : ["00000000-0000-0000-0000-000000000000"]).eq("active", true).is("deleted_at", null),
    supabase.from("notification_logs").select("event_id,recipient_user_id,stage").in("event_id", events.map((event) => event.id)).is("deleted_at", null),
  ]);
  const delivered = new Set((logs ?? []).map((log) => `${log.event_id}:${log.recipient_user_id}:${log.stage}`));
  const grouped = new Map<string, ReminderEvent[]>();
  for (const event of events) {
    const recipients = new Set([event.ownerUserId, event.source_type === "action_item" && event.source_id ? actionMap.get(event.source_id) : null].filter((value): value is string => Boolean(value)));
    for (const recipient of recipients) if (!delivered.has(`${event.id}:${recipient}:${event.stage}`)) grouped.set(recipient, [...(grouped.get(recipient) ?? []), event]);
  }
  const previews = (users ?? []).flatMap((user) => { const userEvents = grouped.get(user.id) ?? []; return userEvents.length ? [{ user, events: userEvents, html: buildReminderHtml(user.name, userEvents) }] : []; });
  if (body.dry_run) return new Response(JSON.stringify({ ok: true, dry_run: true, event_count: events.length, recipient_count: previews.length, previews: previews.map((preview) => ({ recipient: preview.user.email, event_count: preview.events.length, html: preview.html })) }), { headers: { "Content-Type": "application/json" } });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "대방동지역주택조합 <onboarding@resend.dev>";
  if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY가 설정되지 않았어.", pending_recipient_count: previews.length }), { status: 503, headers: { "Content-Type": "application/json" } });
  let sent = 0;
  const failures: string[] = [];
  for (const preview of previews) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [preview.user.email], subject: `[대방동지역주택조합] 확인할 용역 일정 ${preview.events.length}건`, html: preview.html }) });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) { failures.push(`${preview.user.email}: ${result.message ?? response.status}`); continue; }
    const { error: logError } = await supabase.from("notification_logs").insert(preview.events.map((event) => ({ event_id: event.id, recipient_user_id: preview.user.id, stage: event.stage, provider_message_id: result.id ?? null })));
    if (logError) failures.push(`${preview.user.email}: 알림 로그 저장 실패`); else sent += 1;
  }
  return new Response(JSON.stringify({ ok: failures.length === 0, event_count: events.length, recipient_count: previews.length, sent_recipient_count: sent, failures }), { status: failures.length ? 207 : 200, headers: { "Content-Type": "application/json" } });
});
