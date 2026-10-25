import Link from "next/link";
import { Header } from "./header";

type PageShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#172733]">
      <Header />
      <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8 lg:px-10">
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href="/">
          ← Back home
        </Link>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[0.72fr_1.28fr] lg:px-10 lg:py-12">
        <section className="lg:pt-4">
          <h1 className="max-w-lg text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#e4664f] sm:text-6xl lg:text-[4rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-8 text-[#66757d]">{description}</p>
          <div className="mt-10 hidden max-w-sm rounded-3xl bg-[#173f50] p-6 text-white lg:block">
            <p className="text-sm font-bold text-[#f3c969]">What happens next?</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Your group gets one shared planning space for availability,
              preferences, suggestions, and voting.
            </p>
          </div>
        </section>
        <section className="rounded-[2rem] border border-[#172733]/10 bg-white p-6 shadow-[0_22px_70px_rgba(29,50,61,0.09)] sm:p-9 lg:p-11">
          {children}
        </section>
      </div>
    </main>
  );
}
