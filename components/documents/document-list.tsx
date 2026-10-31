"use client";

import {
  AlertTriangle,
  Building2,
  Check,
  Circle,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  applyVendorProfileFromDocument,
  deleteDocument,
} from "@/app/(main)/documents/actions";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  analysisStatusLabel,
  documentAnalysisProgressIndex,
  parseDocumentExtraction,
} from "@/lib/documents";
import { formatDate, formatDateTime } from "@/lib/format";

export type DocumentListItem = {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  version: number;
  validUntil?: string | null;
  createdAt: string;
  analysisStatus: string | null;
  analysisProgressStep: string | null;
  analysisSummary: string | null;
  analysisError: string | null;
  analysisUpdatedAt?: string | null;
  extractedData: unknown;
};

export type VendorProfileSnapshot = {
  id: string;
  name: string;
  bizNo: string;
  ceo: string;
  address: string;
};

type LiveAnalysis = {
  status: string | null;
  progressStep: string;
  error: string | null;
  updatedAt: string | null;
};

const progressLabels = ["원본 등록", "분석 대기", "파일 확인", "AI 분석", "결과 저장", "검토 준비"];

function AnalysisProgress({
  status,
  step,
}: {
  status: string | null;
  step: string | null;
}) {
  const currentIndex = documentAnalysisProgressIndex(
    status === "applied" ? "applied" : step,
  );
  const failed = status === "failed";

  return (
    <ol aria-label="자동분석 진행상태" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {progressLabels.map((label, index) => {
        const complete =
          index < currentIndex ||
          (index === 0 && currentIndex === 0 && !failed) ||
          (index === currentIndex && ["review_required", "applied"].includes(status ?? ""));
        const current = index === currentIndex;
        const finalLabel = index === 5
          ? status === "applied"
            ? "반영 완료"
            : status === "review_required"
              ? "검토 필요"
              : label
          : label;
        return (
          <li
            key={label}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs ${
              failed && current
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : complete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : current
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "text-muted-foreground"
            }`}
          >
            {failed && current ? (
              <X className="size-3.5 shrink-0" />
            ) : complete ? (
              <Check className="size-3.5 shrink-0" />
            ) : current ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <Circle className="size-3.5 shrink-0" />
            )}
            <span>{finalLabel}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function DocumentList({
  documents,
  canAnalyze,
  vendorProfile,
}: {
  documents: DocumentListItem[];
  canAnalyze: boolean;
  vendorProfile?: VendorProfileSnapshot;
}) {
  const router = useRouter();
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [applyingDocumentId, setApplyingDocumentId] = useState<string | null>(null);
  const [liveAnalyses, setLiveAnalyses] = useState<Record<string, LiveAnalysis>>({});

  async function pollAnalysis(documentId: string) {
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = (await response.json()) as {
        status: string | null;
        progressStep: string;
        error: string | null;
        updatedAt: string | null;
      };
      setLiveAnalyses((current) => ({
        ...current,
        [documentId]: {
          status: result.status,
          progressStep: result.progressStep,
          error: result.error,
          updatedAt: result.updatedAt,
        },
      }));
    } catch {
      // POST 요청은 계속 진행되므로 일시적인 상태 조회 실패만 무시한다.
    }
  }

  async function analyze(documentId: string) {
    setActiveDocumentId(documentId);
    setLiveAnalyses((current) => ({
      ...current,
      [documentId]: { status: "analyzing", progressStep: "queued", error: null, updatedAt: null },
    }));
    const pollTimer = window.setInterval(() => void pollAnalysis(documentId), 900);
    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const result = (await response.json()) as { ok: boolean; message: string };
      await pollAnalysis(documentId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch {
      toast.error("자동분석 요청을 처리하지 못했어. 잠시 후 다시 시도해 줘.");
    } finally {
      window.clearInterval(pollTimer);
      router.refresh();
      window.setTimeout(() => setActiveDocumentId(null), 800);
    }
  }

  async function remove(document: DocumentListItem) {
    if (!window.confirm(`'${document.fileName}' 문서를 삭제할까? 삭제한 문서는 관리자 휴지통에서 복원할 수 있어.`))
      return;

    setDeletingDocumentId(document.id);
    try {
      const result = await deleteDocument({ id: document.id });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("문서를 삭제하지 못했어. 잠시 후 다시 시도해 줘.");
    } finally {
      setDeletingDocumentId(null);
    }
  }

  async function applyVendorProfile(document: DocumentListItem, changes: string[]) {
    if (!vendorProfile) return;
    const confirmed = window.confirm(
      `'${document.fileName}' 분석 결과를 업체 기본정보에 반영할까?\n\n${changes.join("\n")}\n\n기존 값과 변경 이력은 감사 로그에 남아.`,
    );
    if (!confirmed) return;

    setApplyingDocumentId(document.id);
    try {
      const result = await applyVendorProfileFromDocument({ document_id: document.id });
      if (result.ok) {
        toast.success(result.message);
        router.push(`/vendors/${vendorProfile.id}?tab=basic`);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("업체 기본정보를 반영하지 못했어. 잠시 후 다시 시도해 줘.");
    } finally {
      setApplyingDocumentId(null);
    }
  }

  if (!documents.length)
    return <div className="p-10 text-center text-muted-foreground"><FileText className="mx-auto mb-2 size-7" />등록된 문서가 없어.</div>;

  return (
    <div className="divide-y">
      {documents.map((document) => {
        const extraction = parseDocumentExtraction(document.extractedData);
        const live = liveAnalyses[document.id];
        const status = live?.status ?? document.analysisStatus;
        const progressStep = live?.progressStep ?? document.analysisProgressStep ?? "registered";
        const analysisError = live?.error ?? document.analysisError;
        const analysisUpdatedAt = live?.updatedAt ?? document.analysisUpdatedAt;
        const isActive = activeDocumentId === document.id;
        const isDeleting = deletingDocumentId === document.id;
        const isApplying = applyingDocumentId === document.id;
        const actionPending = activeDocumentId !== null || deletingDocumentId !== null || applyingDocumentId !== null;
        const vendorChanges = vendorProfile && extraction
          ? [
              extraction.vendor.name && extraction.vendor.name !== vendorProfile.name
                ? `상호: ${vendorProfile.name || "미등록"} → ${extraction.vendor.name}`
                : null,
              extraction.vendor.business_number && extraction.vendor.business_number !== vendorProfile.bizNo
                ? `사업자번호: ${vendorProfile.bizNo || "미등록"} → ${extraction.vendor.business_number}`
                : null,
              extraction.vendor.representative && extraction.vendor.representative !== vendorProfile.ceo
                ? `대표자: ${vendorProfile.ceo || "미등록"} → ${extraction.vendor.representative}`
                : null,
              extraction.vendor.address && extraction.vendor.address !== vendorProfile.address
                ? `주소: ${vendorProfile.address || "미등록"} → ${extraction.vendor.address}`
                : null,
            ].filter((change): change is string => change !== null)
          : [];
        return (
          <div key={document.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{document.kind}</Badge>
                <p className="truncate font-semibold">{document.fileName}</p>
                <span className="text-xs text-muted-foreground">v{document.version}</span>
                <Badge variant={status === "failed" ? "destructive" : status === "applied" ? "default" : "secondary"}>
                  {isActive ? "분석 진행 중" : analysisStatusLabel(status)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">등록 {formatDate(document.createdAt)}{document.fileSize != null ? ` · ${(document.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}{document.validUntil ? ` · 유효기간 ${formatDate(document.validUntil)}` : ""}</p>
              <AnalysisProgress status={status} step={progressStep} />
              {isActive ? <p className="mt-2 text-xs text-blue-700">자동분석을 진행하고 있어. 파일 크기에 따라 최대 1분 정도 걸릴 수 있어.</p> : null}
              {analysisUpdatedAt ? <p className="mt-2 text-xs text-muted-foreground">마지막 상태 갱신 {formatDateTime(analysisUpdatedAt)}</p> : null}
              {document.analysisSummary ? <p className="mt-2 line-clamp-2 text-sm">{document.analysisSummary}</p> : null}
              {analysisError ? <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" />{analysisError}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <DocumentViewerDialog documentId={document.id} extraction={extraction} fileName={document.fileName} mimeType={document.mimeType} />
              {canAnalyze && status === "review_required" && vendorChanges.length ? <Button disabled={actionPending} size="sm" variant="outline" onClick={() => void applyVendorProfile(document, vendorChanges)}>{isApplying ? <Loader2 className="animate-spin" /> : <Building2 />}{isApplying ? "반영 중" : "업체정보 반영"}</Button> : null}
              {canAnalyze && status !== "applied" ? <Button disabled={actionPending} size="sm" variant="outline" onClick={() => void analyze(document.id)}>{isActive ? <Loader2 className="animate-spin" /> : <RefreshCw />}{document.analysisStatus ? "다시 분석" : "자동 분석"}</Button> : null}
              {canAnalyze ? <Button aria-label={`${document.fileName} 삭제`} disabled={actionPending} size="sm" variant="destructive" onClick={() => void remove(document)}>{isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}{isDeleting ? "삭제 중" : "삭제"}</Button> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
