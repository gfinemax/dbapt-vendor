import { ArchiveRestore } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TrashActions } from "@/components/settings/trash-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const supabase = await createClient(); const { data: role } = await supabase.rpc("current_role"); if (role !== "admin") redirect("/dashboard");
  const results = await Promise.all([
    supabase.from("vendors").select("id,name,deleted_at").not("deleted_at", "is", null),
    supabase.from("vendor_contacts").select("id,name,deleted_at").not("deleted_at", "is", null),
    supabase.from("contact_logs").select("id,summary,deleted_at").not("deleted_at", "is", null),
    supabase.from("projects").select("id,title,deleted_at").not("deleted_at", "is", null),
    supabase.from("quotes").select("id,version,deleted_at").not("deleted_at", "is", null),
    supabase.from("contracts").select("id,title,deleted_at").not("deleted_at", "is", null),
    supabase.from("payment_schedules").select("id,label,deleted_at").not("deleted_at", "is", null),
    supabase.from("guarantees").select("id,type,deleted_at").not("deleted_at", "is", null),
    supabase.from("meetings").select("id,agenda,deleted_at").not("deleted_at", "is", null),
    supabase.from("action_items").select("id,content,deleted_at").not("deleted_at", "is", null),
    supabase.from("events").select("id,title,deleted_at").not("deleted_at", "is", null),
    supabase.from("documents").select("id,file_name,deleted_at").not("deleted_at", "is", null),
  ]);
  const vendors = results[0].data ?? []; const contacts = results[1].data ?? []; const logs = results[2].data ?? []; const projects = results[3].data ?? []; const quotes = results[4].data ?? []; const contracts = results[5].data ?? []; const payments = results[6].data ?? []; const guarantees = results[7].data ?? []; const meetings = results[8].data ?? []; const actions = results[9].data ?? []; const events = results[10].data ?? []; const documents = results[11].data ?? [];
  const rows = [
    ...vendors.map((row) => ({ table: "vendors", type: "업체", id: row.id, label: row.name, deletedAt: row.deleted_at! })),
    ...contacts.map((row) => ({ table: "vendor_contacts", type: "업체 담당자", id: row.id, label: row.name, deletedAt: row.deleted_at! })),
    ...logs.map((row) => ({ table: "contact_logs", type: "연락 이력", id: row.id, label: row.summary, deletedAt: row.deleted_at! })),
    ...projects.map((row) => ({ table: "projects", type: "용역 건", id: row.id, label: row.title, deletedAt: row.deleted_at! })),
    ...quotes.map((row) => ({ table: "quotes", type: "견적", id: row.id, label: `견적 v${row.version}`, deletedAt: row.deleted_at! })),
    ...contracts.map((row) => ({ table: "contracts", type: "계약", id: row.id, label: row.title, deletedAt: row.deleted_at! })),
    ...payments.map((row) => ({ table: "payment_schedules", type: "지급 회차", id: row.id, label: row.label, deletedAt: row.deleted_at! })),
    ...guarantees.map((row) => ({ table: "guarantees", type: "보증", id: row.id, label: `${row.type}보증`, deletedAt: row.deleted_at! })),
    ...meetings.map((row) => ({ table: "meetings", type: "협의록", id: row.id, label: row.agenda, deletedAt: row.deleted_at! })),
    ...actions.map((row) => ({ table: "action_items", type: "후속조치", id: row.id, label: row.content, deletedAt: row.deleted_at! })),
    ...events.map((row) => ({ table: "events", type: "일정", id: row.id, label: row.title, deletedAt: row.deleted_at! })),
    ...documents.map((row) => ({ table: "documents", type: "문서", id: row.id, label: row.file_name, deletedAt: row.deleted_at! })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return <section className="space-y-6"><div><Link className="text-sm text-muted-foreground hover:underline" href="/settings">← 설정</Link><div className="mt-2 flex items-center gap-2"><ArchiveRestore className="size-6" /><h1 className="text-2xl font-bold">휴지통</h1></div><p className="mt-1 text-sm text-muted-foreground">소프트 삭제된 항목을 복원하거나 영구 삭제해.</p></div><Card className="py-0"><div className="divide-y">{rows.length ? rows.map((row) => <div key={`${row.table}-${row.id}`} className="grid gap-3 p-4 md:grid-cols-[1fr_180px_220px] md:items-center"><div><div className="flex items-center gap-2"><Badge variant="outline">{row.type}</Badge><p className="font-medium">{row.label}</p></div><p className="mt-1 text-xs text-muted-foreground">삭제 {formatDateTime(row.deletedAt)}</p></div><code className="truncate text-xs text-muted-foreground">{row.id}</code><TrashActions id={row.id} label={row.label} table={row.table} /></div>) : <div className="p-12 text-center text-muted-foreground"><ArchiveRestore className="mx-auto mb-2 size-8" />휴지통이 비어 있어.</div>}</div></Card></section>;
}
