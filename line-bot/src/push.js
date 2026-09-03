/**
 * 排程推播。免費方案的主動訊息有額度，所以一天最多一則、週日多一則。
 */
import { AGENDA, DOW, LAUNDRY, NIGHTLY, THEMES, isWeekday } from "./data.js";
import { lowfreqStatus } from "./router.js";
import * as store from "./store.js";
import { text, quick } from "./line.js";

const MENU = quick([
  { label: "待辦", text: "待辦" },
  { label: "今天", text: "今天" },
  { label: "家事", text: "家事" },
]);

/** 每天 21:30：今晚洗什麼、誰做、有沒有逾期的。 */
export async function nightlyMessage(kv, now) {
  const [todos, lfMap] = await Promise.all([store.listTodos(kv), store.getLowfreq(kv)]);
  const l = LAUNDRY[now.dow];
  const overdue = lowfreqStatus(lfMap, now.iso).filter((i) => i.overdue);
  const open = todos.filter((t) => !t.done);

  const lines = [
    `21:30 家事時間 · 週${DOW[now.dow]}`,
    "",
    `洗衣：${l.wash}`,
    `地板：${l.floor}`,
    `分工：${l.duty}`,
    "",
    `每晚固定：${NIGHTLY.join("、")}`,
  ];
  if (overdue.length) {
    lines.push("", `逾期：${overdue.map((o) => `${o.name}（${o.days} 天前）`).join("、")}`);
  }
  if (open.length) {
    lines.push("", `未完成待辦 ${open.length} 件：`, ...open.slice(0, 5).map((t) => `· ${t.text}`));
    if (open.length > 5) lines.push(`⋯ 還有 ${open.length - 5} 件`);
  }
  const tomorrow = THEMES[(now.dow + 1) % 7];
  if (tomorrow && isWeekday((now.dow + 1) % 7)) {
    lines.push("", `明天是${tomorrow.name}，記得先備：${tomorrow.prep}`);
  }
  return text(lines.join("\n"), MENU);
}

/** 週日 22:50：下週討論清單 ＋ 本週沒做完的。 */
export async function weeklyMessage(kv) {
  const todos = await store.listTodos(kv);
  const open = todos.filter((t) => !t.done);
  const lines = [
    "下週行程討論 · 15 分鐘就好",
    "",
    ...AGENDA.map((a, i) => `${i + 1}. ${a.first ? "【先決定】" : ""}${a.text}`),
  ];
  if (open.length) {
    lines.push("", `這週沒做完的 ${open.length} 件：`, ...open.slice(0, 8).map((t) => `· ${t.text}`));
  }
  return text(lines.join("\n"), MENU);
}
