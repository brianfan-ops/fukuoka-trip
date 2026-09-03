/**
 * 家庭作息的單一資料來源。
 * 內容對應 family/index.html 那份網頁；兩邊要一起改。
 */

export const TZ = "Asia/Taipei";

export const KIDS = [
  { key: "bro", name: "哥哥", birth: "2023-05-03" },
  { key: "sis", name: "妹妹", birth: "2025-01-15" },
];

/** 一天的時段骨架。start/end 是從 00:00 起算的分鐘數。 */
export const BLOCKS = [
  { start: 450, end: 510, title: "起床盥洗",
    wd: "爸爸帶哥哥（刷牙、換衣服、書包），媽媽顧妹妹。目標 08:20 出門。",
    we: "兩個小孩一起慢慢來，不趕時間。" },
  { start: 510, end: 570, title: "出門早餐",
    wd: "爸爸送哥哥上學（在校吃早餐，供應到 09:20），媽媽帶妹妹吃。",
    we: "一家人出門吃早餐。" },
  { start: 570, end: 630, title: "晨間活動",
    wd: "妹妹的時段：公園、圖書館、親子館、散步採買。",
    we: "多半爸爸帶孩子出門，或全家一起。媽媽的自由時間。" },
  { start: 630, end: 690, title: "銜接午餐",
    wd: "妹妹在家：桌邊活動或繪本，順便準備午餐。",
    we: "接續上午行程，11:15 前回家。" },
  { start: 690, end: 750, title: "午餐",
    wd: "媽媽和妹妹在家吃，哥哥在學校吃。", we: "四個人一起吃。" },
  { start: 750, end: 870, title: "午休時間",
    wd: "妹妹午睡。媽媽整天唯一能喘口氣的兩小時——盡量別排家事。",
    we: "兩個小孩一起午睡。" },
  { start: 870, end: 1050, title: "午後三小時",
    wd: "前半是妹妹睡醒最有精神的時候（主題活動），16:30 後備晚餐。",
    we: "四個人都在，適合排一個主行程。" },
  { start: 1050, end: 1170, title: "晚餐時間",
    wd: "爸爸 17:50 接到哥哥、18:05 到家，18:15 開飯。吃完順手洗碗。",
    we: "兩小時，含準備、吃飯、收拾。" },
  { start: 1170, end: 1230, title: "晚上洗澡",
    wd: "輪流洗，換睡衣，脫下的衣服進洗衣籃。", we: "輪流洗，換睡衣。" },
  { start: 1230, end: 1290, title: "睡前故事",
    wd: "燈光調暗，講完就睡。", we: "燈光調暗，講完就睡。" },
  { start: 1290, end: 1380, title: "家事時間",
    wd: "當天種類的洗衣、折昨天晾的、吸地拖地。", we: "適合排大件與長週期家事。" },
  { start: 1380, end: 1440, title: "爸媽時間",
    wd: "一天裡唯一沒有小孩的一小時。", we: "星期日拿 15 分鐘對下週行程。" },
  { start: 0, end: 450, title: "睡眠", wd: "睡覺。", we: "睡覺。" },
];

/** 每週輪值：依種類分天，孩子衣物夠輪替不用每天洗。index = 星期幾（0 = 日）。 */
export const LAUNDRY = [
  { wash: "補洗 · 書包、隔天要用的零星", floor: "倒垃圾、下週衣物盤點", duty: "兩人一起" },
  { wash: "小孩衣物 第一批（哥哥上學服＋妹妹）", floor: "吸地（客廳＋房間）", duty: "洗衣 爸 · 地板 媽" },
  { wash: "大人衣物（淺色、內著）", floor: "拖地（客廳）", duty: "洗衣 爸 · 地板 媽" },
  { wash: "毛巾、口水巾、圍兜", floor: "吸地（客廳＋房間）", duty: "洗衣 媽 · 地板 爸" },
  { wash: "小孩衣物 第二批（含睡衣）", floor: "拖地（房間）", duty: "洗衣 爸 · 地板 媽" },
  { wash: "大人衣物（深色、外出服）", floor: "吸地＋浴室", duty: "洗衣 媽 · 地板 爸" },
  { wash: "大件 · 厚重衣物、外套", floor: "廚房、浴室大掃", duty: "兩人一起" },
];

/** 每晚固定，不進輪值。 */
export const NIGHTLY = [
  "洗碗（吃完就洗，別留到家事時間）",
  "餐袋、水壺沖洗晾著",
  "折昨天晾的衣服",
];

/** 長週期家事。every = 建議間隔天數。 */
export const LOWFREQ = [
  { id: "bedding", name: "床單、被套、枕套", every: 14, where: "週六家事時間，或假日上午" },
  { id: "filter", name: "洗冷氣濾網", every: 30, where: "假日上午 · 夏天可縮到 2–3 週" },
  { id: "fridge", name: "清冰箱", every: 30, where: "大採買的前一天，順便盤點" },
  { id: "balcony", name: "洗陽台", every: 42, where: "挑天氣好的假日上午" },
  { id: "storage", name: "整理儲物間", every: 90, where: "換季時一起做" },
];

/** 妹妹的主題日。index = 星期幾。週六日不排。 */
export const THEMES = [
  null,
  { name: "美勞日", slot: "10:30–11:30", what: "蠟筆塗鴉、貼紙、黏土", prep: "紙、蠟筆、圍兜" },
  { name: "公園日", slot: "09:30–10:30", what: "溜滑梯、走路、追鴿子", prep: "帽子、水壺、換洗衣" },
  { name: "圖書館日", slot: "09:30–10:30", what: "借書、現場翻書，回家講新書", prep: "借書證、環保袋" },
  { name: "音樂日", slot: "14:30–15:30", what: "唱跳、搖鈴、追泡泡", prep: "泡泡水、樂器" },
  { name: "採買日", slot: "15:30–16:30", what: "推車去市場，邊走邊認食物名稱", prep: "推車、購物袋、清單" },
  null,
];

/** 平日的兩個定點。 */
export const ANCHORS = { leave: "08:30 爸爸帶哥哥出門", home: "18:05 爸爸接哥哥到家" };

/** 下週討論清單。 */
export const AGENDA = [
  { text: "每晚的四件家事怎麼分？洗碗、洗衣、折衣、地板", first: true },
  { text: "長週期家事誰負責？排在哪個假日上午？", first: true },
  { text: "妹妹的主題日提案要不要採用？從哪一天開始？" },
  { text: "16:30–17:30 備晚餐能不能穩定做到？" },
  { text: "假日上午爸爸帶孩子時，媽媽要做什麼？" },
  { text: "12:30–14:30 媽媽的午休要不要保護起來？" },
  { text: "週末兩個小孩一起的午後三小時排什麼？" },
  { text: "下週有沒有學校活動、看診、回老家？" },
];

export const DOW = ["日", "一", "二", "三", "四", "五", "六"];

export function isWeekday(dow) {
  return dow >= 1 && dow <= 5;
}

/** 找出某個時間點落在哪個時段。 */
export function blockAt(mins) {
  return BLOCKS.find((b) => mins >= b.start && mins < b.end) || null;
}

export function blockText(block, dow) {
  return isWeekday(dow) ? block.wd : block.we;
}

export function hhmm(mins) {
  const h = Math.floor(mins / 60) % 24;
  return String(h).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
}

/** 依出生日算出「N 歲 N 個月」。 */
export function ageText(birth, today) {
  const b = new Date(birth + "T00:00:00Z");
  let months =
    (today.getUTCFullYear() - b.getUTCFullYear()) * 12 +
    (today.getUTCMonth() - b.getUTCMonth());
  if (today.getUTCDate() < b.getUTCDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y} 歲 ${m} 個月` : `${m} 個月`;
}
