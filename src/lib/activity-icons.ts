// Shared by the sketch, candidate options, and the canonical itinerary.
function iconForText(value: string) {
  const text = value.toLowerCase();
  if (/hotel|lodging|check[ -]?in|check[ -]?out|hostel|resort|airbnb/.test(text)) return "🏨";
  if (/\bland(?:ing)?\b|\barrival\b|arriv.*(?:airport|flight)|flight.*arriv/.test(text)) return "🛬";
  if (/flight|take[ -]?off|departure|depart.*airport/.test(text)) return "🛫";
  if (/train|rail|shinkansen/.test(text)) return "🚆";
  if (/food|meal|dinner|lunch|breakfast|ramen|caf[eé]|restaurant/.test(text)) return "🍽️";
  return "📍";
}

export function activityIcon(activity: { title: string; description?: string; type?: string }) {
  const titleIcon = iconForText(activity.title);
  if (titleIcon !== "📍") return titleIcon;
  return iconForText(`${activity.description ?? ""} ${activity.type ?? ""}`);
}
