import { redirect } from "next/navigation";

import { getContractReportRows } from "@/lib/contract-report";
import { formatDate, formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ContractReportPrintPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  if (role !== "admin") redirect("/dashboard");
  const rows = await getContractReportRows();
  const totals = rows.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      paid: sum.paid + row.paid,
      balance: sum.balance + row.balance,
    }),
    { total: 0, paid: 0, balance: 0 },
  );
  return (
    <main className="print-page report-landscape mx-auto max-w-[297mm] bg-white p-6 text-black">
      <header className="mb-6 text-center">
        <p className="text-sm">대방동지역주택조합</p>
        <h1 className="text-2xl font-bold">용역 계약 현황표</h1>
        <p className="mt-1 text-xs">출력일 {formatDate(new Date())}</p>
      </header>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-1.5">분야</th>
            <th className="border p-1.5">용역명</th>
            <th className="border p-1.5">업체</th>
            <th className="border p-1.5">계약일</th>
            <th className="border p-1.5">계약금액</th>
            <th className="border p-1.5">지급액</th>
            <th className="border p-1.5">잔액</th>
            <th className="border p-1.5">정산</th>
            <th className="border p-1.5">단계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border p-1.5">{row.category}</td>
              <td className="border p-1.5">{row.projectTitle}</td>
              <td className="border p-1.5">{row.vendorName}</td>
              <td className="border p-1.5 text-center">
                {formatDate(row.signedAt)}
              </td>
              <td className="border p-1.5 text-right">
                {formatWon(row.total)}
              </td>
              <td className="border p-1.5 text-right">{formatWon(row.paid)}</td>
              <td className="border p-1.5 text-right">
                {formatWon(row.balance)}
              </td>
              <td className="border p-1.5 text-center">
                {row.settlementStatus}
              </td>
              <td className="border p-1.5 text-center">{row.stage}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border p-1.5" colSpan={4}>
              합계
            </td>
            <td className="border p-1.5 text-right">
              {formatWon(totals.total)}
            </td>
            <td className="border p-1.5 text-right">
              {formatWon(totals.paid)}
            </td>
            <td className="border p-1.5 text-right">
              {formatWon(totals.balance)}
            </td>
            <td className="border p-1.5" colSpan={2} />
          </tr>
        </tbody>
      </table>
    </main>
  );
}
