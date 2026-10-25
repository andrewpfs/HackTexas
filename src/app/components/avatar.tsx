import { backgroundColors, hairColors, shirtColors, skinTones, type AvatarLook } from "@/lib/avatar-look";

type AvatarProps = { look: AvatarLook; idPrefix: string; size?: number; label?: string };

// A friendly cartoon face drawn from a look.
export function Avatar({ look, idPrefix, size = 52, label }: AvatarProps) {
  const skin = skinTones[look.skin];
  const hair = hairColors[look.hair];
  const background = backgroundColors[look.background];
  const shirt = shirtColors[look.shirt];
  const hatColor = shirtColors[(look.shirt + 2) % shirtColors.length];
  const hatBand = shirtColors[(look.shirt + 3) % shirtColors.length];
  const girl = look.gender === "girl";
  const clipId = `avatar-${idPrefix.replace(/[^a-zA-Z0-9]/g, "")}`;
  const style = look.style;

  const fringe = <path d="M17 29c1-9 6-14 15-14s14 5 15 14c-5-2-8-7-10-9-3 5-12 8-20 9z" fill={hair} />;

  return (
    <svg aria-label={label} aria-hidden={label ? undefined : true} height={size} role={label ? "img" : undefined} viewBox="0 0 64 64" width={size}>
      <clipPath id={clipId}><circle cx="32" cy="32" r="32" /></clipPath>
      <circle cx="32" cy="32" fill={background} r="32" />
      <g clipPath={`url(#${clipId})`}>
        {/* hair that sits behind the head */}
        {girl && style === 0 ? <circle cx="32" cy="9.5" fill={hair} r="6.5" /> : null}
        {girl && style === 1 ? <path d="M15 31c0-14 7-20 17-20s17 6 17 20v17c0 3-3 4-6 3V34H21v17c-3 1-6 0-6-3z" fill={hair} /> : null}
        {girl && style === 2 ? <path d="M44 20c9 0 13 9 9 19-1 3-4 3-5 0 2-6 0-10-7-12z" fill={hair} /> : null}
        {girl && style === 3 ? <path d="M15 34c-1-14 6-21 17-21s18 7 17 21c0 5-2 8-5 9V32H20v11c-3-1-5-4-5-9z" fill={hair} /> : null}
        {!girl && style === 2 ? <g fill={hair}><circle cx="18" cy="26" r="7" /><circle cx="46" cy="26" r="7" /><circle cx="23" cy="15" r="8" /><circle cx="41" cy="15" r="8" /><circle cx="32" cy="12" r="8" /></g> : null}

        <path d="M10 70c0-12 9-19 22-19s22 7 22 19z" fill={shirt} />
        <rect fill={skin} height="10" rx="3" width="8" x="28" y="42" />
        <circle cx="32" cy="32" fill={skin} r="15" />
        <circle cx="17.5" cy="34" fill={skin} r="2.6" />
        <circle cx="46.5" cy="34" fill={skin} r="2.6" />

        {/* hair in front */}
        {girl ? fringe : null}
        {!girl && style === 0 ? <path d="M17 29c0-10 6-15 15-15s15 5 15 15c-4-5-9-7-15-7s-11 2-15 7z" fill={hair} /> : null}
        {!girl && style === 1 ? <path d="M17.5 28c1-8 6-12 14.5-12s13.5 4 14.5 12c-3-3-8-5-14.5-5s-11.5 2-14.5 5z" fill={hair} /> : null}
        {!girl && style === 2 ? <path d="M18 27c3-6 8-8 14-8s11 2 14 8c-4-3-8-4-14-4s-10 1-14 4z" fill={hair} /> : null}
        {!girl && style === 3 ? <><path d="M16 31c-1-11 6-18 16-18s17 7 16 18c-2-4-4-7-6-8-7 4-17 4-26 8z" fill={hair} /><path d="M45 14l5-4-1 7z" fill={hair} /></> : null}

        {look.beard ? <path d="M17.5 36c0 10 6 15 14.5 15s14.5-5 14.5-15c-3 5-7 8-14.5 8s-11.5-3-14.5-8z" fill={hair} /> : null}

        <path d="M22 28.6c1.5-1 3.5-1 5 0M37 28.6c1.5-1 3.5-1 5 0" fill="none" stroke={hair} strokeLinecap="round" strokeWidth="1.4" />
        <circle cx="25.5" cy="33" fill="#2b2b2b" r="1.9" />
        <circle cx="38.5" cy="33" fill="#2b2b2b" r="1.9" />
        {girl ? <path d="M22.8 31.6l-1.6-1.2M41.2 31.6l1.6-1.2" fill="none" stroke="#2b2b2b" strokeLinecap="round" strokeWidth="1.3" /> : null}
        <circle cx="21.5" cy="38" fill="#ff8aa0" opacity="0.45" r="2.8" />
        <circle cx="42.5" cy="38" fill="#ff8aa0" opacity="0.45" r="2.8" />
        {look.freckles ? <g fill="#b9714a" opacity="0.75"><circle cx="22" cy="35.5" r="0.8" /><circle cx="24.4" cy="37" r="0.8" /><circle cx="26.8" cy="36" r="0.8" /><circle cx="42" cy="35.5" r="0.8" /><circle cx="39.6" cy="37" r="0.8" /><circle cx="37.2" cy="36" r="0.8" /></g> : null}
        {look.mouth === 0 ? <path d="M27 41c2 3 8 3 10 0" fill="none" stroke="#7b3b2e" strokeLinecap="round" strokeWidth="1.8" /> : null}
        {look.mouth === 1 ? <path d="M27 40c2 5 8 5 10 0z" fill="#7b3b2e" /> : null}
        {look.mouth === 2 ? <path d="M28 41c2 2 6 2 8 0" fill="none" stroke="#7b3b2e" strokeLinecap="round" strokeWidth="1.8" /> : null}
        {look.earrings ? <g fill="#f3c969"><circle cx="17.2" cy="39" r="1.5" /><circle cx="46.8" cy="39" r="1.5" /></g> : null}
        {look.glasses ? <g fill="none" stroke="#2b2b2b" strokeWidth="1.6"><circle cx="25.5" cy="32" r="5" /><circle cx="38.5" cy="32" r="5" /><path d="M30.5 32h3" /></g> : null}
        {look.hat ? <><path d="M16 24c0-10 7-15 16-15s16 5 16 15z" fill={hatColor} /><rect fill={hatBand} height="5" rx="2.5" width="36" x="14" y="22" /><circle cx="32" cy="8" fill={hatBand} r="3" /></> : null}
      </g>
    </svg>
  );
}
