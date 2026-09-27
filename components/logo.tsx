/**
 * "Your words, bridged": a speech bubble holding a bridge. You describe your
 * situation in your own words, and that becomes the bridge to support.
 * Decorative: the site name sits next to it.
 */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-primary shrink-0">
      <path strokeWidth="2.2" d="M8 6.5H24A3.5 3.5 0 0 1 27.5 10V19A3.5 3.5 0 0 1 24 22.5H14L9 26.5V22.5H8A3.5 3.5 0 0 1 4.5 19V10A3.5 3.5 0 0 1 8 6.5Z" />
      <path strokeWidth="2.2" d="M8 18.5C10.5 13 13.3 11 16 11S21.5 13 24 18.5M8 18.5H24" />
      <path strokeWidth="1.7" d="M12.5 18.5V14.8M16 18.5V13.2M19.5 18.5V14.8" />
    </svg>
  );
}
