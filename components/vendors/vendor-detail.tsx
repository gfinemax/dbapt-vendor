"use client";

import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Download,
  FileText,
  History,
  Mail,
  MessageSquare,
  Phone,
  Star,
  UserRound,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deactivateVendorContact, getDocumentDownloadUrl } from "@/app/(main)/vendors/actions";
import { VendorStatusBadge } from "@/components/vendors/vendor-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dDay, formatDate, formatDateTime } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import type { VendorContactInput, VendorInput } from "@/lib/validators/vendor";

type VendorStatus = Database["public"]["Enums"]["vendor_status"];
type ProjectStage = Database["public"]["Enums"]["project_stage"];

const FileUploader = dynamic(
  () => import("@/components/documents/file-uploader").then((module) => module.FileUploader),
  { ssr: false },
);
const ContactDialog = dynamic(
  () => import("@/components/vendors/contact-dialog").then((module) => module.ContactDialog),
  { ssr: false },
);
const GoogleContactImportDialog = dynamic(
  () => import("@/components/vendors/google-contact-import-dialog").then((module) => module.GoogleContactImportDialog),
  { ssr: false },
);
const ContactLogForm = dynamic(
  () => import("@/components/vendors/contact-log-form").then((module) => module.ContactLogForm),
  { ssr: false },
);
const VendorFormDialog = dynamic(
  () => import("@/components/vendors/vendor-form-dialog").then((module) => module.VendorFormDialog),
  { ssr: false },
);

export type VendorDetailProps = {
  vendor: Omit<VendorInput, "internal_note"> & { id: string; status: VendorStatus; internal_note?: string };
  canManage: boolean;
  canImportGoogleContacts: boolean;
  googleContactsConnected: boolean;
  contactSyncs: Array<{ vendor_contact_id: string; google_resource_name: string | null; last_synced_at: string | null }>;
  defaultTab: "basic" | "contacts";
  contacts: Array<VendorContactInput & { id: string; created_at: string }>;
  projects: Array<{ id: string; title: string; category: string | null; stage: ProjectStage; role: string }>;
  documents: Array<{ id: string; kind: string; file_name: string; version: number; valid_until: string | null; created_at: string }>;
  logs: Array<{ id: string; method: string; at: string; summary: string; contact_name: string | null }>;
  reviews: Array<{ id: string; project_title: string; quality: number; schedule: number; communication: number; comment: string | null; created_at: string }>;
  timeline: Array<{ id: string; kind: string; title: string; date: string; description: string | null; href: string | null }>;
  todayKst: string;
  defaultContactAt: string;
};

function LabelValue({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 min-h-5 text-sm">{children || "-"}</dd></div>;
}

function expiryBadge(date: string | null, todayKst: string) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(`${todayKst}T00:00:00Z`).getTime();
  const remaining = Math.round((target - today) / 86_400_000);
  if (remaining < 0) return <Badge variant="destructive">만료 {dDay(date, todayKst)}</Badge>;
  if (remaining <= 30) return <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">만료 임박 {dDay(date, todayKst)}</Badge>;
  return <Badge variant="secondary">{dDay(date, todayKst)}</Badge>;
}

export function VendorDetail({ vendor, canManage, canImportGoogleContacts, googleContactsConnected, contactSyncs, defaultTab, contacts, projects, documents, logs, reviews, timeline, todayKst, defaultContactAt }: VendorDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeContacts = contacts.filter((contact) => contact.active);
  const contactSyncMap = new Map(contactSyncs.map((sync) => [sync.vendor_contact_id, sync]));

  function deactivate(contactId: string) {
    startTransition(async () => {
      const result = await deactivateVendorContact(contactId, vendor.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function download(documentId: string) {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(documentId);
      if (!result.ok || !result.url) {
        toast.error(result.message);
        return;
      }
      window.location.assign(result.url);
    });
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link className="text-sm text-muted-foreground hover:text-foreground hover:underline" href="/vendors">← 용역사 목록</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">{vendor.name}</h1><VendorStatusBadge status={vendor.status} /></div>
          <p className="mt-1 text-sm text-muted-foreground">{vendor.category} · {vendor.biz_no || "사업자번호 미등록"}</p>
        </div>
        {canManage ? <VendorFormDialog vendor={{ ...vendor, internal_note: vendor.internal_note ?? "" }} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm"><CardContent className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2 text-blue-700"><UserRound /></div><div><p className="text-xs text-muted-foreground">활성 담당자</p><p className="text-xl font-bold">{activeContacts.length}명</p></div></CardContent></Card>
        <Card size="sm"><CardContent className="flex items-center gap-3"><div className="rounded-lg bg-violet-50 p-2 text-violet-700"><BriefcaseBusiness /></div><div><p className="text-xs text-muted-foreground">참여 용역</p><p className="text-xl font-bold">{projects.length}건</p></div></CardContent></Card>
        <Card size="sm"><CardContent className="flex items-center gap-3"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><FileText /></div><div><p className="text-xs text-muted-foreground">등록 서류</p><p className="text-xl font-bold">{documents.length}건</p></div></CardContent></Card>
        <Card size="sm"><CardContent className="flex items-center gap-3"><div className="rounded-lg bg-amber-50 p-2 text-amber-700"><MessageSquare /></div><div><p className="text-xs text-muted-foreground">연락 이력</p><p className="text-xl font-bold">{logs.length}건</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue={defaultTab}>
        <div className="overflow-x-auto pb-1"><TabsList variant="line"><TabsTrigger value="basic">기본정보</TabsTrigger><TabsTrigger value="contacts">담당자</TabsTrigger><TabsTrigger value="projects">참여 용역 건</TabsTrigger><TabsTrigger value="documents">서류</TabsTrigger><TabsTrigger value="logs">연락 이력</TabsTrigger><TabsTrigger value="reviews">평가</TabsTrigger></TabsList></div>

        <TabsContent value="basic">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />업체 기본정보</CardTitle></CardHeader><CardContent><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3"><LabelValue label="상호">{vendor.name}</LabelValue><LabelValue label="대표자">{vendor.ceo}</LabelValue><LabelValue label="업체 연락처">{vendor.phone}</LabelValue><LabelValue label="담당자">{vendor.primary_contact_name}</LabelValue><LabelValue label="담당자 연락처">{vendor.primary_contact_phone}</LabelValue><LabelValue label="사업자번호">{vendor.biz_no}</LabelValue><LabelValue label="분야">{vendor.category}</LabelValue><LabelValue label="주소">{vendor.address}</LabelValue><LabelValue label="홈페이지">{vendor.homepage ? <a className="text-blue-700 hover:underline" href={vendor.homepage} rel="noreferrer" target="_blank">{vendor.homepage}</a> : "-"}</LabelValue><LabelValue label="관계인">{vendor.related_person}</LabelValue><LabelValue label="관계인 연락처">{vendor.related_person_phone}</LabelValue><LabelValue label="은행">{vendor.bank_name}</LabelValue><LabelValue label="계좌번호">{vendor.bank_account}</LabelValue><LabelValue label="메모">{vendor.memo}</LabelValue>{vendor.internal_note !== undefined ? <div className="sm:col-span-2 lg:col-span-3"><LabelValue label="내부 검토의견"><span className="block rounded-lg bg-amber-50 p-3 text-amber-900">{vendor.internal_note || "등록된 내부 검토의견이 없어."}</span></LabelValue></div> : null}</dl></CardContent></Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            {canImportGoogleContacts ? googleContactsConnected ? <GoogleContactImportDialog vendorId={vendor.id} /> : <Button asChild variant="outline"><Link href="/settings">Google 연결 필요</Link></Button> : null}
            {canManage ? <ContactDialog vendorId={vendor.id} /> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">{contacts.length ? contacts.map((contact) => (
            <Card key={contact.id} className={!contact.active ? "opacity-60" : ""} size="sm"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex flex-wrap items-center gap-2">{contact.name}{contact.is_primary ? <Badge>주 담당</Badge> : null}{!contact.active ? <Badge variant="secondary">비활성</Badge> : null}{contactSyncMap.get(contact.id)?.google_resource_name ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">Google 연락처 연결됨</Badge> : null}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{contact.title || "직책 미등록"} · {contact.duty || "담당 업무 미등록"}</p></div>{canManage ? <ContactDialog contact={contact} vendorId={vendor.id} /> : null}</div></CardHeader><CardContent className="space-y-2"><p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />{contact.phone || "전화번호 미등록"}</p><p className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />{contact.email || "이메일 미등록"}</p>{contactSyncMap.get(contact.id)?.last_synced_at ? <p className="text-xs text-muted-foreground">Google 연락처 연결 {formatDateTime(contactSyncMap.get(contact.id)!.last_synced_at!)}</p> : null}<div className="flex flex-wrap gap-2">{canManage && contact.active ? <Button disabled={pending} size="sm" variant="ghost" onClick={() => deactivate(contact.id)}>비활성 처리</Button> : null}</div></CardContent></Card>
          )) : <Card className="border-dashed md:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">등록된 담당자가 없어.</CardContent></Card>}</div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="grid gap-4 md:grid-cols-2">{projects.length ? projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`}><Card className="h-full transition hover:ring-foreground/20" size="sm"><CardHeader><div className="flex items-start justify-between"><div><CardTitle>{project.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{project.category ?? "분야 미분류"}</p></div><Badge variant="secondary">{project.stage}</Badge></div></CardHeader><CardContent><Badge variant="outline">{project.role}</Badge></CardContent></Card></Link>) : <Card className="border-dashed md:col-span-2"><CardContent className="py-12 text-center text-muted-foreground">참여 중인 용역 건이 없어.</CardContent></Card>}</div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {canManage ? <FileUploader vendorId={vendor.id} /> : null}
          <Card className="py-0"><div className="divide-y">{documents.length ? documents.map((document) => <div key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{document.kind}</Badge><span className="truncate font-medium">{document.file_name}</span><span className="text-xs text-muted-foreground">v{document.version}</span>{expiryBadge(document.valid_until, todayKst)}</div><p className="mt-1 text-xs text-muted-foreground">등록 {formatDate(document.created_at)}{document.valid_until ? ` · 유효기간 ${formatDate(document.valid_until)}` : ""}</p></div><Button disabled={pending} size="sm" variant="outline" onClick={() => download(document.id)}><Download />60초 다운로드</Button></div>) : <div className="p-10 text-center text-muted-foreground">등록된 서류가 없어.</div>}</div></Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          {canManage ? <ContactLogForm contacts={contacts.map(({ id, name, active }) => ({ id, name, active }))} defaultAt={defaultContactAt} vendorId={vendor.id} /> : null}
          <Card className="py-0"><div className="divide-y">{logs.length ? logs.map((log) => <div key={log.id} className="flex gap-3 p-4"><div className="mt-0.5 rounded-lg bg-muted p-2"><MessageSquare className="size-4" /></div><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{log.method}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(log.at)}</span>{log.contact_name ? <span className="text-xs text-muted-foreground">· {log.contact_name}</span> : null}</div><p className="mt-2">{log.summary}</p></div></div>) : <div className="p-10 text-center text-muted-foreground">등록된 연락 이력이 없어.</div>}</div></Card>
        </TabsContent>

        <TabsContent value="reviews">
          <div className="grid gap-4 md:grid-cols-2">{reviews.length ? reviews.map((review) => <Card key={review.id} size="sm"><CardHeader><CardTitle>{review.project_title}</CardTitle><p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">품질</p><p className="mt-1 font-bold">{review.quality}/5</p></div><div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">일정</p><p className="mt-1 font-bold">{review.schedule}/5</p></div><div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">소통</p><p className="mt-1 font-bold">{review.communication}/5</p></div></div>{review.comment ? <p className="mt-3 text-sm">{review.comment}</p> : null}</CardContent></Card>) : <Card className="border-dashed md:col-span-2"><CardContent className="flex min-h-44 flex-col items-center justify-center text-muted-foreground"><Star className="mb-2 size-7" />등록된 평가가 없어.</CardContent></Card>}</div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-5" />통합 타임라인</CardTitle></CardHeader>
        <CardContent>{timeline.length ? <ol className="relative ml-2 border-l pl-6">{timeline.map((item) => <li key={item.id} className="relative pb-6 last:pb-0"><span className="absolute -left-[31px] top-0 flex size-4 items-center justify-center rounded-full border-2 border-background bg-foreground" /><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.kind}</Badge><time className="text-xs text-muted-foreground">{formatDate(item.date)}</time></div>{item.href ? <Link className="mt-1 block font-semibold hover:underline" href={item.href}>{item.title}</Link> : <p className="mt-1 font-semibold">{item.title}</p>}{item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}</li>)}</ol> : <div className="flex min-h-36 flex-col items-center justify-center text-muted-foreground"><CalendarClock className="mb-2 size-7" />표시할 견적·계약·협의·일정이 없어.</div>}</CardContent>
      </Card>
    </section>
  );
}
