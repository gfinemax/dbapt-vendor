import { TableProperties } from "lucide-react";
import Link from "next/link";

import { QuoteComparison } from "@/components/projects/quote-comparison";
import { Card, CardContent } from "@/components/ui/card";
import { parseQuoteItems, type QuoteComparisonRow } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectQuery = safeView
    ? supabase.from("projects_public").select("id,title").order("created_at", { ascending: false })
    : supabase.from("projects").select("id,title").is("deleted_at", null).order("created_at", { ascending: false });
  const [{ data: projects }, { data: quotes }] = await Promise.all([
    projectQuery,
    supabase.from("quotes").select("*").is("deleted_at", null).order("received_at", { ascending: false }),
  ]);
  const vendorIds = [...new Set((quotes ?? []).map((quote) => quote.vendor_id))];
  const vendorQuery = safeView
    ? supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const { data: vendors } = await vendorQuery;
  const vendorMap = new Map((vendors ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const allQuotes: QuoteComparisonRow[] = (quotes ?? []).flatMap((quote) => {
    const vendorName = vendorMap.get(quote.vendor_id);
    return vendorName ? [{ id: quote.id, projectId: quote.project_id, vendorId: quote.vendor_id, vendorName, version: quote.version, receivedAt: quote.received_at, amount: quote.amount, vatIncluded: quote.vat_included, durationDays: quote.duration_days, warrantyMonths: quote.warranty_months, paymentTerms: quote.payment_terms, items: parseQuoteItems(quote.items), note: quote.note }] : [];
  });
  const groups = (projects ?? []).flatMap((project) => {
    if (!project.id || !project.title) return [];
    const projectQuotes = allQuotes.filter((quote) => quote.projectId === project.id);
    return projectQuotes.length ? [{ id: project.id, title: project.title, quotes: projectQuotes }] : [];
  });

  return <section className="mx-auto max-w-7xl space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">견적 비교</h1><p className="mt-1 text-sm text-muted-foreground">용역 건별 최신 견적과 버전 변화를 비교해.</p></div>{groups.length ? groups.map((group) => <section key={group.id} className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{group.title}</h2><Link className="text-sm text-muted-foreground hover:underline" href={`/projects/${group.id}?tab=quotes`}>용역 상세에서 관리 →</Link></div><QuoteComparison canSelect={false} participants={[...new Map(group.quotes.map((quote) => [quote.vendorId, { id: quote.vendorId, name: quote.vendorName }])).values()]} projectId={group.id} projectTitle={group.title} quotes={group.quotes} showActions={false} /></section>) : <Card className="border-dashed"><CardContent className="flex min-h-56 flex-col items-center justify-center text-center"><TableProperties className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">등록된 견적이 없어.</p><p className="mt-1 text-sm text-muted-foreground">용역 상세에서 첫 견적을 등록해 줘.</p></CardContent></Card>}</section>;
}
