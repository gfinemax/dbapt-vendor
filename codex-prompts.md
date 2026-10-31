# DB-Vendor 개발 프롬프트 (ChatGPT Codex용)

사용법
1. 빈 GitHub 저장소를 만들고 루트에 `AGENTS.md`를 커밋한 뒤 Codex에 연결한다.
2. 아래 프롬프트를 **Phase 순서대로 하나씩** Codex 작업으로 실행한다. 한 Phase가 끝나면 PR을 검토·머지한 뒤 다음 Phase를 실행한다.
3. Supabase 프로젝트 URL·키는 Codex 환경 변수(또는 `.env.local`)로만 넣는다.

---

## Phase 0 — 프로젝트 초기화

```
AGENTS.md 규칙을 따라 DB-Vendor 프로젝트를 초기화해줘.

1. Next.js 15(App Router, TypeScript strict, pnpm) 프로젝트 생성
2. Tailwind + shadcn/ui 설치, 기본 컴포넌트 추가: button, input, textarea, select, dialog, sheet, table, tabs, badge, card, calendar, popover, dropdown-menu, form, toast(sonner)
3. 의존성: @supabase/ssr @supabase/supabase-js react-hook-form zod @hookform/resolvers @tanstack/react-table date-fns lucide-react xlsx
4. lib/supabase/client.ts, server.ts, middleware.ts 작성 (세션 갱신, 미로그인 시 /login 리다이렉트)
5. lib/format.ts: formatDate(→ "2026.11.30."), formatWon(→ "12,500,000원"), dDay(→ "D-3"/"D-day"/"D+2")
6. 공통 레이아웃: 좌측 사이드바(대시보드, 용역 건, 용역사, 견적 비교, 계약, 협의록, 일정, 설정), 상단 사용자 메뉴, 모바일은 햄버거 시트
7. /login 페이지 (이메일+비밀번호, Supabase Auth)
8. .env.example 작성 (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY)
9. package.json 스크립트: dev, build, lint, typecheck

완료 기준: pnpm build 통과, 로그인 후 빈 레이아웃이 보임.
```

---

## Phase 1 — DB 스키마·RLS·시드

```
AGENTS.md 규칙에 따라 supabase/migrations/0001_init.sql 을 작성해줘.

[enum]
- user_role: admin, executive, staff, agent, viewer
- vendor_status: 후보, 견적중, 선정, 계약중, 완료, 탈락, 거래중지
- project_stage: 견적요청, 비교검토, 선정, 계약, 진행, 준공, 정산완료, 보류
- project_category: 사업관리, 토지, 홍보관·사무실, 광고·홍보, 기타
- settlement_status: 미정산, 정산요청, 정산완료
- event_type: 견적마감, 업체미팅, 이사회상정, 계약체결, 착수, 중간점검, 대금지급, 준공, 보증만료, 후속조치, 기타
- event_status: 예정, 진행, 완료, 지연

[테이블] (공통 컬럼: id, created_at, updated_at, created_by, deleted_at)
- users: id(=auth.users.id), name, email, role user_role, phone, active
- vendors: name, biz_no, ceo, address, category, homepage, bank_name, bank_account, status vendor_status, memo, internal_note
- vendor_contacts: vendor_id, name, title, phone, email, duty, is_primary, active
- contact_logs: vendor_id, contact_id, method(통화/문자/메일/방문), at, summary, meeting_id null
- projects: title, category project_category, description, budget bigint, stage project_stage, owner_user_id, board_resolution(이사회 회차·일자 텍스트), selected_vendor_id null, selection_reason, internal_note
- project_assignees: project_id, user_id  ← agent 권한 판단에 사용
- project_vendors: project_id, vendor_id, role(후보/선정/탈락), reason
- quotes: project_id, vendor_id, version int, received_at date, amount bigint, vat_included bool, duration_days int, warranty_months int, payment_terms text, items jsonb(항목별 금액 배열), note
- contracts: project_id, vendor_id, title, signed_at, start_at, end_at, amount bigint, vat bigint, contract_party(조합직접/업무대행사대행), parent_contract_id null(변경계약), change_reason, original_location(원본 보관 위치), is_sealed bool
- payment_schedules: contract_id, seq, label(계약금/중도금/잔금), due_date, amount, paid_at null, settlement_status
- guarantees: contract_id, type(이행/하자/선급금), issuer, amount, starts_at, expires_at
- meetings: project_id, vendor_id null, held_at timestamptz, method(대면/전화/화상/메일), attendees_union text, attendees_vendor text, agenda, notes, decisions
- action_items: meeting_id, content, assignee_user_id, due_date, status event_status
- events: type event_type, title, date, end_date null, project_id null, source_type text null, source_id uuid null, status event_status, memo
- documents: owner_type(vendor/project/quote/contract/meeting), owner_id, kind(사업자등록증/견적서/제안서/계약서/보증증권/회의자료/기타), file_path, file_name, version, valid_until date null
- vendor_reviews: vendor_id, project_id, quality, schedule, communication (1~5), comment
- audit_logs: table_name, row_id, action, before jsonb, after jsonb, user_id, at

[함수·트리거]
- updated_at 자동 갱신 트리거
- audit 트리거: 위 업무 테이블 전부
- public.current_role() returns user_role (security definer)
- 일정 자동 생성 트리거 (insert/update 시 events upsert, source_type+source_id 기준, 소프트삭제 시 events도 삭제 처리):
  · payment_schedules → type 대금지급, date=due_date, 제목 "[업체명] 계약명 – 중도금"
  · guarantees → type 보증만료, date=expires_at - 30일, 제목 "[업체명] 하자보증 만료 30일 전"
  · action_items → type 후속조치, date=due_date
  · contracts → 착수(start_at), 준공(end_at) 두 건
- 지연 처리 함수 mark_overdue_events(): date < 오늘(KST) and status in (예정, 진행) → 지연

[RLS] AGENTS.md 5장 기준
- admin/executive/staff/viewer: 전체 select (단 internal_note 컬럼은 view로 분리: vendors_public, projects_public 뷰를 만들어 agent·viewer는 뷰만 조회)
- agent: project_assignees에 본인이 있는 project 및 그 하위(quotes, contracts, meetings, events, documents)만 select/insert/update
- insert/update: admin, staff, agent(범위 내)
- 영구 delete: admin만

[Storage]
- 비공개 버킷 vendor-files, 경로 규칙 {owner_type}/{owner_id}/{kind}/{timestamp}_{file_name}
- 정책은 documents 테이블 권한과 동일하게

[seed.sql] 현재 조합 실데이터로 작성
- 용역 건/업체:
  · 업무대행 – 뉴해이든 (계약, 2026-10-08 계약 체결)
  · 자금관리 신탁 – KB부동산신탁 (계약)
  · 설계 – 하우드 (진행)
  · 인테리어 – 디자인소마, 비지스튜디오, 스튜디오 레브 (비교검토)
  · 에어컨 – 에어디자이너, 티엔티온시스템 (비교검토)
  · 단지 모형 – 라온모형, 이퀄 (비교검토)
  · 광고대행 – 벨로스아이엔씨 (견적요청, 파트별 분리 발주 예정)
  · CG – 현투시도, 벨로스아이엔씨 (비교검토)
  · 전기 배선, 간판·사인물 – 업체 미정 (견적요청)
- 금액·담당자 연락처는 더미 값으로 넣고 주석에 "더미" 표시

완료 기준: supabase db reset 으로 마이그레이션+시드가 오류 없이 적용, RLS 테스트 SQL(supabase/tests/rls.sql)로 agent가 미배정 프로젝트를 못 보는 것 확인.
```

---

## Phase 2 — 용역사·담당자

```
AGENTS.md 규칙에 따라 용역사·담당자 기능을 구현해줘.

1. /vendors 목록: 검색(상호·대표자·담당자명), 필터(분야, 상태), 표/카드 전환, 상태 Badge 색상 구분
2. 업체 등록·수정 Dialog (zod 검증: 사업자번호 000-00-00000 형식)
3. /vendors/[id] 상세 탭
   - 기본정보 / 담당자(복수, 주 담당 지정, 비활성 처리 시 이력 유지) / 참여 용역 건 / 서류(업로드, 유효기간 만료 30일 전 경고 Badge) / 연락 이력 / 평가
   - 타임라인: 이 업체의 견적·계약·협의·일정을 날짜 역순으로 통합 표시
4. 파일 업로드 공통 컴포넌트 FileUploader (드래그앤드롭, PDF·이미지·엑셀·한글(hwp) 허용, 20MB 제한, 서명 URL 다운로드)
5. 연락 이력 빠른 입력(방법, 일시, 한 줄 요약)

완료 기준: 시드 업체로 등록·수정·담당자 추가·파일 업로드·타임라인 확인 가능.
```

---

## Phase 3 — 용역 건·견적 비교·선정

```
AGENTS.md 규칙에 따라 용역 건과 견적 비교 기능을 구현해줘.

1. /projects 목록: 분야·단계 필터, 예산, 참여 업체 수, 최근 견적일, 조합 담당자
2. /projects/[id] 상세 — 탭: 개요 · 견적비교 · 계약 · 협의 · 일정 · 문서 (계약·협의·일정 탭은 이 단계에선 목록만, 등록은 이후 Phase)
3. 견적 등록: 업체 선택, 버전 자동 증가(v1, v2…), 총액, 부가세 포함 여부, 기간, 하자보증, 지급조건, 항목별 금액(행 추가형 입력 → items jsonb), 견적서 파일 첨부
4. 견적 비교표 (/projects/[id]?tab=quotes 및 /quotes)
   - 업체를 열로, 항목을 행으로: 총액(부가세 포함 환산), 기간, 하자보증, 지급조건, 항목별 금액
   - 각 업체의 최신 버전 기준, 버전 이력 펼쳐보기(금액 변화 표시)
   - 최저 총액·최단 기간 셀 강조
   - 모든 표 셀은 가운데 정렬
5. 선정 처리 Dialog: 선정 업체, 선정 사유, 이사회 회차·일자 입력 → project_vendors 역할 갱신, vendors.status 갱신, projects.stage=선정
6. 엑셀 내보내기: 비교표를 xlsx로 다운로드 (파일명 "견적비교_용역명_YYYYMMDD.xlsx")
7. 인쇄용 비교표 페이지(/projects/[id]/print/quotes): A4 세로, 이사회 보고용 표

완료 기준: 시드의 인테리어(3개사) 건에서 견적 입력 → 비교표 → 선정 → 엑셀 다운로드까지 동작.
```

---

## Phase 4 — 계약·대금·보증

```
AGENTS.md 규칙에 따라 계약 관리 기능을 구현해줘.

1. 계약 등록(용역 건 상세 > 계약 탭 및 /contracts): 선정 업체 기본 선택, 공급가·부가세 자동 합계, 계약 주체(조합직접/업무대행사대행), 원본 보관 위치, 날인 여부, 계약서 파일
2. 대금 지급 회차 편집기: 계약금·중도금·잔금 행 추가, 회차 합계가 계약 총액과 다르면 경고
3. 지급 완료 처리(지급일 입력), 정산 상태 변경(미정산→정산요청→정산완료)
4. 변경계약: 원계약에서 "변경계약 추가" → parent_contract_id 연결, 증감액·사유, 계약 상세에 변경 이력 표시
5. 보증증권 등록(이행/하자/선급금, 만료일)
6. /contracts 목록: 진행 중 / 만료 예정(30일) / 종료 필터, 계약총액·지급액·미지급액·미정산액 합계 표시
7. 저장 시 트리거로 events가 생성되는지 확인하고, 계약 상세에 연결된 일정 목록 표시

완료 기준: 뉴해이든 시드 계약에 회차 3개·하자보증 등록 → 일정 메뉴에 자동 일정 4건 이상 생성.
```

---

## Phase 5 — 협의록·후속조치

```
AGENTS.md 규칙에 따라 협의록 기능을 구현해줘.

1. 협의록 작성 폼 (모바일 우선, 한 화면 입력)
   - 용역 건(필수), 업체(선택), 일시(기본 지금), 방식, 참석자(조합/업체 각각), 안건, 논의 내용, 결정사항
   - 후속조치 행 추가: 내용, 담당자(사용자 선택), 기한 → 저장 시 action_items 생성 → 트리거로 일정 자동 등록
   - 사진·파일 첨부
2. /meetings 목록: 용역 건·업체·기간 필터, 키워드 검색(안건·내용·결정사항, PostgreSQL full text 또는 ilike)
3. /meetings/[id] 상세 + "업체 확인용 요약" 인쇄 페이지(일시, 참석자, 결정사항, 후속조치만)
4. 후속조치 체크(완료 처리) → 연결된 이벤트 상태도 완료
5. 업체 상세 타임라인·용역 건 협의 탭에 반영

완료 기준: 휴대폰 화면 폭에서 협의록 작성 → 후속조치 2건 → 일정 메뉴에 표시 → 완료 체크 동기화.
```

---

## Phase 6 — 일정·알림·대시보드

```
AGENTS.md 규칙에 따라 일정·알림·대시보드를 구현해줘.

1. /schedule
   - FullCalendar 월·주 보기 + 목록 보기(오늘 이후, 지연 우선), 유형별 색상, 용역 건 필터
   - 수동 일정 추가(견적마감, 업체미팅, 이사회상정 등)
   - 이벤트 클릭 → 원천(계약/협의록/견적)으로 이동
   - 완료 체크, ICS 파일 내보내기(/api/ics?project_id=)
2. Edge Function `daily-reminder` (Supabase Cron 매일 08:00 KST)
   - mark_overdue_events() 실행
   - D-7, D-3, D-day 일정과 지연 일정을 조합 담당자·후속조치 담당자에게 Resend 메일 발송 (한국어 HTML 메일, 일정 목록 표 포함)
   - 같은 일정·같은 단계 알림은 1회만 (notification_logs 테이블 추가)
3. /dashboard
   - 카드: 진행 중 용역 건 수, 계약 총액, 미지급액, 미정산액, 이번 주 일정 수, 지연 수
   - 이번 주 일정 목록, 지연 목록(클릭 이동), 분야별 예산 대비 계약액 막대
   - 최근 등록된 견적·협의록 5건
4. 통합 검색(상단 검색창): 업체명, 담당자, 용역 건, 협의록 내용

완료 기준: 시드 기준 대시보드 수치가 계약·지급 데이터와 일치, Edge Function 로컬 실행으로 메일 본문 생성 확인.
```

---

## Phase 7 — 설정·보고서·마무리

```
AGENTS.md 규칙에 따라 마무리 작업을 해줘.

1. /settings (admin): 사용자 초대(이메일), 역할 변경, 비활성화, 용역 건 담당자(project_assignees) 배정
2. 휴지통: 소프트 삭제 항목 조회·복원, admin 영구 삭제
3. 변경 이력 뷰어: 레코드별 audit_logs 표시(누가·언제·무엇을)
4. 보고서: "용역 계약 현황표" 엑셀·인쇄 페이지 (분야, 용역명, 업체, 계약일, 계약금액, 지급액, 잔액, 정산상태, 진행단계) — 총회·이사회 보고용
5. 전체 데이터 백업 내보내기(admin): 모든 테이블 xlsx 시트별 + Storage 파일 목록
6. README.md: 로컬 실행, Supabase 설정, Vercel 배포, Cron 등록, 환경 변수 설명 (한국어)
7. 접근성·반응형 점검, 빈 상태(empty state) 문구, 로딩 스켈레톤, 오류 토스트

완료 기준: 신규 사용자 초대 → agent 역할로 로그인 시 배정된 용역 건만 보이는 것 확인, pnpm build 통과.
```

---

## 2차 고도화 (별도 요청 시)
- dbapt-erp(지출관리)와 계약·지급·정산 데이터 연동
- 카카오 알림톡 / 텔레그램 알림
- 조합 문서 서식(A4, 12pt, 1.5줄)으로 .docx 보고서 생성
- 용역별 간트 차트, 구글 캘린더 양방향 동기화
- 협의 음성 메모 → 텍스트 요약
