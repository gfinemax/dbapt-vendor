import { notFound } from "next/navigation";

import { ProjectDetail, type ProjectDetailProps } from "@/components/projects/project-detail";
import { parseQuoteItems } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectQuery = safeView
    ? supabase.from("projects_public").select("*").eq("id", id).maybeSingle()
    : supabase.from("projects").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  const { data: project, error } = await projectQuery;
  if (error || !project?.id || !project.title || !project.category || project.budget == null || !project.stage) notFound();

  const [linksResult, quotesResult, contractsResult, meetingsResult, eventsResult, documentsResult, usersResult] = await Promise.all([
    supabase.from("project_vendors").select("vendor_id,role").eq("project_id", id).is("deleted_at", null),
    supabase.from("quotes").select("*").eq("project_id", id).is("deleted_at", null).order("version", { ascending: false }),
    supabase.from("contracts").select("id,vendor_id,title,signed_at,amount,vat").eq("project_id", id).is("deleted_at", null).order("signed_at", { ascending: false }),
    supabase.from("meetings").select("id,vendor_id,held_at,method,agenda").eq("project_id", id).is("deleted_at", null).order("held_at", { ascending: false }),
    supabase.from("events").select("id,type,title,date,status").eq("project_id", id).is("deleted_at", null).order("date"),
    supabase.from("documents").select("id,kind,file_name,version,created_at").eq("owner_type", "project").eq("owner_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("users").select("id,name").is("deleted_at", null),
  ]);
  const vendorIds = [...new Set([
    ...(linksResult.data ?? []).map((link) => link.vendor_id),
    ...(quotesResult.data ?? []).map((quote) => quote.vendor_id),
    ...(contractsResult.data ?? []).map((contract) => contract.vendor_id),
    ...(meetingsResult.data ?? []).flatMap((meeting) => meeting.vendor_id ? [meeting.vendor_id] : []),
  ])];
  const vendorQuery = safeView
    ? supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const { data: vendorRows } = await vendorQuery;
  const vendorMap = new Map((vendorRows ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const ownerMap = new Map((usersResult.data ?? []).map((user) => [user.id, user.name]));
  const internalNote = safeView ? undefined : typeof (project as unknown as { internal_note?: unknown }).internal_note === "string" ? (project as unknown as { internal_note: string }).internal_note : "";

  const props: ProjectDetailProps = {
    project: {
      id: project.id, title: project.title, category: project.category, description: project.description, budget: project.budget, stage: project.stage,
      ownerName: project.owner_user_id ? ownerMap.get(project.owner_user_id) ?? null : null,
      boardResolution: project.board_resolution, selectedVendorName: project.selected_vendor_id ? vendorMap.get(project.selected_vendor_id) ?? null : null,
      selectionReason: project.selection_reason, internalNote,
    },
    participants: (linksResult.data ?? []).flatMap((link) => { const name = vendorMap.get(link.vendor_id); return name ? [{ id: link.vendor_id, name, role: link.role }] : []; }),
    quotes: (quotesResult.data ?? []).flatMap((quote) => { const vendorName = vendorMap.get(quote.vendor_id); return vendorName ? [{ id: quote.id, projectId: quote.project_id, vendorId: quote.vendor_id, vendorName, version: quote.version, receivedAt: quote.received_at, amount: quote.amount, vatIncluded: quote.vat_included, durationDays: quote.duration_days, warrantyMonths: quote.warranty_months, paymentTerms: quote.payment_terms, items: parseQuoteItems(quote.items), note: quote.note }] : []; }),
    contracts: (contractsResult.data ?? []).map((contract) => ({ id: contract.id, title: contract.title, vendorName: vendorMap.get(contract.vendor_id) ?? "업체", signedAt: contract.signed_at, amount: contract.amount, vat: contract.vat })),
    meetings: (meetingsResult.data ?? []).map((meeting) => ({ id: meeting.id, heldAt: meeting.held_at, method: meeting.method, agenda: meeting.agenda, vendorName: meeting.vendor_id ? vendorMap.get(meeting.vendor_id) ?? null : null })),
    events: eventsResult.data ?? [],
    documents: (documentsResult.data ?? []).map((document) => ({ id: document.id, kind: document.kind, fileName: document.file_name, version: document.version, createdAt: document.created_at })),
    canCreateQuote: role === "admin" || role === "staff" || role === "agent",
    canSelect: role === "admin" || role === "executive",
    defaultTab: query.tab ?? "overview",
  };
  return <ProjectDetail {...props} />;
}
