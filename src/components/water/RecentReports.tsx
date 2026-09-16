import { AlertTriangle, CheckCircle2, Droplets, Waves, Wind } from "lucide-react";
import { FU_TABLE } from "@/lib/science/forel-ule-table";
import { CLARITIES, FLOWS, ODOURS, labelFor, signsSeen } from "@/components/wizard/survey-options";
import type { SurveyAnswers } from "@/types/observation";

export type ReportRow = {
  id: string;
  observedAt: string;
  observerName: string | null;
  isSynthetic: boolean;
  survey: SurveyAnswers;
};

function when(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** What neighbours actually reported, newest first, in the words they chose. */
export function RecentReports({ reports, now = new Date() }: { reports: ReportRow[]; now?: Date }) {
  if (reports.length === 0) {
    return (
      <p className="m-0 text-sm text-ink-muted">
        No reports yet. The first one makes the biggest difference.
      </p>
    );
  }

  return (
    <ol className="m-0 list-none divide-y divide-rule p-0">
      {reports.map((r) => {
        const colour = r.survey.forelUle ? FU_TABLE.find((e) => e.index === r.survey.forelUle) : null;
        const warnings = [
          ...(r.survey.odour === "sewage" || r.survey.odour === "chemical" ? [labelFor(ODOURS, r.survey.odour)] : []),
          ...signsSeen(r.survey),
          ...(r.survey.litter >= 2 ? ["A lot of litter"] : []),
        ];
        return (
          <li key={r.id} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              title={colour ? `Water colour: ${colour.description}` : "No photo"}
              className={"mt-0.5 size-8 shrink-0 rounded-full border border-rule " + (colour ? "" : "hatch-insufficient")}
              style={colour ? { backgroundColor: colour.srgb } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm">
                <strong className="font-medium">{when(r.observedAt, now)}</strong>
                <span className="text-ink-muted">
                  {" · "}
                  {r.observerName ?? "Anonymous"}
                  {r.isSynthetic && " · demo data"}
                </span>
              </p>
              <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-ink-muted">
                <li className="flex items-center gap-1">
                  <Droplets aria-hidden="true" className="size-3.5" />
                  {labelFor(CLARITIES, r.survey.clarity)}
                </li>
                <li className="flex items-center gap-1">
                  <Waves aria-hidden="true" className="size-3.5" />
                  {labelFor(FLOWS, r.survey.flow)}
                </li>
                {r.survey.odour === "none" || r.survey.odour === "musty" ? (
                  <li className="flex items-center gap-1">
                    <Wind aria-hidden="true" className="size-3.5" />
                    {labelFor(ODOURS, r.survey.odour)}
                  </li>
                ) : null}
              </ul>
              <p className="m-0 mt-1 flex items-start gap-1 text-sm">
                {warnings.length > 0 ? (
                  <>
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#b0561d]" />
                    {warnings.join(", ")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-river" />
                    No warning signs
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
