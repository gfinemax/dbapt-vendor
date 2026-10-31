import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type VendorStatus = Database["public"]["Enums"]["vendor_status"];

const statusStyles: Record<VendorStatus, string> = {
  후보: "border-slate-200 bg-slate-100 text-slate-700",
  견적중: "border-blue-200 bg-blue-50 text-blue-700",
  선정: "border-violet-200 bg-violet-50 text-violet-700",
  계약협의: "border-amber-200 bg-amber-50 text-amber-800",
  계약중: "border-emerald-200 bg-emerald-50 text-emerald-700",
  완료: "border-teal-200 bg-teal-50 text-teal-700",
  탈락: "border-zinc-200 bg-zinc-100 text-zinc-500",
  거래중지: "border-red-200 bg-red-50 text-red-700",
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return (
    <Badge className={cn("border", statusStyles[status])} variant="outline">
      {status}
    </Badge>
  );
}
