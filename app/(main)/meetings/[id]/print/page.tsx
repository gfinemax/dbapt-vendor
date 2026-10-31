import { notFound } from "next/navigation";

import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MeetingPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!meeting) notFound();
  const safeView = role === "agent" || role === "viewer";
  const [projectResult, vendorResult, actionsResult, usersResult] = await Promise.all([
    (safeView ? supabase.from("projects_public") : supabase.from("projects")).select("id,title").eq("id", meeting.project_id).maybeSingle(),
    meeting.vendor_id ? (safeView ? supabase.from("vendors_public") : supabase.from("vendors")).select("id,name").eq("id", meeting.vendor_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("action_items").select("content,assignee_user_id,due_date,status").eq("meeting_id", id).is("deleted_at", null).order("due_date"),
    supabase.from("users").select("id,name").is("deleted_at", null),
  ]);
  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, user.name]));
  return <main className="print-page mx-auto max-w-[210mm] bg-white p-8 text-black"><div className="mb-8 border-b-2 border-black pb-4 text-center"><p className="text-sm">대방동지역주택조합</p><h1 className="mt-1 text-2xl font-bold">업체 확인용 협의 요약</h1></div><table className="w-full border-collapse text-sm"><tbody><tr><th className="w-28 border bg-gray-100 p-2 text-left">용역 건</th><td className="border p-2">{projectResult.data?.title ?? "-"}</td><th className="w-28 border bg-gray-100 p-2 text-left">업체</th><td className="border p-2">{vendorResult.data?.name ?? "-"}</td></tr><tr><th className="border bg-gray-100 p-2 text-left">일시</th><td className="border p-2">{formatDateTime(meeting.held_at)}</td><th className="border bg-gray-100 p-2 text-left">방식</th><td className="border p-2">{meeting.method}</td></tr><tr><th className="border bg-gray-100 p-2 text-left">조합 참석자</th><td className="border p-2">{meeting.attendees_union ?? "-"}</td><th className="border bg-gray-100 p-2 text-left">업체 참석자</th><td className="border p-2">{meeting.attendees_vendor ?? "-"}</td></tr></tbody></table><section className="mt-6"><h2 className="border-b border-black pb-2 text-lg font-bold">결정사항</h2><p className="min-h-28 whitespace-pre-wrap py-4">{meeting.decisions ?? "-"}</p></section><section className="mt-6"><h2 className="border-b border-black pb-2 text-lg font-bold">후속조치</h2><table className="mt-3 w-full border-collapse text-sm"><thead><tr><th className="border bg-gray-100 p-2">내용</th><th className="w-28 border bg-gray-100 p-2">담당</th><th className="w-28 border bg-gray-100 p-2">기한</th><th className="w-20 border bg-gray-100 p-2">상태</th></tr></thead><tbody>{actionsResult.data?.length ? actionsResult.data.map((action) => <tr key={`${action.content}-${action.due_date}`}><td className="border p-2">{action.content}</td><td className="border p-2 text-center">{action.assignee_user_id ? userMap.get(action.assignee_user_id) ?? "-" : "-"}</td><td className="border p-2 text-center">{formatDate(action.due_date)}</td><td className="border p-2 text-center">{action.status}</td></tr>) : <tr><td className="border p-6 text-center" colSpan={4}>후속조치 없음</td></tr>}</tbody></table></section><p className="mt-10 text-center text-xs text-gray-500">본 문서는 협의 결과 확인용 요약본이야.</p></main>;
}
