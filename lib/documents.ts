import {
  documentExtractionSchema,
  type DocumentExtraction,
} from "@/lib/validators/document";

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

export const documentAnalysisProgressSteps = [
  "registered",
  "loading_file",
  "analyzing",
  "saving",
  "review_required",
] as const;

export type DocumentAnalysisProgressStep =
  | (typeof documentAnalysisProgressSteps)[number]
  | "queued"
  | "applied";

export function documentAnalysisProgressLabel(
  step: DocumentAnalysisProgressStep | string | null,
) {
  switch (step) {
    case "registered":
      return "원본 등록";
    case "queued":
      return "분석 대기";
    case "loading_file":
      return "파일 확인";
    case "analyzing":
      return "AI 분석";
    case "saving":
      return "결과 저장";
    case "review_required":
      return "검토 필요";
    case "applied":
      return "반영 완료";
    default:
      return "원본 등록";
  }
}

export function documentAnalysisProgressIndex(
  step: DocumentAnalysisProgressStep | string | null,
) {
  switch (step) {
    case "queued":
      return 1;
    case "loading_file":
      return 2;
    case "analyzing":
      return 3;
    case "saving":
      return 4;
    case "review_required":
    case "applied":
      return 5;
    default:
      return 0;
  }
}

export const allowedDocumentExtensions = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "xls",
  "xlsx",
  "csv",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "hwp",
]);

export function documentExtension(fileName: string) {
  return fileName.split(".").pop()?.toLocaleLowerCase() ?? "";
}

export function safeDocumentFileName(name: string) {
  const extension = documentExtension(name).replace(/[^0-9a-z]/g, "");
  const baseName = extension ? name.slice(0, -(extension.length + 1)) : name;
  const safeBaseName = baseName
    .normalize("NFKD")
    .replace(/[^0-9A-Za-z._-]+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "")
    .slice(-150);
  return `${safeBaseName || "document"}${extension ? `.${extension}` : ""}`;
}

export function documentKindStorageSegment(kind: string) {
  const segments: Record<string, string> = {
    사업자등록증: "business_registration",
    견적서: "quote",
    제안서: "proposal",
    계약서: "contract",
    보증증권: "guarantee",
    회의자료: "meeting_material",
    기타: "other",
  };
  return segments[kind] ?? "other";
}

export function canAnalyzeDocument(fileName: string, mimeType?: string | null) {
  const extension = documentExtension(fileName);
  if (extension === "hwp") return false;
  return (
    extension === "pdf" ||
    ["xls", "xlsx", "csv", "doc", "docx", "ppt", "pptx", "txt"].includes(
      extension,
    ) ||
    mimeType?.startsWith("image/") === true ||
    ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)
  );
}

export function analysisStatusLabel(status: string | null) {
  switch (status) {
    case "queued":
      return "분석 대기";
    case "analyzing":
      return "분석 중";
    case "review_required":
      return "검토 필요";
    case "applied":
      return "반영 완료";
    case "failed":
      return "분석 실패";
    default:
      return "미분석";
  }
}

export function parseDocumentExtraction(value: unknown): DocumentExtraction | null {
  const parsed = documentExtractionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function suggestedQuoteAmount(extraction: DocumentExtraction) {
  if (extraction.quote.total_amount != null)
    return { amount: extraction.quote.total_amount, vatIncluded: true };
  if (extraction.quote.supply_amount != null)
    return { amount: extraction.quote.supply_amount, vatIncluded: false };
  return { amount: 0, vatIncluded: true };
}

export function suggestedContractAmounts(extraction: DocumentExtraction) {
  const amount = extraction.contract.supply_amount ?? 0;
  const vat =
    extraction.contract.vat_amount ??
    (extraction.contract.total_amount != null
      ? Math.max(extraction.contract.total_amount - amount, 0)
      : 0);
  return { amount, vat };
}
