// Shared by the sketch, candidate options, and the canonical itinerary.
function iconForText(value: string) {
  const text = value.toLowerCase();
  if (/hotel|lodging|check[ -]?in|check[ -]?out|hostel|resort|airbnb/.test(text)) return "🏨";
  if (/\bland(?:ing)?\b|\barrival\b|arriv.*(?:airport|flight)|flight.*arriv/.test(text)) return "🛬";
  if (/flight|take[ -]?off|departure|depart.*airport/.test(text)) return "🛫";
  if (/airport/.test(text)) return "✈️";
  if (/train|rail|shinkansen/.test(text)) return "🚆";
  if (/subway|metro|transit|\bbus\b|ferry|taxi|transfer/.test(text)) return "🚇";
  if (/sleep|\bnap\b|bedtime|early night|\brest\b|recover|jet ?lag/.test(text)) return "🛏️";
  if (/coffee|\btea\b|caf[eé]/.test(text)) return "☕";
  if (/food|meal|dinner|lunch|breakfast|brunch|ramen|restaurant|market|bites|snack/.test(text)) return "🍽️";
  if (/museum|gallery|exhibit/.test(text)) return "🏛️";
  if (/shrine|temple|church|cathedral/.test(text)) return "⛩️";
  if (/park|garden|forest|hike|nature/.test(text)) return "🌳";
  if (/beach|\bsea\b|coast/.test(text)) return "🏖️";
  if (/shop|mall|souvenir/.test(text)) return "🛍️";
  if (/\bbars?\b|club|nightlife|karaoke|drinks/.test(text)) return "🌃";
  if (/free time|wander|stroll|explore|walk/.test(text)) return "🚶";
  if (/\bspa\b|onsen|massage|relax/.test(text)) return "♨️";
  return "📍";
}

export function activityIcon(activity: { title: string; description?: string; type?: string }) {
  const titleIcon = iconForText(activity.title);
  if (titleIcon !== "📍") return titleIcon;
  return iconForText(`${activity.description ?? ""} ${activity.type ?? ""}`);
}
