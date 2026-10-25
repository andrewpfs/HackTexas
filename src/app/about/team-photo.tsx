"use client";

import Image from "next/image";
import { useState } from "react";

type TeamPhotoProps = {
  name: string;
  initials: string;
  src: string;
  group?: boolean;
};

export function TeamPhoto({ name, initials, src, group = false }: TeamPhotoProps) {
  const [missing, setMissing] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-[#e8eceb] ${group ? "aspect-[4/3] rounded-3xl" : "aspect-[4/5] rounded-2xl"}`}>
      {missing ? (
        <div className="flex h-full items-center justify-center" role="img" aria-label={`Portrait placeholder for ${name}`}>
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/70 text-2xl font-bold tracking-wide text-[#53666f]" aria-hidden="true">{initials}</span>
        </div>
      ) : (
        <Image alt={name} className={group ? "object-cover object-[center_70%]" : "object-cover object-top"} fill onError={() => setMissing(true)} sizes={group ? "(max-width: 1023px) 100vw, 960px" : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"} src={src} />
      )}
    </div>
  );
}
