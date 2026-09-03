/**
 * LINE 官方帳號的 webhook 與排程推播。
 *
 * 路由：
 *   GET  /         ← 作息表網頁（機器人回「一週」時附的連結）
 *   POST /webhook  ← LINE 的事件（要先驗簽章）
 *   GET  /health   ← 部署後自己確認用
 *
 * Cron（wrangler.toml 設定的是 UTC）：
 *   13:30 UTC = 台北 21:30 → 今晚的家事提醒；星期日那則會多接下週討論清單
 */
import { verifySignature, reply, push, getProfile, text } from "./line.js";
import { respond, respondPostback, helpText, MENU } from "./router.js";
import { nightlyMessage } from "./push.js";
import { taipei } from "./time.js";
import page from "./page.js";
import * as store from "./store.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, now: taipei() });
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
  const message = await nightlyMessage(env.FAMILY, taipei());
  const users = await store.listUsers(env.FAMILY);
  for (const user of users) {
    try {
      await push(env.LINE_CHANNEL_ACCESS_TOKEN, user.id, [message]);
    } catch (err) {
      console.error("push failed", user.id, err.message);
    }
  }
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
