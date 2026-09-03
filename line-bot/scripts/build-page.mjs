/**
 * 把 family/index.html 包成一個 JS 模組，讓 Worker 直接供應這個頁面。
 * 改完網頁要重跑：npm run page
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../family/index.html");
const target = resolve(here, "../src/page.js");

const html = await readFile(source, "utf8");
await writeFile(
  target,
  `// 這個檔案是產生出來的，不要手改。\n` +
    `// 來源：family/index.html，重新產生：npm run page\n` +
    `export default ${JSON.stringify(html)};\n`,
);
console.log(`wrote ${target} (${(html.length / 1024).toFixed(0)} KB)`);
