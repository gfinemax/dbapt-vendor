"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createContract, createContractDocument } from "@/app/(main)/contracts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { safeDocumentFileName } from "@/lib/documents";
import { formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { contractSchema, type ContractInput } from "@/lib/validators/contract";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

type ProjectOption = {
  id: string;
  title: string;
  selectedVendorId: string | null;
  vendors: { id: string; name: string }[];
};
type ParentContract = {
  id: string;
  projectId: string;
  projectTitle: string;
  vendorId: string;
  vendorName: string;
  title: string;
  signedAt: string;
  startAt: string;
  endAt: string;
  amount: number;
  vat: number;
  contractParty: "조합직접" | "업무대행사대행";
  originalLocation: string | null;
};

function todayKst() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}
export function ContractFormDialog({
  projects,
  fixedProjectId,
  parent,
  draftOnly = false,
}: {
  projects: ProjectOption[];
  fixedProjectId?: string;
  parent?: ParentContract;
  draftOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [autoVat, setAutoVat] = useState(!parent);
  const initialProject =
    projects.find((project) => project.id === (parent?.projectId ?? fixedProjectId)) ?? projects[0];
  const initialVendor =
    parent?.vendorId ?? initialProject?.selectedVendorId ?? initialProject?.vendors[0]?.id ?? "";
  const form = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      project_id: parent?.projectId ?? initialProject?.id ?? "",
      vendor_id: initialVendor,
      title: parent ? `${parent.title} 변경계약` : "",
      signed_at: todayKst(),
      start_at: parent?.startAt ?? todayKst(),
      end_at: parent?.endAt ?? todayKst(),
      amount: parent?.amount ?? 0,
      vat: parent?.vat ?? 0,
      contract_party: parent?.contractParty ?? "조합직접",
      original_location: parent?.originalLocation ?? "",
      is_sealed: false,
      parent_contract_id: parent?.id ?? null,
      change_reason: "",
      payments: parent ? [] : [{ label: "계약금", due_date: todayKst(), amount: 0 }],
    },
  });
  const payments = useFieldArray({ control: form.control, name: "payments" });
  const projectId = useWatch({ control: form.control, name: "project_id" });
  const amount = useWatch({ control: form.control, name: "amount" }) ?? 0;
  const vat = useWatch({ control: form.control, name: "vat" }) ?? 0;
  const paymentValues = useWatch({ control: form.control, name: "payments" }) ?? [];
  const selectedProject = projects.find((project) => project.id === projectId) ?? initialProject;
  const total = amount + vat;
  const paymentTotal = paymentValues.reduce(
    (sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0),
    0,
  );

  async function uploadContractFile(contractId: string, selectedFile: File) {
    if (selectedFile.size > MAX_FILE_SIZE) throw new Error("파일 크기는 20MB 이하여야 해.");
    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "png", "jpg", "jpeg", "hwp"].includes(extension))
      throw new Error("PDF·이미지·한글(hwp) 파일만 첨부할 수 있어.");
    const supabase = createClient();
    const path = `contract/${contractId}/contract/${Date.now()}_${crypto.randomUUID()}_${safeDocumentFileName(selectedFile.name)}`;
    const { error } = await supabase.storage
      .from("vendor-files")
      .upload(path, selectedFile, { upsert: false, contentType: selectedFile.type || undefined });
    if (error) throw new Error(`계약서 업로드 실패: ${error.message}`);
    const result = await createContractDocument({
      contract_id: contractId,
      project_id: projectId,
      kind: "계약서",
      file_path: path,
      file_name: selectedFile.name,
      mime_type: selectedFile.type,
      file_size: selectedFile.size,
    });
    if (!result.ok) {
      await supabase.storage.from("vendor-files").remove([path]);
      throw new Error(result.message);
    }
    if (result.id) await fetch(`/api/documents/${result.id}/analyze`, { method: "POST" });
  }

  function onSubmit(values: ContractInput) {
    startTransition(async () => {
      const result = await createContract(values);
      if (!result.ok || !result.id) {
        toast.error(result.message);
        return;
      }
      try {
        if (file) await uploadContractFile(result.id, file);
        toast.success(file ? `${result.message} 계약서도 첨부했어.` : result.message);
      } catch (error) {
        toast.warning(
          `${result.message} ${error instanceof Error ? error.message : "파일 첨부는 실패했어."}`,
        );
      }
      setOpen(false);
      setFile(null);
      router.push(`/contracts/${result.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!projects.length}>
          {parent ? <FilePlus2 /> : <Plus />}
          {parent ? "변경계약 추가" : "계약 등록"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {draftOnly
              ? parent
                ? "변경계약 초안"
                : "계약 초안"
              : parent
                ? "변경계약 승인요청"
                : "계약 승인요청"}
          </DialogTitle>
          <DialogDescription>
            {parent
              ? `${parent.projectTitle} · ${parent.vendorName} 계약의 변경 후 최종 금액과 사유를 기록해.`
              : draftOnly
                ? "계약 정보와 지급 회차 초안을 작성하면 사무국이 검토 후 승인요청해."
                : "계약 정보와 지급 회차를 등록하고 임원 승인을 요청해."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>용역 건 *</FormLabel>
                    <Select
                      disabled={Boolean(parent || fixedProjectId)}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const project = projects.find((item) => item.id === value);
                        form.setValue(
                          "vendor_id",
                          project?.selectedVendorId ?? project?.vendors[0]?.id ?? "",
                          { shouldValidate: true },
                        );
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="용역 건 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>계약 업체 *</FormLabel>
                    <Select
                      disabled={Boolean(parent)}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="업체 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedProject?.vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.name}
                            {selectedProject.selectedVendorId === vendor.id ? " · 선정" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signed_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>계약일 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>계약명 *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contract_party"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>계약 주체 *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="조합직접">조합직접</SelectItem>
                        <SelectItem value="업무대행사대행">업무대행사대행</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작일 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료일 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="original_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>원본 보관 위치</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 조합 사무실 계약서함" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{parent ? "변경 후 공급가 *" : "공급가 *"}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        min={0}
                        type="number"
                        value={field.value}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          field.onChange(next);
                          if (autoVat)
                            form.setValue("vat", Math.round(next * 0.1), { shouldValidate: true });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{parent ? "변경 후 부가세 *" : "부가세 *"}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        min={0}
                        type="number"
                        value={field.value}
                        onChange={(event) => {
                          setAutoVat(false);
                          field.onChange(Number(event.target.value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>{parent ? "변경 후 계약총액" : "계약 총액"}</FormLabel>
                <div className="flex h-8 items-center rounded-lg bg-muted px-3 font-bold">
                  {formatWon(total)}
                </div>
              </FormItem>
            </div>
            {!parent ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={autoVat}
                  className="size-4"
                  type="checkbox"
                  onChange={(event) => {
                    setAutoVat(event.target.checked);
                    if (event.target.checked) form.setValue("vat", Math.round(amount * 0.1));
                  }}
                />
                공급가 입력 시 부가세 10% 자동 계산
              </label>
            ) : null}
            <FormField
              control={form.control}
              name="is_sealed"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      checked={field.value}
                      className="size-4"
                      type="checkbox"
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">날인 완료</FormLabel>
                </FormItem>
              )}
            />
            {parent ? (
              <FormField
                control={form.control}
                name="change_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>변경 사유 *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="변경 범위와 사유를 구체적으로 입력해 줘." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            {!parent ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <FormLabel>대금 지급 회차</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      합계 {formatWon(paymentTotal)} / 계약 총액 {formatWon(total)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      payments.append({ label: "중도금", due_date: todayKst(), amount: 0 })
                    }
                  >
                    <Plus />
                    회차 추가
                  </Button>
                </div>
                {paymentValues.length && paymentTotal !== total ? (
                  <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                    지급 회차 합계가 계약 총액과 {formatWon(Math.abs(total - paymentTotal))} 차이
                    나. 저장은 가능하지만 확인해 줘.
                  </p>
                ) : null}
                {payments.fields.map((payment, index) => (
                  <div
                    key={payment.id}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_160px_180px_auto]"
                  >
                    <Input
                      aria-label={`지급 ${index + 1} 회차명`}
                      {...form.register(`payments.${index}.label`)}
                    />
                    <Input
                      aria-label={`지급 ${index + 1} 예정일`}
                      type="date"
                      {...form.register(`payments.${index}.due_date`)}
                    />
                    <Input
                      aria-label={`지급 ${index + 1} 금액`}
                      type="number"
                      {...form.register(`payments.${index}.amount`, { valueAsNumber: true })}
                    />
                    <Button
                      aria-label="지급 회차 삭제"
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => payments.remove(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="grid gap-2 text-sm font-medium">
              계약서 첨부{" "}
              <span className="font-normal text-muted-foreground">
                선택 · PDF·이미지·hwp, 최대 20MB
              </span>
              <Input
                accept=".pdf,.png,.jpg,.jpeg,.hwp"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <DialogFooter>
              <Button disabled={pending} type="submit">
                {pending ? "저장 중..." : draftOnly ? "초안 저장" : "승인요청"}
              </Button>
              <Button
                disabled={pending}
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
