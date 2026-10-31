"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function MainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { toast.error("화면을 불러오는 중 오류가 발생했어."); }, []);
  return <Card className="mx-auto max-w-xl border-destructive/40"><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><AlertTriangle className="mb-3 size-10 text-destructive" /><h1 className="text-xl font-bold">화면을 불러오지 못했어</h1><p className="mt-2 text-sm text-muted-foreground">잠시 후 다시 시도해 줘.{error.digest ? ` 오류 번호: ${error.digest}` : ""}</p><Button className="mt-5" onClick={reset}><RotateCcw />다시 시도</Button></CardContent></Card>;
}
