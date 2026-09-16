import { notFound } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { supabaseAnon } from "@/lib/db/client";
import { verifyCredential } from "@/lib/credentials/jwt";
import { Button } from "@/components/ui/Button";

const TIER_LABEL: Record<string, string> = {
  contributor: "Contributor",
  data_steward: "Data Steward",
};

type CredentialShape = {
  name?: string;
  validFrom?: string;
  credentialSubject?: {
    name?: string;
    achievement?: { name?: string; description?: string };
  };
  evidence?: { description?: string }[];
};

/** A stand-in for a hand signature and a wax seal: pure CSS/SVG, no image assets. */
function Seal({ tier }: { tier: string }) {
  return (
    <div className="relative mx-auto flex size-32 shrink-0 items-center justify-center rounded-full border border-paper/70 text-paper sm:size-36">
      <div className="absolute inset-2 rounded-full border border-paper/40" />
      <div className="text-center">
        <p className="font-display m-0 text-lg italic leading-tight sm:text-xl">Rivulet</p>
        <p className="field-label m-0 mt-1 text-paper/70">Citizen science</p>
        <p className="field-label m-0 mt-2 text-[0.65rem] text-paper/50">{tier}</p>
      </div>
    </div>
  );
}

export default async function CertificatePage(props: PageProps<"/certificates/[id]">) {
  const { id } = await props.params;
  const db = supabaseAnon();

  const { data: certificate, error } = await db
    .from("certificates")
    .select("id, tier, recipient_name, credential, jwt, issued_at, revoked_at, endorsements")
    .eq("id", id)
    .maybeSingle();

  if (error || !certificate) notFound();

  const status: "verified" | "invalid" | "unavailable" | "revoked" = certificate.revoked_at
    ? "revoked"
    : verifyCredential(certificate.jwt).status;

  const credential = certificate.credential as CredentialShape;
  const achievement = credential.credentialSubject?.achievement;
  const evidence = credential.evidence?.[0]?.description ?? null;
  const tierLabel = TIER_LABEL[certificate.tier] ?? certificate.tier;
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const endorsements = Array.isArray(certificate.endorsements)
    ? (certificate.endorsements as unknown[])
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="field-label m-0">Rivulet certificate — {tierLabel}</p>
        {status !== "revoked" && status !== "invalid" && (
          <Button href={`/api/certificates/${certificate.id}/pdf`} variant="secondary">
            <Download aria-hidden="true" className="size-4" />
            Download as PDF
          </Button>
        )}
      </div>

      {/* The certificate itself: a landscape card, printable and the visual
          basis for the PDF at /api/certificates/[id]/pdf. */}
      <div className="certificate-card grid overflow-hidden rounded-md border border-rule bg-paper-raised sm:aspect-[842/595] sm:grid-cols-[220px_1fr] print:rounded-none print:border-0">
        <div className="relative flex flex-col justify-between bg-ink px-6 py-8 text-paper">
          <div className="flex flex-1 items-center justify-center">
            <Seal tier={tierLabel} />
          </div>
          <div className="space-y-3">
            <div className="rounded-sm bg-white/10 px-3 py-2">
              <p className="m-0 text-xs font-semibold uppercase tracking-wide">
                {achievement?.name ?? "Rivulet certificate"}
              </p>
            </div>
            {achievement?.description && (
              <p className="m-0 text-[0.7rem] leading-snug text-paper/60">
                {achievement.description}
              </p>
            )}
            <p className="m-0 text-[0.65rem] text-paper/50">rivulet-xi.vercel.app</p>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden px-6 py-6 sm:px-10 sm:py-8">
          {/* Faint concentric rings, purely decorative. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 top-1/2 -z-0 size-96 -translate-y-1/2 text-rule/40"
            viewBox="0 0 200 200"
          >
            {[30, 50, 70, 90].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
            ))}
          </svg>

          <div className="relative flex items-baseline justify-between">
            <p className="font-display m-0 text-2xl italic text-river">Rivulet</p>
            <p className="num m-0 text-sm text-ink-muted">Issued {issuedDate}</p>
          </div>

          <div className="relative space-y-1">
            <h1 className="font-display m-0 text-4xl italic sm:text-5xl">
              {certificate.recipient_name}
            </h1>
            <p className="m-0 text-sm text-ink-muted sm:text-base">
              has demonstrated stream reporting recognised by Rivulet as a
            </p>
            <p className="m-0 text-xl font-medium text-river sm:text-2xl">
              {achievement?.name ?? "Rivulet certificate"}
            </p>
          </div>

          <div className="relative space-y-2">
            {achievement?.description && (
              <p className="m-0 max-w-xl text-sm text-ink">{achievement.description}</p>
            )}
            {evidence && <p className="num m-0 max-w-xl text-sm text-ink-muted">{evidence}</p>}
          </div>

          <div className="relative flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-4">
            <div>
              <div className="mb-1 h-px w-40 bg-ink" />
              <p className="m-0 text-sm font-medium">Rivulet Issuer</p>
              <p className="m-0 flex items-center gap-1 text-xs text-ink-muted">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {status === "verified" && "Signature verified · Ed25519"}
                {status === "invalid" && "Signature invalid"}
                {status === "unavailable" && "Cannot verify right now"}
                {status === "revoked" && "Revoked"}
              </p>
            </div>
            <div className="text-right">
              <p className="m-0 text-xs text-ink-muted">Verify this certificate at:</p>
              <p className="num m-0 max-w-[14rem] break-words text-xs font-medium text-river">
                rivulet-xi.vercel.app/certificates/{certificate.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {status === "unavailable" && (
        <p className="max-w-2xl text-sm text-ink-muted">
          Cannot verify right now: the issuer key is not configured on this
          deployment. This says nothing about whether the certificate is
          genuine — try again later or on the primary deployment.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 text-sm text-ink-muted print:hidden">
        <p className="m-0">
          Not endorsed by the EU, IEEE or the OneAquaHealth consortium.
        </p>
        <p className="num m-0">
          <a href={`/api/certificates/${certificate.id}`} className="underline underline-offset-2 hover:text-river">
            View the underlying credential (JSON)
          </a>
        </p>
      </div>

      <div className="border-t border-dashed border-rule-strong pt-4">
        <p className="field-label m-0">Institutional endorsement</p>
        {endorsements.length === 0 ? (
          <p className="mt-1 mb-0 text-sm text-ink-muted">
            None yet. This slot accepts a co-signature from a municipality
            or research consortium.
          </p>
        ) : (
          <ul className="m-0 mt-1 list-none space-y-1 p-0 text-sm">
            {endorsements.map((e, i) => (
              <li key={i}>{JSON.stringify(e)}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-muted print:hidden">
        Rivulet is an independent citizen-science prototype built for a
        hackathon. This certificate carries no institutional endorsement
        unless one is listed above.
      </p>
    </div>
  );
}
