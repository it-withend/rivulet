import { notFound } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { supabaseAnon } from "@/lib/db/client";
import { verifyCredential } from "@/lib/credentials/jwt";
import { CERTIFICATE, TIER_LABEL, certificateNumber, qrModules } from "@/lib/credentials/certificate-copy";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export const metadata = {
  title: "Volunteer certificate — Rivulet",
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

/** The Rivulet seal: the stream mark inside a ring of text, drawn in SVG so it stays sharp when printed. */
function Seal({ tier }: { tier: string }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Rivulet seal" className="mx-auto size-40 text-paper sm:size-44">
      <defs>
        <path id="seal-ring" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <text fontSize="11.5" letterSpacing="2.2" fill="currentColor" fontFamily="var(--font-plex-mono), monospace">
        <textPath href="#seal-ring" startOffset="0">{CERTIFICATE.sealRing.repeat(1)}</textPath>
      </text>
      <g transform="translate(70 62) scale(0.94)">
        <path d="M17 15 C 35 13, 37 29, 27 33 S 26 51, 44 49" fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
        <circle cx="47" cy="49" r="5.2" fill="#e3b53c" />
        <circle cx="17" cy="15" r="3" fill="currentColor" />
      </g>
      <text x="100" y="150" textAnchor="middle" fontSize="9" letterSpacing="1.6" fill="currentColor" fontFamily="var(--font-plex-mono), monospace">
        {tier.toUpperCase()}
      </text>
    </svg>
  );
}

/** The verification link as a QR code, so a printed copy can be checked with a phone. */
function VerifyQr({ url }: { url: string }) {
  const rows = qrModules(url);
  const size = rows.length;
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="QR code for the verification link" className="size-20 shrink-0 bg-white">
      {rows.flatMap((row, y) =>
        row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill="#151b1c" /> : null)),
      )}
    </svg>
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
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rivulet-xi.vercel.app").replace(/\/$/, "");
  const verifyUrl = `${site}/certificates/${certificate.id}`;

  const endorsements = Array.isArray(certificate.endorsements)
    ? (certificate.endorsements as unknown[])
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="field-label m-0">Volunteer certificate — {tierLabel}</p>
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
          <div className="space-y-2 text-center sm:text-left">
            <p className="m-0 text-[0.65rem] uppercase tracking-widest text-paper/60">Certificate no.</p>
            <p className="num m-0 text-sm">{certificateNumber(certificate.id)}</p>
            <p className="m-0 text-[0.65rem] text-paper/50">rivulet-xi.vercel.app</p>
          </div>
        </div>

        <div className="relative flex flex-col justify-between gap-4 overflow-hidden px-6 py-6 sm:px-10 sm:py-7">
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

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Logo className="size-8" />
              <span className="font-display text-2xl italic text-river">Rivulet</span>
            </div>
            <p className="num m-0 text-sm text-ink-muted">Issued {issuedDate}</p>
          </div>

          <div className="relative space-y-1.5">
            <p className="field-label m-0 text-river">{CERTIFICATE.title}</p>
            <p className="m-0 text-sm text-ink-muted">{CERTIFICATE.intro}</p>
            <h1 className="font-display m-0 text-4xl italic leading-tight sm:text-5xl">
              {certificate.recipient_name}
            </h1>
            <p className="m-0 max-w-xl text-sm text-ink sm:text-[0.95rem]">{CERTIFICATE.body}</p>
          </div>

          <div className="relative space-y-1">
            <p className="m-0 text-sm text-ink-muted">Volunteer level</p>
            <p className="m-0 text-lg font-medium text-river sm:text-xl">
              {achievement?.name ?? "Rivulet Contributor"}
            </p>
            {evidence && <p className="num m-0 max-w-xl text-xs text-ink-muted sm:text-sm">{evidence}</p>}
          </div>

          <div className="relative flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-4">
            <div>
              <p className="font-display m-0 -rotate-3 text-3xl italic leading-none text-ink">
                {CERTIFICATE.signatory.name}
              </p>
              <div className="mt-1 h-px w-44 bg-ink" />
              <p className="m-0 mt-1 text-sm font-medium">
                {CERTIFICATE.signatory.name}, {CERTIFICATE.signatory.title}
              </p>
              <p className="m-0 flex items-center gap-1 text-xs text-ink-muted">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {status === "verified" && "Digitally signed · Ed25519 · verified"}
                {status === "invalid" && "Signature invalid"}
                {status === "unavailable" && "Cannot verify right now"}
                {status === "revoked" && "Revoked"}
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-right">
                <p className="m-0 text-xs text-ink-muted">Scan or visit to verify:</p>
                <p className="num m-0 max-w-[13rem] break-words text-xs font-medium text-river">
                  {verifyUrl.replace(/^https?:\/\//, "")}
                </p>
              </div>
              <VerifyQr url={verifyUrl} />
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
        <p className="m-0 max-w-xl">{CERTIFICATE.disclaimer}</p>
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
    </div>
  );
}
