"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button className="h-11 w-full" disabled={disabled || pending} type="submit">
      {pending ? "로그인 중..." : "로그인"}
    </Button>
  );
}

export function LoginForm({
  configured,
  nextPath,
}: {
  configured: boolean;
  nextPath?: string;
}) {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input name="next" type="hidden" value={nextPath ?? ""} />

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          이메일
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="email"
            className="h-11 pl-9"
            disabled={!configured}
            id="email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">
          비밀번호
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoComplete="current-password"
            className="h-11 pl-9"
            disabled={!configured}
            id="password"
            name="password"
            required
            type="password"
          />
        </div>
      </div>

      {state.message ? (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <SubmitButton disabled={!configured} />
    </form>
  );
}
