"use client";

import { Link2, Link2Off } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { disconnectGoogleContacts } from "@/app/(main)/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

type GoogleConnection = {
  account_email: string;
  connected_at: string;
  last_verified_at: string | null;
};

const statusMessages: Record<string, { ok: boolean; message: string }> = {
  connected: { ok: true, message: "Google 연락처 연결을 완료했어." },
  denied: { ok: false, message: "Google 계정 연결이 취소됐어." },
  forbidden: { ok: false, message: "관리자 권한이 필요해." },
  "invalid-state": { ok: false, message: "연결 요청이 만료됐어. 다시 시도해 줘." },
  "missing-config": { ok: false, message: "서버의 Google OAuth 설정을 먼저 완료해 줘." },
  "missing-refresh-token": { ok: false, message: "Google 갱신 토큰을 받지 못했어. 다시 연결해 줘." },
  "connection-failed": { ok: false, message: "Google 계정 연결을 저장하지 못했어." },
};

export function GoogleContactsSettings({
  configured,
  missingConfig,
  connection,
  status,
}: {
  configured: boolean;
  missingConfig: string[];
  connection: GoogleConnection | null;
  status?: string;
}) {
  const [pending, startTransition] = useTransition();
  const statusMessage = status ? statusMessages[status] : undefined;

  function disconnect() {
    startTransition(async () => {
      const result = await disconnectGoogleContacts();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      if (result.ok) window.location.assign("/settings");
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Link2 className="size-5" />Google 연락처</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">공용 Google 계정의 연락처를 조회해서 필요한 사람만 DB-Vendor 담당자로 가져와.</p>
          </div>
          <Badge variant={connection ? "default" : "secondary"}>{connection ? "연결됨" : "연결 안 됨"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusMessage ? <p className={statusMessage.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{statusMessage.message}</p> : null}
        {connection ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p><span className="text-muted-foreground">연결 계정</span> · {connection.account_email}</p>
            <p className="mt-1 text-muted-foreground">연결 {formatDateTime(connection.connected_at)}{connection.last_verified_at ? ` · 마지막 확인 ${formatDateTime(connection.last_verified_at)}` : ""}</p>
          </div>
        ) : null}
        {!configured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">서버 환경 변수 설정이 필요해.</p>
            <p className="mt-1 break-all">{missingConfig.join(", ")}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild={configured} disabled={!configured || pending}>
            {configured ? <a href="/api/integrations/google-contacts/connect">{connection ? "다시 연결" : "Google 계정 연결"}</a> : <span>Google 계정 연결</span>}
          </Button>
          {connection ? <Button disabled={pending} variant="outline" onClick={disconnect}><Link2Off />연결 해제</Button> : null}
        </div>
        <p className="text-xs text-muted-foreground">연동은 Google → DB-Vendor 읽기 전용이야. DB-Vendor는 Google 연락처를 생성·수정·삭제하지 않아.</p>
      </CardContent>
    </Card>
  );
}
