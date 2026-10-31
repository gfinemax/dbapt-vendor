import {
  ProjectDirectory,
  type ProjectDirectoryRow,
} from "@/components/projects/project-directory";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const projectQuery =
    role === "agent" || role === "viewer"
      ? supabase
          .from("projects_public")
          .select(
            "id,business_project_id,title,category,budget,stage,owner_user_id",
          )
          .order("created_at", { ascending: false })
      : supabase
          .from("projects")
          .select(
            "id,business_project_id,title,category,budget,stage,owner_user_id",
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
  const [
    { data: projects, error },
    { data: links },
    { data: quotes },
    { data: users },
    { data: businessProjects },
  ] = await Promise.all([
    projectQuery,
    supabase
      .from("project_vendors")
      .select("project_id")
      .is("deleted_at", null),
    supabase
      .from("quotes")
      .select("project_id,received_at")
      .is("deleted_at", null),
    supabase
      .from("users")
      .select("id,name")
      .is("deleted_at", null)
      .eq("active", true),
    supabase
      .from("business_projects")
      .select("id,title")
      .is("deleted_at", null),
  ]);
  if (error) throw new Error(`용역 목록을 불러오지 못했어: ${error.message}`);

  const ownerMap = new Map((users ?? []).map((user) => [user.id, user.name]));
  const businessProjectMap = new Map(
    (businessProjects ?? []).map((project) => [project.id, project.title]),
  );
  const rows: ProjectDirectoryRow[] = (projects ?? []).flatMap((project) => {
    if (
      !project.id ||
      !project.title ||
      !project.category ||
      project.budget == null ||
      !project.stage
    )
      return [];
    const projectQuotes = (quotes ?? []).filter(
      (quote) => quote.project_id === project.id,
    );
    return [
      {
        id: project.id,
        businessProjectId: project.business_project_id,
        businessProjectName:
          businessProjectMap.get(project.business_project_id) ?? "프로젝트",
        title: project.title,
        category: project.category,
        budget: project.budget,
        stage: project.stage,
        participantCount: (links ?? []).filter(
          (link) => link.project_id === project.id,
        ).length,
        lastQuoteDate: projectQuotes.reduce<string | null>(
          (latest, quote) =>
            !latest || quote.received_at > latest ? quote.received_at : latest,
          null,
        ),
        ownerName: project.owner_user_id
          ? (ownerMap.get(project.owner_user_id) ?? null)
          : null,
      },
    ];
  });
  return <ProjectDirectory rows={rows} />;
}
