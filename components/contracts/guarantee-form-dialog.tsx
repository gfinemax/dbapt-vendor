"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createContractDocument, createGuarantee } from "@/app/(main)/contracts/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { guaranteeSchema, type GuaranteeInput } from "@/lib/validators/contract";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
function todayKst() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()); }
function safeFileName(name: string) { return name.normalize("NFKC").replace(/[^0-9A-Za-z가-힣._-]+/g, "_").slice(-180) || "guarantee"; }

export function GuaranteeFormDialog({ contractId, projectId }: { contractId: string; projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const form = useForm<GuaranteeInput>({ resolver: zodResolver(guaranteeSchema), defaultValues: { contract_id: contractId, project_id: projectId, type: "하자", issuer: "", amount: 0, starts_at: todayKst(), expires_at: todayKst() } });

  async function uploadDocument(guaranteeId: string, selectedFile: File) {
    if (selectedFile.size > MAX_FILE_SIZE) throw new Error("파일 크기는 20MB 이하여야 해.");
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "png", "jpg", "jpeg", "hwp"].includes(extension)) throw new Error("PDF·이미지·한글(hwp) 파일만 첨부할 수 있어.");
    const supabase = createClient();
    const path = `contract/${contractId}/보증증권/${guaranteeId}_${Date.now()}_${crypto.randomUUID()}_${safeFileName(selectedFile.name)}`;
    const { error } = await supabase.storage.from("vendor-files").upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || undefined });
    if (error) throw new Error(`보증증권 업로드 실패: ${error.message}`);
    const result = await createContractDocument({ contract_id: contractId, project_id: projectId, kind: "보증증권", file_path: path, file_name: selectedFile.name });
    if (!result.ok) { await supabase.storage.from("vendor-files").remove([path]); throw new Error(result.message); }
  }

  function onSubmit(values: GuaranteeInput) {
    startTransition(async () => {
      const result = await createGuarantee(values);
      if (!result.ok || !result.id) { toast.error(result.message); return; }
      try { if (file) await uploadDocument(result.id, file); toast.success(file ? `${result.message} 파일도 첨부했어.` : result.message); }
      catch (error) { toast.warning(`${result.message} ${error instanceof Error ? error.message : "파일 첨부는 실패했어."}`); }
      setOpen(false); setFile(null); router.refresh();
    });
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="outline"><Plus />보증증권 등록</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>보증증권 등록</DialogTitle><DialogDescription>만료일 30일 전 일정이 자동으로 만들어져.</DialogDescription></DialogHeader>
      <Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}><div className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>종류 *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["이행", "하자", "선급금"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <FormField control={form.control} name="issuer" render={({ field }) => <FormItem><FormLabel>발급기관</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>보증금액 *</FormLabel><FormControl><Input min={0} type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
        <div />
        <FormField control={form.control} name="starts_at" render={({ field }) => <FormItem><FormLabel>시작일 *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="expires_at" render={({ field }) => <FormItem><FormLabel>만료일 *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
      </div><label className="grid gap-2 text-sm font-medium">보증증권 파일 <span className="font-normal text-muted-foreground">선택 · 최대 20MB</span><Input accept=".pdf,.png,.jpg,.jpeg,.hwp" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><DialogFooter><Button disabled={pending} type="submit">{pending ? "저장 중..." : "보증증권 저장"}</Button><Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter></form></Form>
    </DialogContent>
  </Dialog>;
}
