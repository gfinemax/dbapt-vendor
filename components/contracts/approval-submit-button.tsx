"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { submitContractApproval } from "@/app/(main)/contracts/actions";
import { Button } from "@/components/ui/button";

export function ApprovalSubmitButton({
  targetId,
  targetType,
}: {
  targetId: string;
  targetType: "contract" | "contract_amendment";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      disabled={pending}
      size="sm"
      variant="outline"
      onClick={() =>
        startTransition(async () => {
          const result = await submitContractApproval(targetType, targetId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(result.message);
          router.refresh();
        })
      }
    >
      <Send />
      {pending ? "요청 중" : "승인요청"}
    </Button>
  );
}
