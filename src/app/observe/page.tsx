import { Clock, HeartHandshake, MapPin } from "lucide-react";
import { ObservationWizard } from "@/components/wizard/ObservationWizard";
import { PhotoPreview } from "@/components/wizard/PhotoPreview";
import { FindMyStream } from "@/components/observe/FindMyStream";
import { supabaseAnon } from "@/lib/db/client";

export default async function ObservePage(props: PageProps<"/observe">) {
  const searchParams = await props.searchParams;
  const waterbodyParam = searchParams.waterbody;
  const waterbody = Array.isArray(waterbodyParam)
    ? waterbodyParam[0]
    : waterbodyParam;

  if (!waterbody) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <p className="field-label m-0">Check a stream</p>
        <h1 className="mt-2 mb-3 text-4xl">Help look after the water near you</h1>
        <ul className="m-0 mb-8 list-none space-y-2 p-0 text-ink-muted">
          <li className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-4 shrink-0" /> Takes about two minutes, no sign-up.
          </li>
          <li className="flex items-center gap-2">
            <HeartHandshake aria-hidden="true" className="size-4 shrink-0" /> Your report tells neighbours, dog owners and the city how the stream is doing.
          </li>
        </ul>

        <section aria-labelledby="which-stream" className="rounded-md border border-rule bg-paper-raised p-5">
          <h2 id="which-stream" className="mt-0 mb-3 flex items-center gap-2 text-2xl">
            <MapPin aria-hidden="true" className="size-6 text-river" />
            Which stream are you at?
          </h2>
          <FindMyStream />
        </section>

        <div className="mt-10 border-t border-rule pt-8">
          <p className="field-label m-0">Just curious?</p>
          <h2 className="mt-2 mb-3 text-2xl">Read the colour of any water</h2>
          <p className="mt-0 mb-6 max-w-md text-ink-muted">
            Try the colour reading without sending anything. It happens on your
            device — your photo is never uploaded.
          </p>
          <PhotoPreview />
        </div>
      </div>
    );
  }

  const { data } = await supabaseAnon()
    .from("waterbodies")
    .select("name, city")
    .eq("id", waterbody)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <p className="field-label m-0">Check a stream</p>
      <h1 className="mt-2 mb-4 text-4xl">Tell us what you see</h1>
      <ObservationWizard
        waterbodyId={waterbody}
        waterbodyName={data ? `${data.name}, ${data.city}` : undefined}
      />
    </div>
  );
}
