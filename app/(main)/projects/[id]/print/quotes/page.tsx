import { notFound } from "next/navigation";

import { formatDate, formatWon } from "@/lib/format";
import { latestQuotesByVendor, parseQuoteItems, quoteItemNames, vatIncludedAmount, type QuoteComparisonRow } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectQuery = safeView
    ? supabase.from("projects_public").select("id,title,category,budget,board_resolution").eq("id", id).maybeSingle()
    : supabase.from("projects").select("id,title,category,budget,board_resolution").eq("id", id).is("deleted_at", null).maybeSingle();
  const [{ data: project }, { data: quoteRows }] = await Promise.all([
    projectQuery,
    supabase.from("quotes").select("*").eq("project_id", id).is("deleted_at", null),
  ]);
  if (!project?.id || !project.title) notFound();
  const vendorIds = [...new Set((quoteRows ?? []).map((quote) => quote.vendor_id))];
  const vendorQuery = safeView
    ? supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const { data: vendors } = await vendorQuery;
  const vendorMap = new Map((vendors ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const quotes: QuoteComparisonRow[] = (quoteRows ?? []).flatMap((quote) => {
    const vendorName = vendorMap.get(quote.vendor_id);
    return vendorName ? [{ id: quote.id, projectId: quote.project_id, vendorId: quote.vendor_id, vendorName, version: quote.version, receivedAt: quote.received_at, amount: quote.amount, vatIncluded: quote.vat_included, durationDays: quote.duration_days, warrantyMonths: quote.warranty_months, paymentTerms: quote.payment_terms, items: parseQuoteItems(quote.items), note: quote.note }] : [];
  });
  const latest = latestQuotesByVendor(quotes);
  const itemNames = quoteItemNames(latest);

  return <main className="print-page mx-auto max-w-[210mm] bg-white p-8 text-black"><header className="mb-6 border-b-2 border-black pb-4 text-center"><p className="text-sm">대방동지역주택조합</p><h1 className="mt-2 text-2xl font-bold">용역 견적 비교표</h1><p className="mt-2 text-sm">{project.title} · {project.category ?? "-"}</p></header><section className="mb-4 grid grid-cols-2 gap-4 text-sm"><div><span className="font-semibold">예산:</span> {project.budget != null ? formatWon(project.budget) : "-"}</div><div className="text-right"><span className="font-semibold">이사회 의결:</span> {project.board_resolution ?? "미입력"}</div></section><table className="w-full table-fixed border-collapse text-center text-[11px]"><thead><tr><th className="border border-black bg-slate-100 p-2">비교 항목</th>{latest.map((quote) => <th key={quote.id} className="border border-black bg-slate-100 p-2">{quote.vendorName}<br /><span className="font-normal">v{quote.version} · {formatDate(quote.receivedAt)}</span></th>)}</tr></thead><tbody><tr><th className="border border-black p-2">부가세 포함 총액</th>{latest.map((quote) => <td key={quote.id} className="border border-black p-2 font-bold">{formatWon(vatIncludedAmount(quote))}</td>)}</tr><tr><th className="border border-black p-2">기간</th>{latest.map((quote) => <td key={quote.id} className="border border-black p-2">{quote.durationDays != null ? `${quote.durationDays}일` : "-"}</td>)}</tr><tr><th className="border border-black p-2">하자보증</th>{latest.map((quote) => <td key={quote.id} className="border border-black p-2">{quote.warrantyMonths != null ? `${quote.warrantyMonths}개월` : "-"}</td>)}</tr><tr><th className="border border-black p-2">지급조건</th>{latest.map((quote) => <td key={quote.id} className="border border-black p-2">{quote.paymentTerms ?? "-"}</td>)}</tr>{itemNames.map((name) => <tr key={name}><th className="border border-black p-2">{name}</th>{latest.map((quote) => <td key={quote.id} className="border border-black p-2">{quote.items.find((item) => item.name === name) ? formatWon(quote.items.find((item) => item.name === name)!.amount) : "-"}</td>)}</tr>)}</tbody></table><footer className="mt-8 flex justify-between text-xs"><span>※ 각 업체의 최신 견적 기준</span><span>출력일 {formatDate(new Date())}</span></footer></main>;
}
