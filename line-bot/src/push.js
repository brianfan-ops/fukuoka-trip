/**
 * 排程推播。每天 21:30 一則，週日那則後面接下週討論清單。
 * 合成一則是刻意的：免費方案的主動訊息有額度，cron 觸發器整個帳號也只有 5 個。
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

/** 每天 21:30 推的那一則；星期日會多接下週討論清單。 */
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
  if (now.dow === 0) {
    lines.push("", "──────────", "", ...agendaLines(open, await store.getAnswers(kv)));
  }
  return text(lines.join("\n"), MENU);
}

/** 週日附在後面的下週討論清單。已經有答案的收成一行。 */
function agendaLines(open, answers) {
  const undecided = AGENDA.map((a, i) => [i + 1, a]).filter(([no]) => !answers[String(no)]);
  const lines = [
    `下週行程討論 · 還有 ${undecided.length}/${AGENDA.length} 題沒決定`,
    "",
    ...undecided.map(([no, a]) => `${no}. ${a.first ? "【先決定】" : ""}${a.text}`),
  ];
  if (!undecided.length) lines.push("全部都有答案了，確認一下有沒有要改的。");
  lines.push("", "照編號回一句就記下來，例如「3. 先試一週」。");
  if (open.length) {
    lines.push("", `這週沒做完的 ${open.length} 件：`, ...open.slice(0, 8).map((t) => `· ${t.text}`));
  }
  return lines;
}
