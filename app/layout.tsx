import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeProvider from "./theme";
import { IS_SHOWCASE } from "@/lib/showcase";

const SITE_TITLE = IS_SHOWCASE
  ? "Barber Studio - Public Demo"
  : "Barber Studio - Hairstyle Preview";
const SITE_DESCRIPTION = IS_SHOWCASE
  ? "Public, bring-your-own-key demo of the Barber Studio AI hairstyle preview."
  : "See yourself in a new cut before you sit in the chair.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Barber Studio",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <header className="shop-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="brand-mark">
                <span className="stripe" aria-hidden />
                <span>
                  <span style={{ color: "var(--accent)" }}>Barber</span> Studio
                  {IS_SHOWCASE ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: 999,
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "var(--accent)",
                      }}
                    >
                      Public demo
                    </span>
                  ) : null}
                </span>
              </Link>
              {IS_SHOWCASE ? (
                <span
                  className="text-sm"
                  style={{ color: "var(--muted)" }}
                  aria-label="Bring your own key - runs entirely in your browser"
                >
                  BYOK · Browser-only
                </span>
              ) : (
                <nav className="text-sm" style={{ color: "var(--muted)" }}>
                  <Link href="/admin" className="hover:text-white">
                    Shop admin
                  </Link>
                </nav>
              )}
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
          <footer
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-10 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>
              {IS_SHOWCASE
                ? "Public demo. Your API key and photo never leave your browser - generation calls go directly from this page to the model provider you chose."
                : "For in-shop styling consultations. Your photo is used only to sketch the previews and is not saved on this tablet."}
            </span>
            <a
              href="https://github.com/DeanOpen/barber-ai"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-white"
              style={{ color: "var(--muted)" }}
            >
              github.com/DeanOpen/barber-ai
            </a>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
