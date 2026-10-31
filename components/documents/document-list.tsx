"use client";

import { AlertTriangle, FileText, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analysisStatusLabel, parseDocumentExtraction } from "@/lib/documents";
import { formatDate } from "@/lib/format";

export type DocumentListItem = {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  version: number;
  createdAt: string;
  analysisStatus: string | null;
  analysisSummary: string | null;
  analysisError: string | null;
  extractedData: unknown;
};

export function DocumentList({ documents, canAnalyze }: { documents: DocumentListItem[]; canAnalyze: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function analyze(documentId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/documents/${documentId}/analyze`, { method: "POST" });
      const result = (await response.json()) as { ok: boolean; message: string };
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  }

  if (!documents.length)
    return <div className="p-10 text-center text-muted-foreground"><FileText className="mx-auto mb-2 size-7" />등록된 문서가 없어.</div>;

  return (
    <div className="divide-y">
      {documents.map((document) => {
        const extraction = parseDocumentExtraction(document.extractedData);
        return (
          <div key={document.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{document.kind}</Badge>
                <p className="truncate font-semibold">{document.fileName}</p>
                <span className="text-xs text-muted-foreground">v{document.version}</span>
                <Badge variant={document.analysisStatus === "failed" ? "destructive" : document.analysisStatus === "applied" ? "default" : "secondary"}>
                  {analysisStatusLabel(document.analysisStatus)}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">등록 {formatDate(document.createdAt)}{document.fileSize != null ? ` · ${(document.fileSize / 1024 / 1024).toFixed(1)}MB` : ""}</p>
              {document.analysisSummary ? <p className="mt-2 line-clamp-2 text-sm">{document.analysisSummary}</p> : null}
              {document.analysisError ? <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" />{document.analysisError}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <DocumentViewerDialog documentId={document.id} extraction={extraction} fileName={document.fileName} mimeType={document.mimeType} />
              {canAnalyze && document.analysisStatus !== "applied" ? <Button disabled={pending} size="sm" variant="outline" onClick={() => analyze(document.id)}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}{document.analysisStatus ? "다시 분석" : "자동 분석"}</Button> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
