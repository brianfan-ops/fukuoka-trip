/**
 * LINE 官方帳號的 webhook 與排程推播。
 *
 * 路由：
 *   GET  /         ← 作息表網頁（機器人回「一週」時附的連結）
 *   GET  /cal/<token>.ics ← 手機行事曆訂閱（網址就是密碼）
 *   POST /webhook  ← LINE 的事件（要先驗簽章）
 *   GET  /health   ← 部署後自己確認用
 *
 * Cron：每 5 分鐘跑一次，做兩件事——
 *   1. 把到期的待辦提醒推出去（所以提醒最多晚 5 分鐘）
 *   2. 台北 21:30 之後推當天的家事提醒，一天只推一次
 * 用同一個觸發器是因為免費方案整個帳號只有 5 個 cron 額度。
 */
import { verifySignature, reply, push, getProfile, text, quick } from "./line.js";
import { respond, respondPostback, helpText, MENU } from "./router.js";
import { nightlyMessage } from "./push.js";
import { taipei } from "./time.js";
import { nowStamp } from "./when.js";
import page from "./page.js";
import { buildIcs } from "./ics.js";
import { weekKey } from "./router.js";
import * as store from "./store.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, now: taipei() });
    }
    const cal = url.pathname.match(/^\/cal\/([0-9a-f]{32})\.ics$/);
    if (cal) {
      const token = await env.FAMILY.get("calToken");
      if (!token || token !== cal[1]) return new Response("Not found", { status: 404 });

      const now = taipei();
      const [todos, lowfreq] = await Promise.all([
        store.listTodos(env.FAMILY),
        store.getLowfreq(env.FAMILY),
      ]);
      return new Response(buildIcs({ todos, lowfreq, now, friday: weekKey(now) }), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    if (url.pathname === "/" || url.pathname === "/family" || url.pathname === "/family/") {
      // 頁面帶 noindex，網址也不對外公開，只給家裡人用。
      return new Response(page, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
    if (url.pathname !== "/webhook" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const body = await request.text();
    const signed = await verifySignature(
      env.LINE_CHANNEL_SECRET,
      body,
      request.headers.get("x-line-signature"),
    );
    if (!signed) return new Response("bad signature", { status: 401 });

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("bad json", { status: 400 });
    }

    // LINE 要求盡快回 200，事件在背景處理。
    ctx.waitUntil(
      Promise.all(
        (payload.events || []).map((event) =>
          handleEvent(event, env).catch((err) => console.error("event failed", err)),
        ),
      ),
    );
    return new Response("ok");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(broadcast(env));
  },
};

async function handleEvent(event, env) {
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;

  // 這個帳號只做一對一。群組訊息不處理，免得洗版。
  if (event.source?.type !== "user") return;
  const userId = event.source.userId;

  if (event.type === "unfollow") {
    await store.forgetUser(env.FAMILY, userId);
    return;
  }

  const ctx = {
    kv: env.FAMILY,
    now: taipei(),
    siteUrl: env.SITE_URL || "",
    token,
    userId,
    userName: await resolveName(env, userId),
  };

  if (event.type === "follow") {
    await reply(token, event.replyToken, [
      text(
        `${ctx.userName || "你"}好，這是家裡的作息機器人。\n\n直接打一句話就會加進待辦，其他用下面的選單。`,
        MENU,
      ),
      helpText(),
    ]);
    return;
  }

  if (event.type === "message" && event.message?.type === "text") {
    const messages = await respond(ctx, event.message.text);
    await reply(token, event.replyToken, messages);
    return;
  }

  if (event.type === "postback") {
    const messages = await respondPostback(ctx, event.postback?.data);
    await reply(token, event.replyToken, messages);
  }
}

/** 暱稱查一次就存起來，不用每則訊息都打 profile API。 */
async function resolveName(env, userId) {
  const users = await store.listUsers(env.FAMILY);
  const known = users.find((u) => u.id === userId);
  if (known?.name) return known.name;
  const profile = await getProfile(env.LINE_CHANNEL_ACCESS_TOKEN, userId);
  const name = profile?.displayName || "";
  await store.rememberUser(env.FAMILY, userId, name);
  return name;
}

async function broadcast(env) {
  const now = taipei();
  await sendReminders(env, now);
  await sendNightly(env, now);
}

/** 到期的待辦：只推給當初寫下它的人，找不到人才發給全家。 */
async function sendReminders(env, now) {
  const dueList = await store.dueTodos(env.FAMILY, nowStamp(now));
  if (!dueList.length) return;

  const users = await store.listUsers(env.FAMILY);
  const sent = [];
  for (const todo of dueList) {
    const targets = todo.byId ? [todo.byId] : users.map((u) => u.id);
    const message = text(
      `⏰ 提醒：${todo.text}`,
      quick([
        { label: "完成", data: `done:${todo.id}` },
        { label: "一小時後再說", data: `snooze:${todo.id}` },
      ]),
    );
    for (const to of targets) {
      try {
        await push(env.LINE_CHANNEL_ACCESS_TOKEN, to, [message]);
      } catch (err) {
        console.error("reminder failed", to, err.message);
      }
    }
    sent.push(todo.id);
  }
  await store.markReminded(env.FAMILY, sent, new Date().toISOString());
}

/** 每晚 21:30 那則，一天只推一次。 */
async function sendNightly(env, now) {
  if (now.mins < 21 * 60 + 30) return;
  if ((await store.nightlySentOn(env.FAMILY)) === now.iso) return;

  const message = await nightlyMessage(env.FAMILY, now);
  const users = await store.listUsers(env.FAMILY);
  for (const user of users) {
    try {
      await push(env.LINE_CHANNEL_ACCESS_TOKEN, user.id, [message]);
    } catch (err) {
      console.error("push failed", user.id, err.message);
    }
  }
  await store.markNightlySent(env.FAMILY, now.iso);
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
