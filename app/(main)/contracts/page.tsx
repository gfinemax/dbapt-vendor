import { FileSignature } from "lucide-react";

import { ContractDirectory, type ContractListRow } from "@/components/contracts/contract-directory";
import { ContractFormDialog } from "@/components/contracts/contract-form-dialog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function kstDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(Date.now() + offsetDays * 86400000));
}

export default async function ContractsPage() {
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("current_role");
  const safeView = role === "agent" || role === "viewer";
  const [contractsResult, paymentsResult, projectsResult, linksResult] = await Promise.all([
    supabase.from("contracts").select("*").is("deleted_at", null).order("signed_at", { ascending: false }),
    supabase.from("payment_schedules").select("*").is("deleted_at", null),
    safeView ? supabase.from("projects_public").select("id,title,selected_vendor_id") : supabase.from("projects").select("id,title,selected_vendor_id").is("deleted_at", null),
    supabase.from("project_vendors").select("project_id,vendor_id").is("deleted_at", null),
  ]);
  const contracts = contractsResult.data ?? [];
  const projects = (projectsResult.data ?? []).flatMap((project) => project.id && project.title ? [{ id: project.id, title: project.title, selectedVendorId: project.selected_vendor_id }] : []);
  const projectIds = new Set(projects.map((project) => project.id));
  const vendorIds = [...new Set([...(linksResult.data ?? []).filter((link) => projectIds.has(link.project_id)).map((link) => link.vendor_id), ...contracts.map((contract) => contract.vendor_id)])];
  const vendorQuery = safeView
    ? supabase.from("vendors_public").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"])
    : supabase.from("vendors").select("id,name").in("id", vendorIds.length ? vendorIds : ["00000000-0000-0000-0000-000000000000"]).is("deleted_at", null);
  const { data: vendors } = await vendorQuery;
  const vendorMap = new Map((vendors ?? []).flatMap((vendor) => vendor.id && vendor.name ? [[vendor.id, vendor.name]] : []));
  const projectMap = new Map(projects.map((project) => [project.id, project.title]));
  const rootByContract = new Map(contracts.map((contract) => [contract.id, contract.parent_contract_id ?? contract.id]));
  const familyByRoot = new Map<string, typeof contracts>();
  for (const contract of contracts) { const rootId = rootByContract.get(contract.id) ?? contract.id; familyByRoot.set(rootId, [...(familyByRoot.get(rootId) ?? []), contract]); }
  const paymentsByRoot = new Map<string, NonNullable<typeof paymentsResult.data>>();
  for (const payment of paymentsResult.data ?? []) { const rootId = rootByContract.get(payment.contract_id) ?? payment.contract_id; paymentsByRoot.set(rootId, [...(paymentsByRoot.get(rootId) ?? []), payment]); }
  const rows: ContractListRow[] = contracts.filter((contract) => !contract.parent_contract_id).map((contract) => {
    const family = familyByRoot.get(contract.id) ?? [contract];
    const payments = paymentsByRoot.get(contract.id) ?? [];
    const total = family.reduce((sum, item) => sum + item.amount + item.vat, 0);
    const paid = payments.filter((payment) => payment.paid_at).reduce((sum, payment) => sum + payment.amount, 0);
    const unsettled = payments.filter((payment) => payment.paid_at && payment.settlement_status !== "정산완료").reduce((sum, payment) => sum + payment.amount, 0);
    return { id: contract.id, title: contract.title, projectTitle: projectMap.get(contract.project_id) ?? "용역 건", vendorName: vendorMap.get(contract.vendor_id) ?? "업체", signedAt: contract.signed_at, endAt: contract.end_at, total, paid, unpaid: Math.max(total - paid, 0), unsettled, changeCount: family.length - 1 };
  });
  const projectOptions = projects.map((project) => ({ ...project, vendors: (linksResult.data ?? []).filter((link) => link.project_id === project.id).flatMap((link) => { const name = vendorMap.get(link.vendor_id); return name ? [{ id: link.vendor_id, name }] : []; }) })).filter((project) => project.vendors.length);
  const canManage = role === "admin" || role === "staff" || role === "agent";

  return <section className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><FileSignature className="size-6" /><h1 className="text-2xl font-bold tracking-tight">계약</h1></div><p className="mt-1 text-sm text-muted-foreground">계약 금액, 지급·정산, 보증과 만료 일정을 한곳에서 관리해.</p></div>{canManage ? <ContractFormDialog projects={projectOptions} /> : null}</div><ContractDirectory in30Days={kstDate(30)} rows={rows} today={kstDate()} /></section>;
}
