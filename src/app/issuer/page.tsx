import { Panel } from "@/components/ui/Panel";
import { publicJwk } from "@/lib/credentials/keys";

export const metadata = {
  title: "Issuer — Rivulet",
};

export default function IssuerPage() {
  const jwk = publicJwk();

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
      <header>
        <p className="field-label m-0">Certificates</p>
        <h1 className="mt-2 mb-3 text-4xl">Who issues Rivulet certificates</h1>
        <p className="m-0 max-w-xl text-ink-muted">
          Certificates recognise sustained, trustworthy contribution to
          Rivulet&rsquo;s citizen-science record of urban streams.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl">Issuer</h2>
        <p className="m-0 max-w-xl">
          Certificates are issued by <strong>Rivulet (independent
          citizen-science prototype)</strong>. Rivulet was built for a
          hackathon and is not endorsed by, and does not speak for, the
          European Union, IEEE, or the OneAquaHealth consortium. No seal or
          mark on a Rivulet certificate should be read as endorsement by any
          of those bodies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Signing key</h2>
        {jwk ? (
          <>
            <p className="m-0 max-w-xl">
              Every certificate is a signed Verifiable Credential (Open Badges
              3.0). The signature uses Ed25519 (EdDSA); this is the public key
              a verifier needs, also published as a JSON Web Key Set:
            </p>
            <Panel tone="ink">
              <p className="field-label m-0">GET /api/issuer/jwks</p>
              <pre className="num mt-3 mb-0 overflow-x-auto whitespace-pre-wrap break-all text-xs">
                {JSON.stringify({ keys: [jwk] }, null, 2)}
              </pre>
            </Panel>
          </>
        ) : (
          <Panel>
            <p className="m-0 text-sm">Issuer key not configured.</p>
          </Panel>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">How verification works</h2>
        <p className="m-0 max-w-xl">
          Each certificate page (<code>/certificates/&lt;id&gt;</code>) shows
          a signature status computed server-side against this key, and links
          to the underlying credential JSON at{" "}
          <code>/api/certificates/&lt;id&gt;</code>. A verifier can
          independently check the JWS in the credential&rsquo;s{" "}
          <code>jwt</code> field against the published JWK using any
          standard Ed25519/EdDSA library — no Rivulet-specific tooling is
          required.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Institutional co-signing</h2>
        <p className="m-0 max-w-xl text-ink-muted">
          Every certificate carries an empty institutional co-signing slot.
          Rivulet does not claim any institutional endorsement on its own; a
          municipality or research consortium could add one later.
        </p>
      </section>
    </div>
  );
}
