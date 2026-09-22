/**
 * A quiet placeholder shown at once while a page's data loads, so a press
 * never feels ignored. Uses a real `<h1>` for the label — a slow response
 * (a cold serverless function, a scanner) should never leave the page
 * without its one top-level heading.
 */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6" role="status" aria-live="polite">
      <h1 className="field-label m-0">{label}</h1>
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-sm bg-rule" />
      <div className="h-4 w-full max-w-2xl animate-pulse rounded-sm bg-rule/70" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-md border border-rule bg-paper-raised" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-md border border-rule bg-paper-raised" />
    </div>
  );
}
