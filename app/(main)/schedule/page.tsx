import { CalendarDays } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function SchedulePage() {
  return <PagePlaceholder description="계약과 후속조치에서 생성된 일정을 확인해." icon={CalendarDays} title="일정" />;
}
