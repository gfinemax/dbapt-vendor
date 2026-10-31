"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Award } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { selectProjectVendor } from "@/app/(main)/projects/actions";
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
import { selectionSchema, type SelectionInput } from "@/lib/validators/quote";

export function SelectionDialog({
  projectId,
  vendors,
}: {
  projectId: string;
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<SelectionInput>({
    resolver: zodResolver(selectionSchema),
    defaultValues: {
      project_id: projectId,
      vendor_id: vendors[0]?.id ?? "",
      selection_reason: "",
      board_resolution: "",
    },
  });

  function onSubmit(values: SelectionInput) {
    startTransition(async () => {
      const result = await selectProjectVendor(values);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!vendors.length} variant="outline">
          <Award />
          선정 승인요청
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>업체 선정 승인요청</DialogTitle>
          <DialogDescription>
            선정안과 이사회 의결 근거를 등록하면 임원·관리자가 승인 또는 반려해.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <input type="hidden" {...form.register("project_id")} />
            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>선정 업체 *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
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
              name="selection_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>선정 사유 *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="가격·품질·수행역량 등" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="board_resolution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이사회 회차·일자 *</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 제12차 이사회 · 2026.11.05." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button disabled={pending} type="submit">
                {pending ? "요청 중..." : "승인요청"}
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
