export type AvatarGender = "boy" | "girl";

export type AvatarLook = {
  gender: AvatarGender;
  skin: number;
  hair: number;
  style: number;
  background: number;
  shirt: number;
  mouth: number;
  glasses: boolean;
  hat: boolean;
  freckles: boolean;
  beard: boolean;
  earrings: boolean;
};

export const skinTones = ["#f6d3b8", "#e9b48f", "#c98c63", "#8d5a3c", "#5f3b28"];
export const hairColors = ["#2b1d16", "#5a3825", "#a8672c", "#d9a441", "#c8483a", "#3b3f66", "#9aa0a6"];
export const backgroundColors = ["#fbe4d9", "#daf0ea", "#e7e2f5", "#fff1c7", "#d8e9f7", "#ffe0ea"];
export const shirtColors = ["#173f50", "#e4664f", "#52766c", "#7a5ea8", "#d99a1e", "#2f6fa3"];
export const hairStyleNames: Record<AvatarGender, string[]> = {
  boy: ["Short", "Buzz", "Curly", "Swoop"],
  girl: ["Bun", "Long", "Ponytail", "Bob"],
};

const mouthCount = 3;

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

function finishLook(look: AvatarLook): AvatarLook {
  // Beards and earrings only belong to one look each.
  return { ...look, beard: look.gender === "boy" && look.beard, earrings: look.gender === "girl" && look.earrings };
}

// The look a traveler has until they pick their own, the same every time for the same id.
export function lookFromSeed(seed: string): AvatarLook {
  const h = hash(seed);
  const gender: AvatarGender = h % 2 === 0 ? "boy" : "girl";
  return finishLook({
    gender,
    skin: (h >> 1) % skinTones.length,
    hair: (h >> 4) % hairColors.length,
    style: (h >> 7) % 4,
    background: (h >> 9) % backgroundColors.length,
    shirt: (h >> 12) % shirtColors.length,
    mouth: (h >> 15) % mouthCount,
    glasses: (h >> 17) % 4 === 0,
    hat: (h >> 19) % 5 === 0,
    freckles: (h >> 21) % 4 === 0,
    beard: (h >> 23) % 4 === 0,
    earrings: (h >> 25) % 2 === 0,
  });
}

function pick(count: number) {
  return Math.floor(Math.random() * count);
}

export function randomLook(gender: AvatarGender = Math.random() < 0.5 ? "boy" : "girl"): AvatarLook {
  return finishLook({
    gender,
    skin: pick(skinTones.length),
    hair: pick(hairColors.length),
    style: pick(4),
    background: pick(backgroundColors.length),
    shirt: pick(shirtColors.length),
    mouth: pick(mouthCount),
    glasses: Math.random() < 0.25,
    hat: Math.random() < 0.15,
    freckles: Math.random() < 0.3,
    beard: Math.random() < 0.3,
    earrings: Math.random() < 0.6,
  });
}

function inRange(value: unknown, count: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

// Checks a look sent from a browser before it is stored.
export function normalizeLook(value: unknown): AvatarLook | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const look = value as Record<string, unknown>;
  if (
    (look.gender !== "boy" && look.gender !== "girl") ||
    !inRange(look.skin, skinTones.length) ||
    !inRange(look.hair, hairColors.length) ||
    !inRange(look.style, 4) ||
    !inRange(look.background, backgroundColors.length) ||
    !inRange(look.shirt, shirtColors.length) ||
    !inRange(look.mouth, mouthCount) ||
    [look.glasses, look.hat, look.freckles, look.beard, look.earrings].some((flag) => typeof flag !== "boolean")
  ) {
    return null;
  }

  return finishLook(look as AvatarLook);
}
