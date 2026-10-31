"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Download, History, Printer } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatWon } from "@/lib/format";
import { latestQuotesByVendor, quoteItemNames, vatIncludedAmount, type QuoteComparisonRow } from "@/lib/quotes";
import { cn } from "@/lib/utils";

const SelectionDialog = dynamic(
  () => import("@/components/projects/selection-dialog").then((module) => module.SelectionDialog),
  { ssr: false },
);

function exportDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).replaceAll("-", "");
}

export function QuoteComparison({
  projectId,
  projectTitle,
  quotes,
  participants,
  canSelect,
  showActions = true,
}: {
  projectId: string;
  projectTitle: string;
  quotes: QuoteComparisonRow[];
  participants: { id: string; name: string }[];
  canSelect: boolean;
  showActions?: boolean;
}) {
  const [exporting, startExport] = useTransition();
  const latest = latestQuotesByVendor(quotes);
  const itemNames = quoteItemNames(latest);
  const lowestTotal = latest.length ? Math.min(...latest.map(vatIncludedAmount)) : null;
  const durations = latest.map((quote) => quote.durationDays).filter((value): value is number => value != null);
  const shortestDuration = durations.length ? Math.min(...durations) : null;

  function exportExcel() {
    startExport(async () => {
      try {
        const XLSX = await import("xlsx");
        const rows: (string | number)[][] = [
          ["구분", ...latest.map((quote) => `${quote.vendorName} (v${quote.version})`)],
          ["부가세 포함 총액", ...latest.map((quote) => vatIncludedAmount(quote))],
          ["기간(일)", ...latest.map((quote) => quote.durationDays ?? "-")],
          ["하자보증(개월)", ...latest.map((quote) => quote.warrantyMonths ?? "-")],
          ["지급조건", ...latest.map((quote) => quote.paymentTerms ?? "-")],
          ...itemNames.map((name) => [name, ...latest.map((quote) => quote.items.find((item) => item.name === name)?.amount ?? "-")]),
        ];
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet["!cols"] = [{ wch: 22 }, ...latest.map(() => ({ wch: 22 }))];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "견적비교");
        XLSX.writeFile(workbook, `견적비교_${projectTitle}_${exportDate()}.xlsx`);
        toast.success("견적 비교표를 엑셀로 만들었어.");
      } catch {
        toast.error("엑셀 파일을 만들지 못했어.");
      }
    });
  }

  if (!latest.length) return <Card className="border-dashed"><CardContent className="flex min-h-44 flex-col items-center justify-center text-center"><p className="font-medium">등록된 견적이 없어.</p><p className="mt-1 text-sm text-muted-foreground">참여 업체의 첫 견적을 등록하면 비교표가 만들어져.</p></CardContent></Card>;

  return <div className="space-y-4">
    {showActions ? <div className="flex flex-wrap justify-end gap-2">{canSelect ? <SelectionDialog projectId={projectId} vendors={participants} /> : null}<Button disabled={exporting} variant="outline" onClick={exportExcel}><Download />{exporting ? "생성 중" : "엑셀 내보내기"}</Button><Button asChild variant="outline"><Link href={`/projects/${projectId}/print/quotes`} target="_blank"><Printer />인쇄용 비교표</Link></Button></div> : null}
    <Card className="py-0"><Table className="min-w-[760px] text-center"><TableHeader><TableRow><TableHead className="sticky left-0 z-10 bg-card text-center">비교 항목</TableHead>{latest.map((quote) => <TableHead key={quote.id} className="text-center"><Link className="font-bold hover:underline" href={`/vendors/${quote.vendorId}`}>{quote.vendorName}</Link><p className="mt-1 text-xs font-normal text-muted-foreground">v{quote.version} · {formatDate(quote.receivedAt)}</p></TableHead>)}</TableRow></TableHeader><TableBody>
      <TableRow><TableCell className="sticky left-0 bg-card font-semibold">총액<br /><span className="text-xs text-muted-foreground">부가세 포함 환산</span></TableCell>{latest.map((quote) => { const total = vatIncludedAmount(quote); return <TableCell key={quote.id} className={cn("text-center font-bold", total === lowestTotal && "bg-emerald-50 text-emerald-800")}><div>{formatWon(total)}</div>{total === lowestTotal ? <Badge className="mt-1 bg-emerald-600">최저</Badge> : null}<p className="mt-1 text-xs font-normal text-muted-foreground">{quote.vatIncluded ? "포함 견적" : "별도 견적 × 1.1"}</p></TableCell>; })}</TableRow>
      <TableRow><TableCell className="sticky left-0 bg-card font-semibold">기간</TableCell>{latest.map((quote) => <TableCell key={quote.id} className={cn("text-center", quote.durationDays === shortestDuration && "bg-blue-50 font-bold text-blue-800")}>{quote.durationDays != null ? `${quote.durationDays}일` : "-"}{quote.durationDays === shortestDuration ? <Badge className="ml-2 bg-blue-600">최단</Badge> : null}</TableCell>)}</TableRow>
      <TableRow><TableCell className="sticky left-0 bg-card font-semibold">하자보증</TableCell>{latest.map((quote) => <TableCell key={quote.id} className="text-center">{quote.warrantyMonths != null ? `${quote.warrantyMonths}개월` : "-"}</TableCell>)}</TableRow>
      <TableRow><TableCell className="sticky left-0 bg-card font-semibold">지급조건</TableCell>{latest.map((quote) => <TableCell key={quote.id} className="max-w-60 whitespace-normal text-center">{quote.paymentTerms ?? "-"}</TableCell>)}</TableRow>
      {itemNames.map((name) => <TableRow key={name}><TableCell className="sticky left-0 bg-card font-medium">{name}</TableCell>{latest.map((quote) => <TableCell key={quote.id} className="text-center">{quote.items.find((item) => item.name === name) ? formatWon(quote.items.find((item) => item.name === name)!.amount) : "-"}</TableCell>)}</TableRow>)}
    </TableBody></Table></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" />버전 이력</CardTitle></CardHeader><CardContent className="space-y-2">{participants.map((vendor) => { const versions = quotes.filter((quote) => quote.vendorId === vendor.id).sort((a, b) => b.version - a.version); if (!versions.length) return null; return <details key={vendor.id} className="rounded-lg border p-3"><summary className="cursor-pointer font-medium">{vendor.name} · {versions.length}개 버전</summary><div className="mt-3 space-y-2">{versions.map((quote, index) => { const previous = versions[index + 1]; const change = previous ? vatIncludedAmount(quote) - vatIncludedAmount(previous) : null; return <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-2 text-sm"><span>v{quote.version} · {formatDate(quote.receivedAt)}</span><span className="font-medium">{formatWon(vatIncludedAmount(quote))}{change != null ? <span className={cn("ml-2 text-xs", change > 0 ? "text-red-600" : change < 0 ? "text-blue-600" : "text-muted-foreground")}>{change > 0 ? "+" : ""}{formatWon(change)}</span> : null}</span></div>; })}</div></details>; })}</CardContent></Card>
  </div>;
}
