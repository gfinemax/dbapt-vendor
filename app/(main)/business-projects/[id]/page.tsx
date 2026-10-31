import {
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ServiceCaseFormDialog } from "@/components/business-projects/service-case-form-dialog";
import { ProjectStageBadge } from "@/components/projects/project-stage-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BusinessProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const [{ data: project, error }, { data: serviceCases }, { data: users }] =
    await Promise.all([
      supabase
        .from("business_projects")
        .select("id,title,description,status")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle(),
      (safeView ? supabase.from("projects_public") : supabase.from("projects"))
        .select("id,title,category,budget,stage,owner_user_id")
        .eq("business_project_id", id)
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("users")
        .select("id,name")
        .eq("active", true)
        .is("deleted_at", null)
        .order("name"),
    ]);
  if (error || !project) notFound();
  const ownerMap = new Map((users ?? []).map((user) => [user.id, user.name]));
  const totalBudget = (serviceCases ?? []).reduce(
    (sum, serviceCase) => sum + (serviceCase.budget ?? 0),
    0,
  );
  const activeCount = (serviceCases ?? []).filter(
    (serviceCase) =>
      serviceCase.stage !== "정산완료" && serviceCase.stage !== "보류",
  ).length;
  const canManage = role === "admin" || role === "staff";

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            className="text-sm text-muted-foreground hover:underline"
            href="/business-projects"
          >
            ← 프로젝트 목록
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {project.title}
            </h1>
            <Badge
              variant={project.status === "진행" ? "default" : "secondary"}
            >
              {project.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description ?? "등록된 설명이 없어."}
          </p>
        </div>
        {canManage ? (
          <ServiceCaseFormDialog
            businessProjectId={project.id}
            users={users ?? []}
          />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">전체 용역건</p>
              <p className="mt-1 text-xl font-bold">
                {serviceCases?.length ?? 0}건
              </p>
            </div>
            <ClipboardList className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">진행 중 용역</p>
              <p className="mt-1 text-xl font-bold">{activeCount}건</p>
            </div>
            <BriefcaseBusiness className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">용역 총예산</p>
              <p className="mt-1 text-xl font-bold">{formatWon(totalBudget)}</p>
            </div>
            <CircleDollarSign className="size-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
      <Card className="py-0">
        <CardHeader className="py-4">
          <CardTitle>용역건</CardTitle>
        </CardHeader>
        <div className="divide-y">
          {serviceCases?.length ? (
            serviceCases.map((serviceCase) => (
              <Link
                key={serviceCase.id}
                className="flex flex-col gap-3 p-4 transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                href={`/projects/${serviceCase.id}`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{serviceCase.title}</p>
                    <ProjectStageBadge stage={serviceCase.stage} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {serviceCase.category} · 담당{" "}
                    {serviceCase.owner_user_id
                      ? (ownerMap.get(serviceCase.owner_user_id) ?? "미배정")
                      : "미배정"}
                  </p>
                </div>
                <p className="font-bold">{formatWon(serviceCase.budget)}</p>
              </Link>
            ))
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-2 size-8" />
              <p className="font-medium">이 프로젝트에 등록된 용역건이 없어.</p>
              {canManage ? (
                <p className="mt-1 text-sm">
                  위의 용역건 추가 버튼으로 첫 용역을 등록해 줘.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
