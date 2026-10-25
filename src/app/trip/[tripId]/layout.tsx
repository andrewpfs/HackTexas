import type { ReactNode } from "react";
import { TripNotificationBar } from "./notification-bar";

// Every trip page gets the update bar.
export default function TripLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TripNotificationBar />
    </>
  );
}
