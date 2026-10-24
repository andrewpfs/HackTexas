import Link from "next/link";
import { Header } from "../../components/header";

export default function TripNotFound() {
  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#172733]">
      <Header />
      <section className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
        <p className="eyebrow">Trip not found</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em]">This trip does not exist.</h1>
        <p className="mt-4 text-lg leading-8 text-[#66757d]">Check the link, or create a new trip to start planning.</p>
        <Link className="button-primary mt-8" href="/create">Create a trip</Link>
      </section>
    </main>
  );
}
