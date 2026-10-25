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
      <div className={showCode ? "mt-3 flex flex-col items-stretch gap-3" : "mt-2 flex flex-wrap items-center gap-2"}>
        <button aria-label={`Copy Invite Code: ${code}`} className={`invite-code relative cursor-copy rounded-lg font-mono font-bold text-[#173f50] focus-visible:outline-2 focus-visible:outline-[#397bb3] ${showCode ? "h-14 w-full px-2 py-4" : "border border-[#173f50]/20 px-3 py-2 text-sm tracking-[0.15em]"}`} onClick={() => copy("code")} title="Copy invite code" type="button">
          <span className={`invite-code-value transition-opacity duration-200 ${showCode ? "absolute inset-0 flex items-center justify-center text-2xl font-bold tracking-[0.15em] sm:text-3xl" : ""} ${copied === "code" ? "opacity-0" : ""}`}>{code}</span>
          <span aria-hidden="true" className={`invite-code-action absolute inset-0 flex items-center justify-center gap-2 tracking-normal transition-opacity duration-200 ${showCode && copied === "code" ? "text-2xl" : "text-sm"} ${copied === "code" ? "opacity-100" : "opacity-0"}`}>{copied === "code" ? "Copied!" : <><svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="12" rx="2" width="12" x="8" y="8" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg><span>Copy</span></>}</span>
        </button>
        {showCode ? <p className="text-center text-xs text-[#718087]">Tap or click the code to copy</p> : null}
        <button className={className} onClick={() => copy("link")} type="button">{copied === "link" ? "Copied!" : "Copy Link"}</button>
      </div>
      <span className="sr-only" role="status">{copied ? "Copied!" : ""}</span>
      {fallback ? <label className="mt-2 block text-xs text-[#53666f]">Copy unavailable. Select and copy below:<input className="form-control mt-1 select-all !text-xs" onFocus={(event) => event.target.select()} readOnly value={fallback} /></label> : null}
    </div>
  );
}
