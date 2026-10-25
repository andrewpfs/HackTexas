"use client";

import { useState } from "react";
import { inviteCopyText } from "@/lib/invite-copy";

type CopyInviteLinkProps = {
  joinPath: string;
  className?: string;
  showCode?: boolean;
};

export function CopyInviteLink({ joinPath, className = "button-secondary", showCode = false }: CopyInviteLinkProps) {
  const [copied, setCopied] = useState("");
  const [fallback, setFallback] = useState("");
  const code = inviteCopyText(joinPath, "https://trip.invalid", "code");

  async function copy(kind: "code" | "link") {
    const value = inviteCopyText(joinPath, window.location.origin, kind);

    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setFallback("");
    } catch {
      setFallback(value);
    }
    setTimeout(() => setCopied(""), 2500);
  }

  return (
    <div>
      {showCode ? <button aria-label={`Copy invite code ${code}`} className="mt-2 cursor-copy select-text rounded-lg font-mono text-3xl font-bold tracking-[0.2em] text-[#173f50] focus-visible:outline-2 focus-visible:outline-[#397bb3]" onClick={() => copy("code")} title="Click to copy invite code" type="button">{code}</button> : null}
      <div className="mt-2 flex flex-wrap gap-2"><button className={className} onClick={() => copy("code")} type="button">{copied === "code" ? "Copied!" : "Copy Code"}</button><button className={className} onClick={() => copy("link")} type="button">{copied === "link" ? "Copied!" : "Copy Link"}</button></div>
      <span className="sr-only" role="status">{copied ? "Copied!" : ""}</span>
      {fallback ? <label className="mt-2 block text-xs text-[#53666f]">Copy unavailable. Select and copy below:<input className="form-control mt-1 select-all !text-xs" onFocus={(event) => event.target.select()} readOnly value={fallback} /></label> : null}
    </div>
  );
}
