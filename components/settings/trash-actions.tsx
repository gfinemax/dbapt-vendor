"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { permanentlyDeleteTrashItem, restoreTrashItem } from "@/app/(main)/settings/trash/actions";
import { Button } from "@/components/ui/button";

export function TrashActions({ table, id, label }: { table: string; id: string; label: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  return <div className="flex justify-end gap-2"><Button disabled={pending} size="sm" variant="outline" onClick={() => startTransition(async () => { const result = await restoreTrashItem({ table, id }); if (result.ok) toast.success(result.message); else toast.error(result.message); if (result.ok) router.refresh(); })}><RotateCcw />복원</Button><Button disabled={pending} size="sm" variant="destructive" onClick={() => { if (!window.confirm(`'${label}' 항목을 영구 삭제할까? 이 작업은 되돌릴 수 없어.`)) return; startTransition(async () => { const result = await permanentlyDeleteTrashItem({ table, id }); if (result.ok) toast.success(result.message); else toast.error(result.message); if (result.ok) router.refresh(); }); }}><Trash2 />영구 삭제</Button></div>;
}
