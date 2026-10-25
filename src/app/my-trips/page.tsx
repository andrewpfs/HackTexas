import type { Metadata } from "next";
import { Header } from "../components/header";
import { MyTripsPanel } from "./my-trips-panel";

export const metadata: Metadata = { title: "My Trips" };

export default function MyTripsPage() {
  return (
    <main className="min-h-screen bg-[#f2f0ea] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#e4664f] sm:text-6xl">My Trips</h1>
        <p className="mt-3 max-w-xl text-lg leading-7 text-[#66757d]">Verify your phone to pick up your trips on this device. No account or password.</p>
        <MyTripsPanel />
      </div>
    </main>
  );
}
