import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/database.types";
import { cn } from "@/lib/utils";

type ProjectStage = Database["public"]["Enums"]["project_stage"];

const styles: Record<ProjectStage, string> = {
  견적요청: "border-blue-200 bg-blue-50 text-blue-700",
  비교검토: "border-violet-200 bg-violet-50 text-violet-700",
  선정: "border-indigo-200 bg-indigo-50 text-indigo-700",
  계약: "border-emerald-200 bg-emerald-50 text-emerald-700",
  진행: "border-teal-200 bg-teal-50 text-teal-700",
  준공: "border-slate-200 bg-slate-100 text-slate-700",
  정산완료: "border-zinc-200 bg-zinc-100 text-zinc-700",
  보류: "border-amber-200 bg-amber-50 text-amber-700",
};

export function ProjectStageBadge({ stage }: { stage: ProjectStage }) {
  return <Badge className={cn("border", styles[stage])} variant="outline">{stage}</Badge>;
}
