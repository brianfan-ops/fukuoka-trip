/**
 * 指令解析與回應組裝。這一層不碰網路，方便測試。
 */
import {
  BLOCKS, DOW, LAUNDRY, LOWFREQ, SETUP, THEMES, WEEKLY, blockAt, hhmm, isWeekday,
} from "./data.js";
import { daysBetween, parseDate } from "./time.js";
import * as store from "./store.js";
import * as flex from "./flex.js";
import { installRichMenu } from "./richmenu.js";
import { parseWhen } from "./when.js";
import { text, quick } from "./line.js";

const COMMANDS = [
  { cmd: "today", words: ["今天", "今日", "today"] },
  { cmd: "week", words: ["一週", "本週", "這週", "週表", "week"] },
  { cmd: "todos", words: ["待辦", "清單", "完成", "todo", "list"] },
  { cmd: "chores", words: ["家事", "輪值", "洗衣"] },
  { cmd: "agenda", words: ["討論", "下週", "議題"] },
  { cmd: "rules", words: ["家規", "已定案", "定案"] },
  { cmd: "help", words: ["說明", "指令", "怎麼用", "help"] },
  { cmd: "menu", words: ["安裝選單", "裝選單", "選單", "menu"] },
];

/* 把「一週安排？」這種尾巴修掉，才對得上指令；「洗衣機壞了」不會被削成「洗衣」。 */
const PUNCT = /[\s?？!！。，,、~～]+$/;
const TAIL = /(安排|表格|表|清單|狀況|進度|一下|呢|嗎|吧|的)$/;

function normalize(raw) {
  let t = raw.replace(PUNCT, "");
  let prev;
  do {
    prev = t;
    t = t.replace(TAIL, "").replace(PUNCT, "");
  } while (t !== prev && t);
  return t;
}

/**
 * 把一句話拆成 {cmd, arg}。認不出來的一律當成新增待辦——
 * 「半夜想到明天要帶餐袋」丟一句話就進清單，是這個機器人最主要的用法。
 */
export function parse(input) {
  const raw = (input || "").replace(/　/g, " ").trim();
  if (!raw) return { cmd: "help", arg: "" };

  let m = raw.match(/^(?:完成|做完|done)[\s:：]*(\d+)$/i);
  if (m) return { cmd: "done", arg: m[1] };
  m = raw.match(/^(?:完成|做完|done)[\s:：]+(.+)$/is);
  if (m) return { cmd: "done", arg: m[1].trim() };

  // 討論 加 要不要換保母 → 丟一個議題進這週的清單
  m = raw.match(/^(?:討論|議題)[\s:：]*(?:加|新增|\+)[\s:：]*(.+)$/s);
  if (m) return { cmd: "topic", arg: m[1].trim() };

  // 討論 3 輪班制 → 記下第 3 題的答案
  m = raw.match(/^(?:討論|決定)[\s:：]+(\d{1,2})[\s.、):：]*(.+)$/s);
  if (m) return { cmd: "answers", arg: `${m[1]}. ${m[2].trim()}` };

  m = raw.match(/^(?:刪除|刪掉|刪|remove|delete)[\s:：]*(\d+)$/i);
  if (m) return { cmd: "remove", arg: m[1] };

  // 看完「討論」直接照編號回答，是最自然的用法——不能當成待辦吞掉
  if (numberedLines(raw).length >= 2) return { cmd: "answers", arg: raw };

  m = raw.match(/^(?:待辦|todo)[\s:：,，]+(.+)$/is);
  if (m) return { cmd: "add", arg: m[1].trim() };
  m = raw.match(/^[+＋]\s*(.+)$/s) || raw.match(/^(?:加|新增)[\s:：]+(.+)$/s);
  if (m) return { cmd: "add", arg: m[1].trim() };

  const key = normalize(raw);
  for (const entry of COMMANDS) {
    if (entry.words.includes(key)) return { cmd: entry.cmd, arg: "" };
  }
  return { cmd: "add", arg: raw };
}

/** 把「1. 輪班制」這種行拆成 [題號, 答案]。 */
export function numberedLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d{1,2})\s*[.、)：:]\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => [Number(m[1]), m[2]]);
}

/** 長週期家事的目前狀態。 */
export function lowfreqStatus(map, todayIso) {
  return LOWFREQ.map((item) => {
    const last = map[item.id];
    const days = last ? daysBetween(last, todayIso) : null;
    return {
      ...item,
      last: last || "",
      days,
      overdue: days !== null && days > item.every,
    };
  });
}

/** 目前時段的下一個時段。 */
export function nextBlock(mins) {
  const upcoming = BLOCKS.filter((b) => b.start > mins && b.start > 0).sort((a, b) => a.start - b.start);
  if (upcoming.length) return { at: hhmm(upcoming[0].start), title: upcoming[0].title };
  return { at: "00:00", title: "睡眠" };
}

const MENU = quick([
  { label: "今天", text: "今天" },
  { label: "待辦", text: "待辦" },
  { label: "一週", text: "一週" },
  { label: "家事", text: "家事" },
  { label: "討論", text: "討論" },
]);

/** 主要進入點：一則文字訊息換一組回覆訊息。 */
export async function respond(ctx, input) {
  const { cmd, arg } = parse(input);
  switch (cmd) {
    case "today":
      return [await buildToday(ctx)];
    case "week":
      return [flex.weekCarousel(ctx.now.dow), text(`完整版：${ctx.siteUrl}`, MENU)];
    case "todos":
      return [await buildTodos(ctx)];
    case "chores":
      return [await buildChores(ctx)];
    case "agenda":
      return [flex.agendaBubble(await weekAgenda(ctx))];
    case "rules":
      return [flex.rulesBubble(SETUP, await store.getAnswers(ctx.kv))];
    case "topic":
      return [await addTopic(ctx, arg)];
    case "answers":
      return await recordAnswers(ctx, arg);
    case "remove":
      return [await removeByIndex(ctx, arg)];
    case "done":
      return [await completeByIndex(ctx, arg)];
    case "menu":
      return [await setupMenu(ctx)];
    case "add":
      return [await addTodo(ctx, arg)];
    default:
      return [helpText()];
  }
}

/** 圖文選單與按鈕的 postback。 */
export async function respondPostback(ctx, data) {
  const [kind, value] = String(data || "").split(":");
  if (kind === "cmd") return respond(ctx, value === "todos" ? "待辦" : value === "week" ? "一週" : value);
  if (kind === "done") {
    const todo = await store.setDone(ctx.kv, value, true, ctx.userName);
    if (!todo) return [text("找不到這一筆，可能已經被刪掉了。", MENU)];
    return [text(`完成：${todo.text}`, quick([{ label: "取消完成", data: `undo:${todo.id}` }, { label: "待辦", text: "待辦" }]))];
  }
  if (kind === "undo") {
    const todo = await store.setDone(ctx.kv, value, false, ctx.userName);
    return [text(todo ? `放回待辦：${todo.text}` : "找不到這一筆。", MENU)];
  }
  if (kind === "snooze") {
    const todos = await store.listTodos(ctx.kv);
    const todo = todos.find((t) => t.id === value);
    if (!todo) return [text("找不到這一筆。", MENU)];
    const when = parseWhen("60分鐘後", ctx.now);
    todo.due = when.due;
    delete todo.remindedAt;
    await ctx.kv.put("todos", JSON.stringify(todos));
    return [text(`好，${when.label} 再提醒你：${todo.text}`, MENU)];
  }
  if (kind === "unset") {
    const todo = await store.clearDue(ctx.kv, value);
    return [text(todo ? `不提醒了，待辦留著：${todo.text}` : "找不到這一筆。", MENU)];
  }
  if (kind === "del") {
    const todo = await store.removeTodo(ctx.kv, value);
    return [text(todo ? `已收回：${todo.text}` : "找不到這一筆。", MENU)];
  }
  if (kind === "lf") {
    const item = LOWFREQ.find((i) => i.id === value);
    if (!item) return [text("找不到這個項目。", MENU)];
    await store.setLowfreq(ctx.kv, item.id, ctx.now.iso);
    return [text(`記下了：${item.name} 今天做過，下次約 ${item.every} 天後。`, MENU)];
  }
  return [helpText()];
}

/** 在對話裡安裝圖文選單，省掉跑指令那一段。 */
async function setupMenu(ctx) {
  if (!ctx.token) return text("這裡拿不到權杖，沒辦法安裝選單。", MENU);
  try {
    const { replaced } = await installRichMenu(ctx.token);
    return text(
      [
        "圖文選單裝好了。",
        replaced ? `（順手清掉 ${replaced} 個舊的）` : "",
        "",
        "回到聊天室，鍵盤上方應該會出現「選單」，點開就是六個按鈕：",
        "今天／待辦／一週／家事／討論／說明。",
        "沒看到的話把聊天室關掉重開一次。",
      ]
        .filter(Boolean)
        .join("\n"),
      MENU,
    );
  } catch (err) {
    return text(`選單安裝失敗：\n${String(err.message).slice(0, 300)}`, MENU);
  }
}

/** 這一週的討論清單：每週固定題 → 本週議題 → 還沒定案的設定題。 */
export function weekKey(now) {
  // 以「這一週的星期五」為界：週末行程要在週五就定好，前一晚知道要去哪比較好準備
  const delta = (5 - now.dow + 7) % 7;
  const d = new Date(Date.UTC(now.year, now.month - 1, now.day + delta));
  return d.toISOString().slice(0, 10);
}

export async function weekAgenda(ctx) {
  const week = weekKey(ctx.now);
  const [answers, weekly, topics] = await Promise.all([
    store.getAnswers(ctx.kv),
    store.getWeekly(ctx.kv),
    store.listTopics(ctx.kv),
  ]);

  const items = WEEKLY.map((text, i) => ({
    kind: "weekly",
    key: `${week}#${i}`,
    text,
    answer: weekly[`${week}#${i}`],
  }));

  for (const topic of topics.filter((t) => !t.answeredAt)) {
    items.push({ kind: "topic", key: topic.id, text: topic.text, by: topic.by, answer: topic.answer ? { text: topic.answer } : null });
  }

  SETUP.forEach((item, i) => {
    if (!answers[String(i + 1)]) {
      items.push({ kind: "setup", key: String(i + 1), text: item.text, first: item.first, answer: null });
    }
  });

  return { week, items };
}

/** 記下討論清單的答案。號碼對應「討論」那張卡上的順序。 */
async function recordAnswers(ctx, raw) {
  const agenda = await weekAgenda(ctx);
  const entries = numberedLines(raw).filter(([no]) => no >= 1 && no <= agenda.items.length);
  if (!entries.length) return [await addTodo(ctx, raw)];

  const weeklyEntries = [];
  const setupEntries = [];
  for (const [no, value] of entries) {
    const item = agenda.items[no - 1];
    if (item.kind === "weekly") weeklyEntries.push([item.key, value]);
    else if (item.kind === "setup") setupEntries.push([item.key, value]);
    else await store.answerTopic(ctx.kv, item.key, value, ctx.userName);
  }
  if (weeklyEntries.length) await store.saveWeekly(ctx.kv, weeklyEntries, ctx.userName);
  if (setupEntries.length) await store.saveAnswers(ctx.kv, setupEntries, ctx.userName);

  const summary = text(
    [
      `記下 ${entries.length} 題。`,
      "",
      ...entries.map(([no, value]) => `${no}. ${value}`),
      "",
      setupEntries.length ? "設定題答完就會退出每週清單，之後用「家規」查。" : "",
      "同一個號碼再回一次就覆蓋。這其實是待辦的話，用「待辦 內容」逐筆加。",
    ]
      .filter(Boolean)
      .join("\n"),
    MENU,
  );
  return [summary, flex.agendaBubble(await weekAgenda(ctx))];
}

/** 平常想到的議題丟進來，週日一起看。 */
async function addTopic(ctx, content) {
  if (!content) return text("要討論什麼？例如「討論 加 要不要換保母」。", MENU);
  await store.addTopic(ctx.kv, content, ctx.userName);
  const agenda = await weekAgenda(ctx);
  return text(
    `記下了，週日會出現在討論清單：\n${content}\n\n這週目前 ${agenda.items.length} 題。`,
    MENU,
  );
}

/** 待辦打錯了要刪掉——只能勾完成的話，錯字會留一輩子。 */
async function removeByIndex(ctx, arg) {
  const open = (await store.listTodos(ctx.kv)).filter((t) => !t.done);
  const n = Number(String(arg).trim());
  if (!Number.isInteger(n) || n < 1 || n > open.length) {
    return text(`沒有第 ${arg} 件。輸入「待辦」看目前的編號。`, MENU);
  }
  const todo = await store.removeTodo(ctx.kv, open[n - 1].id);
  return text(`已刪除：${todo.text}`, MENU);
}

async function addTodo(ctx, content) {
  if (!content) return [helpText()];
  const when = parseWhen(content, ctx.now);
  const todo = await store.addTodo(ctx.kv, content, ctx.userName, {
    byId: ctx.userId || "",
    ...(when ? { due: when.due } : {}),
  });
  const open = (await store.listTodos(ctx.kv)).filter((t) => !t.done);

  const actions = [
    { label: "完成", data: `done:${todo.id}` },
    { label: "收回", data: `del:${todo.id}` },
  ];
  if (when) actions.push({ label: "不用提醒", data: `unset:${todo.id}` });
  else actions.push({ label: "看清單", text: "待辦" });

  return text(
    [
      `加進待辦：${todo.text}`,
      when ? `⏰ ${when.label} 會提醒你` : "",
      `目前 ${open.length} 件未完成`,
    ]
      .filter(Boolean)
      .join("\n"),
    quick(actions),
  );
}

async function completeByIndex(ctx, arg) {
  const open = (await store.listTodos(ctx.kv)).filter((t) => !t.done);
  const n = Number(String(arg).trim());
  let todo = null;
  if (Number.isInteger(n) && n >= 1 && n <= open.length) {
    todo = open[n - 1];
  } else {
    todo = open.find((t) => t.text === arg) || open.find((t) => t.text.includes(arg));
  }
  if (!todo) return text(`找不到「${arg}」。輸入「待辦」看目前的編號。`, MENU);
  await store.setDone(ctx.kv, todo.id, true, ctx.userName);
  return text(`完成：${todo.text}`, quick([{ label: "取消完成", data: `undo:${todo.id}` }, { label: "待辦", text: "待辦" }]));
}

async function buildTodos(ctx) {
  const todos = await store.listTodos(ctx.kv);
  const open = todos.filter((t) => !t.done);
  const doneToday = todos.filter((t) => t.done && (t.doneAt || "").slice(0, 10) === isoUtcOf(ctx));
  return flex.todoBubble(open, doneToday);
}

async function buildToday(ctx) {
  const { dow, mins, iso } = ctx.now;
  const [todos, lfMap] = await Promise.all([store.listTodos(ctx.kv), store.getLowfreq(ctx.kv)]);
  return flex.todayBubble({
    dow,
    block: blockAt(mins),
    nextBlock: nextBlock(mins),
    laundry: LAUNDRY[dow],
    theme: THEMES[dow],
    overdue: lowfreqStatus(lfMap, iso).filter((i) => i.overdue),
    openCount: todos.filter((t) => !t.done).length,
  });
}

async function buildChores(ctx) {
  const lfMap = await store.getLowfreq(ctx.kv);
  return flex.choresBubble({
    dow: ctx.now.dow,
    laundry: LAUNDRY[ctx.now.dow],
    lowfreq: lowfreqStatus(lfMap, ctx.now.iso),
  });
}

function helpText() {
  return text(
    [
      "可以這樣用：",
      "",
      "· 直接打一句話 → 加進待辦",
      "· 帶時間就會提醒，例如「明天9點打疫苗」「30分鐘後收衣服」",
      "· 待辦 → 看清單，點按鈕勾完成",
      "· 完成 2 → 把第 2 件標完成",
      "· 刪除 2 → 把第 2 件刪掉（打錯用這個）",
      "· 今天 → 現在的時段、今晚洗什麼",
      "· 一週 → 七天的安排",
      "· 家事 → 輪值與長週期進度",
      "· 討論 → 這週要談的事（每週固定題＋你丟的議題）",
      "· 討論 加 要不要換保母 → 平常想到就丟，週日一起看",
      "· 家規 → 已經定案的安排",
      "· 照編號回答（1. …換行 2. …）→ 記成決定，不會變待辦",
      "· 安裝選單 → 裝上／重裝下方的按鈕列",
      "",
      "每天 21:30 會提醒今晚的家事，週五那則會多接這週的討論清單。",
    ].join("\n"),
    MENU,
  );
}

/** 用台北日期比對「今天完成的」。 */
function isoUtcOf(ctx) {
  return ctx.now.iso;
}

export { MENU, helpText };
