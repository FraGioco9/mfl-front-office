export const TIME_ZONE = "Europe/Rome";
export const MAX_PRIMARY_DELAY_MINUTES = 20;
export const ALLOWED_TARGETS = new Set(["10:20", "19:03", "23:03"]);

function partsFor(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    offset: String(parts.timeZoneName || "GMT+00:00").replace(/^GMT/, "") || "+00:00",
  };
}

function previousDate(year, month, day) {
  const value = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function resolveDueOccurrence(now, target, options = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }
  if (!ALLOWED_TARGETS.has(target)) {
    throw new RangeError(`Unsupported refresh target: ${target}`);
  }

  const maxDelayMinutes = options.maxDelayMinutes ?? MAX_PRIMARY_DELAY_MINUTES;
  const local = partsFor(now, options.timeZone || TIME_ZONE);
  const [targetHour, targetMinute] = target.split(":").map(Number);
  const currentMinuteOfDay = local.hour * 60 + local.minute;
  const targetMinuteOfDay = targetHour * 60 + targetMinute;
  let delayMinutes = currentMinuteOfDay - targetMinuteOfDay;
  let occurrenceDate = { year: local.year, month: local.month, day: local.day };

  if (delayMinutes < 0) {
    delayMinutes += 24 * 60;
    occurrenceDate = previousDate(local.year, local.month, local.day);
  }

  if (delayMinutes > maxDelayMinutes) {
    return null;
  }

  const dateText = `${occurrenceDate.year}-${pad(occurrenceDate.month)}-${pad(occurrenceDate.day)}`;
  const occurrenceKey = `${occurrenceDate.year}${pad(occurrenceDate.month)}${pad(occurrenceDate.day)}-${pad(targetHour)}${pad(targetMinute)}`;
  return {
    occurrenceKey,
    intendedAt: `${dateText}T${pad(targetHour)}:${pad(targetMinute)}:00${local.offset}`,
    delayMinutes,
    localNow: `${local.year}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}`,
  };
}
