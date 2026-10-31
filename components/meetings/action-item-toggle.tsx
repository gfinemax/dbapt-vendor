"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setActionComplete } from "@/app/(main)/meetings/actions";

export function ActionItemToggle({ id, meetingId, projectId, complete, label }: { id: string; meetingId: string; projectId: string; complete: boolean; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <label className="flex cursor-pointer items-start gap-3"><input aria-label={`${label} 완료 상태`} checked={complete} className="mt-1 size-4" disabled={pending} type="checkbox" onChange={(event) => { const checked = event.target.checked; startTransition(async () => { const result = await setActionComplete({ id, meeting_id: meetingId, project_id: projectId, complete: checked }); if (result.ok) { toast.success(result.message); router.refresh(); } else { toast.error(result.message); } }); }} /><span className={complete ? "text-muted-foreground line-through" : ""}>{label}</span></label>;
}
