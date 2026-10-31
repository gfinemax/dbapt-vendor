import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 입력해 줘.");
const moneySchema = z.number().int("원 단위 정수로 입력해 줘.").safe("금액이 너무 커.");

export const paymentRowSchema = z.object({
  label: z.string().trim().min(1, "회차명을 입력해 줘.").max(40),
  due_date: dateSchema,
  amount: moneySchema.nonnegative("지급액은 0원 이상이어야 해."),
});

export const contractSchema = z
  .object({
    project_id: z.string().uuid(),
    vendor_id: z.string().uuid("업체를 선택해 줘."),
    title: z.string().trim().min(1, "계약명을 입력해 줘.").max(120),
    signed_at: dateSchema,
    start_at: dateSchema,
    end_at: dateSchema,
    amount: moneySchema.nonnegative("공급가액은 0원 이상이어야 해."),
    vat: moneySchema.nonnegative("부가세는 0원 이상이어야 해."),
    contract_party: z.enum(["조합직접", "업무대행사대행"]),
    original_location: z.string().trim().max(200),
    is_sealed: z.boolean(),
    parent_contract_id: z.string().uuid().nullable(),
    change_reason: z.string().trim().max(500),
    payments: z.array(paymentRowSchema).max(20, "지급 회차는 20개까지 등록할 수 있어."),
  })
  .superRefine((value, context) => {
    if (value.start_at > value.end_at)
      context.addIssue({
        code: "custom",
        path: ["end_at"],
        message: "종료일은 시작일 이후여야 해.",
      });
    if (value.parent_contract_id && !value.change_reason)
      context.addIssue({
        code: "custom",
        path: ["change_reason"],
        message: "변경 사유를 입력해 줘.",
      });
  });

export const contractDocumentSchema = z.object({
  contract_id: z.string().uuid(),
  project_id: z.string().uuid(),
  kind: z.enum(["계약서", "보증증권"]),
  file_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().trim().max(200).default(""),
  file_size: z.number().int().nonnegative().max(20 * 1024 * 1024).nullable().default(null),
});

export const paymentUpdateSchema = z.object({
  id: z.string().uuid(),
  contract_id: z.string().uuid(),
  project_id: z.string().uuid(),
  paid_at: z.union([dateSchema, z.literal("")]),
  settlement_status: z.enum(["미정산", "정산요청", "정산완료"]),
});

export const guaranteeSchema = z
  .object({
    contract_id: z.string().uuid(),
    project_id: z.string().uuid(),
    type: z.enum(["이행", "하자", "선급금"]),
    issuer: z.string().trim().max(100),
    amount: moneySchema.nonnegative("보증 금액은 0원 이상이어야 해."),
    starts_at: dateSchema,
    expires_at: dateSchema,
  })
  .refine((value) => value.starts_at <= value.expires_at, {
    path: ["expires_at"],
    message: "만료일은 시작일 이후여야 해.",
  });

export type ContractInput = z.infer<typeof contractSchema>;
export type ContractDocumentInput = z.infer<typeof contractDocumentSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
export type GuaranteeInput = z.infer<typeof guaranteeSchema>;
