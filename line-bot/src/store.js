/**
 * KV 存取。家庭規模的資料量，整包 JSON 讀寫就夠。
 * 注意：同一秒內兩個人同時寫，後寫的會蓋掉先寫的。以家庭用量來說可以接受。
 */

const KEYS = {
  users: "users",
  todos: "todos",
  lowfreq: "lowfreq",
  answers: "answers", // 設定題的答案＝家規，永久保留
  weekly: "weekly", // 每週題的答案，key 帶週次
  topics: "topics", // 平常想到就丟進來的議題
};

async function readJson(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function listUsers(kv) {
  return readJson(kv, KEYS.users, []);
}

/** 記住加好友的人，排程推播時要用。 */
export async function rememberUser(kv, userId, name) {
  const users = await listUsers(kv);
  const found = users.find((u) => u.id === userId);
  if (found) {
    if (name && found.name !== name) {
      found.name = name;
      await kv.put(KEYS.users, JSON.stringify(users));
    }
    return users;
  }
  users.push({ id: userId, name: name || "", joinedAt: new Date().toISOString() });
  await kv.put(KEYS.users, JSON.stringify(users));
  return users;
}

export async function forgetUser(kv, userId) {
  const users = (await listUsers(kv)).filter((u) => u.id !== userId);
  await kv.put(KEYS.users, JSON.stringify(users));
}

export async function listTodos(kv) {
  return readJson(kv, KEYS.todos, []);
}

export async function addTodo(kv, content, by, extra = {}) {
  const todos = await listTodos(kv);
  const todo = {
    id: newId(),
    text: content.slice(0, 200),
    by: by || "",
    at: new Date().toISOString(),
    done: false,
    ...extra,
  };
  todos.push(todo);
  await kv.put(KEYS.todos, JSON.stringify(trim(todos)));
  return todo;
}

export async function setDone(kv, id, done, by) {
  const todos = await listTodos(kv);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return null;
  todo.done = done;
  todo.doneBy = done ? by || "" : "";
  todo.doneAt = done ? new Date().toISOString() : "";
  await kv.put(KEYS.todos, JSON.stringify(todos));
  return todo;
}

export async function removeTodo(kv, id) {
  const todos = await listTodos(kv);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return null;
  await kv.put(KEYS.todos, JSON.stringify(todos.filter((t) => t.id !== id)));
  return todo;
}

/** 到期又還沒提醒過的。stamp 是「YYYY-MM-DDTHH:MM」台北時間。 */
export async function dueTodos(kv, stamp) {
  const todos = await listTodos(kv);
  return todos.filter((t) => !t.done && t.due && !t.remindedAt && t.due <= stamp);
}

export async function markReminded(kv, ids, at) {
  const todos = await listTodos(kv);
  for (const todo of todos) {
    if (ids.includes(todo.id)) todo.remindedAt = at;
  }
  await kv.put(KEYS.todos, JSON.stringify(todos));
}

/** 拿掉提醒時間，待辦本身留著。 */
export async function clearDue(kv, id) {
  const todos = await listTodos(kv);
  const todo = todos.find((t) => t.id === id);
  if (!todo) return null;
  delete todo.due;
  delete todo.remindedAt;
  await kv.put(KEYS.todos, JSON.stringify(todos));
  return todo;
}

/** 每晚那則有沒有發過，避免五分鐘一次的排程重複推。 */
export async function nightlySentOn(kv) {
  return (await kv.get("lastNightly")) || "";
}

export async function markNightlySent(kv, iso) {
  await kv.put("lastNightly", iso);
}

export async function getLowfreq(kv) {
  return readJson(kv, KEYS.lowfreq, {});
}

export async function setLowfreq(kv, id, iso) {
  const map = await getLowfreq(kv);
  map[id] = iso;
  await kv.put(KEYS.lowfreq, JSON.stringify(map));
  return map;
}

/** 討論清單的答案，key 是題號字串。 */
export async function getAnswers(kv) {
  return readJson(kv, KEYS.answers, {});
}

/** 同一題再回一次就覆蓋掉舊答案。 */
export async function saveAnswers(kv, entries, by) {
  const answers = await getAnswers(kv);
  for (const [no, text] of entries) {
    answers[String(no)] = { text: text.slice(0, 200), by: by || "", at: new Date().toISOString() };
  }
  await kv.put(KEYS.answers, JSON.stringify(answers));
  return answers;
}

export async function getWeekly(kv) {
  return readJson(kv, KEYS.weekly, {});
}

export async function saveWeekly(kv, entries, by) {
  const weekly = await getWeekly(kv);
  for (const [key, value] of entries) {
    weekly[key] = { text: value.slice(0, 200), by: by || "", at: new Date().toISOString() };
  }
  await kv.put(KEYS.weekly, JSON.stringify(weekly));
  return weekly;
}

export async function listTopics(kv) {
  return readJson(kv, KEYS.topics, []);
}

/** 平常想到的議題，丟著等週日一起看。 */
export async function addTopic(kv, text, by) {
  const topics = await listTopics(kv);
  const topic = {
    id: newId(),
    text: text.slice(0, 200),
    by: by || "",
    at: new Date().toISOString(),
  };
  topics.push(topic);
  await kv.put(KEYS.topics, JSON.stringify(topics.slice(-50)));
  return topic;
}

export async function answerTopic(kv, id, answer, by) {
  const topics = await listTopics(kv);
  const topic = topics.find((t) => t.id === id);
  if (!topic) return null;
  topic.answer = answer.slice(0, 200);
  topic.answeredBy = by || "";
  topic.answeredAt = new Date().toISOString();
  await kv.put(KEYS.topics, JSON.stringify(topics));
  return topic;
}

export async function clearAnswers(kv) {
  await kv.put(KEYS.answers, JSON.stringify({}));
}

/**
 * 行事曆訂閱網址裡的那串亂碼。網址就是密碼——拿到的人就看得到，
 * 所以要能重設（重設後舊網址立刻失效）。
 */
export async function calendarToken(kv, { reset = false } = {}) {
  if (!reset) {
    const existing = await kv.get("calToken");
    if (existing) return existing;
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await kv.put("calToken", token);
  return token;
}

/** 完成日期用台北時間比較，所以存的 ISO 要先轉過去。 */
export function taipeiDateOf(isoTimestamp) {
  if (!isoTimestamp) return "";
  const t = new Date(isoTimestamp);
  if (Number.isNaN(t.getTime())) return "";
  return new Date(t.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 已完成的只留最近 50 筆，未完成的全留。 */
function trim(todos) {
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).slice(-50);
  return [...open, ...done];
}

function newId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}
