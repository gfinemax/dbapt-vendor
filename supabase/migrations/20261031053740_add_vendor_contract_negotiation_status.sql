alter type public.vendor_status add value if not exists '계약협의' after '선정';

comment on type public.vendor_status is
  '업체 진행 상태: 후보 → 견적중 → 선정 → 계약협의 → 계약중 → 완료. 탈락·거래중지는 예외 상태.';
