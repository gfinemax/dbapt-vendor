"use client";

import { CalendarClock, CircleDollarSign, FileSignature, Landmark, WalletCards } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatWon } from "@/lib/format";

export type ContractListRow = {
  id: string; title: string; projectTitle: string; vendorName: string; signedAt: string; endAt: string;
  total: number; paid: number; unpaid: number; unsettled: number; changeCount: number;
};

function statusOf(endAt: string, today: string, in30Days: string) {
  if (endAt < today) return "종료" as const;
  if (endAt <= in30Days) return "만료 예정" as const;
  return "진행 중" as const;
}

export function ContractDirectory({ rows, today, in30Days }: { rows: ContractListRow[]; today: string; in30Days: string }) {
  const [status, setStatus] = useState("전체");
  const filtered = useMemo(() => rows.filter((row) => status === "전체" || statusOf(row.endAt, today, in30Days) === status), [rows, status, today, in30Days]);
  const metrics = filtered.reduce((sum, row) => ({ total: sum.total + row.total, paid: sum.paid + row.paid, unpaid: sum.unpaid + row.unpaid, unsettled: sum.unsettled + row.unsettled }), { total: 0, paid: 0, unpaid: 0, unsettled: 0 });
  const cards = [
    { label: "계약총액", value: metrics.total, icon: FileSignature },
    { label: "지급액", value: metrics.paid, icon: CircleDollarSign },
    { label: "미지급액", value: metrics.unpaid, icon: WalletCards },
    { label: "미정산액", value: metrics.unsettled, icon: Landmark },
  ];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <Card key={label} size="sm"><CardContent className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{formatWon(value)}</p></div><Icon className="size-6 text-muted-foreground" /></CardContent></Card>)}</div>
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{filtered.length}건의 원계약</p><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["전체", "진행 중", "만료 예정", "종료"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    <Card className="py-0"><div className="overflow-x-auto"><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>계약</TableHead><TableHead>업체</TableHead><TableHead className="text-center">기간/상태</TableHead><TableHead className="text-right">계약총액</TableHead><TableHead className="text-right">지급액</TableHead><TableHead className="text-right">미지급액</TableHead><TableHead className="text-right">미정산액</TableHead></TableRow></TableHeader><TableBody>{filtered.length ? filtered.map((row) => { const rowStatus = statusOf(row.endAt, today, in30Days); return <TableRow key={row.id}><TableCell><Link className="font-semibold hover:underline" href={`/contracts/${row.id}`}>{row.title}</Link><p className="mt-1 text-xs text-muted-foreground">{row.projectTitle}{row.changeCount ? ` · 변경 ${row.changeCount}건` : ""}</p></TableCell><TableCell>{row.vendorName}</TableCell><TableCell className="text-center"><p className="text-xs">{formatDate(row.signedAt)} ~ {formatDate(row.endAt)}</p><Badge className="mt-1" variant={rowStatus === "종료" ? "secondary" : rowStatus === "만료 예정" ? "destructive" : "outline"}>{rowStatus}</Badge></TableCell><TableCell className="text-right font-bold">{formatWon(row.total)}</TableCell><TableCell className="text-right">{formatWon(row.paid)}</TableCell><TableCell className="text-right">{formatWon(row.unpaid)}</TableCell><TableCell className="text-right">{formatWon(row.unsettled)}</TableCell></TableRow>; }) : <TableRow><TableCell className="h-40 text-center text-muted-foreground" colSpan={7}><CalendarClock className="mx-auto mb-2 size-7" />조건에 맞는 계약이 없어.</TableCell></TableRow>}</TableBody></Table></div></Card>
  </div>;
}
