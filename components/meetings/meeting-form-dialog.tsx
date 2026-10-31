"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createMeeting, createMeetingDocument } from "@/app/(main)/meetings/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { meetingSchema, type MeetingInput } from "@/lib/validators/meeting";

type ProjectOption = { id: string; title: string; vendors: { id: string; name: string }[] };
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function nowKstLocal() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(" ", "T"); }
function todayKst() { return nowKstLocal().slice(0, 10); }
function safeFileName(name: string) { return name.normalize("NFKC").replace(/[^0-9A-Za-z가-힣._-]+/g, "_").slice(-180) || "meeting"; }

export function MeetingFormDialog({ projects, users, fixedProjectId }: { projects: ProjectOption[]; users: { id: string; name: string }[]; fixedProjectId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const initialProject = projects.find((project) => project.id === fixedProjectId) ?? projects[0];
  const form = useForm<MeetingInput>({ resolver: zodResolver(meetingSchema), defaultValues: { project_id: initialProject?.id ?? "", vendor_id: "", held_at: nowKstLocal(), method: "대면", attendees_union: "", attendees_vendor: "", agenda: "", notes: "", decisions: "", actions: [{ content: "", assignee_user_id: "", due_date: todayKst() }] } });
  const actions = useFieldArray({ control: form.control, name: "actions" });
  const projectId = useWatch({ control: form.control, name: "project_id" });
  const selectedProject = projects.find((project) => project.id === projectId) ?? initialProject;

  async function uploadFiles(meetingId: string, selectedFiles: File[]) {
    const supabase = createClient();
    for (const file of selectedFiles) {
      if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: 20MB를 초과했어.`);
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["pdf", "png", "jpg", "jpeg", "gif", "webp", "xls", "xlsx", "hwp"].includes(extension)) throw new Error(`${file.name}: 지원하지 않는 파일 형식이야.`);
      const path = `meeting/${meetingId}/회의자료/${Date.now()}_${crypto.randomUUID()}_${safeFileName(file.name)}`;
      const { error } = await supabase.storage.from("vendor-files").upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw new Error(`${file.name} 업로드 실패: ${error.message}`);
      const result = await createMeetingDocument({ meeting_id: meetingId, project_id: projectId, file_path: path, file_name: file.name });
      if (!result.ok) { await supabase.storage.from("vendor-files").remove([path]); throw new Error(result.message); }
    }
  }

  function onSubmit(values: MeetingInput) {
    startTransition(async () => {
      const result = await createMeeting(values);
      if (!result.ok || !result.id) { toast.error(result.message); return; }
      try { if (files.length) await uploadFiles(result.id, files); toast.success(files.length ? `${result.message} 파일 ${files.length}개도 첨부했어.` : result.message); }
      catch (error) { toast.warning(`${result.message} ${error instanceof Error ? error.message : "일부 파일 첨부는 실패했어."}`); }
      setOpen(false); setFiles([]); router.push(`/meetings/${result.id}`); router.refresh();
    });
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={!projects.length}><Plus />협의록 작성</Button></DialogTrigger><DialogContent className="max-h-[96vh] overflow-y-auto p-4 sm:max-w-3xl sm:p-6"><DialogHeader><DialogTitle>협의록 작성</DialogTitle><DialogDescription>협의 내용과 후속조치를 한 번에 기록해. 기한 일정은 자동으로 만들어져.</DialogDescription></DialogHeader><Form {...form}><form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
    <div className="grid gap-3 sm:grid-cols-2"><FormField control={form.control} name="project_id" render={({ field }) => <FormItem><FormLabel>용역 건 *</FormLabel><Select disabled={Boolean(fixedProjectId)} value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue("vendor_id", ""); }}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="용역 건 선택" /></SelectTrigger></FormControl><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="vendor_id" render={({ field }) => <FormItem><FormLabel>업체</FormLabel><Select value={field.value || "none"} onValueChange={(value) => field.onChange(value === "none" ? "" : value)}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="업체 없음" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">업체 없음</SelectItem>{selectedProject?.vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="held_at" render={({ field }) => <FormItem><FormLabel>협의 일시 *</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="method" render={({ field }) => <FormItem><FormLabel>방식 *</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["대면", "전화", "화상", "메일"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} /><FormField control={form.control} name="attendees_union" render={({ field }) => <FormItem><FormLabel>조합 참석자</FormLabel><FormControl><Input placeholder="예: 조합장, 사무국장" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="attendees_vendor" render={({ field }) => <FormItem><FormLabel>업체 참석자</FormLabel><FormControl><Input placeholder="예: 대표, 현장소장" {...field} /></FormControl><FormMessage /></FormItem>} /></div>
    <FormField control={form.control} name="agenda" render={({ field }) => <FormItem><FormLabel>안건 *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>논의 내용</FormLabel><FormControl><Textarea className="min-h-28" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="decisions" render={({ field }) => <FormItem><FormLabel>결정사항</FormLabel><FormControl><Textarea className="min-h-24" {...field} /></FormControl><FormMessage /></FormItem>} />
    <div className="space-y-2"><div className="flex items-center justify-between"><FormLabel>후속조치</FormLabel><Button size="sm" type="button" variant="outline" onClick={() => actions.append({ content: "", assignee_user_id: "", due_date: todayKst() })}><Plus />행 추가</Button></div>{actions.fields.map((action, index) => <div key={action.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_150px_145px_auto]"><Input aria-label={`후속조치 ${index + 1} 내용`} placeholder="조치 내용" {...form.register(`actions.${index}.content`)} /><Select value={form.watch(`actions.${index}.assignee_user_id`) || "none"} onValueChange={(value) => form.setValue(`actions.${index}.assignee_user_id`, value === "none" ? "" : value, { shouldValidate: true })}><SelectTrigger aria-label={`후속조치 ${index + 1} 담당자`} className="w-full"><SelectValue placeholder="담당자" /></SelectTrigger><SelectContent><SelectItem value="none">미배정</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Input aria-label={`후속조치 ${index + 1} 기한`} type="date" {...form.register(`actions.${index}.due_date`)} /><Button aria-label="후속조치 삭제" size="icon" type="button" variant="ghost" onClick={() => actions.remove(index)}><Trash2 /></Button></div>)}</div>
    <label className="grid gap-2 text-sm font-medium">사진·파일 첨부 <span className="font-normal text-muted-foreground">여러 개 선택 가능 · 각 20MB 이하</span><Input accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.hwp,image/*" multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
    <DialogFooter><Button disabled={pending} type="submit"><Paperclip />{pending ? "저장 중..." : "협의록 저장"}</Button><Button disabled={pending} type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button></DialogFooter>
  </form></Form></DialogContent></Dialog>;
}
