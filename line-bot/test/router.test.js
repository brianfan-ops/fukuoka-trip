import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, lowfreqStatus, nextBlock, respond, respondPostback } from "../src/router.js";
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
  const messages = await respond(ctxOf(kv), "明天要帶餐袋");
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /明天要帶餐袋/);
  const labels = messages[0].quickReply.items.map((i) => i.action.label);
  assert.deepEqual(labels, ["完成", "收回", "看清單"]);

  const todos = await store.listTodos(kv);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].by, "爸爸");
  assert.equal(todos[0].done, false);
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
