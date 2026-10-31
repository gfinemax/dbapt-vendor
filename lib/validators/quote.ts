import { z } from "zod";

export const quoteItemSchema = z.object({
  name: z.string().trim().min(1, "항목명을 입력해 줘.").max(100),
  amount: z.number().int().min(0, "항목 금액은 0원 이상이어야 해."),
});

export const quoteSchema = z.object({
  project_id: z.string().uuid(),
  vendor_id: z.string().uuid("업체를 선택해 줘."),
  received_at: z.string().date("견적 접수일을 입력해 줘."),
  amount: z.number().int().positive("견적 금액을 입력해 줘."),
  vat_included: z.boolean(),
  duration_days: z.number().int().positive("기간은 1일 이상이어야 해."),
  warranty_months: z.number().int().min(0, "하자보증 기간을 확인해 줘."),
  payment_terms: z.string().trim().min(1, "지급조건을 입력해 줘.").max(500),
  items: z.array(quoteItemSchema).max(50),
  note: z.string().trim().max(1000),
});

export const selectionSchema = z.object({
  project_id: z.string().uuid(),
  vendor_id: z.string().uuid("선정 업체를 선택해 줘."),
  selection_reason: z.string().trim().min(1, "선정 사유를 입력해 줘.").max(1000),
  board_resolution: z.string().trim().min(1, "이사회 회차·일자를 입력해 줘.").max(300),
});

export const quoteDocumentSchema = z.object({
  quote_id: z.string().uuid(),
  project_id: z.string().uuid(),
  file_path: z.string().trim().min(1).max(1000),
  file_name: z.string().trim().min(1).max(255),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type SelectionInput = z.infer<typeof selectionSchema>;
export type QuoteDocumentInput = z.infer<typeof quoteDocumentSchema>;
