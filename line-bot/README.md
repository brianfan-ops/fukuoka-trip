# 家的一日節奏 · LINE 官方帳號

把 [`family/index.html`](../family/index.html) 那份作息表變成能對話的機器人：
半夜想到「明天要帶餐袋」，丟一句話進 LINE 就進待辦；想看安排就按選單。

## 架構

```
LINE App
   │  訊息 / 按鈕
   ▼
LINE Platform ──webhook──▶ Cloudflare Worker ──▶ KV（待辦、使用者、長週期家事完成日）
   ▲                            │
   └────── reply / push ────────┘
                                │  「一週」附連結
                                ▼
                    GitHub Pages 上的 family/index.html
```

用的是 LINE 差勤系統那一套做法：**聊天處理一句話就講完的事，複雜的表格丟網頁**。
所以這裡沒有把整份作息重畫成訊息，「一週」會回七張卡再附上網頁連結。

## 能做什麼

| 輸入 | 回應 |
| --- | --- |
| 任何一句話 | 加進待辦，附「完成 / 收回」按鈕 |
| `待辦` | 未完成清單，每筆一個完成鈕 |
| `完成 2` | 把第 2 件標完成（也可以 `完成 買奶粉`） |
| `今天` | 現在的時段、下一段、今晚洗什麼、妹妹的主題日、逾期家事 |
| `一週` | 七天輪播卡 ＋ 完整網頁連結 |
| `家事` | 每晚固定、今晚輪值、長週期進度（逾期會標紅，按鈕記錄「今天做了」） |
| `討論` | 下週要決定的清單 |
| `說明` | 指令說明 |

排程推播（台北時間）：

- **每天 21:30** — 今晚洗什麼、地板誰做、逾期的長週期家事、未完成待辦、明天的主題日要備什麼
- **週日 22:50** — 下週討論清單 ＋ 這週沒做完的

> LINE 的**回覆**訊息不計費，**主動推播**才計入免費方案額度（台灣約每月 200 則，
> 以你申請時的方案為準）。上面的排程是兩個人 × 每天一則 ≈ 68 則／月，還有餘裕。

## 安裝

### 1. LINE 端

會用到**兩個後台**，很多人卡在這裡：

| 後台 | 網址 | 在這裡做什麼 |
| --- | --- | --- |
| LINE Developers Console | developers.line.biz | 建 channel、拿金鑰、填 Webhook |
| LINE 官方帳號管理後台 | manager.line.biz | 改回應模式、關自動回應、拿加好友 QR |

兩邊是同一個帳號的兩張臉：在 Developers Console 建立 Messaging API channel 時，
**系統會自動幫你開一個對應的官方帳號**，不用另外申請。

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 用你的 LINE 帳號登入。
2. 建立一個 **Provider**（名字隨便，例如「家」）。
3. 在該 Provider 底下建立 **Messaging API** channel。填名稱（會變成官方帳號的顯示名稱）、
   類別、地區選台灣。建完就同時有官方帳號了。
4. **Basic settings** 分頁 → 往下找 **Channel secret**，記下來。
5. **Messaging API** 分頁 → 最下面 **Channel access token (long-lived)** → 按 **Issue**，記下來。
6. 同一分頁的 **Allow bot to join group chats** 保持關閉——這個帳號只做一對一。
7. 到 [LINE 官方帳號管理後台](https://manager.line.biz/) → 選這個帳號 → **設定 → 回應設定**：
   - 回應模式：**聊天機器人**
   - **自動回應訊息：關**（不關的話，機器人回一次、罐頭訊息再回一次）
   - **Webhook：開**

> LINE 的後台改版頻繁，選項名稱可能跟這裡寫的略有出入，但位置大致就在這幾頁。

做完你手上會有兩個值，等一下要用：**Channel secret** 和 **Channel access token**。

### 2. Cloudflare 端

```bash
cd line-bot
npm install
npx wrangler login

# 建立 KV，把印出來的 id 填進 wrangler.toml 的 kv_namespaces.id
npx wrangler kv namespace create FAMILY

# 兩把鑰匙存成 secret，不要寫進檔案
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN

npm test        # 18 個測試，不會連到 LINE
npm run deploy
```

部署完會給一個 `https://family-line-bot.<你的帳號>.workers.dev`。
開 `<那個網址>/health` 應該看到 `{"ok":true,...}`。

### 3. 接起來

1. 回 LINE Console → **Messaging API** → **Webhook URL** 填
   `https://family-line-bot.<你的帳號>.workers.dev/webhook`
2. 按 **Verify**，要出現 Success。
3. **Use webhook** 打開。
4. 用手機掃同一頁的 QR code 加好友。**爸爸媽媽都要加**，排程才推得到兩個人。

### 4. 圖文選單

```bash
npx playwright install chromium   # 只有產圖需要
npm run richmenu:image            # assets/richmenu.html → assets/richmenu.png
LINE_CHANNEL_ACCESS_TOKEN=xxx npm run richmenu:upload
```

選單是 3×2 六格：今天 / 待辦 / 一週 / 家事 / 討論 / 說明。
改版面就改 `assets/richmenu.html`，重跑上面兩行（`node scripts/richmenu.js --clean` 可清掉舊的）。

## 改內容

作息、輪值、主題日、長週期家事、討論清單都在 [`src/data.js`](src/data.js)。
改完 `npm run deploy` 就生效。

> ⚠️ 同一份內容目前在 `family/index.html` 也有一份，兩邊要一起改。
> 之後可以把網頁改成從 Worker 讀資料，就只剩一份。

## 資料與隱私

- 待辦、使用者 ID、長週期家事的完成日期存在 Cloudflare KV，只有這個 Worker 讀得到。
- 不存訊息全文，只存你明確加進待辦的那句話。
- 退出好友（unfollow）會自動把使用者從推播名單移除。
- 家庭規模的量，KV 用整包 JSON 讀寫；同一秒兩個人同時寫，後寫的會蓋掉先寫的。

## 之後可以做

- **LIFF** — 讓網頁在 LINE 內開啟並認得使用者，就能在網頁上直接勾待辦
- **一週安排編輯** — 現在網頁的編輯只存在自己的瀏覽器，接上 KV 後兩個人才看得到同一份
- **提醒指定時間** — 「提醒我 18:00 收衣服」需要另一層排程佇列
