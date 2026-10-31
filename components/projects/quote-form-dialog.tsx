"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { createQuote, createQuoteDocument } from "@/app/(main)/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { quoteSchema, type QuoteInput } from "@/lib/validators/quote";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function todayKst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function safeFileName(name: string) {
  return name.normalize("NFKC").replace(/[^0-9A-Za-z가-힣._-]+/g, "_").slice(-180) || "quote";
}

export function QuoteFormDialog({ projectId, vendors }: { projectId: string; vendors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      project_id: projectId,
      vendor_id: vendors[0]?.id ?? "",
      received_at: todayKst(),
      amount: 0,
      vat_included: true,
      duration_days: 30,
      warranty_months: 12,
      payment_terms: "",
      items: [{ name: "", amount: 0 }],
      note: "",
    },
  });
  const items = useFieldArray({ control: form.control, name: "items" });

  async function uploadQuoteFile(quoteId: string, selectedFile: File) {
    if (selectedFile.size > MAX_FILE_SIZE) throw new Error("파일 크기는 20MB 이하여야 해.");
    const extension = selectedFile.name.split(".").pop()?.toLocaleLowerCase();
    if (!extension || !["pdf", "png", "jpg", "jpeg", "xls", "xlsx", "hwp"].includes(extension)) {
      throw new Error("PDF·이미지·엑셀·한글(hwp) 파일만 첨부할 수 있어.");
    }
    const supabase = createClient();
    const path = `quote/${quoteId}/견적서/${Date.now()}_${crypto.randomUUID()}_${safeFileName(selectedFile.name)}`;
    const { error } = await supabase.storage.from("vendor-files").upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || undefined });
    if (error) throw new Error(`견적서 업로드 실패: ${error.message}`);
    const result = await createQuoteDocument({ quote_id: quoteId, project_id: projectId, file_path: path, file_name: selectedFile.name });
    if (!result.ok) {
      await supabase.storage.from("vendor-files").remove([path]);
      throw new Error(result.message);
    }
  }

  function onSubmit(values: QuoteInput) {
    startTransition(async () => {
      const result = await createQuote(values);
      if (!result.ok || !result.id) {
        toast.error(result.message);
        return;
      }
      try {
        if (file) await uploadQuoteFile(result.id, file);
        toast.success(file ? `${result.message} 견적서도 첨부했어.` : result.message);
        setOpen(false);
        setFile(null);
        router.refresh();
      } catch (error) {
        toast.warning(`${result.message} ${error instanceof Error ? error.message : "파일 첨부는 실패했어."}`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button disabled={!vendors.length}><Plus />견적 등록</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>견적 등록</DialogTitle><DialogDescription>동일 업체의 다음 버전 번호는 저장할 때 자동으로 지정돼.</DialogDescription></DialogHeader>
      <Form {...form}><form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <input type="hidden" {...form.register("project_id")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField control={form.control} name="vendor_id" render={({ field }) => <FormItem><FormLabel>업체 *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="업체 선택" /></SelectTrigger></FormControl><SelectContent>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
          <FormField control={form.control} name="received_at" render={({ field }) => <FormItem><FormLabel>접수일 *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>총액 *</FormLabel><FormControl><Input inputMode="numeric" min={0} type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="duration_days" render={({ field }) => <FormItem><FormLabel>기간(일)</FormLabel><FormControl><Input min={1} type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="warranty_months" render={({ field }) => <FormItem><FormLabel>하자보증(개월)</FormLabel><FormControl><Input min={0} type="number" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="vat_included" render={({ field }) => <FormItem className="flex items-end"><label className="flex h-8 items-center gap-2 rounded-lg border px-3 text-sm"><input checked={field.value} className="size-4" type="checkbox" onChange={field.onChange} />부가세 포함 금액</label></FormItem>} />
        </div>
        <FormField control={form.control} name="payment_terms" render={({ field }) => <FormItem><FormLabel>지급조건 *</FormLabel><FormControl><Input placeholder="예: 계약금 30%, 중도금 40%, 잔금 30%" {...field} /></FormControl><FormMessage /></FormItem>} />
        <div className="space-y-2"><div className="flex items-center justify-between"><FormLabel>항목별 금액</FormLabel><Button size="sm" type="button" variant="outline" onClick={() => items.append({ name: "", amount: 0 })}><Plus />행 추가</Button></div>
          {items.fields.map((item, index) => <div key={item.id} className="grid grid-cols-[1fr_140px_auto] gap-2">
            <Input aria-label={`항목 ${index + 1} 이름`} placeholder="항목명" {...form.register(`items.${index}.name`)} />
            <Input aria-label={`항목 ${index + 1} 금액`} min={0} type="number" {...form.register(`items.${index}.amount`, { valueAsNumber: true })} />
            <Button aria-label="항목 삭제" disabled={items.fields.length === 1} size="icon" type="button" variant="ghost" onClick={() => items.remove(index)}><Trash2 /></Button>
          </div>)}
        </div>
        <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>비고</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
        <label className="grid gap-2 text-sm font-medium">견적서 첨부 <span className="font-normal text-muted-foreground">선택 · 최대 20MB</span><Input accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx,.hwp" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <DialogFooter><Button disabled={pending} type="submit"><FileUp />{pending ? "저장 중..." : "견적 저장"}</Button><Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter>
      </form></Form>
    </DialogContent>
  </Dialog>;
}
