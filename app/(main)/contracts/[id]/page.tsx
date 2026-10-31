import { CalendarDays, CheckCircle2, FileText, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContractFormDialog } from "@/components/contracts/contract-form-dialog";
import { ApprovalSubmitButton } from "@/components/contracts/approval-submit-button";
import { GuaranteeFormDialog } from "@/components/contracts/guarantee-form-dialog";
import { PaymentStatusEditor } from "@/components/contracts/payment-status-editor";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !contract) notFound();
  const rootId = contract.parent_contract_id ?? contract.id;
  const [
    rootResult,
    legacyChangesResult,
    amendmentsResult,
    paymentsResult,
    guaranteesResult,
    projectResult,
  ] = await Promise.all([
    supabase.from("contracts").select("*").eq("id", rootId).is("deleted_at", null).maybeSingle(),
    supabase
      .from("contracts")
      .select("*")
      .eq("parent_contract_id", rootId)
      .is("deleted_at", null)
      .order("signed_at"),
    supabase
      .from("contract_amendments")
      .select("*")
      .eq("contract_id", rootId)
      .is("deleted_at", null)
      .order("sequence"),
    supabase
      .from("payment_schedules")
      .select("*")
      .eq("contract_id", rootId)
      .is("deleted_at", null)
      .order("seq"),
    supabase
      .from("guarantees")
      .select("*")
      .eq("contract_id", rootId)
      .is("deleted_at", null)
      .order("expires_at"),
    (role === "agent" || role === "viewer"
      ? supabase.from("projects_public")
      : supabase.from("projects")
    )
      .select("id,title,selected_vendor_id")
      .eq("id", contract.project_id)
      .maybeSingle(),
  ]);
  const root = rootResult.data;
  if (!root || !projectResult.data?.id || !projectResult.data.title) notFound();
  const family = [root, ...(legacyChangesResult.data ?? [])];
  const familyIds = family.map((item) => item.id);
  const sourceIds = [
    ...familyIds,
    ...(paymentsResult.data ?? []).map((payment) => payment.id),
    ...(guaranteesResult.data ?? []).map((guarantee) => guarantee.id),
  ];
  const [eventsResult, documentsResult, vendorResult, linksResult] = await Promise.all([
    supabase
      .from("events")
      .select("id,type,title,date,status,source_type,source_id")
      .in("source_id", sourceIds)
      .is("deleted_at", null)
      .order("date"),
    supabase
      .from("documents")
      .select("id,kind,file_name,mime_type,file_size,version,created_at")
      .eq("owner_type", "contract")
      .in("owner_id", familyIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    (role === "agent" || role === "viewer"
      ? supabase.from("vendors_public")
      : supabase.from("vendors")
    )
      .select("id,name")
      .eq("id", root.vendor_id)
      .maybeSingle(),
    supabase
      .from("project_vendors")
      .select("vendor_id")
      .eq("project_id", root.project_id)
      .is("deleted_at", null),
  ]);
  const { data: appliedAnalyses } = await supabase
    .from("document_analyses")
    .select("document_id")
    .eq("applied_owner_type", "contract")
    .eq("applied_owner_id", rootId)
    .is("deleted_at", null);
  const appliedDocumentIds = (appliedAnalyses ?? []).map((analysis) => analysis.document_id);
  const { data: appliedDocuments } = appliedDocumentIds.length
    ? await supabase
        .from("documents")
        .select("id,kind,file_name,mime_type,file_size,version,created_at")
        .in("id", appliedDocumentIds)
        .is("deleted_at", null)
    : { data: [] };
  const mergedDocuments = [...new Map([...(documentsResult.data ?? []), ...(appliedDocuments ?? [])].map((document) => [document.id, document])).values()];
  const { data: documentAnalyses } = mergedDocuments.length
    ? await supabase
        .from("document_analyses")
        .select("document_id,status,progress_step,summary,error_message,extracted_data,updated_at")
        .in("document_id", mergedDocuments.map((document) => document.id))
        .is("deleted_at", null)
    : { data: [] };
  const documentAnalysisMap = new Map((documentAnalyses ?? []).map((analysis) => [analysis.document_id, analysis]));
  const vendorIds = (linksResult.data ?? []).map((link) => link.vendor_id);
  const vendorNamesResult =
    role === "agent" || role === "viewer"
      ? await supabase
          .from("vendors_public")
          .select("id,name")
          .in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
      : await supabase
          .from("vendors")
          .select("id,name")
          .in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
          .is("deleted_at", null);
  const vendorName = vendorResult.data?.name ?? "업체";
  const total = root.amount + root.vat;
  const paid = (paymentsResult.data ?? [])
    .filter((payment) => payment.paid_at)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const canManage = role === "admin" || role === "staff" || role === "agent";
  const canManagePayments = role === "admin" || role === "staff";
  const canSubmitApproval = role === "admin" || role === "staff";
  const projectOption = [
    {
      id: root.project_id,
      title: projectResult.data.title,
      selectedVendorId: projectResult.data.selected_vendor_id,
      vendors: (vendorNamesResult.data ?? []).flatMap((vendor) =>
        vendor.id && vendor.name ? [{ id: vendor.id, name: vendor.name }] : [],
      ),
    },
  ];
  const parent = {
    id: root.id,
    projectId: root.project_id,
    projectTitle: projectResult.data.title,
    vendorId: root.vendor_id,
    vendorName,
    title: root.title,
    signedAt: root.signed_at,
    startAt: root.start_at,
    endAt: root.end_at,
    amount: root.amount,
    vat: root.vat,
    contractParty: root.contract_party as "조합직접" | "업무대행사대행",
    originalLocation: root.original_location,
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link className="text-sm text-muted-foreground hover:underline" href="/contracts">
            ← 계약 목록
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{root.title}</h1>
            <Badge
              variant={
                root.approval_status === "approved"
                  ? "default"
                  : root.approval_status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
            >
              {root.approval_status === "approved"
                ? "승인"
                : root.approval_status === "rejected"
                  ? "반려"
                  : root.approval_status === "draft"
                    ? "초안"
                    : "승인대기"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link className="hover:underline" href={`/projects/${root.project_id}?tab=contracts`}>
              {projectResult.data.title}
            </Link>{" "}
            · {vendorName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmitApproval &&
          (root.approval_status === "draft" || root.approval_status === "rejected") ? (
            <ApprovalSubmitButton targetId={root.id} targetType="contract" />
          ) : null}
          {canManage && root.approval_status === "approved" ? (
            <ContractFormDialog
              draftOnly={role === "agent"}
              parent={parent}
              projects={projectOption}
            />
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">현재 계약총액</p>
            <p className="mt-1 text-xl font-bold">{formatWon(total)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">지급액</p>
            <p className="mt-1 text-xl font-bold">{formatWon(paid)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">미지급액</p>
            <p className="mt-1 text-xl font-bold">{formatWon(Math.max(total - paid, 0))}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">계약 기간</p>
            <p className="mt-1 font-bold">
              {formatDate(root.start_at)} ~ {formatDate(root.end_at)}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>계약 기본정보</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">계약일</p>
              <p className="mt-1 font-medium">{formatDate(root.signed_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">계약 주체</p>
              <p className="mt-1 font-medium">{root.contract_party}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">공급가 / 부가세</p>
              <p className="mt-1 font-medium">
                {formatWon(root.amount)} / {formatWon(root.vat)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">날인</p>
              <p className="mt-1 font-medium">{root.is_sealed ? "완료" : "미완료"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">원본 보관 위치</p>
              <p className="mt-1 font-medium">{root.original_location ?? "미입력"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              첨부 문서
            </CardTitle>
            {canManage ? <DocumentUploadDialog defaultKind="계약서" ownerId={rootId} ownerType="contract" /> : null}
          </CardHeader>
          <CardContent className="p-0"><DocumentList canAnalyze={canManage} documents={mergedDocuments.map((document) => { const analysis = documentAnalysisMap.get(document.id); return { id: document.id, kind: document.kind, fileName: document.file_name, mimeType: document.mime_type, fileSize: document.file_size, version: document.version, createdAt: document.created_at, analysisStatus: analysis?.status ?? null, analysisProgressStep: analysis?.progress_step ?? null, analysisSummary: analysis?.summary ?? null, analysisError: analysis?.error_message ?? null, analysisUpdatedAt: analysis?.updated_at ?? null, extractedData: analysis?.extracted_data ?? null }; })} /></CardContent>
        </Card>
      </div>
      <Card className="py-0">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="size-5" />
            대금 지급·정산
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">회차</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>예정일</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>현재 상태</TableHead>
                <TableHead className="text-right">지급일·정산 변경</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsResult.data?.length ? (
                paymentsResult.data.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-center">{payment.seq}</TableCell>
                    <TableCell className="font-medium">{payment.label}</TableCell>
                    <TableCell>{formatDate(payment.due_date)}</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatWon(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={payment.paid_at ? "default" : "outline"}>
                        {payment.paid_at ? `지급 ${formatDate(payment.paid_at)}` : "미지급"}
                      </Badge>
                      <Badge className="ml-1" variant="secondary">
                        {payment.settlement_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canManagePayments && root.approval_status === "approved" ? (
                        <PaymentStatusEditor
                          contractId={root.id}
                          paidAt={payment.paid_at}
                          paymentId={payment.id}
                          projectId={root.project_id}
                          settlementStatus={payment.settlement_status}
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>
                    등록된 지급 회차가 없어.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              보증증권
            </CardTitle>
            {canManage ? (
              <GuaranteeFormDialog contractId={root.id} projectId={root.project_id} />
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {guaranteesResult.data?.length ? (
              guaranteesResult.data.map((guarantee) => (
                <div
                  key={guarantee.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">
                      {guarantee.type}보증 · {guarantee.issuer ?? "발급기관 미입력"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(guarantee.starts_at)} ~ {formatDate(guarantee.expires_at)}
                    </p>
                  </div>
                  <p className="font-bold">{formatWon(guarantee.amount)}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">등록된 보증증권이 없어.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" />
              연결 일정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eventsResult.data?.length ? (
              eventsResult.data.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.type} · {formatDate(event.date)}
                    </p>
                  </div>
                  <Badge variant={event.status === "지연" ? "destructive" : "secondary"}>
                    {event.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">연결된 일정이 없어.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5" />
            변경계약 이력
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {amendmentsResult.data?.length ? (
            amendmentsResult.data.map((change) => {
              const delta =
                change.final_amount +
                change.final_vat -
                change.previous_amount -
                change.previous_vat;
              return (
                <div key={change.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {change.sequence}차 · {change.title}
                      </span>
                      <Badge
                        variant={
                          change.approval_status === "approved"
                            ? "default"
                            : change.approval_status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {change.approval_status === "approved"
                          ? "승인"
                          : change.approval_status === "rejected"
                            ? "반려"
                            : change.approval_status === "draft"
                              ? "초안"
                              : "승인대기"}
                      </Badge>
                      {canSubmitApproval &&
                      (change.approval_status === "draft" ||
                        change.approval_status === "rejected") ? (
                        <ApprovalSubmitButton
                          targetId={change.id}
                          targetType="contract_amendment"
                        />
                      ) : null}
                    </div>
                    <span
                      className={delta < 0 ? "font-bold text-blue-700" : "font-bold text-red-700"}
                    >
                      {delta > 0 ? "+" : ""}
                      {formatWon(delta)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{change.change_reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    변경 후 {formatWon(change.final_amount + change.final_vat)} ·{" "}
                    {formatDate(change.signed_at)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">등록된 변경계약이 없어.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
