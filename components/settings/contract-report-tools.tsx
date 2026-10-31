"use client";

import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ContractReportRow } from "@/lib/contract-report";

export function ContractReportTools({ rows }: { rows: ContractReportRow[] }) {
  const [pending, startTransition] = useTransition();
  return <div className="flex gap-2"><Button disabled={pending} variant="outline" onClick={() => startTransition(async () => { try { const XLSX = await import("xlsx"); const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ 분야: row.category, 용역명: row.projectTitle, 업체: row.vendorName, 계약일: row.signedAt, 계약금액: row.total, 지급액: row.paid, 잔액: row.balance, 정산상태: row.settlementStatus, 진행단계: row.stage }))); sheet["!cols"] = [12, 24, 20, 14, 16, 16, 16, 12, 12].map((wch) => ({ wch })); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "용역계약현황"); XLSX.writeFile(workbook, `용역계약현황_${new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replaceAll("-", "")}.xlsx`); toast.success("계약 현황 엑셀을 만들었어."); } catch { toast.error("엑셀 파일을 만들지 못했어."); } })}><Download />{pending ? "생성 중" : "엑셀"}</Button><Button asChild variant="outline"><Link href="/settings/reports/print" target="_blank"><Printer />인쇄</Link></Button></div>;
}
