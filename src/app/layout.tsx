import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "RuffNeck Learn | AI & digital skills training",
  description:
    "Practical AI literacy and digital skills courses for Nigerian professionals and businesses.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            © {new Date().getFullYear()} RuffNeck Entertainment ·{" "}
            <a href={process.env.NEXT_PUBLIC_SITE_URL || "https://ruffneck-entertainment.vercel.app"}>
              Main website
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
