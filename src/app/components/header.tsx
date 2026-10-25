import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#123746]/95 px-4 text-white backdrop-blur sm:px-8 lg:px-10">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-2 py-2.5">
        <Link className="flex items-center gap-2.5 font-bold tracking-tight text-white" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3c969]" aria-hidden="true">
            <Image alt="" className="h-6 w-6" height={24} priority src="/images/Logo_1.png" width={24} />
          </span>
          <span className="text-sm sm:text-base">TravelSync</span>
        </Link>
        {/* On phones the main button sits beside the logo so the links below fit on one line. */}
        <Link className="order-2 whitespace-nowrap rounded-full bg-[#f3c969] px-3 py-2 text-xs font-bold text-[#173f50] transition hover:bg-[#f7d77f] sm:hidden" href="/create">Plan a Trip</Link>
        <nav className="order-3 flex w-full items-center justify-between gap-1 border-t border-white/10 pt-2 sm:order-3 sm:w-auto sm:gap-2 sm:border-0 sm:pt-0" aria-label="Primary navigation">
          <Link className="nav-link" href="/">Home</Link>
          <Link className="nav-link" href="/join">Join a Trip</Link>
          <Link className="nav-link" href="/my-trips">My Trips</Link>
          <Link className="nav-link" href="/about">About</Link>
          <Link className="hidden whitespace-nowrap rounded-full bg-[#f3c969] px-4 py-2 text-sm font-bold text-[#173f50] transition hover:bg-[#f7d77f] sm:inline-flex" href="/create">Plan a Trip</Link>
        </nav>
      </div>
    </header>
  );
}
