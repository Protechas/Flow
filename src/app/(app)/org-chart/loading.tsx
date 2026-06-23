export default function OrgChartLoading() {
  return (
    <div className="flow-org-chart p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted/40" />
      <div className="h-10 w-full max-w-2xl rounded bg-muted/30" />
      <div className="space-y-3 pt-4">
        <div className="h-24 rounded-xl bg-muted/25" />
        <div className="h-24 rounded-xl bg-muted/20 ml-8" />
        <div className="h-24 rounded-xl bg-muted/20 ml-16" />
        <div className="h-24 rounded-xl bg-muted/25 ml-8" />
        <div className="h-24 rounded-xl bg-muted/20 ml-16" />
      </div>
    </div>
  );
}
