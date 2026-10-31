"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { decideApproval } from "@/app/(main)/approvals/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalDecisionControls({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(decision: "approved" | "rejected") {
    startTransition(async () => {
      const result = await decideApproval({
        approval_id: approvalId,
        decision,
        reason,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setReason("");
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} size="sm" onClick={() => submit("approved")}>
        <Check />
        {pending ? "처리 중" : "승인"}
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button disabled={pending} size="sm" variant="destructive">
            <X />
            반려
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>승인 요청 반려</DialogTitle>
            <DialogDescription>요청자가 보완할 내용을 구체적으로 남겨 줘.</DialogDescription>
          </DialogHeader>
          <Textarea
            maxLength={1000}
            placeholder="반려 사유 *"
            rows={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button
              disabled={pending || !reason.trim()}
              variant="destructive"
              onClick={() => submit("rejected")}
            >
              {pending ? "처리 중..." : "반려 확정"}
            </Button>
            <Button disabled={pending} variant="outline" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
