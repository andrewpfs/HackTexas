const skins = ["#f6d3b8", "#e9b48f", "#c98c63", "#8d5a3c", "#5f3b28"];
const hairs = ["#2b1d16", "#5a3825", "#a8672c", "#d9a441", "#c8483a", "#3b3f66"];
const backgrounds = ["#fbe4d9", "#daf0ea", "#e7e2f5", "#fff1c7", "#d8e9f7", "#ffe0ea"];
const shirts = ["#173f50", "#e4664f", "#52766c", "#7a5ea8", "#d99a1e", "#2f6fa3"];

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

// A friendly cartoon face. Every traveler gets the same face each time, drawn from their id.
export function Avatar({ seed, size = 52, label }: { seed: string; size?: number; label?: string }) {
  const h = hash(seed);
  const skin = skins[h % skins.length];
  const hair = hairs[(h >> 3) % hairs.length];
  const background = backgrounds[(h >> 5) % backgrounds.length];
  const shirt = shirts[(h >> 7) % shirts.length];
  const style = (h >> 9) % 5;
  const mouth = (h >> 12) % 3;
  const accessory = (h >> 14) % 4 === 0 ? 1 : (h >> 14) % 4 === 1 ? 2 : 0;
  const hatColor = shirts[((h >> 7) + 2) % shirts.length];
  const clipId = `avatar-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg aria-label={label} aria-hidden={label ? undefined : true} height={size} role={label ? "img" : undefined} viewBox="0 0 64 64" width={size}>
      <clipPath id={clipId}><circle cx="32" cy="32" r="32" /></clipPath>
      <circle cx="32" cy="32" fill={background} r="32" />
      <g clipPath={`url(#${clipId})`}>
        {style === 2 ? <path d="M15 31c0-14 7-20 17-20s17 6 17 20v17c0 3-3 4-6 3V34H21v17c-3 1-6 0-6-3z" fill={hair} /> : null}
        {style === 1 ? <circle cx="32" cy="9.5" fill={hair} r="6.5" /> : null}
        {style === 3 ? <g fill={hair}><circle cx="18" cy="26" r="7" /><circle cx="46" cy="26" r="7" /><circle cx="23" cy="15" r="8" /><circle cx="41" cy="15" r="8" /><circle cx="32" cy="12" r="8" /></g> : null}
        <path d="M10 70c0-12 9-19 22-19s22 7 22 19z" fill={shirt} />
        <rect fill={skin} height="10" rx="3" width="8" x="28" y="42" />
        <circle cx="32" cy="32" fill={skin} r="15" />
        <circle cx="17.5" cy="34" fill={skin} r="2.6" />
        <circle cx="46.5" cy="34" fill={skin} r="2.6" />
        {style === 0 ? <path d="M17 29c0-10 6-15 15-15s15 5 15 15c-4-5-9-7-15-7s-11 2-15 7z" fill={hair} /> : null}
        {style === 1 || style === 2 ? <path d="M17 29c1-9 6-14 15-14s14 5 15 14c-5-2-8-7-10-9-3 5-12 8-20 9z" fill={hair} /> : null}
        {style === 3 ? <path d="M18 27c3-6 8-8 14-8s11 2 14 8c-4-3-8-4-14-4s-10 1-14 4z" fill={hair} /> : null}
        {style === 4 ? <><path d="M16 31c-1-11 6-18 16-18s17 7 16 18c-2-4-4-7-6-8-7 4-17 4-26 8z" fill={hair} /><path d="M45 14l5-4-1 7z" fill={hair} /></> : null}
        <circle cx="25.5" cy="33" fill="#2b2b2b" r="1.9" />
        <circle cx="38.5" cy="33" fill="#2b2b2b" r="1.9" />
        <circle cx="21.5" cy="38" fill="#ff8aa0" opacity="0.45" r="2.8" />
        <circle cx="42.5" cy="38" fill="#ff8aa0" opacity="0.45" r="2.8" />
        {mouth === 0 ? <path d="M27 41c2 3 8 3 10 0" fill="none" stroke="#7b3b2e" strokeLinecap="round" strokeWidth="1.8" /> : null}
        {mouth === 1 ? <path d="M27 40c2 5 8 5 10 0z" fill="#7b3b2e" /> : null}
        {mouth === 2 ? <path d="M28 41c2 2 6 2 8 0" fill="none" stroke="#7b3b2e" strokeLinecap="round" strokeWidth="1.8" /> : null}
        {accessory === 1 ? <g fill="none" stroke="#2b2b2b" strokeWidth="1.6"><circle cx="25.5" cy="32" r="5" /><circle cx="38.5" cy="32" r="5" /><path d="M30.5 32h3" /></g> : null}
        {accessory === 2 ? <><path d="M16 24c0-10 7-15 16-15s16 5 16 15z" fill={hatColor} /><rect fill={shirts[((h >> 7) + 3) % shirts.length]} height="5" rx="2.5" width="36" x="14" y="22" /><circle cx="32" cy="8" fill={shirts[((h >> 7) + 3) % shirts.length]} r="3" /></> : null}
      </g>
    </svg>
  );
}
