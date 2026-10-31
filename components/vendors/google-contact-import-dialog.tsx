"use client";

import { Building2, CloudDownload, Mail, Phone, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  importGoogleContact,
  listGoogleContactsForImport,
  type GoogleContactListItem,
} from "@/app/(main)/vendors/google-contacts-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function GoogleContactImportDialog({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<GoogleContactListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredContacts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return contacts;
    return contacts.filter((contact) =>
      [
        contact.name,
        contact.phone,
        contact.email,
        contact.organization,
        contact.title,
        contact.department,
      ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(keyword)),
    );
  }, [contacts, query]);

  function loadContacts() {
    startTransition(async () => {
      const result = await listGoogleContactsForImport();
      setLoaded(true);
      if (!result.ok) {
        setContacts([]);
        toast.error(result.message);
        return;
      }
      setContacts(result.contacts);
      toast.success(result.message);
    });
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !loaded && !pending) loadContacts();
  }

  function importContact(contact: GoogleContactListItem) {
    setImporting(contact.resourceName);
    startTransition(async () => {
      const result = await importGoogleContact({
        vendorId,
        resourceName: contact.resourceName,
      });
      setImporting(null);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setContacts((current) =>
        current.map((item) =>
          item.resourceName === contact.resourceName ? { ...item, imported: true } : item,
        ),
      );
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><CloudDownload />Google 연락처 불러오기</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CloudDownload className="size-5" />Google 연락처 불러오기</DialogTitle>
          <DialogDescription>Google 연락처를 조회해서 이 업체의 담당자로 가져와. Google 연락처는 수정하거나 삭제하지 않아.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="이름·전화번호·이메일·회사명 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{loaded ? `전체 ${contacts.length}건 · 표시 ${filteredContacts.length}건` : "Google 연락처를 확인하는 중이야."}</span>
          <Button disabled={pending} size="sm" variant="ghost" onClick={loadContacts}>
            <RefreshCw className={pending && !importing ? "animate-spin" : ""} />새로고침
          </Button>
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {pending && !loaded ? (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />불러오는 중...</div>
          ) : filteredContacts.length ? filteredContacts.map((contact) => (
            <div key={contact.resourceName} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{contact.name || contact.organization || "이름 미등록"}</p>
                  {contact.imported ? <Badge variant="secondary">등록됨</Badge> : null}
                </div>
                {contact.organization || contact.title ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="size-3.5 shrink-0" />{[contact.organization, contact.title].filter(Boolean).join(" · ")}</p> : null}
                {contact.phone ? <p className="flex items-center gap-2 text-sm"><Phone className="size-3.5 shrink-0 text-muted-foreground" />{contact.phone}</p> : null}
                {contact.email ? <p className="flex items-center gap-2 break-all text-sm"><Mail className="size-3.5 shrink-0 text-muted-foreground" />{contact.email}</p> : null}
              </div>
              <Button
                className="shrink-0"
                disabled={contact.imported || pending}
                size="sm"
                onClick={() => importContact(contact)}
              >
                {importing === contact.resourceName ? <RefreshCw className="animate-spin" /> : <CloudDownload />}
                {contact.imported ? "등록됨" : importing === contact.resourceName ? "가져오는 중..." : "가져오기"}
              </Button>
            </div>
          )) : loaded ? (
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground">조건에 맞는 Google 연락처가 없어.</div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
