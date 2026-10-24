import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";

export const metadata: Metadata = {
  title: "Create a Trip",
};

export default function CreateTripPage() {
  return (
    <PageShell
      eyebrow="Host a new trip"
      title="Give your group a place to start."
      description="Share the broad idea now. Everyone can add their own constraints and preferences after they join."
    >
      <form action="/trip/demo">
        <div>
          <label className="form-label" htmlFor="trip-idea">Trip idea</label>
          <textarea
            className="form-control min-h-32 resize-y"
            id="trip-idea"
            name="tripIdea"
            placeholder="Four friends from Austin want to travel somewhere during winter break for about five days. We like food, nightlife, and sightseeing."
          />
          <p className="mt-2 text-sm text-[#7a878d]">A sentence or two is plenty.</p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="origin">Starting city</label>
            <input className="form-control" id="origin" name="origin" placeholder="Austin, Texas" type="text" />
          </div>
          <div>
            <label className="form-label" htmlFor="destination">
              Destination <span className="font-normal text-[#879196]">(optional)</span>
            </label>
            <input className="form-control" id="destination" name="destination" placeholder="Tokyo, Japan" type="text" />
          </div>
        </div>

        <fieldset className="mt-7">
          <legend className="text-base font-bold">Possible travel window</legend>
          <p className="mt-1 text-sm text-[#7a878d]">Use the widest dates your group could consider.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="form-label" htmlFor="earliest-date">Earliest date</label>
              <input className="form-control" id="earliest-date" name="earliestDate" type="date" />
            </div>
            <div>
              <label className="form-label" htmlFor="latest-date">Latest date</label>
              <input className="form-control" id="latest-date" name="latestDate" type="date" />
            </div>
          </div>
        </fieldset>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="duration">Approximate duration</label>
            <select className="form-control" defaultValue="" id="duration" name="duration">
              <option disabled value="">Choose a length</option>
              <option>Weekend</option>
              <option>3–4 days</option>
              <option>5–7 days</option>
              <option>More than a week</option>
              <option>Not sure yet</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="travelers">Number of travelers</label>
            <input className="form-control" id="travelers" min="2" name="travelers" placeholder="4" type="number" />
          </div>
        </div>

        <div className="mt-9 border-t border-[#172733]/10 pt-7">
          <button className="button-primary w-full sm:w-auto" type="submit">
            Create Trip <span aria-hidden="true">→</span>
          </button>
          <p className="mt-3 text-xs text-[#889398]">Demo mode: this opens a sample trip and does not save your answers.</p>
        </div>
      </form>
    </PageShell>
  );
}
