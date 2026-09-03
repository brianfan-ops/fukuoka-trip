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
                    同一個 Worker 供應的作息表網頁（src/page.js）
```

用的是 LINE 差勤系統那一套做法：**聊天處理一句話就講完的事，複雜的表格丟網頁**。
所以這裡沒有把整份作息重畫成訊息，「一週」會回七張卡再附上網頁連結。

## 能做什麼

| 輸入 | 回應 |
| --- | --- |
| 任何一句話 | 加進待辦，附「完成 / 收回」按鈕 |
| `待辦` | 未完成清單，每筆一個完成鈕 |
| `完成 2` | 把第 2 件標完成（也可以 `完成 買奶粉`） |
| `刪除 2` | 把第 2 件刪掉（打錯用這個） |
| `今天` | 現在的時段、下一段、今晚洗什麼、妹妹的主題日、逾期家事 |
| `一週` | 七天輪播卡 ＋ 完整網頁連結 |
| `家事` | 每晚固定、今晚輪值、長週期進度（逾期會標紅，按鈕記錄「今天做了」） |
| `討論` | 這週要談的事，已回答的顯示在題目下面 |
| `討論 加 要不要換保母` | 平常想到就丟，週五一起看 |
| 照編號回答（多行 `1. …` `2. …`） | 記成決定，不會變待辦；同號碼再回一次就覆蓋 |
| `討論 3 先試一週` | 只回第 3 題（單獨一行 `3. …` 仍算待辦） |
| `家規` | 已經定案的安排 |
| `說明` | 指令說明 |
| `安裝選單` | 裝上／重裝下方那排常駐按鈕 |

排程推播（台北時間）：

- **到期的待辦** — 每 5 分鐘檢查一次，只推給當初寫下它的人，附「完成 / 一小時後再說」
- **每天 21:30** — 今晚洗什麼、地板誰做、逾期的長週期家事、未完成待辦、明天的主題日要備什麼
- **星期五那一則**後面會多接這週還沒回答的討論題目（週末行程要在週五就定好）

三件事共用同一個 cron（`*/5 * * * *`）是刻意的：免費方案整個帳號只有 5 個 cron 額度。
每晚那則用 KV 記最後發送日期，所以五分鐘跑一次也只會發一次。

> LINE 的**回覆**訊息不計費，**主動推播**才計入免費方案額度（台灣約每月 200 則，
> 以你申請時的方案為準）。每晚那則是兩個人 × 每天一則 ≈ 60 則／月，剩下約 140 則
> 給待辦提醒用，平均一天 4 則。夠用，但不是無限。

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

設定檔 `wrangler.toml` 放在 **repo 根目錄**，不是這個資料夾——這樣 Cloudflare
的 Git 連動部署用預設的 Root directory「/」就找得到，後台不用改任何建置設定。

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

部署完會給一個 `https://bbssfamily.brian-fan.workers.dev`。
開 `<那個網址>/health` 應該看到 `{"ok":true,...}`。

### 3. 接起來

1. 回 LINE Console → **Messaging API** → **Webhook URL** 填
   `https://bbssfamily.brian-fan.workers.dev/webhook`
2. 按 **Verify**，要出現 Success。
3. **Use webhook** 打開。
4. 用手機掃同一頁的 QR code 加好友。**爸爸媽媽都要加**，排程才推得到兩個人。

### 4. 圖文選單

**在 LINE 裡打「安裝選單」就好**，不用終端機。重打一次會清掉舊的重裝，可以重複執行。

選單是 3×2 六格：今天 / 待辦 / 一週 / 家事 / 討論 / 說明。改版面的話：

```bash
npx playwright install chromium   # 只有產圖需要
npm run richmenu:image            # assets/richmenu.html → assets/richmenu.png
npm run richmenu:module           # PNG → src/richmenu-image.js（Worker 用的）
npm run deploy                    # 部署後在 LINE 打「安裝選單」
```

## 改內容

作息、輪值、主題日、長週期家事、討論題目都在 [`src/data.js`](src/data.js)。

討論清單分三層，這樣它才不會答完一次就沒東西可談：

| 層 | 內容 | 存哪 |
| --- | --- | --- |
| 設定題 `SETUP` | 把作息從草稿變定案要決定的事，答完就退出清單、變成「家規」 | KV `answers` |
| 每週題 `WEEKLY` | 每週都要問一次的（週末與下週行程、上週哪裡卡住、採買、誰比較累） | KV `weekly`，key 以星期五為界 |
| 議題 | 平常 `討論 加 …` 丟進來的，答完就消失 | KV `topics` |

改完 `npm run deploy` 就生效。

網頁本身是 `family/index.html`；Worker 供應的是它包成模組的版本 `src/page.js`。
**改完網頁要跑 `npm run page` 重新產生**，忘了跑的話 `npm test` 會擋下來。

> ⚠️ 作息內容目前在 `src/data.js` 和 `family/index.html` 各有一份，兩邊要一起改。
> 之後可以把網頁改成從 Worker 讀資料，就只剩一份。

## 資料與隱私

- 作息表網頁由 Worker 自己供應，帶 `noindex`，不放 GitHub Pages——那會把小孩的
  出生日期、上下學時間、家裡白天只有誰在，公開到搜尋引擎上。
- 待辦、使用者 ID、長週期家事的完成日期存在 Cloudflare KV，只有這個 Worker 讀得到。
- 不存訊息全文，只存你明確加進待辦的那句話。
- 退出好友（unfollow）會自動把使用者從推播名單移除。
- 家庭規模的量，KV 用整包 JSON 讀寫；同一秒兩個人同時寫，後寫的會蓋掉先寫的。

## 之後可以做

- **LIFF** — 讓網頁在 LINE 內開啟並認得使用者，就能在網頁上直接勾待辦
- **一週安排編輯** — 現在網頁的編輯只存在自己的瀏覽器，接上 KV 後兩個人才看得到同一份
- **提醒指定時間** — 「提醒我 18:00 收衣服」需要另一層排程佇列
