"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveVendorContact } from "@/app/(main)/vendors/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { vendorContactSchema, type VendorContactInput } from "@/lib/validators/vendor";

export function ContactDialog({ vendorId, contact }: { vendorId: string; contact?: VendorContactInput }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(contact?.id);
  const emptyContact: VendorContactInput = {
    vendor_id: vendorId,
    name: "",
    title: "",
    phone: "",
    email: "",
    duty: "",
    is_primary: false,
    active: true,
  };
  const form = useForm<VendorContactInput>({
    resolver: zodResolver(vendorContactSchema),
    defaultValues: contact ?? emptyContact,
  });

  useEffect(() => {
    if (open) form.reset(contact ?? emptyContact);
  // emptyContact is recreated from the stable vendor id and only used when opening.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, form, open, vendorId]);

  function onSubmit(values: VendorContactInput) {
    startTransition(async () => {
      const result = await saveVendorContact(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={editing ? "sm" : "default"} variant={editing ? "outline" : "default"}>{editing ? <Pencil /> : <Plus />}{editing ? "수정" : "담당자 추가"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="size-5" />{editing ? "담당자 수정" : "담당자 추가"}</DialogTitle><DialogDescription>주 담당자로 지정하면 기존 주 담당자는 자동으로 해제돼.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <input type="hidden" {...form.register("vendor_id")} />
            {contact?.id ? <input type="hidden" {...form.register("id")} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>이름 *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>직책</FormLabel><FormControl><Input placeholder="예: 팀장" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>전화번호</FormLabel><FormControl><Input inputMode="tel" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>이메일</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>} />
            </div>
            <FormField control={form.control} name="duty" render={({ field }) => <FormItem><FormLabel>담당 업무</FormLabel><FormControl><Input placeholder="계약·견적 담당" {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="flex flex-wrap gap-5 rounded-lg bg-muted/60 p-3">
              <FormField control={form.control} name="is_primary" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><input checked={field.value} className="size-4" type="checkbox" onChange={field.onChange} /></FormControl><FormLabel className="font-normal">주 담당자로 지정</FormLabel></FormItem>} />
              <FormField control={form.control} name="active" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><input checked={field.value} className="size-4" type="checkbox" onChange={field.onChange} /></FormControl><FormLabel className="font-normal">현재 재직·활성</FormLabel></FormItem>} />
            </div>
            <DialogFooter><Button disabled={pending} type="submit">{pending ? "저장 중..." : "저장"}</Button><Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
