import { notFound } from "next/navigation";
import { supabaseAnon } from "@/lib/db/client";
import { verifyCredential } from "@/lib/credentials/jwt";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";
import { Panel } from "@/components/ui/Panel";

const TIER_LABEL: Record<string, string> = {
  contributor: "Contributor",
  data_steward: "Data Steward",
};

type CredentialShape = {
  name?: string;
  validFrom?: string;
  credentialSubject?: { name?: string };
  evidence?: { description?: string }[];
};

export default async function CertificatePage(
  props: PageProps<"/certificates/[id]">,
) {
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
  const evidence = credential.evidence?.[0]?.description ?? null;
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const endorsements = Array.isArray(certificate.endorsements)
    ? (certificate.endorsements as unknown[])
    : [];

  return (
    <div className="certificate-print-page mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div aria-hidden="true">
        <ForelUleRibbon size="sm" />
      </div>

      <Panel className="print:border-0 print:p-0">
        <p className="field-label m-0">Rivulet certificate — {TIER_LABEL[certificate.tier] ?? certificate.tier}</p>
        <h1 className="font-display mt-3 mb-1 text-4xl italic sm:text-5xl">
          {certificate.recipient_name}
        </h1>
        <p className="m-0 max-w-xl text-ink-muted">
          {credential.name ?? "Rivulet certificate"}
        </p>

        {evidence && (
          <p className="num mt-6 mb-0 max-w-xl text-sm text-ink-muted">{evidence}</p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="field-label">Issued</dt>
            <dd className="num m-0 mt-0.5">{issuedDate}</dd>
          </div>
          <div>
            <dt className="field-label">Issued by</dt>
            <dd className="m-0 mt-0.5">Rivulet (independent citizen-science prototype)</dd>
          </div>
          <div>
            <dt className="field-label">Signature</dt>
            <dd className="m-0 mt-0.5">
              {status === "verified" && "Signature verified"}
              {status === "invalid" && "Signature invalid"}
              {status === "unavailable" && "Cannot verify right now"}
              {status === "revoked" && "Revoked"}
            </dd>
          </div>
        </dl>

        {status === "unavailable" && (
          <p className="mt-4 mb-0 max-w-xl text-sm text-ink-muted">
            Cannot verify right now: the issuer key is not configured on this
            deployment. This says nothing about whether the certificate is
            genuine — try again later or on the primary deployment.
          </p>
        )}

        <div className="mt-6 border-t border-rule pt-4 text-sm text-ink-muted print:hidden">
          <p className="m-0">
            Not endorsed by the EU, IEEE or the OneAquaHealth consortium.
          </p>
          <p className="num mt-2 mb-0">
            <a href={`/api/certificates/${certificate.id}`}>
              View the underlying credential (JSON)
            </a>
          </p>
        </div>

        <div className="mt-6 border-t border-dashed border-rule-strong pt-4">
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
      </Panel>

      <div aria-hidden="true" className="rotate-180">
        <ForelUleRibbon size="sm" />
      </div>

      <p className="text-xs text-ink-muted print:hidden">
        Rivulet is an independent citizen-science prototype built for a
        hackathon. This certificate carries no institutional endorsement
        unless one is listed above.
      </p>
    </div>
  );
}
