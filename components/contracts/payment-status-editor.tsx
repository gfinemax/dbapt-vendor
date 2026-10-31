"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePayment } from "@/app/(main)/contracts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PaymentStatusEditor({ paymentId, contractId, projectId, paidAt, settlementStatus }: { paymentId: string; contractId: string; projectId: string; paidAt: string | null; settlementStatus: "미정산" | "정산요청" | "정산완료" }) {
  const router = useRouter();
  const [date, setDate] = useState(paidAt ?? "");
  const [status, setStatus] = useState(settlementStatus);
  const [pending, startTransition] = useTransition();
  return <div className="flex flex-wrap items-center justify-end gap-2"><Input aria-label="지급일" className="w-40" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><Select value={status} onValueChange={(value) => setStatus(value as typeof status)}><SelectTrigger aria-label="정산 상태" className="w-32"><SelectValue /></SelectTrigger><SelectContent>{["미정산", "정산요청", "정산완료"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button disabled={pending} size="sm" variant="outline" onClick={() => startTransition(async () => { const result = await updatePayment({ id: paymentId, contract_id: contractId, project_id: projectId, paid_at: date, settlement_status: status }); if (result.ok) { toast.success(result.message); router.refresh(); } else { toast.error(result.message); } })}>{pending ? "저장 중" : "반영"}</Button></div>;
}
