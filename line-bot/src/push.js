/**
 * 排程推播。免費方案的主動訊息有額度，所以每一則都要有存在的理由：
 * 11:15 一句話、19:30 今晚分工、週三日 23:00 一項興趣。
 * 週五的討論清單掛在 11:15 那則後面，不另外發。
 */
import { LAUNDRY } from "./data.js";
import { buildSplit, weekAgenda } from "./router.js";
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

/**
 * 19:30 的今晚分工。原本排在 21:30，但分工是從洗澡開始的——
 * 提醒要落在事情開始的那一刻，不是結束之後。
 */
export async function eveningMessage(kv, now) {
  return buildSplit({ kv, now });
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

  const extra = [`今天洗：${LAUNDRY[now.dow].wash}`];
  if (now.dow === 5) extra.push("", ...(await agendaLines(kv, now)));

  return text(
    `${NOTE_KIND[note.kind]}\n\n${note.text}\n\n──────────\n\n${extra.join("\n")}`,
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
