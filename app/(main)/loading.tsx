export default function MainLoading() {
  return <div aria-busy="true" aria-label="화면 불러오는 중" className="animate-pulse space-y-6"><div className="space-y-2"><div className="h-8 w-48 rounded bg-muted" /><div className="h-4 w-80 max-w-full rounded bg-muted" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-xl bg-muted" />)}</div><div className="h-96 rounded-xl bg-muted" /><span className="sr-only">불러오는 중...</span></div>;
}
