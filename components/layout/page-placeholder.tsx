import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function PagePlaceholder({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="border-dashed bg-background/70">
        <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">아직 등록된 내용이 없어</p>
            <p className="mt-1 text-sm text-muted-foreground">다음 개발 단계에서 기능과 데이터를 연결할 예정이야.</p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
