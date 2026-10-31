"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setProjectAssignment } from "@/app/(main)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AssignmentManager({ projects, users, assignments }: { projects: { id: string; title: string }[]; users: { id: string; name: string; role: string }[]; assignments: { project_id: string; user_id: string }[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const assigned = useMemo(() => assignments.some((item) => item.project_id === projectId && item.user_id === userId), [assignments, projectId, userId]);
  return <Card><CardHeader><CardTitle>용역 건 담당자 배정</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-[1fr_220px_auto]"><Select value={projectId} onValueChange={setProjectId}><SelectTrigger aria-label="배정 용역 건" className="w-full"><SelectValue placeholder="용역 건" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent></Select><Select value={userId} onValueChange={setUserId}><SelectTrigger aria-label="배정 사용자" className="w-full"><SelectValue placeholder="사용자" /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.role}</SelectItem>)}</SelectContent></Select><Button disabled={pending || !projectId || !userId} variant={assigned ? "destructive" : "default"} onClick={() => startTransition(async () => { const result = await setProjectAssignment({ project_id: projectId, user_id: userId, assigned: !assigned }); if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message); })}>{assigned ? "배정 해제" : "담당자 배정"}</Button></div><p className="mt-3 text-sm text-muted-foreground">현재 선택 조합은 {assigned ? "배정되어 있어." : "배정되지 않았어."}</p></CardContent></Card>;
}
