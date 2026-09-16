export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule print:hidden">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm text-ink-muted sm:grid-cols-[1fr_1fr] sm:px-6">
        <div>
          <p className="field-label mb-2">Made for</p>
          <p className="m-0 text-ink">
            The IEEE OneAquaHealth Global Hackathon 2026.
          </p>
        </div>
        <div>
          <p className="field-label mb-2">Sources</p>
          <p className="m-0">
            Indicator codes follow the implementation guide of the OneAquaHealth
            project on urban freshwater ecosystems. Forel–Ule class limits after
            Novoa, Wernand &amp; van der Woerd (2013).
          </p>
        </div>
      </div>
    </footer>
  );
}
