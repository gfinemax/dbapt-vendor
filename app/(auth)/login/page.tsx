import { Building2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; setup?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured = Boolean(getSupabasePublicConfig());

  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Building2 aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">대방동지역주택조합</p>
            <h1 className="text-2xl font-bold tracking-tight">용역사 관리 시스템</h1>
          </div>
        </div>

        <Card className="shadow-lg shadow-slate-200/70">
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>등록된 업무용 계정으로 로그인해 주세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured || params.setup === "required" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                Supabase 연결 정보가 없어 로그인을 사용할 수 없어. <code>.env.example</code>을
                참고해 <code>.env.local</code>을 설정해 줘.
              </div>
            ) : null}
            <LoginForm configured={configured} nextPath={params.next} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          인가된 사용자만 이용할 수 있는 내부 업무 시스템입니다.
        </p>
      </div>
    </main>
  );
}
