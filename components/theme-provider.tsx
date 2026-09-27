"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Light / dark / system theme via a class on <html> (see the dark variant in app/globals.css). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
