import Link from "next/link";
import { Header } from "./header";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function PageShell({ eyebrow, title, description, children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#172733]">
      <Header />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.72fr_1.28fr] lg:px-10 lg:py-20">
        <section className="lg:pt-8">
          <Link className="text-sm font-semibold text-[#607179] hover:text-[#e4664f]" href="/">
            ← Back home
          </Link>
          <p className="eyebrow mt-10">{eyebrow}</p>
          <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-tight tracking-[-0.045em] text-[#102a38] sm:text-5xl">
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
