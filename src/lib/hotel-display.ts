import type { HotelOption } from "./trip-types";

export function expediaSearchUrl() {
  // Expedia's real search entry point; no guessed destination IDs or deep-link schema.
  return "https://www.expedia.com/Hotels";
}

export function hotelPage(options: HotelOption[], requestedPage: number) {
  const totalPages = Math.ceil(Math.min(options.length, 27) / 9);
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, totalPages));
  return { page, totalPages, options: options.slice((page - 1) * 9, Math.min(page * 9, 27)) };
}

export function hotelProviderLabel(hotel: HotelOption) {
  return hotel.provider === "expedia" ? "Expedia Result" : "Google Hotels Result";
}

export function hotelPriceTotal(hotel: HotelOption, nights: number): number | null {
  if (hotel.totalPrice !== null) return hotel.totalPrice;
  if (hotel.pricePerNight !== null) return hotel.pricePerNight * nights;
  return null;
}
