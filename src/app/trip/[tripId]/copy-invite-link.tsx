"use client";

import { useState } from "react";

type CopyInviteLinkProps = {
  joinPath: string;
};

export function CopyInviteLink({ joinPath }: CopyInviteLinkProps) {
  const [copyMessage, setCopyMessage] = useState("");

  async function copyInviteLink() {
    const inviteUrl = new URL(joinPath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage("Invite link copied.");
    } catch {
      setCopyMessage("Copy failed. You can copy the visible link above.");
    }
  }

  return (
    <>
      <button className="button-secondary mt-4 w-full" onClick={copyInviteLink} type="button">Copy invite link</button>
      <p className="mt-2 min-h-4 text-center text-xs text-[#8a9498]" role="status">{copyMessage}</p>
    </>
  );
}
