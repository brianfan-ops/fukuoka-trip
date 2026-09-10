/**
 * 排程推播。每天 21:30 一則，週日那則後面接下週討論清單。
 * 合成一則是刻意的：免費方案的主動訊息有額度，cron 觸發器整個帳號也只有 5 個。
 */
import { DOW, LAUNDRY, NIGHTLY, THEMES, isWeekday } from "./data.js";
import { lowfreqStatus, weekAgenda } from "./router.js";
import { draw } from "./hobbies.js";
import { drawNote, NOTE_KIND } from "./notes.js";
import { daysBetween } from "./time.js";
import * as store from "./store.js";
import { text, quick } from "./line.js";

const MENU = quick([
  { label: "待辦", text: "待辦" },
  { label: "今天", text: "今天" },
  { label: "家事", text: "家事" },
]);

/** 每天 21:30 推的那一則；星期五會多接這週的討論清單。 */
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
  if (now.dow === 5) {
    lines.push("", "──────────", "", ...(await agendaLines(kv, now)));
  }

  return text(lines.join("\n"), MENU);
}

/**
 * 每天 11:15 的那一句。挑這個時間是因為媽媽從 08:30 起就單獨帶妹妹，
 * 到這時剛好第三個小時，疲勞感開始出現，午餐又還沒著落。
 */
export async function noteMessage(kv, now) {
  const state = await store.getNotes(kv);
  if (state.off) return null;

  const [todos, lowfreq] = await Promise.all([store.listTodos(kv), store.getLowfreq(kv)]);
  const { note, bag } = drawNote(state, { now, todos, lowfreq });
  if (!note) return null;
  await store.saveNotes(kv, { bag });

  return text(
    `${NOTE_KIND[note.kind]}\n\n${note.text}`,
    quick([
      { label: "再一句", text: "一句" },
      { label: "今天", text: "今天" },
      { label: "不要每天發", text: "一句 關" },
    ]),
  );
}

/** 週五附在後面的討論清單，只列還沒回答的。 */
async function agendaLines(kv, now) {
  const { items } = await weekAgenda({ kv, now });
  const open = items.map((it, i) => [i + 1, it]).filter(([, it]) => !it.answer);

  if (!open.length) return ["這週的討論都回答完了，確認一下有沒有要改的。"];
  return [
    `這週的討論 · 還有 ${open.length}/${items.length} 題`,
    "",
    ...open.map(([no, it]) => `${no}. ${it.first ? "【先決定】" : ""}${it.text}`),
    "",
    "照編號回一句就記下來，例如「3. 先試一週」。",
  ];
}

/**
 * 每週三、週日的 23:00 爸媽時間丟一項興趣。
 * 挑這個時段是因為整份作息裡，那是唯一沒有小孩、兩個人都在的一小時。
 */
export async function hobbyMessage(kv, now) {
  const state = await store.getHobbies(kv);
  const { hobby, example, bag } = draw(state);
  await store.saveHobbies(kv, { bag });

  const last = state.done?.[hobby.id];
  const gap = last ? `上次碰是 ${daysBetween(last, now.iso)} 天前` : "還沒記錄過這一項";

  return text(
    [
      `23:00 爸媽時間 · 今晚抽到「${hobby.name}」`,
      "",
      `例如：${example}`,
      hobby.examples.filter((e) => e !== example).join("、"),
      "",
      hobby.point,
      "",
      gap,
      "",
      "沒力氣就跳過，這不是待辦。",
    ].join("\n"),
    quick([
      { label: `做了${hobby.name}`, data: `hb:${hobby.id}` },
      { label: "換一個", text: "興趣" },
      { label: "看八項", text: "興趣 清單" },
    ]),
  );
}
