/**
 * KV 存取。家庭規模的資料量，整包 JSON 讀寫就夠。
 * 注意：同一秒內兩個人同時寫，後寫的會蓋掉先寫的。以家庭用量來說可以接受。
 */

const KEYS = { users: "users", todos: "todos", lowfreq: "lowfreq" };

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

export async function addTodo(kv, content, by) {
  const todos = await listTodos(kv);
  const todo = {
    id: newId(),
    text: content.slice(0, 200),
    by: by || "",
    at: new Date().toISOString(),
    done: false,
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

export async function getLowfreq(kv) {
  return readJson(kv, KEYS.lowfreq, {});
}

export async function setLowfreq(kv, id, iso) {
  const map = await getLowfreq(kv);
  map[id] = iso;
  await kv.put(KEYS.lowfreq, JSON.stringify(map));
  return map;
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
