import Link from "next/link";

export function Header() {
  return (
    <header className="relative z-20 border-b border-[#172733]/10 bg-[#f8f6f1]/95 px-5 backdrop-blur sm:px-8 lg:px-10">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between">
        <Link className="flex items-center gap-2.5 font-bold tracking-tight text-[#102a38]" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173f50] text-[#f3c969]" aria-hidden="true">
            ✦
          </span>
          <span className="hidden sm:inline">HackTX Trip Planner</span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="Primary navigation">
          <Link className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#52646d] hover:bg-white sm:block" href="/join">
            Join a trip
          </Link>
          <Link className="rounded-full bg-[#173f50] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#24586c]" href="/create">
            Plan a trip
          </Link>
        </nav>
      </div>
    </header>
  );
}
