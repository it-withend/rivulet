import { Button } from "@/components/ui/Button";
import { supabaseAnon } from "@/lib/db/client";
import { CITIES } from "@/lib/cities";

/**
 * Two honest scales side by side, never blended into one number: what
 * residents have actually done so far (small, real, `is_synthetic = false`
 * only), and what the pilot has ready for them to use (the mapped water
 * network, which is real infrastructure even before anyone has reported).
 * An earlier version mixed a handful of real reports with a flat, unrelated
 * "5 pilot cities" figure — see the 2026-09-16 design review.
 */
export async function CommunityCounters() {
  const db = supabaseAnon();

  const [
    { count: observationCount, error: countError },
    { data: rows },
    { count: waterbodyCount },
  ] = await Promise.all([
    db.from("observations").select("id", { count: "exact", head: true }).eq("is_synthetic", false),
    db.from("observations").select("waterbody_id").eq("is_synthetic", false),
    db.from("waterbodies").select("id", { count: "exact", head: true }),
  ]);

  if (countError || !observationCount) {
    return (
      <section aria-label="Community" className="space-y-3">
        <p className="m-0 max-w-md text-sm text-ink-muted">
          The pilot is just starting — be the first to record a stream in
          your city.
        </p>
        <Button href="/map">Find a stream</Button>
      </section>
    );
  }

  const streamCount = new Set((rows ?? []).map((r) => r.waterbody_id)).size;

  return (
    <section aria-label="Community" className="space-y-4">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="num m-0 text-3xl">{observationCount.toLocaleString("en")}</p>
          <p className="m-0 text-sm text-ink-muted">
            real reports from residents, across {streamCount.toLocaleString("en")}{" "}
            stream{streamCount === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="num m-0 text-3xl">{(waterbodyCount ?? 0).toLocaleString("en")}</p>
          <p className="m-0 text-sm text-ink-muted">
            stream sections mapped and ready to check, across {CITIES.length} cities
          </p>
        </div>
      </div>
      <p className="m-0 text-xs text-ink-muted">
        Most of that map is waiting for a first report — that gap is the point:
        it shows exactly where a resident&rsquo;s five-minute check matters most.
      </p>
    </section>
  );
}
