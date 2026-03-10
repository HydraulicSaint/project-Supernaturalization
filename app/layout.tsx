import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supernaturalization | Missing Person Geo Investigation",
  description: "Wilderness-focused geospatial investigation platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
