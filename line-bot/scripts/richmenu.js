/**
 * 建立圖文選單、上傳圖片、設為所有使用者的預設選單。
 *
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx node scripts/richmenu.js
 *
 * 重跑會建立一個新的選單並切換過去；舊的用 --clean 清掉。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("缺少環境變數 LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const IMAGE = resolve(here, "../assets/richmenu.png");

// 2500×1686 切成 3 欄 2 列，每格 833×843（最後一欄補 834 湊滿寬度）。
const CELLS = [
  ["今天", 0, 0], ["待辦", 833, 0], ["一週", 1666, 0],
  ["家事", 0, 843], ["討論", 833, 843], ["說明", 1666, 843],
];

const menu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "家的一日節奏",
  chatBarText: "選單",
  areas: CELLS.map(([label, x, y]) => ({
    bounds: { x, y, width: x === 1666 ? 834 : 833, height: 843 },
    action: { type: "message", label, text: label },
  })),
};

async function api(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(init?.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${url} ${res.status}: ${body}`);
  return body ? JSON.parse(body) : {};
}

if (process.argv.includes("--clean")) {
  const { richmenus } = await api("https://api.line.me/v2/bot/richmenu/list");
  for (const m of richmenus || []) {
    await api(`https://api.line.me/v2/bot/richmenu/${m.richMenuId}`, { method: "DELETE" });
    console.log("deleted", m.richMenuId, m.name);
  }
  process.exit(0);
}

const image = await readFile(IMAGE);
console.log(`圖片 ${(image.length / 1024).toFixed(0)} KB（上限 1 MB）`);

const { richMenuId } = await api("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(menu),
});
console.log("建立選單", richMenuId);

await api(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
  method: "POST",
  headers: { "Content-Type": "image/png" },
  body: image,
});
console.log("圖片已上傳");

await api(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });
console.log("已設為預設選單，回 LINE 就看得到了");
