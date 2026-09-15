"use client";

import { useState } from "react";
import { extractCentreRegion } from "@/lib/science/extract-colour";
import { pixelsToForelUle } from "@/lib/science/forel-ule";
import { FU_TABLE } from "@/lib/science/forel-ule-table";
import { Panel } from "@/components/ui/Panel";
import { ForelUleRibbon } from "@/components/ui/ForelUleRibbon";

export type ForelUleResult = { index: number; confidence: number };

type Props = {
  onResult: (result: ForelUleResult | null) => void;
};

export function PhotoStep({ onResult }: Props) {
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
  }

  const entry = fu ? FU_TABLE.find((e) => e.index === fu.index) : null;

  return (
    <div className="space-y-4">
      <p className="m-0 max-w-xl text-ink-muted">
        Point the centre of the frame at open water. Avoid the bank, your own
        shadow and reflections of the sky.
      </p>

      <label
        className={
          "flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 " +
          "rounded-sm border border-river bg-river px-5 py-3 font-sans text-[0.9375rem] " +
          "font-medium text-paper transition-colors duration-150 hover:border-river-deep " +
          "hover:bg-river-deep focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
        }
      >
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
    </div>
  );
}
