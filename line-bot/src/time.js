import { TZ } from "./data.js";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const DOW_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** 把任意時間換算成台北時間的欄位。date 預設是現在。 */
export function taipei(date = new Date()) {
  const parts = {};
  for (const p of PARTS.formatToParts(date)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dow: DOW_INDEX[parts.weekday],
    mins: hour * 60 + Number(parts.minute),
    iso: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** 兩個 YYYY-MM-DD 之間相差幾天。 */
export function daysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/** 收下 2026-08-15 或 8/15 兩種寫法。 */
export function parseDate(text, todayIso) {
  const t = (text || "").trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const year = Number(todayIso.slice(0, 4));
    const guess = `${year}-${pad(m[1])}-${pad(m[2])}`;
    return guess > todayIso ? `${year - 1}-${pad(m[1])}-${pad(m[2])}` : guess;
  }
  if (/^(今天|today)$/i.test(t)) return todayIso;
  return null;
}

function pad(n) {
  return String(n).padStart(2, "0");
}
