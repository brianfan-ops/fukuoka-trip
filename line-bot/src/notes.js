/**
 * 每晚那則後面附的一句話。
 *
 * 內容標準：具體、可以馬上用、或是真的跟這個家有關。
 * 「相信自己你可以的」那種一律不收——兩週後就會被關掉。
 */
import { drawFromBag } from "./bag.js";
import { KIDS, LAUNDRY, LOWFREQ, THEMES, ageText } from "./data.js";
import { daysBetween } from "./time.js";
import { shiftIso } from "./when.js";

const KIND = { kid: "育兒", home: "家務", view: "提醒", ours: "這個家" };

/** 靜態的句子。每則都要能站得住腳，不要模稜兩可的勵志話。 */
const LINES = [
  // ── 育兒：這兩個年齡真的用得到的 ──
  { id: "k1", kind: "kid", text: "1 歲半到 2 歲是語言爆發期。你重複講的每個名字都在被記，即使她還說不出來。" },
  { id: "k2", kind: "kid", text: "幼兒能專心的時間大約是年齡乘以 2 到 5 分鐘。妹妹一件事撐 5 分鐘就換，是正常的，不是不專心。" },
  { id: "k3", kind: "kid", text: "小孩鬧起來時先處理情緒、再處理事情。大腦負責踩煞車的那塊要到二十幾歲才長好，跟他講道理是在跟工地講話。" },
  { id: "k4", kind: "kid", text: "三歲前後會從「各玩各的」慢慢變成「一起玩」。兄妹之間真正的互動會愈來愈多，衝突也是。" },
  { id: "k5", kind: "kid", text: "指令一次給一個。「去把鞋子穿好」比「穿鞋子拿水壺我們要出門了」有效得多。" },
  { id: "k6", kind: "kid", text: "小孩對「接下來會發生什麼」的預期，比對時間本身敏感。固定的順序比固定的鐘點更讓他安心。" },
  { id: "k7", kind: "kid", text: "共讀時停下來讓她指、讓她說，比把整本唸完有用。書沒唸完不是失敗。" },
  { id: "k8", kind: "kid", text: "他們吵架時，你不用當法官。很多時候只要把兩個人分開三分鐘，事情就自己過去了。" },
  { id: "k9", kind: "kid", text: "小孩最容易在轉換的縫隙崩潰——出門前、洗澡前、睡前。提前三分鐘預告，可以省掉很多場面。" },

  // ── 家務：可以今晚就用的 ──
  { id: "h1", kind: "home", text: "洗衣精放太多反而洗不乾淨。殘留會讓衣物變硬、越洗越不吸水。" },
  { id: "h2", kind: "home", text: "毛巾不要用柔軟精。它會在纖維上留一層膜，用起來就不吸水了。" },
  { id: "h3", kind: "home", text: "先吸地再拖地。順序反過來等於把灰塵和成泥。" },
  { id: "h4", kind: "home", text: "衣服晾之前用力甩一甩，皺褶少一半，可以少燙很多。" },
  { id: "h5", kind: "home", text: "冷氣濾網積灰會直接變成電費。夏天兩三週洗一次，比一個月洗一次划算。" },
  { id: "h6", kind: "home", text: "洗碗前先用紙巾把油抹掉，洗碗精和熱水都會省一半。" },
  { id: "h7", kind: "home", text: "小孩衣服上的果汁和奶漬要用冷水沖。熱水會讓蛋白質定住，就洗不掉了。" },
  { id: "h8", kind: "home", text: "收納的原則是「拿的人放得回去」。大人分類得再漂亮，小孩收不回去就等於沒有。" },
  { id: "h9", kind: "home", text: "晾在室內的衣服，中間留一個拳頭的距離就會乾得快很多——不是靠風，是靠濕氣有地方跑。" },
  { id: "h10", kind: "home", text: "砧板生熟分開。這件事沒有折衷方案。" },

  // ── 提醒：不講漂亮話，講真的 ──
  { id: "v1", kind: "view", text: "家事永遠做不完是它的設計，不是你不夠好。" },
  { id: "v2", kind: "view", text: "「我等一下就做」和「我不做」之間的差別，是有沒有寫下來。" },
  { id: "v3", kind: "view", text: "兩個人都累的時候，先決定今天誰可以不用撐，比兩個人一起硬撐有用。" },
  { id: "v4", kind: "view", text: "今天沒做完的事，明天還在。小孩今天幾歲，明天就不是了。" },
  { id: "v5", kind: "view", text: "計畫沒跑完不代表計畫錯了。這份表是拿來參考的，不是拿來考試的。" },
  { id: "v6", kind: "view", text: "把「我來就好」說出口之前，先想一下對方是不是也在等你開口說「換你」。" },
  { id: "v7", kind: "view", text: "整天沒有一段時間是自己的，久了不會爆炸，只會慢慢變得沒有感覺。那更難救。" },
  { id: "v8", kind: "view", text: "小孩不記得你今天有沒有把地拖乾淨。他會記得你有沒有在他講話的時候看著他。" },
  { id: "v9", kind: "view", text: "累到一個程度就別再做決定了。今天的爭執有一半是因為兩個人都該睡了。" },
  { id: "v10", kind: "view", text: "偶爾外食、偶爾放生一天，不會毀掉任何東西。撐到崩潰才會。" },
];

/** 會用到這個家自己的資料的句子，比罐頭話有感覺得多。 */
const COMPUTED = [
  {
    id: "o1",
    kind: "ours",
    build: ({ now }) => {
      const kid = KIDS[Math.floor(now.day % KIDS.length)];
      return `${kid.name}今天 ${ageText(kid.birth, new Date(`${now.iso}T00:00:00Z`))}。這個階段不會再來一次。`;
    },
  },
  {
    id: "o2",
    kind: "ours",
    build: ({ now, todos }) => {
      const since = shiftIso(now.iso, -7);
      const done = todos.filter((t) => t.done && (t.doneAt || "").slice(0, 10) >= since).length;
      if (!done) return null;
      return `這一週你們一起清掉了 ${done} 件待辦。沒有人會替你們鼓掌，所以我來。`;
    },
  },
  {
    id: "o3",
    kind: "ours",
    build: ({ now, lowfreq }) => {
      const next = LOWFREQ.map((item) => {
        const last = lowfreq[item.id];
        return last ? { name: item.name, left: item.every - daysBetween(last, now.iso) } : null;
      })
        .filter((x) => x && x.left >= 0)
        .sort((a, b) => a.left - b.left)[0];
      if (!next) return null;
      return next.left === 0
        ? `${next.name}今天到期了。`
        : `距離${next.name}還有 ${next.left} 天，現在還不用急。`;
    },
  },
  {
    id: "o4",
    kind: "ours",
    build: ({ now }) => {
      const tomorrow = THEMES[(now.dow + 1) % 7];
      if (!tomorrow) return null;
      return `明天是${tomorrow.name}。前一晚把${tomorrow.prep}放到門口，早上就不用找。`;
    },
  },
  {
    id: "o5",
    kind: "ours",
    build: ({ now }) => `今晚洗的是${LAUNDRY[now.dow].wash}。洗好晾上，明晚折的就是它。`,
  },
];

const ALL = [...LINES, ...COMPUTED];

/** 抽一句。算不出來的（例如這週還沒完成任何待辦）就跳過，換下一張。 */
export function drawNote(state, context, random = Math.random) {
  let bag = state?.bag;
  for (let attempt = 0; attempt < ALL.length; attempt++) {
    const picked = drawFromBag(ALL.map((n) => n.id), bag, random);
    bag = picked.bag;
    const note = ALL.find((n) => n.id === picked.id);
    if (!note) continue;
    const text = note.build ? note.build(context) : note.text;
    if (text) return { note: { ...note, text }, bag };
  }
  return { note: null, bag };
}

export const NOTE_KIND = KIND;
export const NOTE_COUNT = ALL.length;
