/**
 * 把 assets/richmenu.png 包成 JS 模組，讓 Worker 可以直接上傳給 LINE。
 * 換圖之後要重跑：npm run richmenu:module
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const png = await readFile(resolve(here, "../assets/richmenu.png"));
const target = resolve(here, "../src/richmenu-image.js");

await writeFile(
  target,
  `// 這個檔案是產生出來的，不要手改。\n` +
    `// 來源：assets/richmenu.png，重新產生：npm run richmenu:module\n` +
    `export default ${JSON.stringify(png.toString("base64"))};\n`,
);
console.log(`wrote ${target} (${(png.length / 1024).toFixed(0)} KB → base64)`);
