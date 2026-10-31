"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createManualEvent } from "@/app/(main)/schedule/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { manualEventSchema, type ManualEventInput } from "@/lib/validators/event";

function todayKst() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()); }

export function EventFormDialog({ projects, initialDate }: { projects: { id: string; title: string }[]; initialDate?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<ManualEventInput>({ resolver: zodResolver(manualEventSchema), defaultValues: { project_id: projects[0]?.id ?? "", type: "업체미팅", title: "", date: initialDate ?? todayKst(), end_date: "", status: "예정", memo: "" } });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!projects.length}><Plus />일정 추가</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>수동 일정 추가</DialogTitle><DialogDescription>견적 마감, 업체 미팅, 이사회 상정 같은 일정을 직접 등록해.</DialogDescription></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit((values) => startTransition(async () => { const result = await createManualEvent(values); if (result.ok) { toast.success(result.message); setOpen(false); form.reset({ ...values, title: "", memo: "" }); router.refresh(); } else toast.error(result.message); }))}><div className="grid gap-4 sm:grid-cols-2">
    <FormField control={form.control} name="project_id" render={({ field }) => <FormItem><FormLabel>용역 건 *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="용역 건 선택" /></SelectTrigger></FormControl><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="type" render={({ field }) => <FormItem><FormLabel>유형 *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["견적마감", "업체미팅", "이사회상정", "계약체결", "착수", "중간점검", "대금지급", "준공", "보증만료", "후속조치", "기타"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="date" render={({ field }) => <FormItem><FormLabel>시작일 *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="end_date" render={({ field }) => <FormItem><FormLabel>종료일</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} /></div><FormField control={form.control} name="title" render={({ field }) => <FormItem><FormLabel>제목 *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="memo" render={({ field }) => <FormItem><FormLabel>메모</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} /><DialogFooter><Button disabled={pending} type="submit">{pending ? "저장 중..." : "일정 저장"}</Button><Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter></form></Form></DialogContent></Dialog>;
}
