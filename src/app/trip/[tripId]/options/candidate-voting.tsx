"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

type VotingOption = {
  id: string;
  title: string;
  destination: string;
  optionNumber: number;
};

type VotingTraveler = {
  id: string;
  name: string;
  isHost: boolean;
  votedCandidateId: string | null;
  feedback: string;
};

type CandidateVotingProps = {
  tripId: string;
  options: VotingOption[];
  travelers: VotingTraveler[];
  itineraryReady: boolean;
};

export function CandidateVoting({ tripId, options, travelers, itineraryReady }: CandidateVotingProps) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const currentTraveler = travelers.find((traveler) => traveler.id === travelerId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const chosenId = selectedId ?? currentTraveler?.votedCandidateId ?? null;
  const feedbackValue = feedback ?? currentTraveler?.feedback ?? "";
  const votedCount = travelers.filter((traveler) => traveler.votedCandidateId).length;
  const allVoted = travelers.length > 0 && votedCount === travelers.length;

  // A tie at the top means Muse decides between the tied options, so the group is warned first.
  const voteCounts = options.map((option) => ({ option, count: travelers.filter((traveler) => traveler.votedCandidateId === option.id).length }));
  const topCount = Math.max(0, ...voteCounts.map((item) => item.count));
  const tiedOptions = topCount > 0 ? voteCounts.filter((item) => item.count === topCount).map((item) => item.option) : [];
  const tieWarning = allVoted && tiedOptions.length > 1
    ? `It's a tie between Options ${tiedOptions.map((option) => option.optionNumber).join(tiedOptions.length > 2 ? ", " : " and ").replace(/, (\d+)$/, " and $1")} (${topCount} ${topCount === 1 ? "vote" : "votes"} each). Muse will pick the one that fits the whole group best and blend in ideas from the ${tiedOptions.length > 2 ? "others" : "other"}, so the plan may not match any single option.`
    : "";

  async function handleVote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");

    if (!currentTraveler) {
      return;
    }
    if (!chosenId) {
      setErrorMessage("Choose an option before saving your vote.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/travelers/${currentTraveler.id}/vote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: chosenId, feedback: feedbackValue }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData.error || "We could not save your vote.");
        return;
      }

      setMessage("Vote saved. You can change it until the itinerary is created.");
      setSelectedId(null);
      setFeedback(null);
      router.refresh();
    } catch {
      setErrorMessage("We could not reach the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinalize() {
    if (!currentTraveler) {
      return;
    }
    if (tieWarning && !window.confirm(`${tieWarning}\n\nCreate the shared itinerary anyway?`)) {
      return;
    }

    setIsFinalizing(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostTravelerId: currentTraveler.id }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        setErrorMessage(responseData.error || "We could not create the shared itinerary.");
        return;
      }

      router.push(responseData.itineraryPath || `/trip/${tripId}/itinerary`);
      router.refresh();
    } catch {
      setErrorMessage("We could not reach the planner. Please try again.");
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <section className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" aria-labelledby="decide-together">
      <div className="rounded-3xl border border-[#e4664f]/20 bg-white p-6 sm:p-8">
        <p className="eyebrow">Decide Together</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight" id="decide-together">
          {itineraryReady ? "Voting Is Closed" : "Cast Your Vote"}
        </h2>

        {itineraryReady ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-[#718087]">The group&apos;s shared itinerary has been created from these votes.</p>
            <Link className="button-primary mt-5" href={`/trip/${tripId}/itinerary`}>
              View Shared Itinerary
            </Link>
          </div>
        ) : !browserReady ? null : !currentTraveler ? (
          <p className="mt-4 text-sm leading-6 text-[#718087]">
            Join this trip from your invite link on this device to vote.
          </p>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={handleVote}>
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="sr-only">Choose your preferred option</legend>
              {options.map((option) => {
                const selected = chosenId === option.id;
                return (
                  <label
                    className={`cursor-pointer rounded-2xl border-2 p-4 transition ${selected ? "border-[#e4664f] bg-[#fff4ef]" : "border-[#172733]/10 bg-[#f7f7f3] hover:border-[#e4664f]/40"}`}
                    key={option.id}
                  >
                    <input
                      checked={selected}
                      className="sr-only"
                      name="candidate"
                      onChange={() => setSelectedId(option.id)}
                      type="radio"
                      value={option.id}
                    />
                    <span className="block text-xs font-bold uppercase tracking-[0.14em] text-[#e4664f]">Option {option.optionNumber}</span>
                    <span className="mt-1 block font-bold text-[#173f50]">{option.title}</span>
                    <span className="mt-1 block text-sm text-[#52766c]">{option.destination}</span>
                  </label>
                );
              })}
            </fieldset>

            <div>
              <label className="form-label" htmlFor="vote-feedback">
                Anything the group should know? <span className="font-normal text-[#879196]">(optional)</span>
              </label>
              <textarea
                className="form-control mt-2 min-h-24"
                id="vote-feedback"
                maxLength={500}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="I like the museums, but I'd want one outdoor day."
                value={feedbackValue}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button className={`button-primary ${isSaving ? "cursor-not-allowed opacity-60" : ""}`} disabled={isSaving} type="submit">
                {isSaving ? "Saving Vote..." : currentTraveler.votedCandidateId ? "Update My Vote" : "Save My Vote"}
              </button>
              {message ? <p className="text-sm font-semibold text-[#276655]" role="status">{message}</p> : null}
            </div>
          </form>
        )}

        {errorMessage ? (
          <p className="mt-4 text-sm font-semibold text-[#a34532]" role="alert">{errorMessage}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-[#173f50]">Group Votes</h3>
          <p className="text-sm font-bold text-[#52766c]">{votedCount} of {travelers.length} voted</p>
        </div>
        <ul className="mt-4 divide-y divide-[#172733]/8">
          {travelers.map((traveler) => {
            const option = options.find((item) => item.id === traveler.votedCandidateId);
            return (
              <li className="py-3 text-sm" key={traveler.id}>
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{traveler.name}{traveler.isHost ? " (Host)" : ""}</span>
                  <span className={option ? "font-bold text-[#276655]" : "text-[#778388]"}>
                    {option ? `Option ${option.optionNumber} ✓` : "Waiting"}
                  </span>
                </span>
                {option && traveler.feedback ? (
                  <span className="mt-1.5 block rounded-xl bg-[#f7f7f3] px-3 py-2 text-[#53666f]">&ldquo;{traveler.feedback}&rdquo;</span>
                ) : null}
              </li>
            );
          })}
        </ul>

        {!itineraryReady && browserReady ? (
          <div className="mt-5 rounded-2xl bg-[#f7f7f3] p-4 text-sm leading-6 text-[#53666f]">
            {!allVoted ? (
              <p>Once everyone who joined has voted, the host can create one shared itinerary.</p>
            ) : currentTraveler?.isHost ? (
              <>
                {tieWarning ? <p className="mb-3 rounded-xl bg-[#fff8dc] p-3 font-semibold text-[#6f5a16]" role="status">⚖️ {tieWarning}</p> : null}
                <p>Everyone voted. Muse will build one plan from the strongest option and work in the group&apos;s feedback.</p>
                <button
                  className={`button-dark mt-4 w-full ${isFinalizing ? "cursor-not-allowed opacity-60" : ""}`}
                  disabled={isFinalizing}
                  onClick={handleFinalize}
                  type="button"
                >
                  {isFinalizing ? "Building Itinerary..." : "Create Shared Itinerary"}
                </button>
              </>
            ) : (
              <>
                {tieWarning ? <p className="mb-3 rounded-xl bg-[#fff8dc] p-3 font-semibold text-[#6f5a16]" role="status">⚖️ {tieWarning}</p> : null}
                <p>Everyone voted. Waiting for the host to create the shared itinerary.</p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
