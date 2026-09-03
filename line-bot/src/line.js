const API = "https://api.line.me/v2/bot";

/** 驗證 LINE 的 x-line-signature（HMAC-SHA256 + base64）。 */
export async function verifySignature(secret, body, signature) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function post(token, path, payload) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`LINE ${path} ${res.status}: ${await res.text()}`);
  }
  return res;
}

/** 回覆訊息：不計入免費方案的訊息額度。 */
export function reply(token, replyToken, messages) {
  return post(token, "/message/reply", { replyToken, messages: toArray(messages) });
}

/** 主動推播：會計入額度，只用在排程提醒。 */
export function push(token, to, messages) {
  return post(token, "/message/push", { to, messages: toArray(messages) });
}

function toArray(messages) {
  const list = Array.isArray(messages) ? messages : [messages];
  return list.slice(0, 5);
}

export function text(content, quickReply) {
  const msg = { type: "text", text: content.slice(0, 4900) };
  if (quickReply) msg.quickReply = quickReply;
  return msg;
}

/** 底部的快速按鈕列。 */
export function quick(items) {
  return {
    items: items.slice(0, 13).map((it) => ({
      type: "action",
      action: it.data
        ? { type: "postback", label: it.label, data: it.data, displayText: it.display }
        : { type: "message", label: it.label, text: it.text || it.label },
    })),
  };
}

/** 取使用者暱稱，用來標記待辦是誰加的。 */
export async function getProfile(token, userId) {
  const res = await fetch(`${API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}
