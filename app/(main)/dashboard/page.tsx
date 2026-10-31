import { CalendarDays, ClipboardList, FileSignature, WalletCards } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const summaryCards = [
  { title: "진행 중 용역", value: "-", icon: ClipboardList },
  { title: "계약 총액", value: "-", icon: FileSignature },
  { title: "미지급액", value: "-", icon: WalletCards },
  { title: "이번 주 일정", value: "-", icon: CalendarDays },
] as const;

export default function DashboardPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-muted-foreground">용역 진행 현황과 주요 일정을 확인해.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ icon: Icon, title, value }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
          <p className="font-semibold">업무 데이터 연결 전이야</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Phase 1에서 데이터베이스와 권한 정책을 구성하면 현황이 표시돼.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
