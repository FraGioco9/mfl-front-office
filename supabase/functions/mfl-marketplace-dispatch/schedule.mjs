export const TIME_ZONE = "Europe/Rome";
export const MAX_DELAY_MINUTES = 10;
const QUARTER_HOUR_MINUTES = new Set([0, 15, 30, 45]);

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

function parseTarget(target) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(target || ""));
  if (!match) {
    throw new RangeError(`Unsupported Marketplace target: ${target}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || !QUARTER_HOUR_MINUTES.has(minute)) {
    throw new RangeError(`Unsupported Marketplace target: ${target}`);
  }
  return { hour, minute };
}

function offsetKey(offset) {
  const sign = offset.startsWith("-") ? "m" : "p";
  return `${sign}${offset.replace(/^[+-]/, "").replace(":", "")}`;
}

export function modeForTarget(target) {
  const { hour, minute } = parseTarget(target);
  return hour === 4 && minute === 0 ? "reconcile" : "incremental";
}

export function resolveDueOccurrence(now, target, options = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const { hour: targetHour, minute: targetMinute } = parseTarget(target);
  const maxDelayMinutes = options.maxDelayMinutes ?? MAX_DELAY_MINUTES;
  const local = partsFor(now, options.timeZone || TIME_ZONE);
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
  const targetText = `${pad(targetHour)}:${pad(targetMinute)}`;
  const occurrenceKey = `${occurrenceDate.year}${pad(occurrenceDate.month)}${pad(occurrenceDate.day)}-${pad(targetHour)}${pad(targetMinute)}-${offsetKey(local.offset)}`;
  return {
    occurrenceKey,
    intendedAt: `${dateText}T${targetText}:00${local.offset}`,
    delayMinutes,
    localNow: `${local.year}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}`,
    mode: modeForTarget(targetText),
    target: targetText,
  };
}
