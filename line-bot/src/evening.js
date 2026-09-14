/**
 * 今晚誰做 A、誰做 B。每天輪一次。
 *
 * 機器人不知道哪個 LINE 帳號是爸爸、哪個是媽媽，所以只排 A/B 對應到爸媽，
 * 輪錯了就打「換班」把順序翻過來。
 */
import { EVENING } from "./data.js";

const DAY = 86400000;

/** 從 1970 算到今天是第幾天，用來決定今天輪到誰。 */
function dayIndex(iso) {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
}

export function tonight(iso, offset = 0) {
  const dadIsA = (dayIndex(iso) + Number(offset || 0)) % 2 === 0;
  return {
    dadIsA,
    a: { who: dadIsA ? "爸爸" : "媽媽", ...EVENING.A },
    b: { who: dadIsA ? "媽媽" : "爸爸", ...EVENING.B },
  };
}

/** 明天輪到誰——19:30 那則順便講，才知道今天累不累是暫時的。 */
export function tomorrow(iso, offset = 0) {
  const next = new Date(Date.parse(`${iso}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
  return tonight(next, offset);
}
