import { ModeratorQueue } from "@/components/moderation/ModeratorQueue";

export const metadata = {
  title: "Moderator queue — Rivulet",
  robots: { index: false, follow: false },
};

export default function ModeratePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <p className="field-label m-0">Not for residents</p>
        <h1 className="mt-2 mb-2 text-3xl">Moderator queue</h1>
        <p className="m-0 max-w-xl text-sm text-ink-muted">
          Reports our automatic checks could not place — usually an imprecise
          GPS fix, a location far from the stream, too many reports in an
          hour from one device, or a photo that did not look like water.
          Approving or rejecting recomputes trust for everyone who has
          reported on that stream.
        </p>
      </header>
      <ModeratorQueue />
    </div>
  );
}
