/**
 * 從終端機安裝圖文選單。平常不需要——在 LINE 裡打「安裝選單」就好，
 * 這支留給沒辦法用聊天觸發的情況（例如還沒設好 webhook）。
 *
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx node scripts/richmenu.js
 */
import { installRichMenu } from "../src/richmenu.js";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("缺少環境變數 LINE_CHANNEL_ACCESS_TOKEN");
  process.exit(1);
}

const { richMenuId, replaced } = await installRichMenu(TOKEN);
console.log(`已安裝 ${richMenuId}${replaced ? `（清掉 ${replaced} 個舊的）` : ""}`);
