import { Button } from "@/components/ui/Button";
import { supabaseAnon } from "@/lib/db/client";

export async function CommunityCounters() {
  const db = supabaseAnon();

  const [{ count: observationCount, error: countError }, { data: rows }] =
    await Promise.all([
      db
        .from("observations")
        .select("id", { count: "exact", head: true })
        .eq("is_synthetic", false),
      db.from("observations").select("waterbody_id").eq("is_synthetic", false),
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

  const stats = [
    { value: observationCount, label: "observations recorded" },
    { value: streamCount, label: "streams with citizen data" },
    { value: 5, label: "OneAquaHealth pilot cities" },
  ];

  return (
    <section aria-label="Community" className="grid gap-6 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="num m-0 text-3xl">{stat.value.toLocaleString("en")}</p>
          <p className="m-0 text-sm text-ink-muted">{stat.label}</p>
        </div>
      ))}
    </section>
  );
}
