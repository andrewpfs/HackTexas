import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../components/header";
import { TeamPhoto } from "./team-photo";

export const metadata: Metadata = { title: "About" };

const team = [
  { name: "Duy Andrew Ha", initials: "DAH", photo: "/team/duy-andrew-ha.jpg" },
  { name: "Henry Tin Luong", initials: "HTL", photo: "/team/henry-tin-luong.jpg" },
  { name: "Jay Rawal", initials: "JR", photo: "/team/jay-rawal.jpg" },
  { name: "Ryan Tran", initials: "RT", photo: "/team/ryan-tran.jpg" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#172733]">
      <Header />
      <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <h1 className="mt-1 max-w-3xl font-extrabold leading-[1.02] tracking-[-0.045em] text-[#e4664f] text-5xl sm:text-6xl">Group Travel Should Feel Exciting Before Takeoff.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#5f7078]">HackTX Trip Planner brings schedules, budgets, interests, lodging needs, and departure cities into one shared planning space. Instead of one person juggling polls and group chats, every traveler contributes to a plan the whole group can understand.</p>
        <article className="ticket-card mt-12 p-7">
          <p className="eyebrow">The Concept</p>
          <h2 className="mt-3 text-2xl font-bold">Find The Common Ground</h2>
          <p className="mt-3 leading-7 text-[#66757d]">The current demo collects traveler details, calculates shared availability, and creates deterministic candidate trips. Future phases will add Muse-powered group reasoning without fabricating live travel inventory.</p>
        </article>
        <section className="mt-12" aria-labelledby="team-heading">
          <p className="eyebrow">The Team</p>
          <h2 className="mt-3 text-2xl font-bold" id="team-heading">
            Built By Our HackTX 2026 Team
            <span aria-hidden="true" className="mx-3 font-normal text-[#c9c3b6]">|</span>
            <a className="text-[#e4664f] underline decoration-[#e4664f]/40 underline-offset-4 hover:decoration-[#e4664f]" href="https://devpost.com/software/trip-sync-wqrhnl" rel="noopener noreferrer" target="_blank">Devpost</a>
          </h2>
          <div className="mt-6">
            <TeamPhoto group name="The HackTX 2026 team together" initials="Team" src="/team/group.jpg" />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <article className="ticket-card p-4" key={member.name}>
                <TeamPhoto name={member.name} initials={member.initials} src={member.photo} />
                <h3 className="mt-4 text-lg font-bold">{member.name}</h3>
              </article>
            ))}
          </div>
        </section>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link className="button-primary" href="/create">Plan a Trip</Link>
          <Link className="button-secondary" href="/">Back Home</Link>
        </div>
      </section>
    </main>
  );
}
