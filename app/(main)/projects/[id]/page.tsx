import { notFound } from "next/navigation";

import { ProjectDetail, type ProjectDetailProps } from "@/components/projects/project-detail";
import { parseQuoteItems } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectQuery = safeView
    ? supabase.from("projects_public").select("*").eq("id", id).maybeSingle()
    : supabase.from("projects").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  const { data: project, error } = await projectQuery;
  if (
    error ||
    !project?.id ||
    !project.title ||
    !project.category ||
    project.budget == null ||
    !project.stage
  )
    notFound();

  const [
    linksResult,
    quotesResult,
    contractsResult,
    meetingsResult,
    eventsResult,
    documentsResult,
    usersResult,
    businessProjectResult,
    internalNoteResult,
  ] = await Promise.all([
    supabase
      .from("project_vendors")
      .select("vendor_id,role")
      .eq("project_id", id)
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select("*")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("version", { ascending: false }),
    supabase
      .from("contracts")
      .select("id,vendor_id,title,signed_at,amount,vat")
      .eq("project_id", id)
      .is("parent_contract_id", null)
      .is("deleted_at", null)
      .order("signed_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("id,vendor_id,held_at,method,agenda")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("held_at", { ascending: false }),
    supabase
      .from("events")
      .select("id,type,title,date,status")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("date"),
    supabase
      .from("documents")
      .select("id,kind,file_name,mime_type,file_size,version,created_at")
      .eq("owner_type", "project")
      .eq("owner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("id,name").is("deleted_at", null),
    supabase
      .from("business_projects")
      .select("id,title")
      .eq("id", project.business_project_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("project_internal_notes")
      .select("content")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const vendorIds = [
    ...new Set([
      ...(linksResult.data ?? []).map((link) => link.vendor_id),
      ...(quotesResult.data ?? []).map((quote) => quote.vendor_id),
      ...(contractsResult.data ?? []).map((contract) => contract.vendor_id),
      ...(meetingsResult.data ?? []).flatMap((meeting) =>
        meeting.vendor_id ? [meeting.vendor_id] : [],
      ),
    ]),
  ];
  const vendorQuery = safeView
    ? supabase
        .from("vendors_public")
        .select("id,name")
        .in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase
        .from("vendors")
        .select("id,name")
        .in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
        .is("deleted_at", null);
  const { data: vendorRows } = await vendorQuery;
  const vendorMap = new Map(
    (vendorRows ?? []).flatMap((vendor) =>
      vendor.id && vendor.name ? [[vendor.id, vendor.name]] : [],
    ),
  );
  const { data: appliedAnalyses } = await supabase
    .from("document_analyses")
    .select("document_id")
    .eq("applied_project_id", id)
    .is("deleted_at", null);
  const appliedDocumentIds = (appliedAnalyses ?? []).map((analysis) => analysis.document_id);
  const { data: appliedDocuments } = appliedDocumentIds.length
    ? await supabase
        .from("documents")
        .select("id,kind,file_name,mime_type,file_size,version,created_at")
        .in("id", appliedDocumentIds)
        .is("deleted_at", null)
    : { data: [] };
  const documentMap = new Map(
    [...(documentsResult.data ?? []), ...(appliedDocuments ?? [])].map((document) => [document.id, document]),
  );
  const allDocuments = [...documentMap.values()];
  const { data: documentAnalyses } = allDocuments.length
    ? await supabase
        .from("document_analyses")
        .select("document_id,status,summary,error_message,extracted_data")
        .in("document_id", allDocuments.map((document) => document.id))
        .is("deleted_at", null)
    : { data: [] };
  const documentAnalysisMap = new Map(
    (documentAnalyses ?? []).map((analysis) => [analysis.document_id, analysis]),
  );
  const ownerMap = new Map((usersResult.data ?? []).map((user) => [user.id, user.name]));
  const internalNote = safeView ? undefined : (internalNoteResult.data?.content ?? "");

  const props: ProjectDetailProps = {
    project: {
      id: project.id,
      title: project.title,
      category: project.category,
      description: project.description,
      budget: project.budget,
      stage: project.stage,
      businessProjectId: project.business_project_id,
      businessProjectTitle: businessProjectResult.data?.title ?? "프로젝트",
      ownerName: project.owner_user_id ? (ownerMap.get(project.owner_user_id) ?? null) : null,
      boardResolution: project.board_resolution,
      selectedVendorId: project.selected_vendor_id,
      selectedVendorName: project.selected_vendor_id
        ? (vendorMap.get(project.selected_vendor_id) ?? null)
        : null,
      selectionReason: project.selection_reason,
      internalNote,
    },
    participants: (linksResult.data ?? []).flatMap((link) => {
      const name = vendorMap.get(link.vendor_id);
      return name ? [{ id: link.vendor_id, name, role: link.role }] : [];
    }),
    quotes: (quotesResult.data ?? []).flatMap((quote) => {
      const vendorName = vendorMap.get(quote.vendor_id);
      return vendorName
        ? [
            {
              id: quote.id,
              projectId: quote.project_id,
              vendorId: quote.vendor_id,
              vendorName,
              version: quote.version,
              receivedAt: quote.received_at,
              amount: quote.amount,
              vatIncluded: quote.vat_included,
              durationDays: quote.duration_days,
              warrantyMonths: quote.warranty_months,
              paymentTerms: quote.payment_terms,
              items: parseQuoteItems(quote.items),
              note: quote.note,
            },
          ]
        : [];
    }),
    contracts: (contractsResult.data ?? []).map((contract) => ({
      id: contract.id,
      title: contract.title,
      vendorId: contract.vendor_id,
      vendorName: vendorMap.get(contract.vendor_id) ?? "업체",
      signedAt: contract.signed_at,
      amount: contract.amount,
      vat: contract.vat,
    })),
    meetings: (meetingsResult.data ?? []).map((meeting) => ({
      id: meeting.id,
      heldAt: meeting.held_at,
      method: meeting.method,
      agenda: meeting.agenda,
      vendorName: meeting.vendor_id ? (vendorMap.get(meeting.vendor_id) ?? null) : null,
    })),
    events: eventsResult.data ?? [],
    documents: allDocuments.map((document) => ({
      id: document.id,
      kind: document.kind,
      fileName: document.file_name,
      mimeType: document.mime_type,
      fileSize: document.file_size,
      version: document.version,
      createdAt: document.created_at,
      analysisStatus: documentAnalysisMap.get(document.id)?.status ?? null,
      analysisSummary: documentAnalysisMap.get(document.id)?.summary ?? null,
      analysisError: documentAnalysisMap.get(document.id)?.error_message ?? null,
      extractedData: documentAnalysisMap.get(document.id)?.extracted_data ?? null,
    })),
    canCreateQuote: role === "admin" || role === "staff" || role === "agent",
    canManageContracts: role === "admin" || role === "staff" || role === "agent",
    contractDraftOnly: role === "agent",
    canManageMeetings: role === "admin" || role === "staff" || role === "agent",
    meetingUsers: usersResult.data ?? [],
    canSelect: role === "admin" || role === "staff",
    canManageDocuments: role === "admin" || role === "staff" || role === "agent",
    defaultTab: query.tab ?? "overview",
  };
  return <ProjectDetail {...props} />;
}
