import {
  documentExtractionSchema,
  type DocumentExtraction,
} from "@/lib/validators/document";

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

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
  return (
    name
      .normalize("NFKC")
      .replace(/[^0-9A-Za-z가-힣._-]+/g, "_")
      .slice(-180) || "document"
  );
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
