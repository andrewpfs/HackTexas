export type CalendarMonth = {
  key: string;
  label: string;
  leadingBlankDays: number;
  dates: string[];
};

export type DateWindow = {
  startDate: string;
  endDate: string;
  dayCount: number;
};

export function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseISODate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateString: string, numberOfDays: number) {
  const date = parseISODate(dateString);
  date.setUTCDate(date.getUTCDate() + numberOfDays);
  return toISODate(date);
}

export function getDatesInRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = addDays(currentDate, 1);
  }

  return dates;
}

export function formatCalendarDate(dateString: string, includeYear = true) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };

  if (includeYear) {
    options.year = "numeric";
  }

  return new Intl.DateTimeFormat("en-US", options).format(parseISODate(dateString));
}

export function getCalendarMonths(startDate: string, endDate: string) {
  const months: CalendarMonth[] = [];
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  let year = start.getUTCFullYear();
  let monthIndex = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonthIndex = end.getUTCMonth();

  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    const firstDay = new Date(Date.UTC(year, monthIndex, 1));
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
    const numberOfDays = lastDay.getUTCDate();
    const dates: string[] = [];

    for (let day = 1; day <= numberOfDays; day += 1) {
      dates.push(toISODate(new Date(Date.UTC(year, monthIndex, day))));
    }

    months.push({
      key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(firstDay),
      leadingBlankDays: firstDay.getUTCDay(),
      dates,
    });

    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }

  return months;
}

export function findSharedDates(availableDateLists: string[][]) {
  if (availableDateLists.length === 0) {
    return [];
  }

  const sharedDates: string[] = [];
  const firstTravelerDates = availableDateLists[0];

  for (const date of firstTravelerDates) {
    let sharedByEveryone = true;

    for (let index = 1; index < availableDateLists.length; index += 1) {
      if (!availableDateLists[index].includes(date)) {
        sharedByEveryone = false;
        break;
      }
    }

    if (sharedByEveryone && !sharedDates.includes(date)) {
      sharedDates.push(date);
    }
  }

  sharedDates.sort();
  return sharedDates;
}

export function getContiguousDateWindows(dates: string[]) {
  const windows: DateWindow[] = [];

  if (dates.length === 0) {
    return windows;
  }

  const sortedDates = [...dates].sort();
  let startDate = sortedDates[0];
  let endDate = sortedDates[0];
  let dayCount = 1;

  for (let index = 1; index < sortedDates.length; index += 1) {
    const currentDate = sortedDates[index];
    if (currentDate === endDate) {
      continue;
    }

    if (currentDate === addDays(endDate, 1)) {
      endDate = currentDate;
      dayCount += 1;
    } else {
      windows.push({ startDate, endDate, dayCount });
      startDate = currentDate;
      endDate = currentDate;
      dayCount = 1;
    }
  }

  windows.push({ startDate, endDate, dayCount });
  return windows;
}
