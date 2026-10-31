"use client";

import dynamic from "next/dynamic";
import { CalendarDays, FileSignature, FileText, MessageSquareText, WalletCards } from "lucide-react";
import Link from "next/link";

import { ProjectStageBadge } from "@/components/projects/project-stage-badge";
import { QuoteComparison } from "@/components/projects/quote-comparison";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/lib/database.types";
import { formatDate, formatDateTime, formatWon } from "@/lib/format";
import type { QuoteComparisonRow } from "@/lib/quotes";

const QuoteFormDialog = dynamic(
  () => import("@/components/projects/quote-form-dialog").then((module) => module.QuoteFormDialog),
  { ssr: false },
);
const ContractFormDialog = dynamic(
  () => import("@/components/contracts/contract-form-dialog").then((module) => module.ContractFormDialog),
  { ssr: false },
);

type ProjectStage = Database["public"]["Enums"]["project_stage"];
type ProjectCategory = Database["public"]["Enums"]["project_category"];

export type ProjectDetailProps = {
  project: {
    id: string;
    title: string;
    category: ProjectCategory;
    description: string | null;
    budget: number;
    stage: ProjectStage;
    ownerName: string | null;
    boardResolution: string | null;
    selectedVendorId: string | null;
    selectedVendorName: string | null;
    selectionReason: string | null;
    internalNote?: string;
  };
  participants: { id: string; name: string; role: string }[];
  quotes: QuoteComparisonRow[];
  contracts: { id: string; title: string; vendorName: string; signedAt: string; amount: number; vat: number }[];
  meetings: { id: string; heldAt: string; method: string; agenda: string; vendorName: string | null }[];
  events: { id: string; type: string; title: string; date: string; status: string }[];
  documents: { id: string; kind: string; fileName: string; version: number; createdAt: string }[];
  canCreateQuote: boolean;
  canManageContracts: boolean;
  canSelect: boolean;
  defaultTab: string;
};

export function ProjectDetail({ project, participants, quotes, contracts, meetings, events, documents, canCreateQuote, canManageContracts, canSelect, defaultTab }: ProjectDetailProps) {
  const participantOptions = participants.map(({ id, name }) => ({ id, name }));
  return <section className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><Link className="text-sm text-muted-foreground hover:underline" href="/projects">← 용역 건 목록</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">{project.title}</h1><ProjectStageBadge stage={project.stage} /></div><p className="mt-1 text-sm text-muted-foreground">{project.category} · 담당 {project.ownerName ?? "미배정"}</p></div>{canCreateQuote ? <QuoteFormDialog projectId={project.id} vendors={participantOptions} /> : null}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Card size="sm"><CardContent><p className="text-xs text-muted-foreground">예산</p><p className="mt-1 text-xl font-bold">{formatWon(project.budget)}</p></CardContent></Card><Card size="sm"><CardContent><p className="text-xs text-muted-foreground">참여 업체</p><p className="mt-1 text-xl font-bold">{participants.length}곳</p></CardContent></Card><Card size="sm"><CardContent><p className="text-xs text-muted-foreground">등록 견적</p><p className="mt-1 text-xl font-bold">{quotes.length}건</p></CardContent></Card><Card size="sm"><CardContent><p className="text-xs text-muted-foreground">선정 업체</p><p className="mt-1 truncate text-xl font-bold">{project.selectedVendorName ?? "미선정"}</p></CardContent></Card></div>
    <Tabs defaultValue={["overview", "quotes", "contracts", "meetings", "schedule", "documents"].includes(defaultTab) ? defaultTab : "overview"}>
      <div className="overflow-x-auto pb-1"><TabsList variant="line"><TabsTrigger value="overview">개요</TabsTrigger><TabsTrigger value="quotes">견적비교</TabsTrigger><TabsTrigger value="contracts">계약</TabsTrigger><TabsTrigger value="meetings">협의</TabsTrigger><TabsTrigger value="schedule">일정</TabsTrigger><TabsTrigger value="documents">문서</TabsTrigger></TabsList></div>
      <TabsContent value="overview"><div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>용역 개요</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-muted-foreground">설명</p><p className="mt-1 whitespace-pre-wrap">{project.description ?? "등록된 설명이 없어."}</p></div><div><p className="text-xs text-muted-foreground">참여 업체</p><div className="mt-2 flex flex-wrap gap-2">{participants.map((vendor) => <Badge key={vendor.id} variant={vendor.role === "선정" ? "default" : "outline"}>{vendor.name} · {vendor.role}</Badge>)}</div></div>{project.internalNote !== undefined ? <div className="rounded-lg bg-amber-50 p-3 text-amber-900"><p className="text-xs font-semibold">내부 검토의견</p><p className="mt-1">{project.internalNote || "등록된 내용이 없어."}</p></div> : null}</CardContent></Card><Card><CardHeader><CardTitle>선정 정보</CardTitle></CardHeader><CardContent className="space-y-4"><div><p className="text-xs text-muted-foreground">선정 업체</p><p className="mt-1 font-semibold">{project.selectedVendorName ?? "미선정"}</p></div><div><p className="text-xs text-muted-foreground">선정 사유</p><p className="mt-1">{project.selectionReason ?? "-"}</p></div><div><p className="text-xs text-muted-foreground">이사회 의결</p><p className="mt-1">{project.boardResolution ?? "-"}</p></div></CardContent></Card></div></TabsContent>
      <TabsContent value="quotes"><QuoteComparison canSelect={canSelect} participants={participantOptions} projectId={project.id} projectTitle={project.title} quotes={quotes} /></TabsContent>
      <TabsContent value="contracts"><div className="space-y-3">{canManageContracts ? <div className="flex justify-end"><ContractFormDialog fixedProjectId={project.id} projects={[{ id: project.id, title: project.title, selectedVendorId: project.selectedVendorId, vendors: participantOptions }]} /></div> : null}<Card className="py-0"><div className="divide-y">{contracts.length ? contracts.map((contract) => <Link key={contract.id} className="flex flex-col gap-2 p-4 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between" href={`/contracts/${contract.id}`}><div><p className="font-semibold">{contract.title}</p><p className="text-sm text-muted-foreground">{contract.vendorName} · {formatDate(contract.signedAt)}</p></div><p className="font-bold">{formatWon(contract.amount + contract.vat)}</p></Link>) : <div className="p-10 text-center text-muted-foreground"><FileSignature className="mx-auto mb-2 size-7" />등록된 계약이 없어.</div>}</div></Card></div></TabsContent>
      <TabsContent value="meetings"><Card className="py-0"><div className="divide-y">{meetings.length ? meetings.map((meeting) => <div key={meeting.id} className="p-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{meeting.method}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(meeting.heldAt)}</span>{meeting.vendorName ? <span className="text-xs text-muted-foreground">· {meeting.vendorName}</span> : null}</div><p className="mt-2 font-semibold">{meeting.agenda}</p></div>) : <div className="p-10 text-center text-muted-foreground"><MessageSquareText className="mx-auto mb-2 size-7" />등록된 협의록이 없어.</div>}</div></Card></TabsContent>
      <TabsContent value="schedule"><Card className="py-0"><div className="divide-y">{events.length ? events.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{event.type} · {formatDate(event.date)}</p></div><Badge variant={event.status === "지연" ? "destructive" : "secondary"}>{event.status}</Badge></div>) : <div className="p-10 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-2 size-7" />등록된 일정이 없어.</div>}</div></Card></TabsContent>
      <TabsContent value="documents"><Card className="py-0"><div className="divide-y">{documents.length ? documents.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{document.fileName}</p><p className="mt-1 text-xs text-muted-foreground">{document.kind} · v{document.version} · {formatDate(document.createdAt)}</p></div><FileText className="size-5 text-muted-foreground" /></div>) : <div className="p-10 text-center text-muted-foreground"><WalletCards className="mx-auto mb-2 size-7" />등록된 문서가 없어.</div>}</div></Card></TabsContent>
    </Tabs>
  </section>;
}
