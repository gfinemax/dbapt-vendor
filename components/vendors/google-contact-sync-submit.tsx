"use client";

import { RefreshCw } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function GoogleContactSyncSubmit({ synced }: { synced: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="sm" type="submit" variant="outline">
      <RefreshCw className={pending ? "animate-spin" : ""} />
      {pending ? "Google 동기화 중..." : synced ? "다시 동기화" : "Google 연락처 동기화"}
    </Button>
  );
}
