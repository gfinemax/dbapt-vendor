import { z } from "zod";

export const businessProjectStatuses = [
  "계획",
  "진행",
  "완료",
  "보류",
] as const;
export const serviceCaseCategories = [
  "사업관리",
  "토지",
  "홍보관·사무실",
  "광고·홍보",
  "기타",
] as const;
export const serviceCaseStages = [
  "견적요청",
  "비교검토",
  "선정",
  "계약",
  "진행",
  "준공",
  "정산완료",
  "보류",
] as const;

export const businessProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "프로젝트명을 입력해 줘.")
    .max(120, "프로젝트명은 120자 이내로 입력해 줘."),
  description: z.string().trim().max(1000, "설명은 1,000자 이내로 입력해 줘."),
  status: z.enum(businessProjectStatuses),
});

export const serviceCaseSchema = z.object({
  business_project_id: z.string().uuid("상위 프로젝트를 확인해 줘."),
  title: z
    .string()
    .trim()
    .min(1, "용역명을 입력해 줘.")
    .max(120, "용역명은 120자 이내로 입력해 줘."),
  category: z.enum(serviceCaseCategories),
  description: z.string().trim().max(1000, "설명은 1,000자 이내로 입력해 줘."),
  budget: z
    .number()
    .int("예산은 원 단위 정수로 입력해 줘.")
    .min(0, "예산은 0원 이상이어야 해.")
    .max(Number.MAX_SAFE_INTEGER),
  stage: z.enum(serviceCaseStages),
  owner_user_id: z.union([z.string().uuid(), z.literal("")]),
});

export type BusinessProjectInput = z.infer<typeof businessProjectSchema>;
export type ServiceCaseInput = z.infer<typeof serviceCaseSchema>;
