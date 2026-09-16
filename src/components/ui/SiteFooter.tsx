import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule print:hidden">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm text-ink-muted sm:grid-cols-[1fr_1fr] sm:px-6">
        <div>
          <p className="field-label mb-2">Made for</p>
          <p className="m-0 text-ink">
            The IEEE OneAquaHealth Global Hackathon 2026.
          </p>
          <p className="field-label mt-5 mb-2">For researchers</p>
          <p className="m-0">
            <Link href="/open-data" className="text-ink underline underline-offset-2 hover:text-river">
              Open data and FHIR export
            </Link>
            {" · "}
            <a
              href="https://github.com/it-withend/rivulet"
              className="text-ink underline underline-offset-2 hover:text-river"
            >
              Source code
            </a>
            {" · "}
            <Link href="/moderate" className="text-ink underline underline-offset-2 hover:text-river">
              Moderator
            </Link>
          </p>
        </div>
        <div>
          <p className="field-label mb-2">Sources</p>
          <p className="m-0">
            FHIR resources declare profiles from the OneAquaHealth
            implementation guide; signs residents report use a separate Rivulet
            code system. Forel–Ule class limits after Novoa, Wernand &amp; van
            der Woerd (2013).
          </p>
        </div>
      </div>
    </footer>
  );
}
