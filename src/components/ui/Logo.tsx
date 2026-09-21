/** The Rivulet mark: a stream winding from its source to its mouth. Same drawing as src/app/icon.svg. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#185157" />
      <path
        d="M17 15 C 35 13, 37 29, 27 33 S 26 51, 44 49"
        fill="none"
        stroke="#eeede5"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <circle cx="47" cy="49" r="5.2" fill="#e3b53c" />
      <circle cx="17" cy="15" r="3" fill="#eeede5" />
    </svg>
  );
}
