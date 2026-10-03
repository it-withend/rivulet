import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Page not found — Rivulet",
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-16 sm:px-6">
      <p className="field-label m-0">Not found</p>
      <h1 className="m-0 text-4xl">This page is not on the map</h1>
      <p className="m-0 max-w-xl text-ink-muted">
        The address may be mistyped, or the stream or certificate it pointed to may have been removed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button href="/map">Open the map</Button>
        <Button href="/" variant="secondary">
          Back to the start
        </Button>
      </div>
    </div>
  );
}
