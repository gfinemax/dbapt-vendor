# AGENTS.md — DB-Vendor (대방동지역주택조합 용역사 관리 시스템)

이 파일은 저장소 루트에 두고, Codex가 모든 작업에서 따르는 규칙이다.

## 1. 프로젝트 개요
- 서울 대방동 지역주택조합이 발주하는 외주 용역(인테리어, 에어컨, 전기, 간판, 단지 모형, 광고·CG, 토지용역, 업무대행, 신탁 등)을 관리하는 내부 웹 시스템.
- 흐름: 용역사 등록 → 견적·제안서 접수·비교 → 선정 → 계약 → 협의(회의록) → 일정·대금 지급 → 정산.
- 사용자: 관리자, 조합 임원, 사무국, 업무대행사 인력, 열람자(이사·감사). 동시 사용자 10명 내외.
- UI 언어는 전부 한국어. 날짜는 KST, 표시 형식 `2026.11.30.`, 금액은 원 단위 천 단위 콤마(`12,500,000원`).

## 2. 기술 스택 (변경 금지, 추가 라이브러리는 사유를 PR 설명에 기재)
- Next.js 15 (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui, 아이콘 lucide-react
- Supabase: PostgreSQL, Auth(이메일 로그인), Storage, RLS, Edge Functions
- @supabase/ssr 로 서버/클라이언트 세션 처리
- 폼: react-hook-form + zod / 테이블: @tanstack/react-table
- 캘린더: FullCalendar / 엑셀: SheetJS(xlsx) / 날짜: date-fns (ko locale)
- 메일: Resend (Edge Function에서 호출)
- 배포: Vercel

## 3. 디렉터리 구조
```
app/
  (auth)/login/
  (main)/dashboard/
  (main)/projects/[id]/        # 용역 건 상세 (탭: 개요·견적비교·계약·협의·일정·문서)
  (main)/vendors/[id]/
  (main)/quotes/
  (main)/contracts/[id]/
  (main)/meetings/[id]/
  (main)/schedule/
  (main)/settings/
components/ui/                 # shadcn
components/<도메인>/
lib/supabase/{client,server,middleware}.ts
lib/validators/                # zod 스키마
lib/format.ts                  # 날짜·금액 포맷
supabase/migrations/           # SQL 마이그레이션 (순번_설명.sql)
supabase/functions/            # Edge Functions
supabase/seed.sql
```

## 4. 코딩 규칙
- 데이터 변경은 Server Actions 사용, 입력은 반드시 zod로 검증.
- DB 스키마 변경은 항상 `supabase/migrations/`에 새 SQL 파일로 추가 (기존 파일 수정 금지).
- 모든 테이블: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by`, `deleted_at`(소프트 삭제).
- 금액은 `bigint`(원), 날짜는 `date`, 시각은 `timestamptz`.
- 목록 조회는 항상 `deleted_at is null` 조건.
- 모든 insert/update/delete는 `audit_logs` 트리거로 기록.
- 비밀키는 `.env.local`만 사용, 코드·커밋에 하드코딩 금지. `.env.example` 유지.
- 컴포넌트는 서버 컴포넌트 기본, 상호작용 필요한 부분만 `"use client"`.
- 모바일(390px)에서도 사용 가능해야 함. 특히 협의록 작성 폼과 일정 목록.

## 5. 권한 (RLS로 강제, UI 숨김만으로 처리 금지)
| 역할 | 코드 | 권한 |
|---|---|---|
| 관리자 | admin | 전체 + 사용자·코드 관리 + 영구 삭제 |
| 조합 임원 | executive | 전체 조회, 선정·계약 승인 |
| 사무국 | staff | 업체·문서·협의록·일정 등록·수정 |
| 업무대행사 | agent | 본인이 담당자로 배정된 용역 건만 조회·수정, 내부 검토의견(internal_note) 조회 불가 |
| 열람자 | viewer | 조회 전용, internal_note 조회 불가 |

- `users` 테이블(auth.users와 1:1)에 `role` 컬럼. 헬퍼 함수 `public.current_role()` 작성해 RLS에서 사용.
- Storage 버킷 `vendor-files`는 비공개, 다운로드는 서명 URL(60초).

## 6. 완료 기준 (모든 작업 공통)
- `pnpm lint`, `pnpm typecheck`, `pnpm build` 통과.
- 새 기능은 seed 데이터로 화면에서 동작 확인 가능해야 함.
- 작업 끝에 변경 파일 목록, 실행 방법, 남은 TODO를 한국어로 요약.
- 요구사항이 모호하면 임의로 크게 설계하지 말고 가장 단순한 구현 + TODO 주석.
