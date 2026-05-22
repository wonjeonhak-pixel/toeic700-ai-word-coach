import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuietStep — TOEIC700 AI英単語コーチ",
  description:
    "QuietStep｜なぜ間違えたかが分かる、社会人向けTOEIC700英単語コーチ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f5f3ee",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
