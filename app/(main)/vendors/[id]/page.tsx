import { notFound } from "next/navigation";

import { VendorDetail, type VendorDetailProps } from "@/components/vendors/vendor-detail";
import { getGoogleContactsMissingConfig } from "@/lib/google/contacts";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getKstDateParts() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [date, time] = parts.split(" ");
  return { date, dateTime: `${date}T${time}` };
}

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const allowedTabs = ["basic", "contacts", "projects", "documents", "logs", "reviews"] as const;
  const defaultTab = allowedTabs.find((value) => value === tab) ?? "basic";
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const vendorQuery = safeView
    ? supabase.from("vendors_public").select("*").eq("id", id).maybeSingle()
    : supabase.from("vendors").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  const { data: vendor, error: vendorError } = await vendorQuery;

  if (vendorError || !vendor?.id || !vendor.name || !vendor.status) notFound();

  const [
    contactsResult,
    linksResult,
    documentsResult,
    logsResult,
    reviewsResult,
    quotesResult,
    contractsResult,
    meetingsResult,
    financialResult,
    internalNoteResult,
  ] = await Promise.all([
    supabase
      .from("vendor_contacts")
      .select("*")
      .eq("vendor_id", id)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("project_vendors")
      .select("project_id,role")
      .eq("vendor_id", id)
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("id,kind,file_name,mime_type,file_size,version,valid_until,created_at,document_analyses(status,progress_step,summary,error_message,extracted_data,updated_at)")
      .eq("owner_type", "vendor")
      .eq("owner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_logs")
      .select("id,contact_id,method,at,summary")
      .eq("vendor_id", id)
      .is("deleted_at", null)
      .order("at", { ascending: false }),
    supabase
      .from("vendor_reviews")
      .select("id,project_id,quality,schedule,communication,comment,created_at")
      .eq("vendor_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotes")
      .select("id,project_id,received_at,amount,version")
      .eq("vendor_id", id)
      .is("deleted_at", null),
    supabase
      .from("contracts")
      .select("id,project_id,title,signed_at,amount,vat")
      .eq("vendor_id", id)
      .is("parent_contract_id", null)
      .is("deleted_at", null),
    supabase
      .from("meetings")
      .select("id,project_id,held_at,agenda,method")
      .eq("vendor_id", id)
      .is("deleted_at", null),
    supabase
      .from("vendor_financial_details")
      .select("bank_name,bank_account")
      .eq("vendor_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("vendor_internal_notes")
      .select("content")
      .eq("vendor_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const projectIds = [
    ...new Set([
      ...(linksResult.data ?? []).map((link) => link.project_id),
      ...(reviewsResult.data ?? []).map((review) => review.project_id),
      ...(quotesResult.data ?? []).map((quote) => quote.project_id),
      ...(contractsResult.data ?? []).map((contract) => contract.project_id),
      ...(meetingsResult.data ?? []).map((meeting) => meeting.project_id),
    ]),
  ];

  const projectQuery = safeView
    ? supabase
        .from("projects_public")
        .select("id,title,category,stage")
        .in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase
        .from("projects")
        .select("id,title,category,stage")
        .in("id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
        .is("deleted_at", null);
  const [{ data: projectRows }, { data: eventRows }] = await Promise.all([
    projectQuery,
    supabase
      .from("events")
      .select("id,project_id,type,title,date,status")
      .in("project_id", projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"])
      .is("deleted_at", null),
  ]);

  const projectMap = new Map(
    (projectRows ?? []).flatMap((project) =>
      project.id && project.title ? [[project.id, project]] : [],
    ),
  );
  const contactMap = new Map(
    (contactsResult.data ?? []).map((contact) => [contact.id, contact.name]),
  );
  const primaryContact =
    (contactsResult.data ?? []).find((contact) => contact.active && contact.is_primary) ??
    (contactsResult.data ?? []).find((contact) => contact.active);
  const contactIds = (contactsResult.data ?? []).map((contact) => contact.id);
  const [googleConnectionResult, googleSyncsResult] = role === "admin"
    ? await Promise.all([
        supabase.from("google_contact_connections").select("id").is("deleted_at", null).maybeSingle(),
        supabase
          .from("google_contact_syncs")
          .select("vendor_contact_id,google_resource_name,last_synced_at")
          .in("vendor_contact_id", contactIds.length ? contactIds : ["00000000-0000-0000-0000-000000000000"])
          .is("deleted_at", null),
      ])
    : [{ data: null }, { data: [] }];
  const timeline: VendorDetailProps["timeline"] = [
    ...(quotesResult.data ?? []).map((quote) => ({
      id: `quote-${quote.id}`,
      kind: "견적",
      title: `${projectMap.get(quote.project_id)?.title ?? "용역"} 견적 v${quote.version}`,
      date: quote.received_at,
      description: `${Number(quote.amount).toLocaleString("ko-KR")}원`,
      href: `/projects/${quote.project_id}`,
    })),
    ...(contractsResult.data ?? []).map((contract) => ({
      id: `contract-${contract.id}`,
      kind: "계약",
      title: contract.title,
      date: contract.signed_at,
      description: `${Number(contract.amount + contract.vat).toLocaleString("ko-KR")}원`,
      href: "/contracts",
    })),
    ...(meetingsResult.data ?? []).map((meeting) => ({
      id: `meeting-${meeting.id}`,
      kind: "협의",
      title: meeting.agenda,
      date: meeting.held_at,
      description: meeting.method,
      href: `/meetings/${meeting.id}`,
    })),
    ...(eventRows ?? []).map((event) => ({
      id: `event-${event.id}`,
      kind: "일정",
      title: event.title,
      date: event.date,
      description: `${event.type} · ${event.status}`,
      href: "/schedule",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const kst = getKstDateParts();
  const detailVendor: VendorDetailProps["vendor"] = {
    id: vendor.id,
    name: vendor.name,
    biz_no: vendor.biz_no ?? "",
    ceo: vendor.ceo ?? "",
    phone: vendor.phone ?? "",
    address: vendor.address ?? "",
    category: vendor.category ?? "",
    homepage: vendor.homepage ?? "",
    bank_name: financialResult.data?.bank_name ?? "",
    bank_account: financialResult.data?.bank_account ?? "",
    related_person: vendor.related_person ?? "",
    related_person_phone: vendor.related_person_phone ?? "",
    primary_contact_name: primaryContact?.name ?? "",
    primary_contact_phone: primaryContact?.phone ?? "",
    status: vendor.status,
    memo: vendor.memo ?? "",
    internal_note: safeView ? undefined : (internalNoteResult.data?.content ?? ""),
  };

  return (
    <VendorDetail
      canManage={role === "admin" || role === "staff"}
      canImportGoogleContacts={role === "admin"}
      googleContactsConnected={Boolean(googleConnectionResult.data) && getGoogleContactsMissingConfig().length === 0}
      contactSyncs={googleSyncsResult.data ?? []}
      defaultTab={defaultTab}
      contacts={(contactsResult.data ?? []).map((contact) => ({
        id: contact.id,
        vendor_id: contact.vendor_id,
        name: contact.name,
        title: contact.title ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        duty: contact.duty ?? "",
        is_primary: contact.is_primary,
        active: contact.active,
        created_at: contact.created_at,
      }))}
      documents={(documentsResult.data ?? []).map((document) => {
        const analysis = Array.isArray(document.document_analyses)
          ? document.document_analyses[0]
          : document.document_analyses;
        return {
          id: document.id,
          kind: document.kind,
          fileName: document.file_name,
          mimeType: document.mime_type,
          fileSize: document.file_size,
          version: document.version,
          validUntil: document.valid_until,
          createdAt: document.created_at,
          analysisStatus: analysis?.status ?? null,
          analysisProgressStep: analysis?.progress_step ?? null,
          analysisSummary: analysis?.summary ?? null,
          analysisError: analysis?.error_message ?? null,
          analysisUpdatedAt: analysis?.updated_at ?? null,
          extractedData: analysis?.extracted_data ?? null,
        };
      })}
      logs={(logsResult.data ?? []).map((log) => ({
        ...log,
        contact_name: log.contact_id ? (contactMap.get(log.contact_id) ?? null) : null,
      }))}
      projects={(linksResult.data ?? []).flatMap((link) => {
        const project = projectMap.get(link.project_id);
        return project?.id && project.title && project.stage
          ? [
              {
                id: project.id,
                title: project.title,
                category: project.category,
                stage: project.stage,
                role: link.role,
              },
            ]
          : [];
      })}
      reviews={(reviewsResult.data ?? []).map((review) => ({
        ...review,
        project_title: projectMap.get(review.project_id)?.title ?? "용역 건",
      }))}
      timeline={timeline}
      defaultContactAt={kst.dateTime}
      vendor={detailVendor}
    />
  );
}
