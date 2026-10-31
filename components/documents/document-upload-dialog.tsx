"use client";

import { FileUp, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { registerDocument } from "@/app/(main)/documents/actions";
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
import { createClient } from "@/lib/supabase/client";
import {
  allowedDocumentExtensions,
  canAnalyzeDocument,
  documentKindStorageSegment,
  documentExtension,
  MAX_DOCUMENT_SIZE,
  safeDocumentFileName,
} from "@/lib/documents";
import {
  documentKinds,
  type DocumentRegistrationInput,
} from "@/lib/validators/document";

export function DocumentUploadDialog({
  ownerType,
  ownerId,
  defaultKind = "기타",
  analyzeAfterUpload = true,
}: {
  ownerType: DocumentRegistrationInput["owner_type"];
  ownerId: string;
  defaultKind?: DocumentRegistrationInput["kind"];
  analyzeAfterUpload?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DocumentRegistrationInput["kind"]>(defaultKind);
  const [validUntil, setValidUntil] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!files.length) {
      toast.error("등록할 파일을 선택해 줘.");
      return;
    }
    setUploading(true);
    const supabase = createClient();
    let completed = 0;
    let analysisFailures = 0;
    try {
      for (const file of files) {
        const extension = documentExtension(file.name);
        if (!allowedDocumentExtensions.has(extension)) throw new Error(`${file.name}: 지원하지 않는 파일 형식이야.`);
        if (file.size > MAX_DOCUMENT_SIZE) throw new Error(`${file.name}: 파일은 20MB 이하여야 해.`);

        const path = `${ownerType}/${ownerId}/${documentKindStorageSegment(kind)}/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("vendor-files").upload(path, file, {
          upsert: false,
          cacheControl: "3600",
          contentType: file.type || undefined,
        });
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

        const registered = await registerDocument({
          owner_type: ownerType,
          owner_id: ownerId,
          kind,
          file_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          valid_until: validUntil,
        });
        if (!registered.ok || !registered.id) {
          await supabase.storage.from("vendor-files").remove([path]);
          throw new Error(`${file.name}: ${registered.message}`);
        }
        completed += 1;

        if (analyzeAfterUpload && canAnalyzeDocument(file.name, file.type)) {
          const response = await fetch(`/api/documents/${registered.id}/analyze`, { method: "POST" });
          if (!response.ok) analysisFailures += 1;
        }
      }
      toast.success(`${completed}개 원본 문서를 등록했어.`);
      if (analysisFailures) toast.warning(`${analysisFailures}개 문서는 자동 분석하지 못했지만 원본은 보관했어.`);
      setFiles([]);
      setValidUntil("");
      if (inputRef.current) inputRef.current.value = "";
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "문서를 등록하지 못했어.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />관련 문서 등록</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>관련 문서 등록</DialogTitle><DialogDescription>원본을 비공개로 보관하고 등록 후 주요 내용을 자동 분석해.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">문서 종류<Select value={kind} onValueChange={(value) => setKind(value as DocumentRegistrationInput["kind"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{documentKinds.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-2 text-sm font-medium">유효기간 <span className="font-normal text-muted-foreground">선택</span><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
          </div>
          <label className="grid gap-2 text-sm font-medium">파일 <span className="font-normal text-muted-foreground">여러 개 선택 가능 · 파일당 최대 20MB</span><Input ref={inputRef} multiple type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.txt,.hwp" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
          {files.length ? <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="font-medium">선택한 파일 {files.length}개</p><ul className="mt-2 space-y-1 text-muted-foreground">{files.map((file) => <li key={`${file.name}-${file.lastModified}`} className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB</li>)}</ul></div> : null}
          <p className="text-xs text-muted-foreground">HWP는 원본 보관과 다운로드만 지원해. PDF로 변환해 올리면 자동 분석과 화면 미리보기가 가능해.</p>
        </div>
        <DialogFooter><Button disabled={uploading || !files.length} onClick={() => void submit()}>{uploading ? <Loader2 className="animate-spin" /> : <FileUp />}{uploading ? "등록·분석 중..." : "문서 등록"}</Button><Button disabled={uploading} variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
