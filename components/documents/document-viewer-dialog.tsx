"use client";

import { Download, ExternalLink, Eye, Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { getDocumentAccessUrl } from "@/app/(main)/documents/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { documentExtension } from "@/lib/documents";
import type { DocumentExtraction } from "@/lib/validators/document";

type SheetPreview = { name: string; rows: string[][] };

function SpreadsheetPreview({ url }: { url: string }) {
  const [sheets, setSheets] = useState<SheetPreview[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [response, XLSX] = await Promise.all([fetch(url), import("xlsx")]);
        if (!response.ok) throw new Error("파일을 불러오지 못했어.");
        const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
        const parsed = workbook.SheetNames.map((name) => ({
          name,
          rows: (XLSX.utils.sheet_to_json(workbook.Sheets[name], {
            header: 1,
            raw: false,
            defval: "",
          }) as unknown[][])
            .slice(0, 200)
            .map((row) => row.slice(0, 50).map((cell) => String(cell))),
        }));
        if (!cancelled) setSheets(parsed);
      } catch (reason) {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "엑셀 미리보기에 실패했어.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!sheets.length)
    return <div className="flex h-full items-center justify-center"><Loader2 className="size-7 animate-spin" /></div>;
  const sheet = sheets[selected];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 overflow-x-auto border-b p-2">
        {sheets.map((item, index) => (
          <Button key={item.name} size="sm" variant={selected === index ? "default" : "outline"} onClick={() => setSelected(index)}>
            {item.name}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-white text-black">
        <table className="min-w-full border-collapse text-xs">
          <tbody>
            {sheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="max-w-80 whitespace-pre-wrap border border-slate-300 px-2 py-1 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DocumentViewerDialog({
  documentId,
  fileName,
  mimeType,
  extraction,
}: {
  documentId: string;
  fileName: string;
  mimeType?: string | null;
  extraction?: DocumentExtraction | null;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState<number | null>(null);
  const extension = documentExtension(fileName);
  const type = mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(extension)
    ? "image"
    : mimeType === "application/pdf" || extension === "pdf"
      ? "pdf"
      : ["xls", "xlsx", "csv"].includes(extension)
        ? "spreadsheet"
        : "download";

  function load() {
    if (url) return;
    startTransition(async () => {
      const result = await getDocumentAccessUrl(documentId);
      if (!result.ok || !result.url) {
        toast.error(result.message);
        setOpen(false);
        return;
      }
      setUrl(result.url);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) load(); else { setUrl(""); setPage(null); } }}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Eye />보기</Button></DialogTrigger>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-14">
          <DialogTitle className="truncate">{fileName}</DialogTitle>
          <DialogDescription>권한을 확인한 60초 임시 주소로 원본을 표시해.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative min-h-[45vh] flex-1 overflow-hidden bg-muted/40">
            {pending || !url ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
            ) : type === "pdf" ? (
              <iframe key={`${url}-${page ?? 1}`} className="h-full w-full border-0" src={`${url}#page=${page ?? 1}`} title={fileName} />
            ) : type === "image" ? (
              <div className="relative h-full w-full"><Image alt={fileName} className="object-contain" fill src={url} unoptimized /></div>
            ) : type === "spreadsheet" ? (
              <SpreadsheetPreview url={url} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="font-medium">이 형식은 브라우저에서 바로 표시할 수 없어.</p>
                <p className="text-sm text-muted-foreground">원본을 새 창에서 열거나 내려받아 확인해 줘.</p>
              </div>
            )}
          </div>
          <aside className="max-h-[45vh] w-full overflow-y-auto border-t p-5 lg:max-h-none lg:w-[380px] lg:border-l lg:border-t-0">
            <div className="flex flex-wrap gap-2">
              {url ? <Button asChild size="sm" variant="outline"><a href={url} rel="noreferrer" target="_blank"><ExternalLink />새 창</a></Button> : null}
              {url ? <Button asChild size="sm" variant="outline"><a download={fileName} href={url}><Download />다운로드</a></Button> : null}
            </div>
            <h3 className="mt-5 font-semibold">문서 분석</h3>
            {extraction ? (
              <div className="mt-3 space-y-4 text-sm">
                <p className="whitespace-pre-wrap leading-6">{extraction.summary}</p>
                {extraction.risks.length ? <div><p className="font-medium text-amber-700">위험·확인사항</p><ul className="mt-1 list-disc space-y-1 pl-5">{extraction.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></div> : null}
                {extraction.missing_fields.length ? <div><p className="font-medium text-destructive">누락 필수값</p><ul className="mt-1 list-disc space-y-1 pl-5">{extraction.missing_fields.map((field) => <li key={field}>{field}</li>)}</ul></div> : null}
                {extraction.evidence.length ? <div><p className="font-medium">원문 근거</p><div className="mt-2 space-y-2">{extraction.evidence.map((item, index) => <button key={`${item.field}-${index}`} className="block w-full rounded-lg border p-2 text-left hover:bg-muted" type="button" onClick={() => item.page && setPage(item.page)}><span className="font-medium">{item.field}</span>{item.page ? <span className="ml-2 text-xs text-muted-foreground">{item.page}페이지</span> : null}<p className="mt-1 text-xs text-muted-foreground">{item.quote}</p></button>)}</div></div> : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">저장된 분석 결과가 없어.</p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
