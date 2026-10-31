import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ContractReportTools } from "@/components/settings/contract-report-tools";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getContractReportRows } from "@/lib/contract-report";
import { formatDate, formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ContractReportPage() {
  const supabase = await createClient(); const { data: role } = await supabase.rpc("current_role"); if (role !== "admin") redirect("/dashboard"); const rows = await getContractReportRows();
  const totals = rows.reduce((sum, row) => ({ total: sum.total + row.total, paid: sum.paid + row.paid, balance: sum.balance + row.balance }), { total: 0, paid: 0, balance: 0 });
  return <section className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Link className="text-sm text-muted-foreground hover:underline" href="/settings">← 설정</Link><div className="mt-2 flex items-center gap-2"><ClipboardList className="size-6" /><h1 className="text-2xl font-bold">용역 계약 현황표</h1></div><p className="mt-1 text-sm text-muted-foreground">총회·이사회 보고용 계약·지급·잔액 현황이야.</p></div><ContractReportTools rows={rows} /></div><Card className="py-0"><div className="overflow-x-auto"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead>분야</TableHead><TableHead>용역명</TableHead><TableHead>업체</TableHead><TableHead>계약일</TableHead><TableHead className="text-right">계약금액</TableHead><TableHead className="text-right">지급액</TableHead><TableHead className="text-right">잔액</TableHead><TableHead>정산상태</TableHead><TableHead>진행단계</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.category}</TableCell><TableCell><Link className="font-medium hover:underline" href={`/contracts/${row.id}`}>{row.projectTitle}</Link></TableCell><TableCell>{row.vendorName}</TableCell><TableCell>{formatDate(row.signedAt)}</TableCell><TableCell className="text-right">{formatWon(row.total)}</TableCell><TableCell className="text-right">{formatWon(row.paid)}</TableCell><TableCell className="text-right">{formatWon(row.balance)}</TableCell><TableCell>{row.settlementStatus}</TableCell><TableCell>{row.stage}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell colSpan={4}>합계</TableCell><TableCell className="text-right">{formatWon(totals.total)}</TableCell><TableCell className="text-right">{formatWon(totals.paid)}</TableCell><TableCell className="text-right">{formatWon(totals.balance)}</TableCell><TableCell colSpan={2} /></TableRow></TableBody></Table></div></Card></section>;
}
