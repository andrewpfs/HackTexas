import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { CreateTripForm } from "./create-trip-form";

export const metadata: Metadata = {
  title: "Create a Trip",
};

export default function CreateTripPage() {
  return (
    <PageShell
      eyebrow="Host a new trip"
      title="Give your group a place to start."
      description="Share the broad idea now. Everyone can add their own constraints and preferences after they join."
    >
      <CreateTripForm />
    </PageShell>
  );
}
