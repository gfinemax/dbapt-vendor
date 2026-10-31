import { BadgeCheck, Clock3 } from "lucide-react";
import Link from "next/link";

import { ApprovalDecisionControls } from "@/components/approvals/approval-decision-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatWon } from "@/lib/format";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function objectSnapshot(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function numberValue(value: Json | undefined) {
  return typeof value === "number" ? value : 0;
}

function statusLabel(status: string) {
  if (status === "approved") return "승인";
  if (status === "rejected") return "반려";
  if (status === "cancelled") return "취소";
  return "승인대기";
}

function targetLabel(target: string) {
  if (target === "vendor_selection") return "업체선정";
  if (target === "contract_amendment") return "변경계약";
  return "원계약";
}

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const [{ data: role }, { data: authData }] = await Promise.all([
    supabase.rpc("current_role"),
    supabase.auth.getUser(),
  ]);
  const { data: requests } = await supabase
    .from("approval_requests")
    .select("*")
    .is("deleted_at", null)
    .order("requested_at", { ascending: false });
  const requesterIds = [...new Set((requests ?? []).map((item) => item.requested_by))];
  const { data: users } = await supabase
    .from("users")
    .select("id,name")
    .in("id", requesterIds.length ? requesterIds : ["00000000-0000-0000-0000-000000000000"]);
  const userMap = new Map((users ?? []).map((user) => [user.id, user.name]));
  const canDecide = role === "admin" || role === "executive";
  const currentUserId = authData.user?.id;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-6" />
          <h1 className="text-2xl font-bold tracking-tight">승인함</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          업체선정과 계약 승인 근거를 확인하고 결정 이력을 남겨.
        </p>
      </div>
      <div className="space-y-3">
        {requests?.length ? (
          requests.map((request) => {
            const snapshot = objectSnapshot(request.snapshot);
            const total = numberValue(snapshot.amount) + numberValue(snapshot.vat);
            const finalTotal = numberValue(snapshot.final_amount) + numberValue(snapshot.final_vat);
            const href =
              request.target_type === "vendor_selection"
                ? `/projects/${request.project_id}?tab=quotes`
                : request.target_type === "contract"
                  ? `/contracts/${request.target_id}`
                  : typeof snapshot.contract_id === "string"
                    ? `/contracts/${snapshot.contract_id}`
                    : `/projects/${request.project_id}`;
            const selfRequested = request.requested_by === currentUserId;
            return (
              <Card key={request.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{targetLabel(request.target_type)}</Badge>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "default"
                            : request.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {statusLabel(request.status)}
                      </Badge>
                    </div>
                    <CardTitle className="mt-3">
                      <Link className="hover:underline" href={href}>
                        {request.title}
                      </Link>
                    </CardTitle>
                  </div>
                  {canDecide &&
                  request.status === "requested" &&
                  (!selfRequested || role === "admin") ? (
                    <ApprovalDecisionControls approvalId={request.id} />
                  ) : null}
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">요청자</p>
                    <p className="mt-1 font-medium">
                      {userMap.get(request.requested_by) ?? "사용자"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">요청 시각</p>
                    <p className="mt-1 font-medium">{formatDateTime(request.requested_at)}</p>
                  </div>
                  {total > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">계약총액</p>
                      <p className="mt-1 font-bold">{formatWon(total)}</p>
                    </div>
                  ) : null}
                  {finalTotal > 0 ? (
                    <div>
                      <p className="text-xs text-muted-foreground">변경 후 계약총액</p>
                      <p className="mt-1 font-bold">{formatWon(finalTotal)}</p>
                    </div>
                  ) : null}
                  {request.decision_reason ? (
                    <div className="sm:col-span-2 lg:col-span-4">
                      <p className="text-xs text-muted-foreground">결정 사유</p>
                      <p className="mt-1 rounded-lg bg-muted p-3">{request.decision_reason}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
              <Clock3 className="mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">확인할 승인 요청이 없어.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
