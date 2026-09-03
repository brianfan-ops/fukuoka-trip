/**
 * 圖文選單：螢幕下方那排常駐按鈕。
 * 在 LINE 裡打「安裝選單」就會跑這裡，不需要終端機。
 */
import image from "./richmenu-image.js";

// 2500×1686 切成 3 欄 2 列，每格 833×843（最右欄補 834 湊滿寬度）。
const CELLS = [
  ["今天", 0, 0], ["待辦", 833, 0], ["一週", 1666, 0],
  ["家事", 0, 843], ["討論", 833, 843], ["說明", 1666, 843],
];

export const MENU_DEFINITION = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "家的一日節奏",
  chatBarText: "選單",
  areas: CELLS.map(([label, x, y]) => ({
    bounds: { x, y, width: x === 1666 ? 834 : 833, height: 843 },
    action: { type: "message", label, text: label },
  })),
};

function bytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function api(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${url} ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

/** 重跑安全：先清掉舊的選單，再建一個新的設成預設。 */
export async function installRichMenu(token) {
  const { richmenus = [] } = await api(token, "https://api.line.me/v2/bot/richmenu/list");
  for (const menu of richmenus) {
    await api(token, `https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, { method: "DELETE" });
  }

  const { richMenuId } = await api(token, "https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(MENU_DEFINITION),
  });

  await api(token, `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: bytes(image),
  });

  await api(token, `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });

  return { richMenuId, replaced: richmenus.length };
}
