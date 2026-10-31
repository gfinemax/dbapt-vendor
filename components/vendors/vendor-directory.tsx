"use client";

import { Building2, Grid2X2, List, Search, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { VendorStatusBadge } from "@/components/vendors/vendor-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database } from "@/lib/database.types";

type VendorStatus = Database["public"]["Enums"]["vendor_status"];

const VendorFormDialog = dynamic(
  () => import("@/components/vendors/vendor-form-dialog").then((module) => module.VendorFormDialog),
  { ssr: false },
);

export type VendorDirectoryRow = {
  id: string;
  name: string;
  bizNo: string | null;
  ceo: string | null;
  category: string | null;
  status: VendorStatus;
  address: string | null;
  contactNames: string[];
  contactCount: number;
};

export function VendorDirectory({ rows, canCreate }: { rows: VendorDirectoryRow[]; canCreate: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<"table" | "card">("table");
  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter((value): value is string => Boolean(value)))].sort(),
    [rows],
  );
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status))], [rows]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = rows.filter((row) => {
    const matchesQuery = !normalizedQuery || [row.name, row.ceo, ...row.contactNames]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
    return matchesQuery
      && (category === "all" || row.category === category)
      && (status === "all" || row.status === status);
  });

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">용역사</h1>
          <p className="mt-1 text-sm text-muted-foreground">업체 기본정보와 담당자, 서류 및 참여 이력을 관리해.</p>
        </div>
        {canCreate ? <VendorFormDialog /> : null}
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상호·대표자·담당자명 검색" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <select aria-label="분야 필터" className="h-8 rounded-lg border bg-background px-2.5 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">모든 분야</option>
                {categories.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label="상태 필터" className="h-8 rounded-lg border bg-background px-2.5 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">모든 상태</option>
                {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="flex rounded-lg border p-0.5">
              <Button aria-label="표로 보기" size="icon-sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}><List /></Button>
              <Button aria-label="카드로 보기" size="icon-sm" variant={view === "card" ? "secondary" : "ghost"} onClick={() => setView("card")}><Grid2X2 /></Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">전체 {rows.length}곳 중 {filtered.length}곳</p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center text-center"><Building2 className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">조건에 맞는 업체가 없어.</p><p className="mt-1 text-sm text-muted-foreground">검색어나 필터를 바꿔 봐.</p></CardContent></Card>
      ) : view === "table" ? (
        <Card className="py-0">
          <Table>
            <TableHeader><TableRow><TableHead className="pl-4">업체</TableHead><TableHead>분야</TableHead><TableHead>대표자</TableHead><TableHead>담당자</TableHead><TableHead>상태</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4"><Link className="font-semibold hover:underline" href={`/vendors/${row.id}`}>{row.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{row.bizNo ?? "사업자번호 미등록"}</p></TableCell>
                <TableCell>{row.category ?? "-"}</TableCell><TableCell>{row.ceo ?? "-"}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1"><Users className="size-3.5 text-muted-foreground" />{row.contactCount}</span>{row.contactNames[0] ? <span className="ml-2 text-muted-foreground">{row.contactNames[0]}</span> : null}</TableCell>
                <TableCell><VendorStatusBadge status={row.status} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((row) => (
          <Link key={row.id} href={`/vendors/${row.id}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:ring-foreground/20">
              <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{row.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{row.bizNo ?? "사업자번호 미등록"}</p></div><VendorStatusBadge status={row.status} /></div></CardHeader>
              <CardContent className="space-y-2 text-sm"><p><span className="text-muted-foreground">분야</span><span className="ml-3">{row.category ?? "-"}</span></p><p><span className="text-muted-foreground">대표자</span><span className="ml-3">{row.ceo ?? "-"}</span></p><p className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" />담당자 {row.contactCount}명</p><p className="truncate text-xs text-muted-foreground">{row.address ?? "주소 미등록"}</p></CardContent>
            </Card>
          </Link>
        ))}</div>
      )}
    </section>
  );
}
