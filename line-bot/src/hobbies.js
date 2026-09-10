/**
 * 「八種興趣」的提醒。出處是 Threads 上 @booktevenmore 的一則串文，
 * 這裡濃縮成八個面向，每次隨機挑一個丟出來。
 *
 * 設計上不是催人做滿八項——帶兩個幼兒的階段本來就做不到。
 * 重點是讓「已經歸零很久的那一項」被看見。
 */
export const HOBBIES = [
  { id: "body", name: "身體", examples: ["健身", "跑步", "游泳", "瑜伽", "爬山"],
    point: "要能流汗，而且難度會慢慢加上去。長期沒被挑戰的身體只會慢慢退化。" },
  { id: "mind", name: "大腦", examples: ["閱讀", "下棋", "解謎", "學一門語言", "策略遊戲"],
    point: "工作不算。下班後如果沒有事情逼你認真想，大腦就一直在最低限度運轉。" },
  { id: "make", name: "創造", examples: ["攝影", "畫畫", "寫作", "音樂", "做菜"],
    point: "做出一個昨天還不存在的東西。做得好不好不重要。" },
  { id: "inner", name: "內在", examples: ["冥想", "寫日記", "園藝", "在自然裡散步"],
    point: "唯一不追求進步的一項。沒有連續天數，沒有紀錄要破。" },
  { id: "people", name: "連結", examples: ["跳舞", "團體運動", "當志工", "旅行", "社群活動"],
    point: "要固定出現在某個地方，跟真的人相處。這項通常最先被放棄。" },
  { id: "money", name: "收入", examples: ["投資", "接案", "行銷", "內容創作", "銷售"],
    point: "在工作之外培養一項能帶來收入的能力。別等到出現危機才開始。" },
  { id: "adventure", name: "冒險", examples: ["爬山", "露營", "公路旅行", "潛水", "沒去過的地方"],
    point: "刻意打破習以為常的安排。舒適圈裡休息很好，一直住在裡面就長不出去。" },
  { id: "fun", name: "好玩", examples: ["打電動", "看電影", "收藏", "桌遊", "沒吃過的東西"],
    point: "不用證明有什麼用。每項興趣都得有用的話，那是第二份工作，不是生活。" },
];

/**
 * 洗牌抽牌：八項全部出過一輪才會重來，
 * 純隨機會連著抽到同一項，反而讓人覺得這功能很笨。
 */
export function draw(state, random = Math.random) {
  const bag = Array.isArray(state?.bag) && state.bag.length ? [...state.bag] : shuffle(random);
  const id = bag.pop();
  const hobby = HOBBIES.find((h) => h.id === id) || HOBBIES[0];
  const example = hobby.examples[Math.floor(random() * hobby.examples.length)];
  return { hobby, example, bag };
}

function shuffle(random) {
  const ids = HOBBIES.map((h) => h.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

/** 每一項多久沒碰了。沒記錄過的排最前面——那才是真正歸零的。 */
export function neglected(done, todayIso, daysBetween) {
  return HOBBIES.map((hobby) => {
    const last = done?.[hobby.id];
    return { ...hobby, last: last || "", days: last ? daysBetween(last, todayIso) : null };
  }).sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
}
