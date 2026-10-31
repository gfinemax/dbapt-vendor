import { z } from "zod";

export const vendorStatuses = [
  "후보",
  "견적중",
  "선정",
  "계약협의",
  "계약중",
  "완료",
  "탈락",
  "거래중지",
] as const;

const optionalText = z.string().trim().max(500);
const databaseUuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "식별자 형식이 올바르지 않아.",
  );

export const vendorSchema = z.object({
  id: databaseUuid.optional(),
  name: z.string().trim().min(1, "상호를 입력해 주세요.").max(100),
  biz_no: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{3}-\d{2}-\d{5}$/.test(value),
      "사업자번호는 000-00-00000 형식으로 입력해 주세요.",
    ),
  ceo: z.string().trim().max(50),
  phone: z.string().trim().max(50),
  address: z.string().trim().max(300),
  category: z.string().trim().min(1, "분야를 입력해 주세요.").max(100),
  homepage: z
    .string()
    .trim()
    .refine((value) => value === "" || z.url().safeParse(value).success, "올바른 URL을 입력해 주세요."),
  bank_name: z.string().trim().max(50),
  bank_account: z.string().trim().max(100),
  related_person: z.string().trim().max(100),
  related_person_phone: z.string().trim().max(50),
  primary_contact_name: z.string().trim().max(50),
  primary_contact_phone: z.string().trim().max(30),
  status: z.enum(vendorStatuses),
  memo: optionalText,
  internal_note: optionalText,
}).superRefine((value, context) => {
  if (!value.primary_contact_name && value.primary_contact_phone) {
    context.addIssue({
      code: "custom",
      message: "담당자 연락처를 입력하려면 담당자 이름을 입력해 주세요.",
      path: ["primary_contact_name"],
    });
  }
});

export const vendorContactSchema = z.object({
  id: databaseUuid.optional(),
  vendor_id: databaseUuid,
  name: z.string().trim().min(1, "담당자명을 입력해 주세요.").max(50),
  title: z.string().trim().max(50),
  phone: z.string().trim().max(30),
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, "올바른 이메일을 입력해 주세요."),
  duty: z.string().trim().max(100),
  is_primary: z.boolean(),
  active: z.boolean(),
});

export const contactLogSchema = z.object({
  vendor_id: databaseUuid,
  contact_id: databaseUuid.optional().or(z.literal("")),
  method: z.enum(["통화", "문자", "메일", "방문"]),
  at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "연락 일시를 입력해 주세요."),
  summary: z.string().trim().min(1, "연락 내용을 입력해 주세요.").max(300),
});

export const documentMetadataSchema = z.object({
  owner_id: databaseUuid,
  kind: z.enum(["사업자등록증", "견적서", "제안서", "계약서", "보증증권", "회의자료", "기타"]),
  file_path: z.string().trim().min(1).max(1000),
  file_name: z.string().trim().min(1).max(255),
  valid_until: z.string().date().optional().or(z.literal("")),
});

export type VendorInput = z.infer<typeof vendorSchema>;
export type VendorContactInput = z.infer<typeof vendorContactSchema>;
export type ContactLogInput = z.infer<typeof contactLogSchema>;
export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
