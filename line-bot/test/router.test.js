import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, lowfreqStatus, nextBlock, respond, respondPostback, weekAgenda } from "../src/router.js";
import { SETUP, WEEKLY } from "../src/data.js";
import * as store from "../src/store.js";

/** 用 Map 假裝 KV，測試不碰網路也不碰 Cloudflare。 */
function fakeKv(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    _dump: () => Object.fromEntries(map),
  };
}

const NOW = { year: 2026, month: 9, day: 3, dow: 4, mins: 1295, iso: "2026-09-03" };
// 週次以星期五為界：2026-09-03 是星期四，所以這一週的 key 是 09-04
const WEEK = "2026-09-04";
const FRIDAY = { ...NOW, dow: 5, day: 4, iso: WEEK };
const ctxOf = (kv) => ({ kv, now: NOW, userName: "爸爸", siteUrl: "https://example.test/family/" });

test("指令：認得的關鍵字", () => {
  assert.deepEqual(parse("今天"), { cmd: "today", arg: "" });
  assert.deepEqual(parse("一週安排"), { cmd: "week", arg: "" });
  assert.deepEqual(parse("待辦清單"), { cmd: "todos", arg: "" });
  assert.deepEqual(parse("家事"), { cmd: "chores", arg: "" });
  assert.deepEqual(parse("討論"), { cmd: "agenda", arg: "" });
});

test("指令：認不出來的當成待辦，不會被關鍵字誤吃", () => {
  assert.deepEqual(parse("洗衣機壞了"), { cmd: "add", arg: "洗衣機壞了" });
  assert.deepEqual(parse("加油站要繳費"), { cmd: "add", arg: "加油站要繳費" });
  assert.deepEqual(parse("明天要帶泳衣"), { cmd: "add", arg: "明天要帶泳衣" });
});

test("指令：帶參數的寫法", () => {
  assert.deepEqual(parse("待辦 買奶粉"), { cmd: "add", arg: "買奶粉" });
  assert.deepEqual(parse("+記得帶餐袋"), { cmd: "add", arg: "記得帶餐袋" });
  assert.deepEqual(parse("完成2"), { cmd: "done", arg: "2" });
  assert.deepEqual(parse("完成 買奶粉"), { cmd: "done", arg: "買奶粉" });
});

test("長週期家事：超過建議間隔才算逾期", () => {
  const status = lowfreqStatus({ bedding: "2026-09-01", filter: "2026-06-20" }, "2026-09-03");
  const bedding = status.find((s) => s.id === "bedding");
  const filter = status.find((s) => s.id === "filter");
  const fridge = status.find((s) => s.id === "fridge");
  assert.equal(bedding.days, 2);
  assert.equal(bedding.overdue, false);
  assert.equal(filter.overdue, true);
  assert.equal(fridge.days, null);
  assert.equal(fridge.overdue, false);
});

test("下一個時段：跨過午夜要回到睡眠", () => {
  assert.deepEqual(nextBlock(1295), { at: "23:00", title: "爸媽時間" });
  assert.deepEqual(nextBlock(1400), { at: "00:00", title: "睡眠" });
});

test("一句話就進待辦，回覆帶完成與收回按鈕", async () => {
  const kv = fakeKv();
  const messages = await respond(ctxOf(kv), "買奶粉");
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /買奶粉/);
  const labels = messages[0].quickReply.items.map((i) => i.action.label);
  assert.deepEqual(labels, ["完成", "收回", "看清單"]);

  const todos = await store.listTodos(kv);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].by, "爸爸");
  assert.equal(todos[0].done, false);
  assert.equal(todos[0].due, undefined, "沒寫時間就不該排提醒");
});

test("帶時間的待辦會排提醒，並回報排在什麼時候", async () => {
  const kv = fakeKv();
  const messages = await respond(ctxOf(kv), "明天9點打疫苗");

  assert.match(messages[0].text, /明天 09:00 會提醒你/);
  const labels = messages[0].quickReply.items.map((i) => i.action.label);
  assert.deepEqual(labels, ["完成", "收回", "不用提醒"]);

  const todo = (await store.listTodos(kv))[0];
  assert.equal(todo.due, "2026-09-04T09:00");
});

test("不用提醒：拿掉時間但待辦留著", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);
  await respond(ctx, "明天9點打疫苗");
  const id = (await store.listTodos(kv))[0].id;

  const messages = await respondPostback(ctx, `unset:${id}`);
  assert.match(messages[0].text, /不提醒了/);

  const todo = (await store.listTodos(kv))[0];
  assert.equal(todo.due, undefined);
  assert.equal(todo.done, false);
});

test("完成 1 會標掉清單上的第一件", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);
  await respond(ctx, "買奶粉");
  await respond(ctx, "繳電費");
  const messages = await respond(ctx, "完成 1");
  assert.match(messages[0].text, /完成：買奶粉/);

  const todos = await store.listTodos(kv);
  assert.equal(todos.find((t) => t.text === "買奶粉").done, true);
  assert.equal(todos.find((t) => t.text === "繳電費").done, false);
});

test("完成不存在的編號會給提示，不會炸掉", async () => {
  const kv = fakeKv();
  const messages = await respond(ctxOf(kv), "完成 9");
  assert.match(messages[0].text, /找不到/);
});

test("postback：勾完成可以再取消", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);
  await respond(ctx, "買尿布");
  const id = (await store.listTodos(kv))[0].id;

  await respondPostback(ctx, `done:${id}`);
  assert.equal((await store.listTodos(kv))[0].done, true);

  await respondPostback(ctx, `undo:${id}`);
  assert.equal((await store.listTodos(kv))[0].done, false);
});

test("postback：長週期家事按了就記今天", async () => {
  const kv = fakeKv();
  const messages = await respondPostback(ctxOf(kv), "lf:filter");
  assert.match(messages[0].text, /洗冷氣濾網/);
  assert.deepEqual(await store.getLowfreq(kv), { filter: "2026-09-03" });
});

test("今天：回一張 Flex，帶今晚的洗衣種類", async () => {
  const kv = fakeKv();
  const messages = await respond(ctxOf(kv), "今天");
  assert.equal(messages[0].type, "flex");
  assert.match(JSON.stringify(messages[0]), /小孩衣物 第二批/);
});

test("一週：七張卡加一則網頁連結", async () => {
  const kv = fakeKv();
  const messages = await respond(ctxOf(kv), "一週");
  assert.equal(messages[0].contents.contents.length, 7);
  assert.match(messages[1].text, /example\.test/);
});

test("星期五的排程訊息會接上這週的討論清單", async () => {
  const kv = fakeKv();
  const { nightlyMessage } = await import("../src/push.js");

  const fridayMsg = await nightlyMessage(kv, FRIDAY);
  const otherDayMsg = await nightlyMessage(kv, { ...NOW, dow: 4 });

  assert.match(fridayMsg.text, /這週的討論/);
  assert.match(fridayMsg.text, /週末和下週有沒有特殊行程/);
  assert.doesNotMatch(otherDayMsg.text, /這週的討論/, "只有週五那則帶討論清單");
});

test("內建網頁與 family/index.html 一致", async () => {
  const { readFile } = await import("node:fs/promises");
  const { default: page } = await import("../src/page.js");
  const source = await readFile(new URL("../../family/index.html", import.meta.url), "utf8");
  assert.equal(page, source, "family/index.html 改過了，請執行 npm run page 重新產生 src/page.js");
});

test("在聊天裡安裝選單：清舊的、建新的、設成預設", async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(`${init?.method || "GET"} ${String(url)}`);
    if (String(url).endsWith("/richmenu/list")) {
      return new Response(JSON.stringify({ richmenus: [{ richMenuId: "old-1" }] }), { status: 200 });
    }
    if (String(url).endsWith("/v2/bot/richmenu")) {
      return new Response(JSON.stringify({ richMenuId: "new-1" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };

  const ctx = { ...ctxOf(fakeKv()), token: "test-token" };
  const messages = await respond(ctx, "安裝選單");
  globalThis.fetch = original;

  assert.match(messages[0].text, /裝好了/);
  assert.deepEqual(calls, [
    "GET https://api.line.me/v2/bot/richmenu/list",
    "DELETE https://api.line.me/v2/bot/richmenu/old-1",
    "POST https://api.line.me/v2/bot/richmenu",
    "POST https://api-data.line.me/v2/bot/richmenu/new-1/content",
    "POST https://api.line.me/v2/bot/user/all/richmenu/new-1",
  ]);
});

test("選單安裝失敗會把錯誤回給使用者，不是靜靜失敗", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad token", { status: 401 });
  const ctx = { ...ctxOf(fakeKv()), token: "nope" };
  const messages = await respond(ctx, "安裝選單");
  globalThis.fetch = original;
  assert.match(messages[0].text, /選單安裝失敗/);
});

test("照編號回答會記成決定，不會變成待辦", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);

  const messages = await respond(ctx, "1. 週三疫苗\n2. 早上太趕，晚十分鐘出門");

  assert.match(messages[0].text, /記下 2 題/);
  assert.equal(messages[1].type, "flex", "第二則要回更新後的清單");
  assert.equal((await store.listTodos(kv)).length, 0, "不該產生待辦");

  // 前四題是每週固定題，答案存在那一週底下，不會蓋掉下一週
  const weekly = await store.getWeekly(kv);
  assert.equal(weekly[`${WEEK}#0`].text, "週三疫苗");
  assert.equal(weekly[`${WEEK}#1`].by, "爸爸");
});

test("設定題答完就退出每週清單，改成用家規查", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);

  const before = await weekAgenda(ctx);
  assert.equal(before.items.length, WEEKLY.length + SETUP.length);
  assert.equal(before.items[WEEKLY.length].kind, "setup");

  await respond(ctx, `${WEEKLY.length + 1}. 輪班制\n${WEEKLY.length + 2}. 兩週一次`);

  const answers = await store.getAnswers(kv);
  assert.equal(answers["1"].text, "輪班制", "每週題之後第一項就是第 1 題設定題");
  const after = await weekAgenda(ctx);
  assert.equal(after.items.length, before.items.length - 2);

  const [rules] = await respond(ctx, "家規");
  assert.match(JSON.stringify(rules), /輪班制/);
  assert.match(JSON.stringify(rules), new RegExp(`2/${SETUP.length} 題已定案`));
});

test("平常丟的議題會排進這週的清單，答完就消失", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);

  const added = await respond(ctx, "討論 加 要不要換保母");
  assert.match(added[0].text, /要不要換保母/);

  const agenda = await weekAgenda(ctx);
  assert.equal(agenda.items[WEEKLY.length].kind, "topic");
  assert.equal(agenda.items[WEEKLY.length].text, "要不要換保母");

  // 單獨一行編號還是待辦，所以單題作答要用「討論 N …」
  await respond(ctx, `討論 ${WEEKLY.length + 1} 先觀察一個月`);
  const topics = await store.listTopics(kv);
  assert.equal(topics[0].answer, "先觀察一個月");
  assert.ok(!(await weekAgenda(ctx)).items.some((it) => it.kind === "topic"));
});

test("單獨一行編號還是當待辦，不會誤判成討論答案", async () => {
  const kv = fakeKv();
  await respond(ctxOf(kv), "1. 買奶粉");
  const todos = await store.listTodos(kv);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].text, "1. 買奶粉");
  assert.deepEqual(await store.getAnswers(kv), {});
});

test("討論 3 先試一週：單題作答，再回一次會覆蓋", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);

  await respond(ctx, "討論 3 先試一週");
  assert.equal((await store.getWeekly(kv))[`${WEEK}#2`].text, "先試一週");

  await respond(ctx, "討論 3 改成兩週");
  const weekly = await store.getWeekly(kv);
  assert.equal(weekly[`${WEEK}#2`].text, "改成兩週");
  assert.equal(Object.keys(weekly).length, 1);
});

test("超出題號範圍的編號清單仍然當待辦", async () => {
  const kv = fakeKv();
  await respond(ctxOf(kv), "51. 買奶粉\n52. 買尿布");
  assert.equal((await store.listTodos(kv)).length, 1);
  assert.deepEqual(await store.getAnswers(kv), {});
});

test("討論卡片會顯示已經回答的內容", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);
  await respond(ctx, "1. 週三疫苗\n2. 早上太趕");

  const [bubble] = await respond(ctx, "討論");
  const rendered = JSON.stringify(bubble);
  assert.match(rendered, new RegExp(`已回答 2/${WEEKLY.length + SETUP.length}`));
  assert.match(rendered, /週三疫苗/);
});

test("刪除 2 可以把打錯的待辦拿掉", async () => {
  const kv = fakeKv();
  const ctx = ctxOf(kv);
  await respond(ctx, "買奶粉");
  await respond(ctx, "打錯的東西");

  const messages = await respond(ctx, "刪除 2");
  assert.match(messages[0].text, /已刪除：打錯的東西/);

  const todos = await store.listTodos(kv);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].text, "買奶粉");
});

test("刪除不存在的編號會給提示", async () => {
  const messages = await respond(ctxOf(fakeKv()), "刪除 9");
  assert.match(messages[0].text, /沒有第 9 件/);
});

test("週五推播只列還沒回答的題目", async () => {
  const kv = fakeKv();
  const { nightlyMessage } = await import("../src/push.js");

  await store.saveWeekly(kv, [[`${WEEK}#0`, "週三疫苗"]], "爸爸");

  const msg = await nightlyMessage(kv, FRIDAY);
  assert.match(msg.text, new RegExp(`還有 ${WEEKLY.length + SETUP.length - 1}/${WEEKLY.length + SETUP.length} 題`));
  assert.doesNotMatch(msg.text, /週末和下週有沒有特殊行程/, "已回答的不再重複問");
  assert.match(msg.text, /上週哪一段沒跑順/);
});

test("週次以星期五為界", async () => {
  const { weekKey } = await import("../src/router.js");
  assert.equal(weekKey({ year: 2026, month: 9, day: 3, dow: 4 }), "2026-09-04", "週四 → 這週五");
  assert.equal(weekKey({ year: 2026, month: 9, day: 4, dow: 5 }), "2026-09-04", "週五當天就是自己");
  assert.equal(weekKey({ year: 2026, month: 9, day: 6, dow: 0 }), "2026-09-11", "週日 → 下一個週五");
  assert.equal(weekKey({ year: 2026, month: 9, day: 30, dow: 3 }), "2026-10-02", "跨月");
});
