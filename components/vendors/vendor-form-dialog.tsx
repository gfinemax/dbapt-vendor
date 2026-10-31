"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveVendor } from "@/app/(main)/vendors/actions";
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
import { vendorSchema, vendorStatuses, type VendorInput } from "@/lib/validators/vendor";

const emptyVendor: VendorInput = {
  name: "",
  biz_no: "",
  ceo: "",
  address: "",
  category: "",
  homepage: "",
  bank_name: "",
  bank_account: "",
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(vendor?.id);
  const form = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: vendor ?? emptyVendor,
  });

  useEffect(() => {
    if (open) form.reset(vendor ?? emptyVendor);
  }, [form, open, vendor]);

  function onSubmit(values: VendorInput) {
    startTransition(async () => {
      const result = await saveVendor(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      if (!editing && result.id) {
        router.push(`/vendors/${result.id}`);
      } else {
        router.refresh();
      }
    });
  }

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
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
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
