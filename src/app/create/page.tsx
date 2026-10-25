import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { PhoneGate } from "../components/phone-gate";
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
      <PhoneGate description="Your phone number is your login. No password: we text you a code, and you can pick your trips back up on any device from My Trips." title="Sign In With Your Phone">
        <CreateTripForm />
      </PhoneGate>
    </PageShell>
  );
}
