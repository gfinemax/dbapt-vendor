"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Building2, CheckCircle2, FileText, Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { toast } from "sonner";

import { createVendorDocument, saveVendor } from "@/app/(main)/vendors/actions";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedDocumentExtensions,
  documentAnalysisProgressLabel,
  documentKindStorageSegment,
  documentExtension,
  MAX_DOCUMENT_SIZE,
  safeDocumentFileName,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import { vendorSchema, vendorStatuses, type VendorInput } from "@/lib/validators/vendor";

const emptyVendor: VendorInput = {
  name: "",
  biz_no: "",
  ceo: "",
  phone: "",
  address: "",
  category: "",
  homepage: "",
  bank_name: "",
  bank_account: "",
  related_person: "",
  related_person_phone: "",
  primary_contact_name: "",
  primary_contact_phone: "",
  status: "후보",
  memo: "",
  internal_note: "",
};

type UploadStage =
  | "selected"
  | "uploading"
  | "registering"
  | "registered"
  | "queued"
  | "loading_file"
  | "analyzing"
  | "saving"
  | "review_required"
  | "applied"
  | "failed";

type UploadProgress = {
  kind: "견적서" | "계약서";
  fileName: string;
  stage: UploadStage;
  message: string | null;
};

function uploadStageLabel(stage: UploadStage) {
  switch (stage) {
    case "selected":
      return "파일 선택 완료";
    case "uploading":
      return "원본 업로드 중";
    case "registering":
      return "문서 정보 등록 중";
    case "failed":
      return "처리 실패";
    default:
      return documentAnalysisProgressLabel(stage);
  }
}

export function VendorFormDialog({
  vendor,
  triggerLabel,
}: {
  vendor?: VendorInput;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const quoteInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(vendor?.id);
  const form = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: vendor ?? emptyVendor,
  });

  useEffect(() => {
    if (open) {
      form.reset(vendor ?? emptyVendor);
      setSubmitError(null);
      setQuoteFile(null);
      setContractFile(null);
      setUploadProgress([]);
      if (quoteInputRef.current) quoteInputRef.current.value = "";
      if (contractInputRef.current) contractInputRef.current.value = "";
    }
  }, [form, open, vendor]);

  function validateDocument(file: File, label: string) {
    if (!allowedDocumentExtensions.has(documentExtension(file.name))) {
      return `${label}는 PDF·이미지·엑셀·워드·한글 파일만 올릴 수 있어.`;
    }
    if (file.size > MAX_DOCUMENT_SIZE) return `${label}는 20MB 이하여야 해.`;
    return null;
  }

  async function uploadDocument(
    vendorId: string,
    kind: "견적서" | "계약서",
    file: File,
  ) {
    const updateProgress = (stage: UploadStage, message: string | null = null) => {
      setUploadProgress((current) => current.map((item) =>
        item.kind === kind ? { ...item, stage, message } : item,
      ));
    };
    const supabase = createClient();
    const path = `vendor/${vendorId}/${documentKindStorageSegment(kind)}/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(file.name)}`;
    try {
      updateProgress("uploading");
      const { error: uploadError } = await supabase.storage
        .from("vendor-files")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || undefined,
          upsert: false,
        });
      if (uploadError) throw new Error(`${kind}를 업로드하지 못했어: ${uploadError.message}`);

      updateProgress("registering");
      const registered = await createVendorDocument({
        owner_id: vendorId,
        kind,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        valid_until: "",
      });
      if (!registered.ok || !registered.id) {
        await supabase.storage.from("vendor-files").remove([path]);
        throw new Error(`${kind}를 등록하지 못했어: ${registered.message}`);
      }

      updateProgress("queued");
      const pollTimer = window.setInterval(async () => {
        try {
          const progressResponse = await fetch(`/api/documents/${registered.id}/analyze`, {
            cache: "no-store",
          });
          if (!progressResponse.ok) return;
          const progress = (await progressResponse.json()) as {
            progressStep: UploadStage;
            error: string | null;
          };
          updateProgress(progress.progressStep, progress.error);
        } catch {
          // 원본 등록과 분석 POST는 계속 진행되므로 상태 조회만 다음 주기에 재시도한다.
        }
      }, 900);
      try {
        const response = await fetch(`/api/documents/${registered.id}/analyze`, {
          method: "POST",
        });
        const result = (await response.json()) as { ok: boolean; message: string };
        if (!response.ok || !result.ok) {
          updateProgress("failed", result.message);
          return { analysisOk: false, message: result.message };
        }
        updateProgress("review_required", result.message);
        return { analysisOk: true, message: result.message };
      } finally {
        window.clearInterval(pollTimer);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `${kind} 처리 중 오류가 발생했어.`;
      updateProgress("failed", message);
      throw error;
    }
  }

  function onSubmit(values: VendorInput) {
    const quoteError = quoteFile ? validateDocument(quoteFile, "견적서") : null;
    const contractError = contractFile ? validateDocument(contractFile, "계약서") : null;
    const documentError = quoteError ?? contractError;
    if (documentError) {
      setSubmitError(documentError);
      toast.error(documentError);
      return;
    }

    setSubmitError(null);
    const initialDocuments = editing
      ? [
          ...(quoteFile ? [{ kind: "견적서" as const, file: quoteFile }] : []),
          ...(contractFile ? [{ kind: "계약서" as const, file: contractFile }] : []),
        ]
      : [];
    setUploadProgress(initialDocuments.map((document) => ({
      kind: document.kind,
      fileName: document.file.name,
      stage: "selected",
      message: null,
    })));
    startTransition(async () => {
      let vendorSaved = false;
      try {
        const result = await saveVendor(values);
        if (!result.ok) {
          setSubmitError(result.message);
          toast.error(result.message);
          return;
        }
        vendorSaved = true;

        const selectedDocuments = editing && result.id ? initialDocuments : [];
        const uploadResults = result.id
          ? await Promise.allSettled(
              selectedDocuments.map((document) =>
                uploadDocument(result.id!, document.kind, document.file),
              ),
            )
          : [];
        const uploadErrors: string[] = [];
        const analysisFailureMessages: string[] = [];
        uploadResults.forEach((uploadResult, index) => {
          const selected = selectedDocuments[index];
          if (uploadResult.status === "rejected") {
            uploadErrors.push(
              uploadResult.reason instanceof Error
                ? uploadResult.reason.message
                : `${selected.kind} 등록 중 오류가 발생했어.`,
            );
            return;
          }
          if (!uploadResult.value.analysisOk) analysisFailureMessages.push(uploadResult.value.message);
          if (selected.kind === "견적서") {
            setQuoteFile(null);
            if (quoteInputRef.current) quoteInputRef.current.value = "";
          } else {
            setContractFile(null);
            if (contractInputRef.current) contractInputRef.current.value = "";
          }
        });
        if (uploadErrors.length) throw new Error(uploadErrors.join(" "));

        const uploadedCount = selectedDocuments.length;
        toast.success(
          uploadedCount
            ? `${result.message} 견적서·계약서 ${uploadedCount}건도 등록했어.`
            : result.message,
        );
        if (analysisFailureMessages.length) {
          const warning = `${analysisFailureMessages.length}건은 원본을 등록했지만 자동 분석은 완료하지 못했어. ${analysisFailureMessages.join(" ")}`;
          setSubmitError(warning);
          toast.warning(warning);
          router.refresh();
          return;
        }
        setOpen(false);
        if (!editing && result.id) {
          router.push(`/vendors/${result.id}`);
        } else if (uploadedCount && result.id) {
          router.push(`/vendors/${result.id}?tab=documents`);
        } else {
          router.refresh();
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "문서 등록 중 오류가 발생했어.";
        const message = vendorSaved
          ? `업체 기본정보는 저장했지만 문서를 등록하지 못했어. ${detail}`
          : "저장 요청을 처리하지 못했어. 잠시 후 다시 시도해 줘.";
        setSubmitError(message);
        toast.error(message);
        if (vendorSaved) router.refresh();
      }
    });
  }

  function onInvalid(errors: FieldErrors<VendorInput>) {
    const firstInvalidField = Object.keys(errors)[0] as keyof VendorInput | undefined;
    const message = firstInvalidField
      ? form.getFieldState(firstInvalidField).error?.message
      : undefined;
    const errorMessage = message ?? "입력값을 확인해 줘.";

    setSubmitError(errorMessage);
    toast.error(errorMessage);
    if (firstInvalidField) form.setFocus(firstInvalidField);
  }

  const submitForm = form.handleSubmit(onSubmit, onInvalid);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={editing ? "outline" : "default"}>
          {editing ? <Pencil /> : <Plus />}
          {triggerLabel ?? (editing ? "기본정보 수정" : "업체 등록")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            {editing ? "업체 정보 수정" : "새 업체 등록"}
          </DialogTitle>
          <DialogDescription>사업자번호는 000-00-00000 형식으로 입력해 줘.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-5" noValidate onSubmit={submitForm}>
            {vendor?.id ? <input type="hidden" {...form.register("id")} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>상호 *</FormLabel><FormControl><Input placeholder="업체명" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="biz_no" render={({ field }) => (
                <FormItem><FormLabel>사업자번호</FormLabel><FormControl><Input inputMode="numeric" placeholder="000-00-00000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ceo" render={({ field }) => (
                <FormItem><FormLabel>대표자</FormLabel><FormControl><Input placeholder="대표자명" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>업체 연락처</FormLabel><FormControl><Input inputMode="tel" placeholder="02-0000-0000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="primary_contact_name" render={({ field }) => (
                <FormItem><FormLabel>담당자</FormLabel><FormControl><Input placeholder="주 담당자 이름" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="primary_contact_phone" render={({ field }) => (
                <FormItem><FormLabel>담당자 연락처</FormLabel><FormControl><Input inputMode="tel" placeholder="010-0000-0000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>분야 *</FormLabel><FormControl><Input placeholder="예: 인테리어" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>상태</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{vendorStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="homepage" render={({ field }) => (
                <FormItem><FormLabel>홈페이지</FormLabel><FormControl><Input placeholder="https://" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bank_name" render={({ field }) => (
                <FormItem><FormLabel>은행</FormLabel><FormControl><Input placeholder="은행명" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bank_account" render={({ field }) => (
                <FormItem><FormLabel>계좌번호</FormLabel><FormControl><Input placeholder="계좌번호" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="related_person" render={({ field }) => (
                <FormItem><FormLabel>관계인</FormLabel><FormControl><Input placeholder="관계인 성명 또는 관계" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="related_person_phone" render={({ field }) => (
                <FormItem><FormLabel>관계인 연락처</FormLabel><FormControl><Input inputMode="tel" placeholder="010-0000-0000" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem><FormLabel>주소</FormLabel><FormControl><Input placeholder="사업장 주소" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="memo" render={({ field }) => (
                <FormItem><FormLabel>메모</FormLabel><FormControl><Textarea placeholder="업체 관련 일반 메모" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="internal_note" render={({ field }) => (
                <FormItem><FormLabel>내부 검토의견</FormLabel><FormControl><Textarea placeholder="관리자·임원·사무국만 조회" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            {editing ? (
              <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">견적서·계약서 등록</p>
                    <p className="text-xs text-muted-foreground">
                      파일을 선택하지 않으면 기존 문서는 그대로 유지돼. 등록한 문서는 서류 탭에서 확인할 수 있어.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">
                    견적서
                    <Input
                      ref={quoteInputRef}
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.csv,.doc,.docx,.hwp"
                      disabled={pending}
                      type="file"
                      onChange={(event) => setQuoteFile(event.target.files?.[0] ?? null)}
                    />
                    {quoteFile ? <span className="truncate text-xs font-normal text-muted-foreground">{quoteFile.name}</span> : null}
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    계약서
                    <Input
                      ref={contractInputRef}
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.csv,.doc,.docx,.hwp"
                      disabled={pending}
                      type="file"
                      onChange={(event) => setContractFile(event.target.files?.[0] ?? null)}
                    />
                    {contractFile ? <span className="truncate text-xs font-normal text-muted-foreground">{contractFile.name}</span> : null}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">파일당 최대 20MB · 등록 후 주요 내용을 자동 분석해.</p>
                {uploadProgress.length ? (
                  <div aria-live="polite" className="space-y-2 rounded-lg border bg-background p-3">
                    <p className="text-xs font-semibold">등록·자동분석 진행상태</p>
                    {uploadProgress.map((item) => {
                      const failed = item.stage === "failed";
                      const finished = item.stage === "review_required" || item.stage === "applied";
                      return (
                        <div key={item.kind} className="flex items-start gap-2 text-xs">
                          {failed ? (
                            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                          ) : finished ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          ) : (
                            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-blue-600" />
                          )}
                          <div className="min-w-0">
                            <p className={failed ? "font-medium text-destructive" : "font-medium"}>
                              {item.kind} · {uploadStageLabel(item.stage)}
                            </p>
                            <p className="truncate text-muted-foreground">{item.fileName}</p>
                            {item.message ? <p className={failed ? "mt-1 text-destructive" : "mt-1 text-muted-foreground"}>{item.message}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
            {submitError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {submitError}
              </p>
            ) : null}
            <DialogFooter>
              <Button disabled={pending} type="submit">{pending ? "저장 중..." : "저장"}</Button>
              <Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
