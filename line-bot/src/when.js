/**
 * 從一句話裡讀出時間，例如「明天9點打疫苗」→ 明天 09:00。
 *
 * 時間一律用台北時間的「YYYY-MM-DDTHH:MM」字串表示：
 * 這樣比大小就是字串比大小，不用處理時區換算。
 */

const CN_NUM = {
  零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12,
};

const WEEKDAY = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

/** 一天裡沒指定時間時的預設，以及「早上」這類詞對應的鐘點。 */
const PERIOD = { 早上: 9, 上午: 9, 中午: 12, 下午: 14, 傍晚: 17, 晚上: 20, 半夜: 0 };
const DEFAULT_HOUR = 9;

function pad(n) {
  return String(n).padStart(2, "0");
}

function toNumber(token) {
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  if (token in CN_NUM) return CN_NUM[token];
  const m = token.match(/^十([一二三四五六七八九])$/);
  if (m) return 10 + CN_NUM[m[1]];
  return null;
}

/** 以台北日期做加減，避免月底跨月算錯。 */
function addDays({ year, month, day }, delta) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
  };
}

function iso({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function findDate(text, now) {
  let m = text.match(/(大後天|後天|明天|明日|今天|今日)/);
  if (m) {
    const delta = { 今天: 0, 今日: 0, 明天: 1, 明日: 1, 後天: 2, 大後天: 3 }[m[1]];
    return { date: addDays(now, delta), matched: m[1] };
  }

  m = text.match(/(下週|下星期|下禮拜|這週|本週|週|星期|禮拜)([一二三四五六日天])/);
  if (m) {
    const target = WEEKDAY[m[2]];
    let delta = (target - now.dow + 7) % 7;
    if (/^下/.test(m[1])) delta += 7;
    else if (delta === 0) delta = 7; // 「週四」在星期四當天講，指的是下一個週四
    return { date: addDays(now, delta), matched: m[0] };
  }

  m = text.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*(?:日|號)?/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const thisYear = { year: now.year, month, day };
      const past = iso(thisYear) < iso(now);
      return { date: past ? { ...thisYear, year: now.year + 1 } : thisYear, matched: m[0] };
    }
  }

  return null;
}

function findTime(text) {
  let m = text.match(/(早上|上午|中午|下午|傍晚|晚上|半夜)?\s*(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) return { hour: shift(Number(m[2]), m[1]), minute: Number(m[3]), matched: m[0] };

  m = text.match(/(早上|上午|中午|下午|傍晚|晚上|半夜)?\s*(\d{1,2}|十[一二]?|[一二兩三四五六七八九])\s*點\s*(半|\d{1,2}\s*分)?/);
  if (m) {
    const hour = toNumber(m[2].trim());
    if (hour !== null && hour <= 24) {
      const tail = (m[3] || "").trim();
      const minute = tail === "半" ? 30 : tail ? Number(tail.replace(/\D/g, "")) : 0;
      return { hour: shift(hour, m[1]), minute, matched: m[0] };
    }
  }

  m = text.match(/(早上|上午|中午|下午|傍晚|晚上|半夜)/);
  if (m) return { hour: PERIOD[m[1]], minute: 0, matched: m[1] };

  return null;
}

/** 「下午3點」要變成 15 點；已經寫成 15 點的就不動。 */
function shift(hour, period) {
  if (!period) return hour % 24;
  if ((period === "下午" || period === "傍晚" || period === "晚上") && hour < 12) return hour + 12;
  if (period === "中午" && hour < 12) return hour === 12 ? 12 : hour + 12;
  if (period === "半夜" && hour === 12) return 0;
  return hour % 24;
}

function label(due, now) {
  const [datePart, timePart] = due.split("T");
  const today = iso(now);
  const tomorrow = iso(addDays(now, 1));
  if (datePart === today) return `今天 ${timePart}`;
  if (datePart === tomorrow) return `明天 ${timePart}`;
  const [, month, day] = datePart.split("-");
  const d = new Date(`${datePart}T00:00:00Z`);
  return `${Number(month)}/${Number(day)}（週${"日一二三四五六"[d.getUTCDay()]}） ${timePart}`;
}

/**
 * 讀不出時間就回 null——讀不準的時候寧可當成沒有時間的待辦，
 * 也不要默默排在一個使用者沒預期的時間點。
 */
export function parseWhen(text, now) {
  const raw = String(text || "");

  const soon = raw.match(/(\d{1,3})\s*(分鐘|分)後/);
  if (soon) {
    const total = now.mins + Number(soon[1]);
    const date = addDays(now, Math.floor(total / 1440));
    const mins = ((total % 1440) + 1440) % 1440;
    const due = `${iso(date)}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    return { due, label: label(due, now), matched: soon[0] };
  }

  const hours = raw.match(/(\d{1,2}|半|[一二兩三四五六七八九十])\s*(小時|鐘頭)後/);
  if (hours) {
    const value = hours[1] === "半" ? 0.5 : toNumber(hours[1]);
    if (value !== null) {
      const total = now.mins + Math.round(value * 60);
      const date = addDays(now, Math.floor(total / 1440));
      const mins = ((total % 1440) + 1440) % 1440;
      const due = `${iso(date)}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
      return { due, label: label(due, now), matched: hours[0] };
    }
  }

  const date = findDate(raw, now);
  const time = findTime(raw);
  if (!date && !time) return null;

  let target = date ? date.date : now;
  const hour = time ? time.hour : DEFAULT_HOUR;
  const minute = time ? time.minute : 0;

  // 只寫時間沒寫日期：今天還沒到就今天，過了就明天
  if (!date) {
    const atMins = hour * 60 + minute;
    if (atMins <= now.mins) target = addDays(now, 1);
  }

  const due = `${iso(target)}T${pad(hour)}:${pad(minute)}`;
  return {
    due,
    label: label(due, now),
    matched: [date?.matched, time?.matched].filter(Boolean).join(" "),
  };
}

/** 現在的台北時間，格式跟 due 一樣，可以直接比大小。 */
export function nowStamp(now) {
  return `${iso(now)}T${pad(Math.floor(now.mins / 60))}:${pad(now.mins % 60)}`;
}
