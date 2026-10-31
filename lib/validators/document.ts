import { z } from "zod";

import {
  serviceCaseCategories,
  serviceCaseStages,
} from "@/lib/validators/business-project";

export const documentOwnerTypes = [
  "business_project",
  "vendor",
  "project",
  "quote",
  "contract",
  "meeting",
] as const;

export const documentKinds = [
  "사업자등록증",
  "견적서",
  "제안서",
  "계약서",
  "보증증권",
  "회의자료",
  "기타",
] as const;

export const detectedDocumentKinds = [
  ...documentKinds.slice(0, 4),
  "변경계약서",
  ...documentKinds.slice(4, 6),
  "공문",
  "기타",
] as const;

const nullableText = z.string().nullable();
const nullableMoney = z.number().int().nonnegative().nullable();
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const extractionEvidenceSchema = z.object({
  field: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string(),
  confidence: z.number().min(0).max(1),
});

const extractionLineItemSchema = z.object({
  name: z.string(),
  normalized_name: z.string(),
  amount: z.number().int().nonnegative(),
});

const extractionPaymentSchema = z.object({
  label: z.string(),
  due_date: nullableDate,
  amount: nullableMoney,
});

const extractionGuaranteeSchema = z.object({
  type: z.enum(["이행", "하자", "선급금", "기타"]),
  issuer: nullableText,
  amount: nullableMoney,
  starts_at: nullableDate,
  expires_at: nullableDate,
});

export const documentExtractionSchema = z.object({
  document_type: z.enum([
    "business_registration",
    "quote",
    "proposal",
    "contract",
    "amendment",
    "guarantee",
    "meeting_material",
    "official_letter",
    "other",
  ]),
  detected_kind: z.enum(detectedDocumentKinds),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  service_case: z.object({
    title: nullableText,
    category: z.enum(serviceCaseCategories).nullable(),
    description: nullableText,
    budget: nullableMoney,
    stage: z.enum(serviceCaseStages).nullable(),
  }),
  vendor: z.object({
    name: nullableText,
    business_number: nullableText,
    representative: nullableText,
    address: nullableText,
  }),
  quote: z.object({
    quote_number: nullableText,
    received_at: nullableDate,
    valid_until: nullableDate,
    supply_amount: nullableMoney,
    vat_amount: nullableMoney,
    total_amount: nullableMoney,
    vat_included: z.boolean().nullable(),
    duration_days: z.number().int().positive().nullable(),
    warranty_months: z.number().int().nonnegative().nullable(),
    payment_terms: nullableText,
    inclusions: z.array(z.string()),
    exclusions: z.array(z.string()),
  }),
  contract: z.object({
    title: nullableText,
    signed_at: nullableDate,
    start_at: nullableDate,
    end_at: nullableDate,
    supply_amount: nullableMoney,
    vat_amount: nullableMoney,
    total_amount: nullableMoney,
    contract_party: z.enum(["조합직접", "업무대행사대행"]).nullable(),
    is_sealed: z.boolean().nullable(),
    change_reason: nullableText,
    scope: nullableText,
    deliverables: z.array(z.string()),
    termination_terms: nullableText,
    damages_terms: nullableText,
    confidentiality_terms: nullableText,
  }),
  line_items: z.array(extractionLineItemSchema),
  payments: z.array(extractionPaymentSchema),
  guarantees: z.array(extractionGuaranteeSchema),
  risks: z.array(z.string()),
  missing_fields: z.array(z.string()),
  evidence: z.array(extractionEvidenceSchema),
});

export const documentRegistrationSchema = z.object({
  owner_type: z.enum(documentOwnerTypes),
  owner_id: z.string().uuid(),
  kind: z.enum(documentKinds),
  file_path: z.string().trim().min(1).max(1000),
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().max(200),
  file_size: z.number().int().nonnegative().max(20 * 1024 * 1024),
  valid_until: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal(""),
  ]),
});

const intakeQuoteSchema = z.object({
  document_id: z.string().uuid(),
  vendor_id: z.string().uuid("견적 업체를 선택해 줘."),
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "견적 접수일을 확인해 줘."),
  amount: z.number().int().positive("견적금액은 1원 이상 입력해 줘."),
  vat_included: z.boolean(),
  duration_days: z.number().int().positive().nullable(),
  warranty_months: z.number().int().nonnegative().nullable(),
  payment_terms: z.string().trim().max(500).nullable(),
  items: z.array(
    z.object({
      name: z.string().trim().min(1).max(100),
      amount: z.number().int().nonnegative(),
    }),
  ).max(50),
  note: z.string().trim().max(1000).nullable(),
});

const intakeContractSchema = z
  .object({
    document_id: z.string().uuid(),
    vendor_id: z.string().uuid("계약 업체를 선택해 줘."),
    title: z.string().trim().min(1, "계약명을 입력해 줘.").max(120),
    signed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "계약일을 확인해 줘."),
    start_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "계약 시작일을 확인해 줘."),
    end_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "계약 종료일을 확인해 줘."),
    amount: z.number().int().nonnegative(),
    vat: z.number().int().nonnegative(),
    contract_party: z.enum(["조합직접", "업무대행사대행"]),
    is_sealed: z.boolean(),
    payments: z.array(
      z.object({
        label: z.string().trim().min(1).max(40),
        due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.number().int().nonnegative(),
      }),
    ).max(20),
  })
  .refine((value) => value.start_at <= value.end_at, {
    path: ["end_at"],
    message: "계약 종료일은 시작일 이후여야 해.",
  });

export const documentIntakeApplySchema = z.object({
  business_project_id: z.string().uuid(),
  title: z.string().trim().min(1, "용역명을 입력해 줘.").max(120),
  category: z.enum(serviceCaseCategories),
  description: z.string().trim().max(1000),
  budget: z.number().int().nonnegative(),
  stage: z.enum(serviceCaseStages),
  owner_user_id: z.union([z.string().uuid(), z.literal("")]),
  document_ids: z.array(z.string().uuid()).min(1),
  quotes: z.array(intakeQuoteSchema),
  contracts: z.array(intakeContractSchema),
});

export type DocumentExtraction = z.infer<typeof documentExtractionSchema>;
export type DocumentRegistrationInput = z.infer<typeof documentRegistrationSchema>;
export type DocumentIntakeApplyInput = z.infer<typeof documentIntakeApplySchema>;
