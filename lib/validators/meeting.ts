import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "기한을 입력해 줘.");
const dateTimeLocalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "일시를 입력해 줘.");

export const actionItemInputSchema = z.object({
  content: z.string().trim().min(1, "후속조치 내용을 입력해 줘.").max(300),
  assignee_user_id: z.union([z.string().uuid(), z.literal("")]),
  due_date: dateSchema,
});

export const meetingSchema = z.object({
  project_id: z.string().uuid("용역 건을 선택해 줘."),
  vendor_id: z.union([z.string().uuid(), z.literal("")]),
  held_at: dateTimeLocalSchema,
  method: z.enum(["대면", "전화", "화상", "메일"]),
  attendees_union: z.string().trim().max(300),
  attendees_vendor: z.string().trim().max(300),
  agenda: z.string().trim().min(1, "안건을 입력해 줘.").max(300),
  notes: z.string().trim().max(5000),
  decisions: z.string().trim().max(3000),
  actions: z.array(actionItemInputSchema).max(20, "후속조치는 20개까지 등록할 수 있어."),
});

export const meetingDocumentSchema = z.object({
  meeting_id: z.string().uuid(),
  project_id: z.string().uuid(),
  file_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
});

export const actionStatusSchema = z.object({
  id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  project_id: z.string().uuid(),
  complete: z.boolean(),
});

export type MeetingInput = z.infer<typeof meetingSchema>;
export type MeetingDocumentInput = z.infer<typeof meetingDocumentSchema>;
export type ActionStatusInput = z.infer<typeof actionStatusSchema>;
