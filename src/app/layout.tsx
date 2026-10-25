import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TravelSync",
    template: "%s | TravelSync",
  },
  description:
    "Plan a group trip around everyone's schedules, budgets, and preferences.",
};

// viewport-fit=cover lets pages use the iPhone safe areas; themeColor tints Safari's toolbar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#123746",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
