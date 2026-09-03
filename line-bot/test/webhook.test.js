import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../src/index.js";

function fakeKv(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(k) { return map.has(k) ? map.get(k) : null; },
    async put(k, v) { map.set(k, v); },
    _dump: () => Object.fromEntries(map),
  };
}

const SECRET = "test-channel-secret";

function envOf(kv) {
  return {
    LINE_CHANNEL_SECRET: SECRET,
    LINE_CHANNEL_ACCESS_TOKEN: "test-token",
    SITE_URL: "https://example.test/family/",
    FAMILY: kv,
  };
}

function sign(body) {
  return createHmac("sha256", SECRET).update(body).digest("base64");
}

function request(body, signature) {
  return new Request("https://bot.test/webhook", {
    method: "POST",
    headers: { "x-line-signature": signature ?? sign(body) },
    body,
  });
}

/** 攔下所有對 LINE 的呼叫，回傳被送出去的 payload。 */
function captureLine() {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).includes("/profile/")) {
      return new Response(JSON.stringify({ displayName: "爸爸" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

function ctxOf() {
  const pending = [];
  return { ctx: { waitUntil: (p) => pending.push(p) }, settle: () => Promise.all(pending) };
}

test("/health 回得了", async () => {
  const res = await worker.fetch(new Request("https://bot.test/health"), envOf(fakeKv()), ctxOf().ctx);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test("簽章不對就擋下來", async () => {
  const body = JSON.stringify({ events: [] });
  const res = await worker.fetch(request(body, "not-the-signature"), envOf(fakeKv()), ctxOf().ctx);
  assert.equal(res.status, 401);
});

test("沒有簽章也擋下來", async () => {
  const res = await worker.fetch(
    new Request("https://bot.test/webhook", { method: "POST", body: "{}" }),
    envOf(fakeKv()),
    ctxOf().ctx,
  );
  assert.equal(res.status, 401);
});

test("一句話進來，回一則確認並存進 KV", async () => {
  const kv = fakeKv();
  const line = captureLine();
  const { ctx, settle } = ctxOf();
  const body = JSON.stringify({
    events: [{
      type: "message",
      replyToken: "reply-token",
      source: { type: "user", userId: "U123" },
      message: { type: "text", text: "明天要帶餐袋" },
    }],
  });

  const res = await worker.fetch(request(body), envOf(kv), ctx);
  assert.equal(res.status, 200);
  await settle();
  line.restore();

  const replyCall = line.calls.find((c) => c.url.endsWith("/message/reply"));
  assert.ok(replyCall, "應該要呼叫 reply");
  assert.equal(replyCall.body.replyToken, "reply-token");
  assert.match(replyCall.body.messages[0].text, /明天要帶餐袋/);

  const todos = JSON.parse(kv._dump().todos);
  assert.equal(todos.length, 1);
  assert.equal(todos[0].by, "爸爸");
});

test("群組訊息不理會", async () => {
  const line = captureLine();
  const { ctx, settle } = ctxOf();
  const body = JSON.stringify({
    events: [{
      type: "message",
      replyToken: "t",
      source: { type: "group", groupId: "C1" },
      message: { type: "text", text: "今天" },
    }],
  });
  await worker.fetch(request(body), envOf(fakeKv()), ctx);
  await settle();
  line.restore();
  assert.equal(line.calls.length, 0);
});

test("排程推播會發給每個記住的使用者", async () => {
  const kv = fakeKv({
    users: JSON.stringify([{ id: "U1", name: "爸爸" }, { id: "U2", name: "媽媽" }]),
    todos: JSON.stringify([{ id: "a", text: "買奶粉", done: false }]),
  });
  const line = captureLine();
  const { ctx, settle } = ctxOf();

  await worker.scheduled({ cron: "30 13 * * *" }, envOf(kv), ctx);
  await settle();
  line.restore();

  const pushes = line.calls.filter((c) => c.url.endsWith("/message/push"));
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes.map((p) => p.body.to), ["U1", "U2"]);
  assert.match(pushes[0].body.messages[0].text, /家事時間/);
  assert.match(pushes[0].body.messages[0].text, /買奶粉/);
});
