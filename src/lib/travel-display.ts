import type { Booking, FlightOption, Trip } from "./trip-types";

export function flightHighlights(options: FlightOption[]) {
  let cheapest: number | null = null;
  let shortest: number | null = null;
  for (const option of options) {
    if (Number.isFinite(option.price) && option.price >= 0 && (cheapest === null || option.price < cheapest)) cheapest = option.price;
    if (Number.isFinite(option.durationMinutes) && option.durationMinutes > 0 && (shortest === null || option.durationMinutes < shortest)) shortest = option.durationMinutes;
  }
  return { cheapest, shortest };
}

export function hotelShareForTraveler(trip: Trip, travelerId: string) {
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  const hotels = trip.travel?.hotels;
  const hotel = hotels?.options.find((item) => item.token === hotels.selectedToken);
  if (!traveler || traveler.preferences?.lodgingType === "No need" || !hotel || !hotels || hotels.selectedByTravelerId === travelerId) return undefined;
  const booker = trip.travelers.find((item) => item.id === hotels.selectedByTravelerId);
  if (!booker) return undefined;
  let count = 0;
  for (const member of trip.travelers) {
    if (member.preferences?.lodgingType !== "No need") count += 1;
  }
  const nights = Math.max(1, Math.round((Date.parse(hotels.checkOut) - Date.parse(hotels.checkIn)) / 86400000));
  const total = hotel.totalPrice ?? (hotel.pricePerNight ?? 0) * nights;
  return { bookerName: booker.name, hotelName: hotel.name, amount: total / Math.max(1, count), confirmationCode: trip.travel?.bookings?.[booker.id]?.items.find((item) => item.kind === "hotel")?.confirmationCode };
}

export function bookingConfirmationText(tripName: string, booking: Booking, hotelShare = booking.hotelShare) {
  const lines = [tripName, "Booking Confirmation", ""];
  for (const item of booking.items) {
    lines.push(`${item.kind === "flight" ? "Flight" : "Hotel"}: ${item.label}`, item.detail, `Confirmation: ${item.confirmationCode}`, `Amount: $${item.amount.toFixed(2)}`, "");
  }
  lines.push(`Amount paid${booking.items.some((item) => item.source === "assistant") ? " (recorded)" : " (simulated)"}: $${booking.total.toFixed(2)}`);
  if (hotelShare) {
    lines.push(`Hotel: ${hotelShare.hotelName}`, `You owe ${hotelShare.bookerName} about $${hotelShare.amount.toFixed(2)} for your hotel share (separate from your payment).`);
    if (hotelShare.confirmationCode) lines.push(`Group hotel confirmation: ${hotelShare.confirmationCode}`);
  }
  lines.push("Demo items are simulated. No reservation or payment was made for demo items.");
  return lines.join("\n");
}
