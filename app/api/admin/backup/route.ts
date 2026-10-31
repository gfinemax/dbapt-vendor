import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function serializableRows(rows: Record<string, unknown>[]) { return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value && typeof value === "object" ? JSON.stringify(value) : value]))); }

export async function GET() {
  const supabase = await createClient(); const { data: role } = await supabase.rpc("current_role"); if (role !== "admin") return NextResponse.json({ error: "관리자 권한이 필요해." }, { status: 403 });
  const tableQueries = [
    ["users", supabase.from("users").select("*")], ["vendors", supabase.from("vendors").select("*")], ["vendor_contacts", supabase.from("vendor_contacts").select("*")], ["contact_logs", supabase.from("contact_logs").select("*")], ["projects", supabase.from("projects").select("*")], ["project_assignees", supabase.from("project_assignees").select("*")], ["project_vendors", supabase.from("project_vendors").select("*")], ["quotes", supabase.from("quotes").select("*")], ["contracts", supabase.from("contracts").select("*")], ["payment_schedules", supabase.from("payment_schedules").select("*")], ["guarantees", supabase.from("guarantees").select("*")], ["meetings", supabase.from("meetings").select("*")], ["action_items", supabase.from("action_items").select("*")], ["events", supabase.from("events").select("*")], ["documents", supabase.from("documents").select("*")], ["vendor_reviews", supabase.from("vendor_reviews").select("*")], ["audit_logs", supabase.from("audit_logs").select("*")], ["notification_logs", supabase.from("notification_logs").select("*")],
  ] as const;
  const results = await Promise.all(tableQueries.map(([, query]) => query));
  const failures = results.flatMap((result, index) => result.error ? [`${tableQueries[index][0]}: ${result.error.message}`] : []); if (failures.length) return NextResponse.json({ error: "백업 조회에 실패했어.", failures }, { status: 500 });
  const storageFiles: Record<string, unknown>[] = [];
  async function walk(path = ""): Promise<void> {
    const { data, error } = await supabase.storage.from("vendor-files").list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } }); if (error) throw error;
    for (const item of data ?? []) { const itemPath = path ? `${path}/${item.name}` : item.name; if (!item.metadata) await walk(itemPath); else storageFiles.push({ path: itemPath, name: item.name, id: item.id, created_at: item.created_at, updated_at: item.updated_at, size: item.metadata.size ?? null, mimetype: item.metadata.mimetype ?? null }); }
  }
  try { await walk(); } catch (error) { return NextResponse.json({ error: `Storage 목록을 읽지 못했어: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }, { status: 500 }); }
  const XLSX = await import("xlsx"); const workbook = XLSX.utils.book_new();
  results.forEach((result, index) => { const sheet = XLSX.utils.json_to_sheet(serializableRows((result.data ?? []) as Record<string, unknown>[])); XLSX.utils.book_append_sheet(workbook, sheet, tableQueries[index][0].slice(0, 31)); });
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(storageFiles), "storage_files");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Uint8Array; const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replaceAll("-", "");
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="dbapt-vendor-backup-${date}.xlsx"`, "Cache-Control": "private, no-store" } });
}
