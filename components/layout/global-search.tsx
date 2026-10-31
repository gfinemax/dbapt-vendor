"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

type SearchResult = { id: string; kind: string; title: string; description: string; href: string };

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const requestRef = useRef(0);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setOpen(false); return; }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const body = response.ok ? await response.json() as { results?: SearchResult[] } : {};
        if (requestId === requestRef.current) { setResults(body.results ?? []); setOpen(true); }
      } catch {
        if (requestId === requestRef.current) { setResults([]); setOpen(true); }
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  return <div className="relative hidden w-full max-w-md md:block"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="통합 검색" className="pl-8" placeholder="업체, 담당자, 용역, 협의록 검색" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => { if (results.length) setOpen(true); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} />{open ? <div className="absolute left-0 right-0 top-10 z-50 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">{results.length ? results.map((result) => <Link key={result.id} className="block rounded-lg px-3 py-2 hover:bg-muted" href={result.href} onClick={() => { setOpen(false); setQuery(""); }}><div className="flex items-center gap-2"><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{result.kind}</span><span className="truncate text-sm font-medium">{result.title}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{result.description}</p></Link>) : <p className="px-3 py-6 text-center text-sm text-muted-foreground">검색 결과가 없어.</p>}</div> : null}</div>;
}
