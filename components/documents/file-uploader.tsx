"use client";

import { FileUp, Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createVendorDocument } from "@/app/(main)/vendors/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  documentKindStorageSegment,
  safeDocumentFileName,
} from "@/lib/documents";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedExtensions = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "xls", "xlsx", "hwp"]);
const kinds = ["사업자등록증", "견적서", "제안서", "계약서", "보증증권", "회의자료", "기타"] as const;

export function FileUploader({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<(typeof kinds)[number]>("사업자등록증");
  const [validUntil, setValidUntil] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLocaleLowerCase();
    if (!extension || !allowedExtensions.has(extension)) {
      toast.error("PDF·이미지·엑셀·한글(hwp) 파일만 올릴 수 있어.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("파일 크기는 20MB 이하여야 해.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = `vendor/${vendorId}/${documentKindStorageSegment(kind)}/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(file.name)}`;
    const { error } = await supabase.storage.from("vendor-files").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) {
      toast.error(`업로드하지 못했어: ${error.message}`);
      setUploading(false);
      return;
    }

    const result = await createVendorDocument({
      owner_id: vendorId,
      kind,
      file_path: path,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      valid_until: validUntil,
    });
    if (!result.ok) {
      await supabase.storage.from("vendor-files").remove([path]);
      toast.error(result.message);
      setUploading(false);
      return;
    }

    toast.success(result.message);
    if (result.id) {
      const response = await fetch(`/api/documents/${result.id}/analyze`, { method: "POST" });
      if (!response.ok) toast.warning("원본은 등록했지만 자동 분석은 완료하지 못했어.");
    }
    setUploading(false);
    setValidUntil("");
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">서류 종류<select className="h-8 rounded-lg border bg-background px-2.5 font-normal" value={kind} onChange={(event) => setKind(event.target.value as (typeof kinds)[number])}>{kinds.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="grid gap-1.5 text-sm font-medium">유효기간 <span className="sr-only">선택 사항</span><Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
      </div>
      <div
        className={cn("flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-background p-5 text-center transition", dragging && "border-primary bg-primary/5")}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }}
      >
        {uploading ? <Loader2 className="mb-2 size-7 animate-spin text-muted-foreground" /> : <UploadCloud className="mb-2 size-7 text-muted-foreground" />}
        <p className="font-medium">파일을 끌어 놓거나 선택해 줘.</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF·이미지·엑셀·한글(hwp), 최대 20MB</p>
        <input ref={inputRef} accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.hwp,image/*" className="sr-only" disabled={uploading} type="file" onChange={(event) => void upload(event.target.files?.[0])} />
        <Button className="mt-3" disabled={uploading} type="button" variant="outline" onClick={() => inputRef.current?.click()}><FileUp />{uploading ? "업로드 중..." : "파일 선택"}</Button>
      </div>
    </div>
  );
}
