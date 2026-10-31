"use client";

import { CalendarDays, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProjectStageBadge } from "@/components/projects/project-stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from "@/lib/database.types";
import { formatDate, formatWon } from "@/lib/format";

type Category = Database["public"]["Enums"]["project_category"];
type Stage = Database["public"]["Enums"]["project_stage"];

export type ProjectDirectoryRow = {
  id: string;
  businessProjectId: string;
  businessProjectName: string;
  title: string;
  category: Category;
  stage: Stage;
  budget: number;
  participantCount: number;
  lastQuoteDate: string | null;
  ownerName: string | null;
};

export function ProjectDirectory({ rows }: { rows: ProjectDirectoryRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category))],
    [rows],
  );
  const stages = useMemo(
    () => [...new Set(rows.map((row) => row.stage))],
    [rows],
  );
  const normalized = query.trim().toLocaleLowerCase("ko-KR");
  const filtered = rows.filter(
    (row) =>
      (!normalized ||
        row.title.toLocaleLowerCase("ko-KR").includes(normalized)) &&
      (category === "all" || row.category === category) &&
      (stage === "all" || row.stage === stage),
  );

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">용역 건</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          용역 진행 단계와 견적·계약 현황을 관리해.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="용역명 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="h-8 rounded-lg border bg-background px-2.5 text-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">모든 분야</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              className="h-8 rounded-lg border bg-background px-2.5 text-sm"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              <option value="all">모든 단계</option>
              {stages.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            전체 {rows.length}건 중 {filtered.length}건
          </p>
        </CardContent>
      </Card>
      <Card className="overflow-x-auto py-0">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">용역명</TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead>분야·단계</TableHead>
              <TableHead className="text-right">예산</TableHead>
              <TableHead className="text-center">참여 업체</TableHead>
              <TableHead>최근 견적</TableHead>
              <TableHead>조합 담당자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4">
                  <Link
                    className="font-semibold hover:underline"
                    href={`/projects/${row.id}`}
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    className="text-sm text-muted-foreground hover:underline"
                    href={`/business-projects/${row.businessProjectId}`}
                  >
                    {row.businessProjectName}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{row.category}</span>
                    <ProjectStageBadge stage={row.stage} />
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatWon(row.budget)}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5 text-muted-foreground" />
                    {row.participantCount}
                  </span>
                </TableCell>
                <TableCell>
                  {row.lastQuoteDate ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-muted-foreground" />
                      {formatDate(row.lastQuoteDate)}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{row.ownerName ?? "미배정"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
