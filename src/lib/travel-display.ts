import type { Booking, FlightOption, Trip } from "./trip-types";
import { hotelPriceTotal } from "./hotel-display";
import { getHotelStays, groupLodgers, selectedGroupHotel, stayNights } from "./hotel-stays";

export function flightHighlights(options: FlightOption[]) {
  let cheapest: number | null = null;
  let shortest: number | null = null;
  for (const option of options) {
    if (Number.isFinite(option.price) && option.price >= 0 && (cheapest === null || option.price < cheapest)) cheapest = option.price;
    if (Number.isFinite(option.durationMinutes) && option.durationMinutes > 0 && (shortest === null || option.durationMinutes < shortest)) shortest = option.durationMinutes;
  }
  return { cheapest, shortest };
}

// What a traveler sharing the group hotel owes whoever booked it, summed over every stay.
export function hotelShareForTraveler(trip: Trip, travelerId: string) {
  const traveler = trip.travelers.find((item) => item.id === travelerId);
  if (!traveler || !groupLodgers(trip).some((item) => item.id === travelerId)) return undefined;
  const count = Math.max(1, groupLodgers(trip).length);
  let amount = 0;
  const names: string[] = [];
  let booker: Trip["travelers"][number] | undefined;
  for (const { plan, result } of getHotelStays(trip)) {
    const hotel = selectedGroupHotel(result);
    if (!hotel || !result || result.selectedByTravelerId === travelerId) continue;
    const total = hotelPriceTotal(hotel, stayNights(plan));
    const stayBooker = trip.travelers.find((item) => item.id === result.selectedByTravelerId);
    if (total === null || !stayBooker) continue;
    booker = stayBooker;
    amount += total / count;
    names.push(hotel.name);
  }
  if (!booker || names.length === 0) return undefined;
  return { bookerName: booker.name, hotelName: names.join(" + "), amount, confirmationCode: trip.travel?.bookings?.[booker.id]?.items.find((item) => item.kind === "hotel")?.confirmationCode };
}

export function bookingConfirmationText(tripName: string, booking: Booking, hotelShare = booking.hotelShare) {
  const lines = [tripName, "Booking Confirmation", ""];
  for (const item of booking.items) {
    lines.push(`${item.kind === "flight" ? "Flight" : "Hotel"}: ${item.label}`, item.detail, `Confirmation: ${item.confirmationCode}`, `Amount: $${item.amount.toFixed(2)}`, "");
  }
  lines.push(`Total: $${booking.total.toFixed(2)}`);
  if (hotelShare) {
    lines.push(`Hotel: ${hotelShare.hotelName}`, `You owe ${hotelShare.bookerName} about $${hotelShare.amount.toFixed(2)} for your hotel share (separate from your payment).`);
    if (hotelShare.confirmationCode) lines.push(`Group hotel confirmation: ${hotelShare.confirmationCode}`);
  }
  lines.push("These are TravelSync booking codes. Pay the airline and hotel directly.");
  return lines.join("\n");
}
