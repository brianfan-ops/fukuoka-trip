/**
 * 產生 iCalendar（.ics）給手機的行事曆訂閱。
 *
 * 只放「會變動、需要提前知道」的事：有排時間的待辦、長週期家事的下次到期、
 * 週五的爸媽時間、平日的上下學定點。
 *
 * 洗衣輪值和主題日刻意不放——機器人每天 21:30 就會推，
 * 再塞進行事曆只會變成每天七件重複的雜訊。
 */
import { LOWFREQ } from "./data.js";
import { shiftIso } from "./when.js";

const TZ_OFFSET_MIN = 8 * 60; // 台灣沒有日光節約，固定 UTC+8

/** 逗號、分號、換行在 ICS 裡有語法意義，要轉義。 */
function esc(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 台北的「YYYY-MM-DDTHH:MM」轉成 ICS 的 UTC 時間戳。 */
export function toUtcStamp(local) {
  const [date, time = "00:00"] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = Date.UTC(y, m - 1, d, hh, mm) - TZ_OFFSET_MIN * 60000;
  return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dateOnly(iso) {
  return iso.replace(/-/g, "");
}

function event({ uid, start, end, allDay, summary, description, rrule, stamp }) {
  const lines = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`];
  if (allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly(end)}`);
  } else {
    lines.push(`DTSTART:${toUtcStamp(start)}`, `DTEND:${toUtcStamp(end)}`);
  }
  if (rrule) lines.push(`RRULE:${rrule}`);
  lines.push(`SUMMARY:${esc(summary)}`);
  if (description) lines.push(`DESCRIPTION:${esc(description)}`);
  lines.push("END:VEVENT");
  return lines;
}

function nowStampUtc() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** 把 HH:MM 加上分鐘數，回傳同一天的 HH:MM（不跨日，夠用）。 */
function plus(time, minutes) {
  const [hh, mm] = time.split(":").map(Number);
  const total = Math.min(hh * 60 + mm + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildIcs({ todos, lowfreq, now, friday, stamp = nowStampUtc() }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//bbssfamily//family schedule//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:家的一日節奏",
    "X-WR-TIMEZONE:Asia/Taipei",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  // 有排時間的待辦：往前留 30 天，方便回頭看
  const from = shiftIso(now.iso, -30);
  for (const todo of todos) {
    if (!todo.due || todo.due.slice(0, 10) < from) continue;
    const [date, time] = todo.due.split("T");
    lines.push(
      ...event({
        uid: `todo-${todo.id}@bbssfamily`,
        stamp,
        start: `${date}T${time}`,
        end: `${date}T${plus(time, 30)}`,
        summary: `${todo.done ? "✓ " : ""}${todo.text}`,
        description: todo.by ? `${todo.by} 加的` : "",
      }),
    );
  }

  // 長週期家事的下次到期，用整天事件
  for (const item of LOWFREQ) {
    const last = lowfreq[item.id];
    if (!last) continue;
    const next = shiftIso(last, item.every);
    lines.push(
      ...event({
        uid: `chore-${item.id}-${next}@bbssfamily`,
        stamp,
        start: next,
        end: shiftIso(next, 1),
        allDay: true,
        summary: `${item.name} 該做了`,
        description: `上次 ${last} · 建議每 ${item.every} 天`,
      }),
    );
  }

  // 每週五的爸媽時間
  lines.push(
    ...event({
      uid: "weekly-talk@bbssfamily",
      stamp,
      start: `${friday}T23:00`,
      end: `${friday}T23:30`,
      rrule: "FREQ=WEEKLY;BYDAY=FR",
      summary: "爸媽時間 · 這週的討論",
      description: "在 LINE 打「討論」看清單",
    }),
  );

  // 平日的兩個定點
  const nextMonday = shiftIso(now.iso, ((8 - new Date(`${now.iso}T00:00:00Z`).getUTCDay()) % 7) || 7);
  lines.push(
    ...event({
      uid: "school-out@bbssfamily",
      stamp,
      start: `${nextMonday}T08:20`,
      end: `${nextMonday}T08:30`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      summary: "帶哥哥出門上學",
    }),
    ...event({
      uid: "school-pickup@bbssfamily",
      stamp,
      start: `${nextMonday}T17:50`,
      end: `${nextMonday}T18:05`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      summary: "接哥哥放學",
    }),
  );

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
