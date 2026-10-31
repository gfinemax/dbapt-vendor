# DB-Vendor

대방동지역주택조합의 외주 용역사, 견적 비교, 계약·지급, 협의록, 일정과 감사 이력을 관리하는 내부 웹 시스템이야.

## 기술 구성

- Next.js 15 App Router, TypeScript strict
- Tailwind CSS, shadcn/ui, lucide-react
- Supabase PostgreSQL, Auth, Storage, RLS, Edge Functions, Cron
- React Hook Form + Zod, FullCalendar 7, SheetJS
- Resend 일정 알림, Vercel 배포

## 로컬 실행

Node.js 22와 pnpm 10, Docker Desktop이 필요해.

```powershell
pnpm install
npx supabase start
npx supabase db reset --local
pnpm dev
```

브라우저에서 `http://localhost:3000`을 열어. 로컬 더미 계정은 `supabase/seed.sql`에서 확인할 수 있고, 운영 비밀번호나 비밀키는 저장소에 넣지 않아.

## 환경 변수

`.env.example`을 `.env.local`로 복사해 값을 설정해.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

- 브라우저에는 publishable key만 노출해. 레거시 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 대체값으로 사용할 수 있어.
- `SUPABASE_SERVICE_ROLE_KEY`는 사용자 초대와 Edge Function 서버 처리에만 사용하고 클라이언트 코드에 넣지 않아.
- `RESEND_FROM_EMAIL`은 Resend에서 인증한 발신 주소를 사용해.

## 데이터베이스와 시드

스키마 변경은 `supabase/migrations/`에 새 파일로만 추가해. 전체 로컬 DB와 시드는 다음 명령으로 재구성해.

```powershell
npx supabase db reset --local
npx supabase test db
```

운영 반영 전에는 새 마이그레이션, RLS 정책, 감사 트리거와 Supabase Security Advisor 결과를 확인해야 해. `vendor-files` 버킷은 비공개이며 다운로드 URL은 60초 서명 방식이야.

## 일정 알림 Edge Function

로컬 실행:

```powershell
npx supabase functions serve daily-reminder
```

`daily-reminder`는 다음 순서로 동작해.

1. KST 기준 지난 일정을 `지연`으로 갱신
2. D-7, D-3, D-day, 지연 일정을 용역 담당자와 후속조치 담당자별로 묶음
3. `notification_logs`로 같은 일정·수신자·단계의 중복 발송 차단
4. Resend로 한국어 HTML 표 메일 발송

운영 Cron은 Supabase Vault의 다음 비밀을 사용해 Edge Function을 호출해.

- `daily_reminder_project_url`
- `daily_reminder_publishable_key`
- `daily_reminder_token`

Cron 표현식 `0 23 * * *`는 UTC 23:00, 즉 KST 매일 08:00이야. Supabase Dashboard의 Cron 화면에서 `daily-reminder-kst` 작업과 실행 이력을 확인해. 호출 토큰과 API 키를 SQL 파일이나 커밋에 직접 넣으면 안 돼.

## Vercel 배포

1. Git 저장소를 Vercel 프로젝트에 연결해.
2. 위 Next.js 환경 변수를 Production/Preview에 각각 설정해.
3. Supabase Auth의 Site URL과 Redirect URL에 실제 Vercel 도메인을 추가해.
4. 빌드 명령은 `pnpm build`, 설치 명령은 `pnpm install`을 사용해.
5. 배포 후 로그인, RLS 역할별 접근, Storage 업로드, Edge Function과 Cron을 각각 확인해.

커밋이나 push 성공은 배포 성공을 뜻하지 않아. Vercel 배포 상태와 실제 운영 URL의 주요 흐름을 별도로 확인해야 해.

## 품질 검사

```powershell
pnpm lint
pnpm typecheck
pnpm build
npx supabase test db
```

주요 화면은 390px 모바일 폭에서도 사용할 수 있게 구성되어 있어. 특히 협의록 작성, 일정 목록, 표의 가로 스크롤과 버튼 접근성을 변경할 때 다시 확인해.

## 주요 경로

- `/dashboard`: 진행·계약·지급·일정 요약
- `/projects`, `/quotes`: 용역 건과 견적 비교·선정
- `/vendors`: 용역사, 담당자, 문서와 타임라인
- `/contracts`: 계약, 지급·정산, 보증과 변경계약
- `/meetings`: 협의록, 후속조치와 업체 확인용 인쇄
- `/schedule`: 월·주·목록 일정, 수동 일정과 ICS
- `/settings`: 관리자 사용자·배정, 휴지통, 감사 이력, 보고서와 전체 XLSX 백업
