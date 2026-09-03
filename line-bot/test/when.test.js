import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhen, nowStamp } from "../src/when.js";

// 2026-09-03（星期四）14:50
const NOW = { year: 2026, month: 9, day: 3, dow: 4, mins: 14 * 60 + 50, iso: "2026-09-03" };

function due(text) {
  return parseWhen(text, NOW)?.due ?? null;
}

test("相對日期", () => {
  assert.equal(due("今天下午3點回診"), "2026-09-03T15:00");
  assert.equal(due("明天9點打疫苗"), "2026-09-04T09:00");
  assert.equal(due("後天早上打疫苗"), "2026-09-05T09:00");
  assert.equal(due("大後天 提醒我"), "2026-09-06T09:00");
});

test("星期：講當天的星期指的是下一個", () => {
  assert.equal(due("週五16:00接哥哥"), "2026-09-04T16:00");
  assert.equal(due("週四 10:00 回診"), "2026-09-10T10:00", "今天就是週四，指下週四");
  assert.equal(due("下週一 10:30 親子館"), "2026-09-14T10:30");
});

test("日期寫法", () => {
  assert.equal(due("9/15 疫苗"), "2026-09-15T09:00");
  assert.equal(due("9月15日 打針"), "2026-09-15T09:00");
  assert.equal(due("1/5 回診"), "2027-01-05T09:00", "已經過的日期算明年");
});

test("時間寫法", () => {
  assert.equal(due("晚上7點半吃飯"), "2026-09-03T19:30");
  assert.equal(due("明天下午2點15分"), "2026-09-04T14:15");
  assert.equal(due("明天早上八點"), "2026-09-04T08:00");
  assert.equal(due("明天 中午 領包裹"), "2026-09-04T12:00");
});

test("相對時間", () => {
  assert.equal(due("30分鐘後收衣服"), "2026-09-03T15:20");
  assert.equal(due("2小時後看烤箱"), "2026-09-03T16:50");
  assert.equal(due("20分鐘後"), "2026-09-03T15:10");
});

test("只寫時間：過了就算明天", () => {
  assert.equal(due("8點 出門"), "2026-09-04T08:00", "早上 8 點已經過了");
  assert.equal(due("16:00 出門"), "2026-09-03T16:00", "還沒到就是今天");
});

test("只寫日期沒寫時間 → 早上九點", () => {
  assert.equal(due("明天 買奶粉"), "2026-09-04T09:00");
});

test("讀不出時間就回 null，寧可不排也不要排錯", () => {
  assert.equal(due("買奶粉"), null);
  assert.equal(due("洗衣機壞了"), null);
  assert.equal(due(""), null);
});

test("跨月與跨日", () => {
  const endOfMonth = { year: 2026, month: 9, day: 30, dow: 3, mins: 23 * 60 + 50, iso: "2026-09-30" };
  assert.equal(parseWhen("明天 9點", endOfMonth).due, "2026-10-01T09:00");
  assert.equal(parseWhen("30分鐘後", endOfMonth).due, "2026-10-01T00:20");
});

test("nowStamp 跟 due 同格式，可以直接比大小", () => {
  assert.equal(nowStamp(NOW), "2026-09-03T14:50");
  assert.ok(nowStamp(NOW) < "2026-09-04T09:00");
});
