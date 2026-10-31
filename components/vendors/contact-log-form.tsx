"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createContactLog } from "@/app/(main)/vendors/actions";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contactLogSchema, type ContactLogInput } from "@/lib/validators/vendor";

function nowInKstInput() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return parts.replace(" ", "T");
}

export function ContactLogForm({ vendorId, contacts, defaultAt }: { vendorId: string; contacts: { id: string; name: string; active: boolean }[]; defaultAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ContactLogInput>({
    resolver: zodResolver(contactLogSchema),
    defaultValues: { vendor_id: vendorId, contact_id: "", method: "통화", at: defaultAt, summary: "" },
  });

  function onSubmit(values: ContactLogInput) {
    startTransition(async () => {
      const result = await createContactLog(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      form.reset({ ...values, at: nowInKstInput(), summary: "" });
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form className="grid gap-3 rounded-xl border bg-muted/30 p-4 lg:grid-cols-[130px_180px_180px_1fr_auto] lg:items-end" onSubmit={form.handleSubmit(onSubmit)}>
        <input type="hidden" {...form.register("vendor_id")} />
        <FormField control={form.control} name="method" render={({ field }) => <FormItem><FormLabel>방법</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["통화", "문자", "메일", "방문"].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <FormField control={form.control} name="at" render={({ field }) => <FormItem><FormLabel>일시</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="contact_id" render={({ field }) => <FormItem><FormLabel>담당자</FormLabel><Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="선택 안 함" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">선택 안 함</SelectItem>{contacts.map((contact) => <SelectItem key={contact.id} value={contact.id}>{contact.name}{contact.active ? "" : " (비활성)"}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
        <FormField control={form.control} name="summary" render={({ field }) => <FormItem><FormLabel>한 줄 요약</FormLabel><FormControl><Input placeholder="통화·협의 내용을 간단히 입력" {...field} /></FormControl><FormMessage /></FormItem>} />
        <Button className="w-full lg:w-auto" disabled={pending} type="submit"><MessageSquarePlus />{pending ? "등록 중" : "빠른 등록"}</Button>
      </form>
    </Form>
  );
}
