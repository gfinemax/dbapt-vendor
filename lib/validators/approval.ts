import { z } from "zod";

export const approvalDecisionSchema = z
  .object({
    approval_id: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(1000),
  })
  .superRefine((value, context) => {
    if (value.decision === "rejected" && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "반려 사유를 입력해 줘.",
      });
    }
  });

export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
