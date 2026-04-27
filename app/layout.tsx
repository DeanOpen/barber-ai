import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeProvider from "./theme";
import ThemeToggle from "./components/ThemeToggle";
import { IS_SHOWCASE } from "@/lib/showcase";

// Runs before React hydrates so the first paint matches the saved theme —
// prevents a dark/light flash. Default is light; "system" honors the OS only
// when the visitor explicitly opted in via the toggle.
const THEME_BOOT = `(function(){try{var k='barber-theme';var v=localStorage.getItem(k);var m='light';if(v==='light'||v==='dark'){m=v;}else if(v==='system'){m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var d=document.documentElement;d.dataset.theme=m;d.style.colorScheme=m;}catch(e){}})();`;

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
    <html
      lang="en"
      data-theme="light"
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <ThemeProvider>
          <header className="shop-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
              <Link href="/" className="brand-mark">
                <span className="stripe" aria-hidden />
                <span className="brand-wordmark">
                  <span className="brand-name">Barber Studio</span>
                  <span className="brand-sub">Chair-side preview</span>
                </span>
                {IS_SHOWCASE ? (
                  <span className="brand-chip">Demo</span>
                ) : null}
              </Link>
              <div className="flex items-center gap-3">
                {IS_SHOWCASE ? (
                  <span
                    className="text-sm"
                    style={{ color: "var(--muted)" }}
                    aria-label="Bring your own key - runs entirely in your browser"
                  >
                    BYOK · Browser-only
                  </span>
                ) : (
                  <nav className="text-sm">
                    <Link href="/admin" className="nav-link">
                      Shop admin
                    </Link>
                  </nav>
                )}
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
          <footer
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-10 text-xs"
            style={{ color: "var(--muted)" }}
          >
            <span>
              {IS_SHOWCASE
                ? "Public demo. Your API key and photo never leave your browser - generation calls go directly from this page to the model provider you chose."
                : "For in-shop styling consultations. Your photo is used only to sketch the previews and is not saved on this tablet."}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <a
                href="https://www.producthunt.com/products/barber-studio-try-the-haircut?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-barber-studio-try-the-haircut"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Barber Studio on Product Hunt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Barber Studio - Try the haircut - An in-shop AI hairstyle preview for barbers and salons. | Product Hunt"
                  width={140}
                  height={30}
                  style={{ display: "block", height: 30, width: "auto" }}
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1132893&theme=light&t=1777256507518"
                />
              </a>
              <a
                href="https://github.com/DeanOpen/barber-ai"
                target="_blank"
                rel="noreferrer noopener"
                className="nav-link"
              >
                github.com/DeanOpen/barber-ai
              </a>
            </span>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
