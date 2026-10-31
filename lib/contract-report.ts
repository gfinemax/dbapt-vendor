import { createClient } from "@/lib/supabase/server";

export type ContractReportRow = {
  id: string;
  category: string;
  projectTitle: string;
  vendorName: string;
  signedAt: string;
  total: number;
  paid: number;
  balance: number;
  settlementStatus: string;
  stage: string;
};

export async function getContractReportRows() {
  const supabase = await createClient();
  const [contractsResult, paymentsResult, projectsResult, vendorsResult] = await Promise.all([
    supabase.from("contracts").select("*").is("deleted_at", null).order("signed_at"),
    supabase.from("payment_schedules").select("*").is("deleted_at", null),
    supabase.from("projects").select("id,title,category,stage").is("deleted_at", null),
    supabase.from("vendors").select("id,name").is("deleted_at", null),
  ]);
  const allContracts = contractsResult.data ?? [];
  const contracts = allContracts.filter(
    (contract) => !contract.parent_contract_id && contract.approval_status === "approved",
  );
  const payments = paymentsResult.data ?? [];
  const rootByContract = new Map(
    allContracts.map((contract) => [contract.id, contract.parent_contract_id ?? contract.id]),
  );
  const projectMap = new Map((projectsResult.data ?? []).map((project) => [project.id, project]));
  const vendorMap = new Map((vendorsResult.data ?? []).map((vendor) => [vendor.id, vendor.name]));
  return contracts.map((root): ContractReportRow => {
    const contractPayments = payments.filter(
      (payment) => (rootByContract.get(payment.contract_id) ?? payment.contract_id) === root.id,
    );
    const total = root.amount + root.vat;
    const paid = contractPayments
      .filter((payment) => payment.paid_at)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const settlementStatus =
      contractPayments.length &&
      contractPayments.every((payment) => payment.settlement_status === "정산완료")
        ? "정산완료"
        : contractPayments.some((payment) => payment.settlement_status === "정산요청")
          ? "정산요청"
          : "미정산";
    const project = projectMap.get(root.project_id);
    return {
      id: root.id,
      category: project?.category ?? "기타",
      projectTitle: project?.title ?? "용역",
      vendorName: vendorMap.get(root.vendor_id) ?? "업체",
      signedAt: root.signed_at,
      total,
      paid,
      balance: Math.max(total - paid, 0),
      settlementStatus,
      stage: project?.stage ?? "-",
    };
  });
}
