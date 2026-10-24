import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HackTX Trip Planner",
    template: "%s | HackTX Trip Planner",
  },
  description:
    "Plan a group trip around everyone's schedules, budgets, and preferences.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
