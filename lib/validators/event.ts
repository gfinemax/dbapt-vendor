import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 입력해 줘.");

export const manualEventSchema = z.object({
  project_id: z.string().uuid("용역 건을 선택해 줘."),
  type: z.enum(["견적마감", "업체미팅", "이사회상정", "계약체결", "착수", "중간점검", "대금지급", "준공", "보증만료", "후속조치", "기타"]),
  title: z.string().trim().min(1, "일정 제목을 입력해 줘.").max(160),
  date: dateSchema,
  end_date: z.union([dateSchema, z.literal("")]),
  status: z.enum(["예정", "진행", "완료", "지연"]),
  memo: z.string().trim().max(1000),
}).refine((value) => !value.end_date || value.end_date >= value.date, { path: ["end_date"], message: "종료일은 시작일 이후여야 해." });

export const eventStatusSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  complete: z.boolean(),
});

export type ManualEventInput = z.infer<typeof manualEventSchema>;
export type EventStatusInput = z.infer<typeof eventStatusSchema>;
