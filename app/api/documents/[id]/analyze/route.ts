import { createHash } from "node:crypto";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";

import type { Json } from "@/lib/database.types";
import {
  canAnalyzeDocument,
  documentExtension,
  MAX_DOCUMENT_SIZE,
} from "@/lib/documents";
import { getActor } from "@/lib/supabase/actor";
import { documentExtractionSchema } from "@/lib/validators/document";

export const runtime = "nodejs";
export const maxDuration = 60;

function fallbackMimeType(fileName: string) {
  const extension = documentExtension(fileName);
  const values: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
  };
  return values[extension] ?? "application/octet-stream";
}

const systemPrompt = `너는 대한민국 지역주택조합의 용역 문서 분석 담당자야.
계약서, 변경계약서, 견적서, 제안서, 사업자등록증, 보증증권, 회의자료와 공문에서 사실만 추출해.
문서에 없는 값은 추측하지 말고 null 또는 빈 배열로 반환해.
금액은 원 단위 정수로 정규화하고 공급가액, 부가세, 총액을 구분해.
견적과 계약의 원문 항목명은 보존하고 normalized_name에는 업체 간 비교 가능한 짧은 표준 이름을 넣어.
날짜는 YYYY-MM-DD 형식으로 반환해.
분야는 사업관리, 토지, 홍보관·사무실, 광고·홍보, 기타 중 하나만 제안해.
각 핵심 필드에는 페이지 번호, 짧은 원문 근거, 신뢰도를 evidence에 남겨.
불리하거나 모호한 조항과 필수값 누락은 risks와 missing_fields에 분리해.
개인 주민등록번호, 계좌번호 같은 불필요한 개인정보는 요약이나 근거에 복사하지 마.`;

function validDocumentId(id: string) {
  return /^[0-9a-f-]{36}$/i.test(id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validDocumentId(id))
    return NextResponse.json({ ok: false, message: "문서 정보가 올바르지 않아." }, { status: 400 });

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return NextResponse.json({ ok: false, message: actor.error ?? "로그인이 필요해." }, { status: 401 });

  const { data, error } = await actor.supabase
    .from("document_analyses")
    .select("status,progress_step,summary,error_message,updated_at")
    .eq("document_id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error)
    return NextResponse.json({ ok: false, message: "분석 진행상태를 불러오지 못했어." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    status: data?.status ?? null,
    progressStep: data?.progress_step ?? "registered",
    summary: data?.summary ?? null,
    error: data?.error_message ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!validDocumentId(id))
    return NextResponse.json({ ok: false, message: "문서 정보가 올바르지 않아." }, { status: 400 });

  const actor = await getActor();
  if (actor.error || !actor.supabase || !actor.userId)
    return NextResponse.json({ ok: false, message: actor.error ?? "로그인이 필요해." }, { status: 401 });
  if (!(["admin", "staff", "agent"] as string[]).includes(actor.role ?? ""))
    return NextResponse.json({ ok: false, message: "문서를 분석할 권한이 없어." }, { status: 403 });

  const { data: document, error: documentError } = await actor.supabase
    .from("documents")
    .select("id,owner_type,owner_id,kind,file_path,file_name,mime_type,file_size")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (documentError || !document)
    return NextResponse.json({ ok: false, message: "문서를 찾을 수 없거나 권한이 없어." }, { status: 404 });

  let initialProjectId = document.owner_type === "project" ? document.owner_id : null;
  if (document.owner_type === "quote") {
    const { data } = await actor.supabase.from("quotes").select("project_id").eq("id", document.owner_id).maybeSingle();
    initialProjectId = data?.project_id ?? null;
  }
  if (document.owner_type === "contract") {
    const { data } = await actor.supabase.from("contracts").select("project_id").eq("id", document.owner_id).maybeSingle();
    initialProjectId = data?.project_id ?? null;
  }
  if (document.owner_type === "meeting") {
    const { data } = await actor.supabase.from("meetings").select("project_id").eq("id", document.owner_id).maybeSingle();
    initialProjectId = data?.project_id ?? null;
  }
  const appliedOwner = document.owner_type === "business_project"
    ? { applied_owner_type: null, applied_owner_id: null }
    : { applied_owner_type: document.owner_type, applied_owner_id: document.owner_id };
  const { error: queueError } = await actor.supabase.from("document_analyses").upsert(
    {
      document_id: document.id,
      status: "analyzing",
      progress_step: "queued",
      detected_kind: document.kind,
      error_message: null,
      applied_project_id: initialProjectId,
      ...appliedOwner,
      created_by: actor.userId,
    },
    { onConflict: "document_id" },
  );
  if (queueError)
    return NextResponse.json({ ok: false, message: "문서 분석 상태를 저장하지 못했어." }, { status: 500 });

  if (!canAnalyzeDocument(document.file_name, document.mime_type)) {
    const message = "한글(hwp) 파일은 원본을 보관했어. PDF로 변환해 다시 올리면 자동 분석할 수 있어.";
    await actor.supabase
      .from("document_analyses")
      .update({
        status: "review_required",
        progress_step: "review_required",
        summary: message,
        error_message: null,
        analyzed_at: new Date().toISOString(),
      })
      .eq("document_id", document.id);
    return NextResponse.json({ ok: true, message, analysis: null });
  }

  const directOpenAiKey = process.env.OPENAI_API_KEY;
  if (!directOpenAiKey) {
    const message = "Vercel 환경변수에 OPENAI_API_KEY가 없어 원본만 등록했어.";
    await actor.supabase
      .from("document_analyses")
      .update({ status: "failed", error_message: message })
      .eq("document_id", document.id);
    return NextResponse.json({ ok: false, message }, { status: 503 });
  }

  await actor.supabase
    .from("document_analyses")
    .update({ progress_step: "loading_file" })
    .eq("document_id", document.id);

  const { data: blob, error: downloadError } = await actor.supabase.storage
    .from("vendor-files")
    .download(document.file_path);
  if (downloadError || !blob) {
    const message = "분석할 원본 파일을 불러오지 못했어.";
    await actor.supabase
      .from("document_analyses")
      .update({ status: "failed", error_message: message })
      .eq("document_id", document.id);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.byteLength > MAX_DOCUMENT_SIZE) {
    const message = "20MB 이하 문서만 분석할 수 있어.";
    await actor.supabase
      .from("document_analyses")
      .update({ status: "failed", error_message: message })
      .eq("document_id", document.id);
    return NextResponse.json({ ok: false, message }, { status: 413 });
  }

  const mimeType = document.mime_type || blob.type || fallbackMimeType(document.file_name);
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const model = process.env.OPENAI_DOCUMENT_MODEL || "gpt-4.1-mini";

  try {
    await actor.supabase
      .from("document_analyses")
      .update({ progress_step: "analyzing" })
      .eq("document_id", document.id);

    const openai = new OpenAI({ apiKey: directOpenAiKey });
    const image = mimeType.startsWith("image/");
    const fileContent = image
      ? ({ type: "input_image", image_url: dataUrl, detail: "high" } as const)
      : ({
          type: "input_file",
          filename: document.file_name,
          file_data: dataUrl,
          ...(mimeType === "application/pdf" ? { detail: "high" as const } : {}),
        } as const);
    const response = await openai.responses.parse({
      model,
      store: false,
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "input_text",
              text: `파일명: ${document.file_name}\n사용자가 지정한 종류: ${document.kind}\n원문 근거가 없는 값은 만들지 말고 문서를 분석해 줘.`,
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(documentExtractionSchema, "document_extraction"),
      },
    });
    const extraction = response.output_parsed;
    if (!extraction) throw new Error("구조화된 분석 결과가 없어.");

    await actor.supabase
      .from("document_analyses")
      .update({ progress_step: "saving" })
      .eq("document_id", document.id);

    const { error: saveError } = await actor.supabase
      .from("document_analyses")
      .update({
        status: "review_required",
        progress_step: "review_required",
        detected_kind: extraction.detected_kind,
        summary: extraction.summary,
        extracted_data: extraction as unknown as NonNullable<Json>,
        evidence: extraction.evidence as unknown as NonNullable<Json>,
        confidence: extraction.confidence,
        model,
        schema_version: "document-intelligence-v1",
        source_hash: createHash("sha256").update(buffer).digest("hex"),
        error_message: null,
        analyzed_at: new Date().toISOString(),
      })
      .eq("document_id", document.id);
    if (saveError) throw new Error("분석 결과를 저장하지 못했어.");

    const hasVendorProfile = Object.values(extraction.vendor).some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
    if (
      document.owner_type === "vendor" &&
      (actor.role === "admin" || actor.role === "staff") &&
      hasVendorProfile
    ) {
      const { error: applyError } = await actor.supabase.rpc(
        "apply_vendor_profile_from_document",
        { document_id_value: document.id },
      );
      if (applyError) {
        const message = applyError.message.includes("vendors_active_biz_no_uidx")
          ? "분석은 완료했지만 추출된 사업자번호가 다른 업체에 이미 등록돼 있어 기본정보에는 반영하지 못했어."
          : "분석은 완료했지만 업체 기본정보에는 자동 반영하지 못했어. 서류 탭에서 추출값을 확인해 줘.";
        return NextResponse.json(
          { ok: false, message, analysis: extraction },
          { status: 409 },
        );
      }
      return NextResponse.json({
        ok: true,
        message: "문서 분석을 마치고 추출된 업체 기본정보까지 반영했어.",
        analysis: extraction,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "문서 분석을 마쳤어. 추출값을 확인해 줘.",
      analysis: extraction,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "문서 분석 중 오류가 발생했어.";
    await actor.supabase
      .from("document_analyses")
      .update({ status: "failed", error_message: message })
      .eq("document_id", document.id);
    return NextResponse.json(
      { ok: false, message: `문서는 보관했지만 자동 분석에 실패했어: ${message}` },
      { status: 502 },
    );
  }
}
