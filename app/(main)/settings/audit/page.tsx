import { History, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function changedKeys(before: unknown, after: unknown) {
  const left = before && typeof before === "object" ? before as Record<string, unknown> : {};
  const right = after && typeof after === "object" ? after as Record<string, unknown> : {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]) && !["updated_at"].includes(key));
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; user?: string; action?: string; row?: string }> }) {
  const filters = await searchParams; const supabase = await createClient(); const { data: role } = await supabase.rpc("current_role"); if (role !== "admin") redirect("/dashboard");
  let query = supabase.from("audit_logs").select("*").is("deleted_at", null).order("at", { ascending: false }).limit(200);
  if (filters.table) query = query.eq("table_name", filters.table); if (filters.user) query = query.eq("user_id", filters.user); if (filters.action) query = query.eq("action", filters.action); if (filters.row) query = query.eq("row_id", filters.row);
  const [logsResult, usersResult] = await Promise.all([query, supabase.from("users").select("id,name,email").order("name")]);
  const userMap = new Map((usersResult.data ?? []).map((user) => [user.id, `${user.name} (${user.email})`]));
  const tableNames = ["users", "vendors", "vendor_contacts", "contact_logs", "projects", "project_assignees", "project_vendors", "quotes", "contracts", "payment_schedules", "guarantees", "meetings", "action_items", "events", "documents", "vendor_reviews", "notification_logs"];
  return <section className="space-y-6"><div><Link className="text-sm text-muted-foreground hover:underline" href="/settings">← 설정</Link><div className="mt-2 flex items-center gap-2"><History className="size-6" /><h1 className="text-2xl font-bold">변경 이력</h1></div><p className="mt-1 text-sm text-muted-foreground">업무 레코드의 생성·수정·삭제를 사용자와 시각 기준으로 확인해.</p></div><Card className="p-4"><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_220px_140px_1fr_auto]" method="get"><select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={filters.table ?? ""} name="table"><option value="">모든 테이블</option>{tableNames.map((name) => <option key={name} value={name}>{name}</option>)}</select><select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={filters.user ?? ""} name="user"><option value="">모든 사용자</option>{(usersResult.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={filters.action ?? ""} name="action"><option value="">모든 작업</option><option value="INSERT">생성</option><option value="UPDATE">수정</option><option value="DELETE">삭제</option></select><Input defaultValue={filters.row} name="row" placeholder="레코드 UUID" /><Button type="submit" variant="outline"><Search />조회</Button></form></Card><Card className="py-0"><div className="divide-y">{logsResult.data?.length ? logsResult.data.map((log) => { const keys = changedKeys(log.before, log.after); return <div key={log.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge>{log.action}</Badge><Badge variant="outline">{log.table_name}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(log.at)}</span><span className="text-xs text-muted-foreground">· {log.user_id ? userMap.get(log.user_id) ?? log.user_id : "시스템"}</span></div><p className="mt-2 text-sm"><code>{log.row_id}</code>{keys.length ? ` · 변경 필드: ${keys.join(", ")}` : ""}</p><details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">원본 JSON 보기</summary><div className="mt-2 grid gap-2 lg:grid-cols-2"><pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(log.before, null, 2)}</pre><pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(log.after, null, 2)}</pre></div></details></div>; }) : <div className="p-12 text-center text-muted-foreground">조건에 맞는 변경 이력이 없어.</div>}</div></Card></section>;
}
