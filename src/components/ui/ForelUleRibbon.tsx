import { FU_TABLE } from "@/lib/science/forel-ule-table";

type ForelUleRibbonProps = {
  /** The current reading (1–21), raised above the rest of the scale. */
  active?: number | null;
  /**
   * Indices already found. When given, colours not yet found render as empty
   * specimen slots carrying only a thin strip of their reference colour.
   */
  collected?: number[];
  size?: "sm" | "md";
};

/**
 * The 21-colour Forel–Ule scale, Rivulet's signature. Colours always mean
 * water colour; they are never used decoratively.
 */
export function ForelUleRibbon({
  active = null,
  collected,
  size = "md",
}: ForelUleRibbonProps) {
  const collecting = collected !== undefined;
  const found = new Set(collected ?? []);
  const md = size === "md";

  return (
    <ul
      aria-label="Forel–Ule water colour scale"
      className={
        "m-0 grid list-none grid-cols-[repeat(21,minmax(0,1fr))] p-0 " +
        (md ? "items-end gap-px pt-3" : "gap-0")
      }
    >
      {FU_TABLE.map((entry) => {
        const isActive = active === entry.index;
        const isCollected = found.has(entry.index);
        const empty = collecting && !isCollected;

        const label =
          `Forel–Ule ${entry.index}: ${entry.description}` +
          (isActive ? " — current reading" : "") +
          (collecting ? (isCollected ? " — collected" : " — not yet collected") : "");

        return (
          <li
            key={entry.index}
            aria-label={label}
            aria-current={isActive ? "true" : undefined}
            data-srgb={entry.srgb}
            data-collected={isCollected ? "true" : "false"}
            className="relative flex min-w-0 flex-col items-stretch"
          >
            <span
              aria-hidden="true"
              style={
                empty
                  ? { borderBottomColor: entry.srgb }
                  : { backgroundColor: entry.srgb }
              }
              className={
                "block transition-[height] duration-200 motion-reduce:transition-none " +
                (md
                  ? (isActive ? "h-14 " : "h-9 ") +
                    (empty
                      ? "border border-b-4 border-dashed border-rule-strong bg-paper-raised"
                      : "")
                  : "h-1.5" + (empty ? " border-b-2 bg-transparent" : ""))
              }
            />
            {md && (
              <span
                aria-hidden="true"
                className={
                  "num mt-1.5 block text-center text-[0.625rem] leading-none sm:text-[0.6875rem] " +
                  (isActive
                    ? "font-medium text-ink"
                    : empty
                      ? "text-rule-strong"
                      : "text-ink-muted")
                }
              >
                {entry.index}
              </span>
            )}
            {md && isActive && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-2.5 mx-auto block h-1 w-full max-w-4 bg-ink"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
