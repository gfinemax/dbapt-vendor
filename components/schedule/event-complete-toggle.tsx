"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setEventComplete } from "@/app/(main)/schedule/actions";

export function EventCompleteToggle({ id, projectId, complete, title }: { id: string; projectId: string; complete: boolean; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <input aria-label={`${title} 완료 상태`} checked={complete} className="size-4" disabled={pending} type="checkbox" onChange={(event) => { const checked = event.target.checked; startTransition(async () => { const result = await setEventComplete({ id, project_id: projectId, complete: checked }); if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message); }); }} />;
}
