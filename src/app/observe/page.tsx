import { ObservationWizard } from "@/components/wizard/ObservationWizard";
import { PhotoPreview } from "@/components/wizard/PhotoPreview";

export default async function ObservePage(props: PageProps<"/observe">) {
  const searchParams = await props.searchParams;
  const waterbodyParam = searchParams.waterbody;
  const waterbody = Array.isArray(waterbodyParam)
    ? waterbodyParam[0]
    : waterbodyParam;

  if (!waterbody) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <p className="field-label m-0">Try it</p>
        <h1 className="mt-2 mb-3 text-4xl">Read the colour of your water</h1>
        <p className="mt-0 mb-6 max-w-md text-ink-muted">
          The reading happens on your device — your photo is never uploaded,
          only the colour class it produces.
        </p>
        <PhotoPreview />
        <p className="mt-6 mb-0 max-w-md text-sm text-ink-muted">
          To send a full observation, open it from a stream&apos;s page on
          the map.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="field-label m-0">New observation</p>
      <h1 className="mt-2 mb-6 text-4xl">Record an observation</h1>
      <ObservationWizard waterbodyId={waterbody} />
    </div>
  );
}
