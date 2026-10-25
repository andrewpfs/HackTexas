import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { CreateTripForm } from "./create-trip-form";

export const metadata: Metadata = {
  title: "Create a Trip",
};

export default function CreateTripPage() {
  return (
    <PageShell
      title="Give Your Group A Place To Start."
      description="Share the broad idea now. Everyone can add their own constraints and preferences after they join."
    >
      <CreateTripForm />
    </PageShell>
  );
}
