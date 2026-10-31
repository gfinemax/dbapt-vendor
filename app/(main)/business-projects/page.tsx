import { FolderKanban } from "lucide-react";
import Link from "next/link";

import { BusinessProjectFormDialog } from "@/components/business-projects/business-project-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BusinessProjectsPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const [{ data: businessProjects, error }, { data: serviceCases }] =
    await Promise.all([
      supabase
        .from("business_projects")
        .select("id,title,description,status")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      (safeView ? supabase.from("projects_public") : supabase.from("projects"))
        .select("id,business_project_id,budget,stage")
        .is("deleted_at", null),
    ]);
  if (error)
    throw new Error(`프로젝트 목록을 불러오지 못했어: ${error.message}`);
  const canManage = role === "admin" || role === "staff";

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">프로젝트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            사업·현장별로 여러 용역건을 묶어서 관리해.
          </p>
        </div>
        {canManage ? <BusinessProjectFormDialog /> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {businessProjects?.length ? (
          businessProjects.map((project) => {
            const children = (serviceCases ?? []).filter(
              (serviceCase) => serviceCase.business_project_id === project.id,
            );
            const activeCount = children.filter(
              (serviceCase) =>
                serviceCase.stage !== "정산완료" &&
                serviceCase.stage !== "보류",
            ).length;
            const budget = children.reduce(
              (sum, serviceCase) => sum + (serviceCase.budget ?? 0),
              0,
            );
            return (
              <Link key={project.id} href={`/business-projects/${project.id}`}>
                <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                          <FolderKanban className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-bold">
                            {project.title}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {project.description ?? "등록된 설명이 없어."}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          project.status === "진행" ? "default" : "secondary"
                        }
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">용역건</p>
                        <p className="mt-1 font-bold">{children.length}건</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">진행 중</p>
                        <p className="mt-1 font-bold">{activeCount}건</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">총 예산</p>
                        <p className="mt-1 truncate font-bold">
                          {formatWon(budget)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="py-14 text-center text-muted-foreground">
              <FolderKanban className="mx-auto mb-2 size-9" />
              <p className="font-medium">등록된 프로젝트가 없어.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
