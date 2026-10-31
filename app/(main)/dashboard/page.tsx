import { AlertTriangle, CalendarDays, ClipboardList, FileSignature, WalletCards, Waypoints } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function kstDateParts() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const base = new Date(`${today}T00:00:00Z`);
  const day = base.getUTCDay() || 7;
  const monday = new Date(base); monday.setUTCDate(base.getUTCDate() - day + 1);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  return { today, monday: monday.toISOString().slice(0, 10), sunday: sunday.toISOString().slice(0, 10) };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const projectQuery = safeView ? supabase.from("projects_public").select("id,title,category,budget,stage") : supabase.from("projects").select("id,title,category,budget,stage").is("deleted_at", null);
  const { monday, sunday } = kstDateParts();
  const [projectsResult, contractsResult, paymentsResult, weekEventsResult, overdueResult, quotesResult, meetingsResult] = await Promise.all([
    projectQuery,
    supabase.from("contracts").select("id,project_id,amount,vat").is("deleted_at", null),
    supabase.from("payment_schedules").select("contract_id,amount,paid_at,settlement_status").is("deleted_at", null),
    supabase.from("events").select("id,project_id,title,date,type,status").gte("date", monday).lte("date", sunday).is("deleted_at", null).order("date"),
    supabase.from("events").select("id,project_id,title,date,type,status").eq("status", "지연").is("deleted_at", null).order("date"),
    supabase.from("quotes").select("id,project_id,vendor_id,version,received_at,amount").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("meetings").select("id,project_id,vendor_id,held_at,agenda,method").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
  ]);
  const projects = (projectsResult.data ?? []).flatMap((project) => project.id && project.title && project.category && project.budget != null && project.stage ? [{ id: project.id, title: project.title, category: project.category, budget: project.budget, stage: project.stage }] : []);
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const vendorIds = [...new Set([...(quotesResult.data ?? []).map((quote) => quote.vendor_id), ...(meetingsResult.data ?? []).flatMap((meeting) => meeting.vendor_id ? [meeting.vendor_id] : [])])];
  const vendorsResult = safeView
    ? await supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : await supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const vendorMap = new Map((vendorsResult.data ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const contracts = contractsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const contractTotal = contracts.reduce((sum, contract) => sum + contract.amount + contract.vat, 0);
  const paid = payments.filter((payment) => payment.paid_at).reduce((sum, payment) => sum + payment.amount, 0);
  const unsettled = payments.filter((payment) => payment.paid_at && payment.settlement_status !== "정산완료").reduce((sum, payment) => sum + payment.amount, 0);
  const activeProjects = projects.filter((project) => project.stage !== "정산완료" && project.stage !== "보류").length;
  const summaryCards = [
    { title: "진행 중 용역", value: `${activeProjects}건`, icon: ClipboardList },
    { title: "계약 총액", value: formatWon(contractTotal), icon: FileSignature },
    { title: "미지급액", value: formatWon(Math.max(contractTotal - paid, 0)), icon: WalletCards },
    { title: "미정산액", value: formatWon(unsettled), icon: Waypoints },
    { title: "이번 주 일정", value: `${weekEventsResult.data?.length ?? 0}건`, icon: CalendarDays },
    { title: "지연", value: `${overdueResult.data?.length ?? 0}건`, icon: AlertTriangle },
  ];
  const categories = [...new Set(projects.map((project) => project.category))].map((category) => {
    const categoryProjects = projects.filter((project) => project.category === category);
    const ids = new Set(categoryProjects.map((project) => project.id));
    const budget = categoryProjects.reduce((sum, project) => sum + project.budget, 0);
    const contracted = contracts.filter((contract) => ids.has(contract.project_id)).reduce((sum, contract) => sum + contract.amount + contract.vat, 0);
    return { category, budget, contracted, percent: budget ? Math.min(Math.round(contracted / budget * 100), 100) : 0 };
  });

  return <section className="mx-auto max-w-7xl space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">대시보드</h1><p className="mt-1 text-sm text-muted-foreground">용역 진행, 계약·지급과 주요 일정을 한눈에 확인해.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{summaryCards.map(({ icon: Icon, title, value }) => <Card key={title} size="sm"><CardContent className="flex items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 text-lg font-bold">{value}</p></div><Icon className="size-5 text-muted-foreground" /></CardContent></Card>)}</div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>이번 주 일정</CardTitle></CardHeader><CardContent className="space-y-2">{weekEventsResult.data?.length ? weekEventsResult.data.map((event) => <Link key={event.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40" href="/schedule"><div><p className="font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{projectMap.get(event.project_id ?? "")?.title ?? "용역"} · {formatDate(event.date)}</p></div><Badge variant="outline">{event.type}</Badge></Link>) : <p className="text-sm text-muted-foreground">이번 주 일정이 없어.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-red-700">지연 일정</CardTitle></CardHeader><CardContent className="space-y-2">{overdueResult.data?.length ? overdueResult.data.map((event) => <Link key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-200 p-3 hover:bg-red-50" href="/schedule"><div><p className="font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{projectMap.get(event.project_id ?? "")?.title ?? "용역"} · {formatDate(event.date)}</p></div><Badge variant="destructive">지연</Badge></Link>) : <p className="text-sm text-muted-foreground">지연 일정이 없어.</p>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>분야별 예산 대비 계약액</CardTitle></CardHeader><CardContent className="space-y-4">{categories.map((item) => <div key={item.category}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{item.category}</span><span className="text-muted-foreground">{formatWon(item.contracted)} / {formatWon(item.budget)}</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${item.percent}%` }} /></div></div>)}</CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>최근 견적</CardTitle></CardHeader><CardContent className="space-y-2">{quotesResult.data?.map((quote) => <Link key={quote.id} className="block rounded-lg border p-3 hover:bg-muted/40" href={`/projects/${quote.project_id}?tab=quotes`}><p className="font-medium">{projectMap.get(quote.project_id)?.title ?? "용역"} · {vendorMap.get(quote.vendor_id) ?? "업체"} v{quote.version}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(quote.received_at)} · {formatWon(quote.amount)}</p></Link>)}</CardContent></Card><Card><CardHeader><CardTitle>최근 협의록</CardTitle></CardHeader><CardContent className="space-y-2">{meetingsResult.data?.map((meeting) => <Link key={meeting.id} className="block rounded-lg border p-3 hover:bg-muted/40" href={`/meetings/${meeting.id}`}><p className="font-medium">{meeting.agenda}</p><p className="mt-1 text-xs text-muted-foreground">{projectMap.get(meeting.project_id)?.title ?? "용역"}{meeting.vendor_id ? ` · ${vendorMap.get(meeting.vendor_id) ?? "업체"}` : ""} · {formatDateTime(meeting.held_at)}</p></Link>)}</CardContent></Card></div>
  </section>;
}
