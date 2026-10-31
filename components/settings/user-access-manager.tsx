"use client";

import { MailPlus, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { inviteUser, updateUserAccess } from "@/app/(main)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const roles = [{ value: "admin", label: "관리자" }, { value: "executive", label: "조합 임원" }, { value: "staff", label: "사무국" }, { value: "agent", label: "업무대행사" }, { value: "viewer", label: "열람자" }];

function UserRow({ user, currentUserId }: { user: { id: string; name: string; email: string; role: string; active: boolean }; currentUserId: string }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [pending, startTransition] = useTransition();
  return <div className="grid gap-3 border-t p-4 md:grid-cols-[1fr_160px_120px_auto] md:items-center"><div><p className="font-medium">{user.name}{user.id === currentUserId ? " · 현재 계정" : ""}</p><p className="text-xs text-muted-foreground">{user.email}</p></div><Select value={role} onValueChange={setRole}><SelectTrigger aria-label={`${user.name} 역할`} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><label className="flex items-center gap-2 text-sm"><input checked={active} className="size-4" disabled={user.id === currentUserId} type="checkbox" onChange={(event) => setActive(event.target.checked)} />활성</label><Button disabled={pending || (role === user.role && active === user.active)} size="sm" variant="outline" onClick={() => startTransition(async () => { const result = await updateUserAccess({ id: user.id, role, active }); if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message); })}><Save />저장</Button></div>;
}

export function UserAccessManager({ users, currentUserId }: { users: { id: string; name: string; email: string; role: string; active: boolean }[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState("viewer"); const [pending, startTransition] = useTransition();
  return <div className="space-y-4"><Card><CardHeader><CardTitle>사용자 초대</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]"><Input aria-label="초대 이메일" placeholder="email@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /><Input aria-label="사용자 이름" placeholder="이름" value={name} onChange={(event) => setName(event.target.value)} /><Select value={role} onValueChange={setRole}><SelectTrigger aria-label="초대 역할" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{roles.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Button disabled={pending} onClick={() => startTransition(async () => { const result = await inviteUser({ email, name, role }); if (result.ok) { toast.success(result.message); setEmail(""); setName(""); router.refresh(); } else toast.error(result.message); })}><MailPlus />{pending ? "초대 중" : "초대"}</Button></div><p className="mt-2 text-xs text-muted-foreground">초대 메일 발송에는 서버의 SUPABASE_SERVICE_ROLE_KEY가 필요해.</p></CardContent></Card><Card className="py-0"><CardHeader className="py-4"><CardTitle>사용자 역할·활성 상태</CardTitle></CardHeader>{users.map((user) => <UserRow key={user.id} currentUserId={currentUserId} user={user} />)}</Card></div>;
}
