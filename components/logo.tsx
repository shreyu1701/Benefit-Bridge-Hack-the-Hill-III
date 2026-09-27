/** Bridge mark from the design canvas. Decorative: the site name sits next to it. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="text-primary shrink-0">
      <path d="M3 22c4-9 9-13 13-13s9 4 13 13" />
      <path d="M3 22h26" />
      <path d="M10 22v-6" />
      <path d="M16 22v-9" />
      <path d="M22 22v-6" />
    </svg>
  );
}
