"use client";

import { useState } from "react";

type CopyInviteLinkProps = {
  joinPath: string;
  className?: string;
};

export function CopyInviteLink({ joinPath, className = "button-secondary" }: CopyInviteLinkProps) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  async function copyInviteLink() {
    const inviteUrl = new URL(joinPath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2500);
  }

  return (
    <button className={className} onClick={copyInviteLink} type="button">
      {copied === "done" ? "Copied!" : copied === "failed" ? "Copy failed. Share the code instead." : "Copy Invite Link"}
    </button>
  );
}
