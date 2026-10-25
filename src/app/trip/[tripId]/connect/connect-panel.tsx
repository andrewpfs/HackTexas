"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTravelerIdentity } from "@/lib/use-traveler-identity";

const toolList = [
  ["get_my_trip", "Your itinerary, dates, and group, from your point of view"],
  ["get_my_bookings", "Your checklist: your flight, the group hotel, and your share"],
  ["get_booking_details", "Times, fares, hotel dates, and links for one item"],
  ["mark_booked", "Records a booking you approved, so the group sees it"],
];

function subscribe() {
  return () => {};
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#879196]">{label}</p>
        <button
          className="text-xs font-bold text-[#173f50] underline decoration-[#e4664f]/40 underline-offset-4"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          type="button"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-2xl bg-[#173f50] p-4 font-mono text-xs leading-6 text-white">{value}</pre>
    </div>
  );
}

export function ConnectPanel({ tripId, connectedIds }: { tripId: string; connectedIds: string[] }) {
  const router = useRouter();
  const { browserReady, travelerId } = useTravelerIdentity(tripId);
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = travelerId !== null && connectedIds.includes(travelerId);
  const serverUrl = `${origin}/api/mcp`;

  async function call(method: "POST" | "DELETE") {
    if (!travelerId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/travelers/${travelerId}/assistant-token`, { method });
      const data = (await response.json()) as { token?: string; error?: string };
      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setToken(data.token ?? null);
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!browserReady) return null;
  if (!travelerId) {
    return <p className="mt-8 rounded-3xl bg-white p-6 text-[#718087]">Open this trip from your invite link (or My Trips) on this device first.</p>;
  }

  const shownToken = token ?? "YOUR_TOKEN";
  const config = JSON.stringify({ mcpServers: { "trip-planner": { url: serverUrl, headers: { Authorization: `Bearer ${shownToken}` } } } }, null, 2);
  const curl = `curl -X POST ${serverUrl} \\\n  -H "Authorization: Bearer ${shownToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_my_bookings","arguments":{}}}'`;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="min-w-0 rounded-3xl border border-[#172733]/8 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Your Connection</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${connected || token ? "bg-[#daf0ea] text-[#276655]" : "bg-[#f2f0ea] text-[#879196]"}`}>
            {connected || token ? "Connected" : "Not connected"}
          </span>
        </div>

        {token ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-2xl bg-[#fff8dc] p-4 text-sm text-[#6f5a16]">Copy this token now. For your safety it is shown only once.</p>
            <CopyBlock label="Connection Token" value={token} />
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#718087]">
            {connected ? "Your assistant is connected. Creating a new token disconnects the old one." : "Create a token, then add it to your assistant with the server URL below."}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button className="button-primary" disabled={busy} onClick={() => call("POST")} type="button">
            {busy ? "Working…" : connected || token ? "Create A New Token" : "Create Connection Token"}
          </button>
          {connected || token ? (
            <button className="button-secondary" disabled={busy} onClick={() => { call("DELETE"); setToken(null); }} type="button">Disconnect</button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-[#a34532]" role="alert">{error}</p> : null}

        <div className="mt-8 space-y-5">
          <CopyBlock label="Server URL" value={serverUrl} />
          <CopyBlock label="MCP Client Config" value={config} />
          <CopyBlock label="Quick Test" value={curl} />
        </div>
      </section>

      <aside className="min-w-0 space-y-6">
        <section className="rounded-3xl border border-[#172733]/8 bg-white p-6">
          <h2 className="text-lg font-bold">What Your Assistant Can Do</h2>
          <ul className="mt-4 space-y-3">
            {toolList.map(([name, description]) => (
              <li key={name}>
                <code className="rounded-lg bg-[#f2f0ea] px-2 py-1 font-mono text-xs font-bold text-[#173f50]">{name}</code>
                <p className="mt-1 text-sm text-[#718087]">{description}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl bg-[#173f50] p-6 text-white">
          <h2 className="text-lg font-bold text-[#f3c969]">Try Saying</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">&ldquo;Book my part of the Tokyo trip.&rdquo; Your assistant reads your checklist, asks you before paying anything, and records the confirmation here so your friends see it.</p>
          <p className="mt-4 text-xs leading-5 text-white/60">The token only reaches your own trip view. It can&apos;t see other travelers&apos; preferences, change the group plan, or pay for anything by itself.</p>
        </section>
      </aside>
    </div>
  );
}
