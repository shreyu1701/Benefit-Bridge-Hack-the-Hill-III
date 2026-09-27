/** Narrow reading column for every page except the full-width landing page. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-6">{children}</div>;
}
