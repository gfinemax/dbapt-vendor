"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FileText, Pencil, Plus } from "lucide-react";
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
    const supabase = createClient();
    const path = `vendor/${vendorId}/${kind}/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("vendor-files")
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false,
      });
    if (uploadError) throw new Error(`${kind}를 업로드하지 못했어: ${uploadError.message}`);

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

    const response = await fetch(`/api/documents/${registered.id}/analyze`, {
      method: "POST",
    });
    return response.ok;
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

        const selectedDocuments = editing && result.id
          ? [
              ...(quoteFile ? [{ kind: "견적서" as const, file: quoteFile }] : []),
              ...(contractFile ? [{ kind: "계약서" as const, file: contractFile }] : []),
            ]
          : [];
        const uploadResults = result.id
          ? await Promise.allSettled(
              selectedDocuments.map((document) =>
                uploadDocument(result.id!, document.kind, document.file),
              ),
            )
          : [];
        const uploadErrors: string[] = [];
        let analysisFailures = 0;
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
          if (!uploadResult.value) analysisFailures += 1;
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
        if (analysisFailures) {
          toast.warning(`${analysisFailures}건은 원본을 등록했지만 자동 분석은 완료하지 못했어.`);
        }
        setOpen(false);
        if (!editing && result.id) {
          router.push(`/vendors/${result.id}`);
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
