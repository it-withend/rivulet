"use client";

import { useState } from "react";
import { extractCentreRegion } from "@/lib/science/extract-colour";
import { pixelsToForelUle } from "@/lib/science/forel-ule";
import { FU_TABLE } from "@/lib/science/forel-ule-table";
import { Panel } from "@/components/ui/Panel";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";
import { Camera, Crosshair, SunDim, Waves } from "lucide-react";

export type ForelUleResult = { index: number; confidence: number };

const THUMBNAIL_MAX_PX = 160;

/** A small downscaled JPEG for the optional "is this really water?" check — never full-resolution. */
function makeThumbnail(bitmap: ImageBitmap): string {
  const scale = Math.min(1, THUMBNAIL_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.5);
}

type Props = {
  onResult: (result: ForelUleResult | null) => void;
  /**
   * Called with a small thumbnail once a photo is chosen, whether or not a
   * colour reading could be extracted from it — an unreadable photo is
   * exactly the kind of image the water check most needs to see.
   */
  onThumbnail?: (dataUrl: string | null) => void;
};

export function PhotoStep({ onResult, onThumbnail }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fu, setFu] = useState<ForelUleResult | null>(null);
  const [tooUnclear, setTooUnclear] = useState(false);

  async function handleFile(file: File) {
    const url = URL.createObjectURL(file);
    setPreview(url);

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);

    const region = extractCentreRegion(
      context.getImageData(0, 0, bitmap.width, bitmap.height),
    );
    const result = pixelsToForelUle(region);

    setTooUnclear(result === null);
    setFu(result);
    onResult(result);
    onThumbnail?.(makeThumbnail(bitmap));
  }

  const entry = fu ? FU_TABLE.find((e) => e.index === fu.index) : null;

  return (
    <div className="space-y-4">
      <p className="m-0 max-w-xl text-ink-muted">
        We read the water&apos;s colour from the middle of your photo, the way
        scientists compare water against a colour chart.
      </p>
      <ul className="m-0 grid list-none gap-2 p-0 text-sm sm:grid-cols-3">
        <li className="flex items-center gap-2 rounded-sm border border-rule bg-paper-raised p-2.5">
          <Crosshair aria-hidden="true" className="size-5 shrink-0 text-river" /> Aim the middle at open water
        </li>
        <li className="flex items-center gap-2 rounded-sm border border-rule bg-paper-raised p-2.5">
          <Waves aria-hidden="true" className="size-5 shrink-0 text-river" /> Leave out the bank and plants
        </li>
        <li className="flex items-center gap-2 rounded-sm border border-rule bg-paper-raised p-2.5">
          <SunDim aria-hidden="true" className="size-5 shrink-0 text-river" /> Avoid glare and your shadow
        </li>
      </ul>

      <label
        className={
          "flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 " +
          "rounded-sm border border-river bg-river px-5 py-3 font-sans text-[0.9375rem] " +
          "font-medium text-paper transition-colors duration-150 hover:border-river-deep " +
          "hover:bg-river-deep focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
        }
      >
        <Camera aria-hidden="true" className="size-5" />
        Take or choose a photo of the water
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="sr-only"
        />
      </label>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Your photo of the water"
          className="w-full rounded-md border border-rule"
        />
      )}

      {entry && fu && (
        <Panel>
          <p className="field-label mb-1">
            Current reading · <data value={entry.index}>FU {entry.index}</data>
          </p>
          <ForelUleRibbon active={entry.index} />
          <p className="mt-3 mb-0 text-base font-medium">{entry.description}</p>
          <p className="num mt-1 mb-0 text-sm text-ink-muted">
            Confidence{" "}
            <data value={fu.confidence}>{(fu.confidence * 100).toFixed(0)}%</data>
          </p>
        </Panel>
      )}

      {tooUnclear && (
        <Panel>
          <p className="m-0 text-sm">
            We could not read the colour from this photo. You can retake it,
            or continue without a photo — your other answers still count.
          </p>
        </Panel>
      )}

      <p className="m-0 text-xs text-ink-muted">
        Your full photo never leaves your phone. Only the colour we find, and
        a small, low-resolution thumbnail we use once to check it&apos;s really a
        photo of water, are sent — the thumbnail is never stored or shown to
        anyone.
      </p>
    </div>
  );
}
