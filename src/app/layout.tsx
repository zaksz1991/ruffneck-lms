import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./certificate-social-print.css";
import "./background-upgrade.css";
import "./social-shell.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
title: "RuffNeck Learn | AI & digital skills training",
description:
"Practical AI literacy and digital skills courses for Nigerian professionals and businesses.",
};

export const viewport: Viewport = {
width: "device-width",
initialScale: 1,
viewportFit: "cover",
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return ( <html lang="en"> <body> <Header />

    <main>{children}</main>

    <footer className="footer rn-social-footer">
      <div className="container">
        <span>
          © {new Date().getFullYear()} RuffNeck Entertainment
        </span>

        <span className="rn-footer-divider" aria-hidden="true">
          ·
        </span>

        <a
          href={
            process.env.NEXT_PUBLIC_SITE_URL ||
            "https://ruffneck-entertainment.vercel.app"
          }
        >
          Main website
        </a>
      </div>
    </footer>
  </body>
</html>

);
}
