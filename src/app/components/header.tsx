import Link from "next/link";

export function Header() {
  return <header className="relative z-20 border-b border-white/10 bg-[#123746] px-4 text-white shadow-sm sm:px-8 lg:px-10"><div className="mx-auto flex min-h-18 max-w-7xl flex-wrap items-center justify-between gap-2 py-3"><Link className="flex items-center gap-2.5 font-bold tracking-tight text-white" href="/"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3c969] text-[#173f50]" aria-hidden="true">✦</span><span className="text-sm sm:text-base">HackTX Trip Planner</span></Link><nav className="order-3 flex w-full items-center justify-between gap-1 border-t border-white/10 pt-2 sm:order-2 sm:w-auto sm:border-0 sm:pt-0" aria-label="Primary navigation"><Link className="nav-link" href="/">Home</Link><Link className="nav-link" href="/create">Plan a Trip</Link><Link className="nav-link" href="/join">Join a Trip</Link><Link className="nav-link" href="/about">About</Link></nav></div></header>;
}
