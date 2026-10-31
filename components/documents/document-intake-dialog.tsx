"use client";

import { FileSearch, Loader2, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  applyDocumentIntake,
  registerDocument,
} from "@/app/(main)/documents/actions";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  allowedDocumentExtensions,
  documentExtension,
  MAX_DOCUMENT_SIZE,
  safeDocumentFileName,
  suggestedContractAmounts,
  suggestedQuoteAmount,
} from "@/lib/documents";
import {
  serviceCaseCategories,
  serviceCaseStages,
  type ServiceCaseInput,
} from "@/lib/validators/business-project";
import {
  documentExtractionSchema,
  documentIntakeApplySchema,
  documentKinds,
  type DocumentExtraction,
  type DocumentIntakeApplyInput,
  type DocumentRegistrationInput,
} from "@/lib/validators/document";

type SelectedFile = { file: File; kind: DocumentRegistrationInput["kind"] };
type IntakeQuote = DocumentIntakeApplyInput["quotes"][number];
type IntakeContract = DocumentIntakeApplyInput["contracts"][number];
type IntakeDocument = {
  documentId: string;
  fileName: string;
  mimeType: string;
  kind: DocumentRegistrationInput["kind"];
  extraction: DocumentExtraction | null;
  vendorId: string;
  applyRecord: boolean;
  quote: IntakeQuote | null;
  contract: IntakeContract | null;
  message: string;
};

function todayKst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function inferKind(fileName: string): DocumentRegistrationInput["kind"] {
  if (/변경.*계약|계약.*변경/.test(fileName)) return "계약서";
  if (fileName.includes("계약")) return "계약서";
  if (fileName.includes("견적")) return "견적서";
  if (fileName.includes("제안")) return "제안서";
  if (/사업자.*등록/.test(fileName)) return "사업자등록증";
  if (fileName.includes("보증")) return "보증증권";
  if (/회의|협의/.test(fileName)) return "회의자료";
  return "기타";
}

function normalizeBusinessNumber(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function documentDraft(
  documentId: string,
  extraction: DocumentExtraction,
  vendorId: string,
) {
  if (extraction.document_type === "quote") {
    const amount = suggestedQuoteAmount(extraction);
    const quote: IntakeQuote = {
      document_id: documentId,
      vendor_id: vendorId,
      received_at: extraction.quote.received_at ?? todayKst(),
      amount: amount.amount,
      vat_included: amount.vatIncluded,
      duration_days: extraction.quote.duration_days,
      warranty_months: extraction.quote.warranty_months,
      payment_terms: extraction.quote.payment_terms,
      items: extraction.line_items.map((item) => ({
        name: item.normalized_name || item.name,
        amount: item.amount,
      })),
      note: extraction.summary,
    };
    return { quote, contract: null };
  }
  if (extraction.document_type === "contract") {
    const amounts = suggestedContractAmounts(extraction);
    const contract: IntakeContract = {
      document_id: documentId,
      vendor_id: vendorId,
      title: extraction.contract.title ?? extraction.service_case.title ?? "",
      signed_at: extraction.contract.signed_at ?? "",
      start_at: extraction.contract.start_at ?? "",
      end_at: extraction.contract.end_at ?? "",
      amount: amounts.amount,
      vat: amounts.vat,
      contract_party: extraction.contract.contract_party ?? "조합직접",
      is_sealed: extraction.contract.is_sealed ?? false,
      payments: extraction.payments.flatMap((payment) =>
        payment.due_date && payment.amount != null
          ? [{ label: payment.label, due_date: payment.due_date, amount: payment.amount }]
          : [],
      ),
    };
    return { quote: null, contract };
  }
  return { quote: null, contract: null };
}

export function DocumentIntakeDialog({
  businessProjectId,
  users,
  vendors,
}: {
  businessProjectId: string;
  users: { id: string; name: string }[];
  vendors: { id: string; name: string; bizNo: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [working, setWorking] = useState(false);
  const [serviceCase, setServiceCase] = useState<ServiceCaseInput>({
    business_project_id: businessProjectId,
    title: "",
    category: "기타",
    description: "",
    budget: 0,
    stage: "견적요청",
    owner_user_id: "",
  });

  const hasContract = documents.some((document) => document.contract);

  function chooseVendor(extraction: DocumentExtraction | null) {
    if (!extraction) return "";
    const number = normalizeBusinessNumber(extraction.vendor.business_number);
    if (number) {
      const byNumber = vendors.find((vendor) => normalizeBusinessNumber(vendor.bizNo) === number);
      if (byNumber) return byNumber.id;
    }
    const name = extraction.vendor.name?.replace(/\s/g, "").toLocaleLowerCase();
    return vendors.find((vendor) => vendor.name.replace(/\s/g, "").toLocaleLowerCase() === name)?.id ?? "";
  }

  function deriveServiceCase(nextDocuments: IntakeDocument[]) {
    const extractions = nextDocuments.flatMap((document) => document.extraction ? [document.extraction] : []);
    const primary = extractions.find((item) => item.document_type === "contract") ?? extractions.find((item) => item.document_type === "quote") ?? extractions[0];
    if (!primary) return;
    const contract = extractions.find((item) => item.document_type === "contract");
    const quote = extractions.find((item) => item.document_type === "quote");
    const budget = contract?.contract.total_amount ?? (contract ? suggestedContractAmounts(contract).amount + suggestedContractAmounts(contract).vat : null) ?? quote?.quote.total_amount ?? (quote ? suggestedQuoteAmount(quote).amount : 0);
    setServiceCase((current) => ({
      ...current,
      title: primary.service_case.title ?? primary.contract.title ?? current.title,
      category: primary.service_case.category ?? current.category,
      description: [primary.service_case.description, ...extractions.map((item) => item.summary)].filter(Boolean).join("\n\n").slice(0, 1000),
      budget: budget ?? current.budget,
      stage: contract ? "계약" : quote ? "비교검토" : (primary.service_case.stage ?? "견적요청"),
    }));
  }

  async function uploadAndAnalyze() {
    if (!selectedFiles.length) {
      toast.error("분석할 견적서·계약서 또는 관련 서류를 선택해 줘.");
      return;
    }
    setWorking(true);
    const supabase = createClient();
    const nextDocuments: IntakeDocument[] = [];
    try {
      for (const selected of selectedFiles) {
        const { file, kind } = selected;
        const extension = documentExtension(file.name);
        if (!allowedDocumentExtensions.has(extension)) throw new Error(`${file.name}: 지원하지 않는 파일 형식이야.`);
        if (file.size > MAX_DOCUMENT_SIZE) throw new Error(`${file.name}: 파일은 20MB 이하여야 해.`);
        const path = `business_project/${businessProjectId}/${kind}/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("vendor-files").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);
        const registered = await registerDocument({ owner_type: "business_project", owner_id: businessProjectId, kind, file_path: path, file_name: file.name, mime_type: file.type, file_size: file.size, valid_until: "" });
        if (!registered.ok || !registered.id) {
          await supabase.storage.from("vendor-files").remove([path]);
          throw new Error(`${file.name}: ${registered.message}`);
        }
        const response = await fetch(`/api/documents/${registered.id}/analyze`, { method: "POST" });
        const result = (await response.json()) as { ok: boolean; message: string; analysis?: unknown };
        const parsed = documentExtractionSchema.safeParse(result.analysis);
        const extraction = parsed.success ? parsed.data : null;
        const vendorId = chooseVendor(extraction);
        const draft = extraction ? documentDraft(registered.id, extraction, vendorId) : { quote: null, contract: null };
        nextDocuments.push({ documentId: registered.id, fileName: file.name, mimeType: file.type, kind, extraction, vendorId, applyRecord: Boolean(draft.quote || draft.contract), quote: draft.quote, contract: draft.contract, message: result.message });
      }
      setDocuments(nextDocuments);
      deriveServiceCase(nextDocuments);
      toast.success(`${nextDocuments.length}개 문서를 등록하고 분석했어. 제안값을 확인해 줘.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문서 등록·분석 중 오류가 발생했어.");
    } finally {
      setWorking(false);
    }
  }

  function updateDocument(documentId: string, patch: Partial<IntakeDocument>) {
    setDocuments((current) => current.map((document) => document.documentId === documentId ? { ...document, ...patch } : document));
  }

  function updateVendor(document: IntakeDocument, vendorId: string) {
    updateDocument(document.documentId, {
      vendorId,
      quote: document.quote ? { ...document.quote, vendor_id: vendorId } : null,
      contract: document.contract ? { ...document.contract, vendor_id: vendorId } : null,
    });
  }

  async function apply() {
    const payload = {
      business_project_id: businessProjectId,
      title: serviceCase.title,
      category: serviceCase.category,
      description: serviceCase.description,
      budget: serviceCase.budget,
      stage: serviceCase.stage,
      owner_user_id: serviceCase.owner_user_id,
      document_ids: documents.map((document) => document.documentId),
      quotes: documents.flatMap((document) => document.applyRecord && document.quote ? [document.quote] : []),
      contracts: documents.flatMap((document) => document.applyRecord && document.contract ? [document.contract] : []),
    };
    const checked = documentIntakeApplySchema.safeParse(payload);
    if (!checked.success) {
      toast.error(checked.error.issues[0]?.message ?? "필수 등록값을 확인해 줘.");
      return;
    }

    setWorking(true);
    try {
      const result = await applyDocumentIntake(checked.data);
      if (!result.ok || !result.id) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.push(`/projects/${result.id}?tab=documents`);
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setSelectedFiles([]);
    setDocuments([]);
    setServiceCase({ business_project_id: businessProjectId, title: "", category: "기타", description: "", budget: 0, stage: "견적요청", owner_user_id: "" });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value && !working) reset(); }}>
      <DialogTrigger asChild><Button variant="outline"><Sparkles />문서로 자동 등록</Button></DialogTrigger>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>견적서·계약서로 용역건 자동 등록</DialogTitle><DialogDescription>여러 문서를 함께 분석하고, 검토한 값만 용역건·견적·계약 승인초안에 반영해.</DialogDescription></DialogHeader>
        {!documents.length ? (
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium">문서 선택 <span className="font-normal text-muted-foreground">여러 개 선택 가능 · 파일당 최대 20MB</span><Input multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt,.hwp" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []).map((file) => ({ file, kind: inferKind(file.name) })))} /></label>
            {selectedFiles.length ? <div className="space-y-2 rounded-xl border p-3">{selectedFiles.map((selected, index) => <div key={`${selected.file.name}-${selected.file.lastModified}`} className="grid gap-2 sm:grid-cols-[1fr_180px]"><div className="min-w-0"><p className="truncate text-sm font-medium">{selected.file.name}</p><p className="text-xs text-muted-foreground">{(selected.file.size / 1024 / 1024).toFixed(1)}MB</p></div><Select value={selected.kind} onValueChange={(value) => setSelectedFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kind: value as DocumentRegistrationInput["kind"] } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{documentKinds.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectContent></Select></div>)}</div> : null}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">원본은 먼저 비공개 저장돼. 분석에 실패해도 원본은 남고, HWP는 PDF 변환 후 다시 올리면 자동 분석할 수 있어.</div>
            <DialogFooter><Button disabled={working || !selectedFiles.length} onClick={() => void uploadAndAnalyze()}>{working ? <Loader2 className="animate-spin" /> : <FileSearch />}{working ? "등록·분석 중..." : "문서 분석"}</Button><Button disabled={working} variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-4 rounded-xl border p-4">
              <div><h3 className="font-semibold">용역건 필수값</h3><p className="text-xs text-muted-foreground">문서 제안값을 확인하고 필요한 경우 수정해.</p></div>
              <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">용역명 *<Input value={serviceCase.title} onChange={(event) => setServiceCase({ ...serviceCase, title: event.target.value })} /></label><label className="grid gap-2 text-sm font-medium">분야 *<Select value={serviceCase.category} onValueChange={(value) => setServiceCase({ ...serviceCase, category: value as ServiceCaseInput["category"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{serviceCaseCategories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label></div>
              <div className="grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-medium">예산(원)<Input min={0} type="number" value={serviceCase.budget} onChange={(event) => setServiceCase({ ...serviceCase, budget: Number(event.target.value) })} /></label><label className="grid gap-2 text-sm font-medium">진행 단계<Select value={serviceCase.stage} onValueChange={(value) => setServiceCase({ ...serviceCase, stage: value as ServiceCaseInput["stage"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{serviceCaseStages.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-2 text-sm font-medium">조합 담당자<Select value={serviceCase.owner_user_id || "none"} onValueChange={(value) => setServiceCase({ ...serviceCase, owner_user_id: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">미배정</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select></label></div>
              <label className="grid gap-2 text-sm font-medium">설명<Textarea className="min-h-28" value={serviceCase.description} onChange={(event) => setServiceCase({ ...serviceCase, description: event.target.value })} /></label>
            </section>
            <section className="space-y-3"><div><h3 className="font-semibold">문서별 등록값</h3><p className="text-xs text-muted-foreground">체크한 견적·계약만 업무 데이터로 등록돼. 원본 문서는 체크와 관계없이 보존돼.</p></div>{documents.map((document) => <div key={document.documentId} className="space-y-4 rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{document.extraction?.detected_kind ?? document.kind}</Badge><p className="font-semibold">{document.fileName}</p>{document.extraction ? <Badge variant="secondary">신뢰도 {Math.round(document.extraction.confidence * 100)}%</Badge> : <Badge variant="destructive">직접 확인</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">{document.extraction?.summary ?? document.message}</p></div><DocumentViewerDialog documentId={document.documentId} extraction={document.extraction} fileName={document.fileName} mimeType={document.mimeType} /></div>{document.quote || document.contract ? <><label className="flex items-center gap-2 text-sm font-medium"><input checked={document.applyRecord} className="size-4" type="checkbox" onChange={(event) => updateDocument(document.documentId, { applyRecord: event.target.checked })} />{document.quote ? "견적으로 등록" : "계약 승인초안으로 등록"}</label>{document.applyRecord ? <div className="space-y-3 rounded-lg bg-muted/40 p-3"><label className="grid gap-2 text-sm font-medium">연결 업체 *<Select value={document.vendorId || "none"} onValueChange={(value) => updateVendor(document, value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="업체 선택" /></SelectTrigger><SelectContent><SelectItem value="none">선택 필요</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}{vendor.bizNo ? ` · ${vendor.bizNo}` : ""}</SelectItem>)}</SelectContent></Select></label>{document.quote ? <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-medium">접수일<Input type="date" value={document.quote.received_at} onChange={(event) => updateDocument(document.documentId, { quote: { ...document.quote!, received_at: event.target.value } })} /></label><label className="grid gap-1 text-xs font-medium">견적금액<Input min={0} type="number" value={document.quote.amount} onChange={(event) => updateDocument(document.documentId, { quote: { ...document.quote!, amount: Number(event.target.value) } })} /></label><label className="flex items-end gap-2 pb-2 text-xs font-medium"><input checked={document.quote.vat_included} type="checkbox" onChange={(event) => updateDocument(document.documentId, { quote: { ...document.quote!, vat_included: event.target.checked } })} />부가세 포함</label></div> : null}{document.contract ? <div className="space-y-3"><label className="grid gap-1 text-xs font-medium">계약명<Input value={document.contract.title} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, title: event.target.value } })} /></label><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-medium">계약일<Input type="date" value={document.contract.signed_at} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, signed_at: event.target.value } })} /></label><label className="grid gap-1 text-xs font-medium">시작일<Input type="date" value={document.contract.start_at} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, start_at: event.target.value } })} /></label><label className="grid gap-1 text-xs font-medium">종료일<Input type="date" value={document.contract.end_at} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, end_at: event.target.value } })} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">공급가액<Input min={0} type="number" value={document.contract.amount} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, amount: Number(event.target.value) } })} /></label><label className="grid gap-1 text-xs font-medium">부가세<Input min={0} type="number" value={document.contract.vat} onChange={(event) => updateDocument(document.documentId, { contract: { ...document.contract!, vat: Number(event.target.value) } })} /></label></div></div> : null}</div> : null}</> : <p className="text-xs text-muted-foreground">이 문서는 용역 설명과 요약 근거로 연결돼.</p>}</div>)}</section>
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">계약 문서가 포함되어 있어도 자동 승인하지 않아. {hasContract ? "저장 후 기존 계약 승인함에서 임원 승인을 거쳐야 해." : "견적은 업체별 버전으로 보존돼."}</div>
            <DialogFooter><Button disabled={working} onClick={() => void apply()}>{working ? <Loader2 className="animate-spin" /> : <Plus />}{working ? "반영 중..." : "검토 완료 및 등록"}</Button><Button disabled={working} variant="outline" onClick={() => { setDocuments([]); }}>파일 다시 선택</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
