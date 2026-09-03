/**
 * Flex 版型。LINE 在深色模式下會把沒指定背景的泡泡變深，
 * 所以每個容器都明確給底色與字色。
 */
import { ARC, BANDS, BLOCKS, DOW, LAUNDRY, THEMES, NIGHTLY, ANCHORS, hhmm, isWeekday } from "./data.js";

const INK = "#1D2320";
const MUTED = "#7C867F";
const ACCENT = "#2F7F78";
const ALERT = "#A6402C";
const PAPER = "#FFFFFF";
const RULE = "#E4E9E6";

function label(text, color = MUTED) {
  return { type: "text", text, size: "xxs", color, weight: "bold" };
}

function line(text, opts = {}) {
  return {
    type: "text",
    text: text || "—",
    size: opts.size || "sm",
    color: opts.color || INK,
    weight: opts.weight,
    wrap: true,
    flex: opts.flex,
  };
}

function row(name, value, color) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: name, size: "xs", color: MUTED, flex: 2 },
      { type: "text", text: value || "—", size: "sm", color: color || INK, flex: 5, wrap: true },
    ],
  };
}

function separator() {
  return { type: "separator", color: RULE };
}

function bubble(header, bodyContents, footer, size = "mega") {
  const b = {
    type: "bubble",
    size,
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: header.color || ACCENT,
      paddingAll: "14px",
      contents: [
        { type: "text", text: header.title, color: "#FFFFFF", weight: "bold", size: "md", wrap: true },
        ...(header.sub
          ? [{ type: "text", text: header.sub, color: "#E4EFED", size: "xs", wrap: true, margin: "xs" }]
          : []),
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: PAPER,
      spacing: "md",
      paddingAll: "16px",
      contents: bodyContents,
    },
  };
  if (footer) {
    b.footer = { type: "box", layout: "vertical", backgroundColor: PAPER, spacing: "sm", paddingAll: "12px", contents: footer };
  }
  return b;
}

export function flex(altText, contents) {
  return { type: "flex", altText: altText.slice(0, 400), contents };
}

function button(labelText, data, style = "secondary") {
  return {
    type: "button",
    style,
    height: "sm",
    color: style === "primary" ? ACCENT : undefined,
    action: { type: "postback", label: labelText.slice(0, 20), data, displayText: undefined },
  };
}

/**
 * 一天的色帶：橫向按分鐘數分配寬度，跟作息表網頁上那條同一個做法。
 * 下面再排一列標出「現在」的位置。
 */
function dayArc(mins) {
  const START = 450;
  const END = 1440;
  const bar = {
    type: "box",
    layout: "horizontal",
    height: "14px",
    cornerRadius: "4px",
    contents: ARC.map((seg) => ({
      type: "box",
      layout: "vertical",
      flex: seg.end - seg.start,
      backgroundColor: mins >= seg.end ? BANDS[seg.band].tint : BANDS[seg.band].color,
      contents: [{ type: "filler" }],
    })),
  };

  if (mins < START || mins >= END) return [bar];

  const before = Math.max(mins - START, 1);
  const after = Math.max(END - mins, 1);
  return [
    bar,
    {
      type: "box",
      layout: "horizontal",
      height: "10px",
      margin: "xs",
      contents: [
        { type: "box", layout: "vertical", flex: before, contents: [{ type: "filler" }] },
        { type: "box", layout: "vertical", flex: 0, width: "3px", backgroundColor: INK, contents: [{ type: "filler" }] },
        { type: "box", layout: "vertical", flex: after, contents: [{ type: "filler" }] },
      ],
    },
  ];
}

/**
 * 一天的時段列表。過去的淡掉，現在的框起來——一眼就知道自己在哪。
 * 不畫睡眠那格：它佔掉 Flex 的 10 KB 額度，但沒有人需要被提醒自己在睡覺。
 */
function timeline(mins) {
  return BLOCKS.filter((b) => b.band !== "rest").map((block) => {
    const band = BANDS[block.band];
    const now = mins >= block.start && mins < block.end;
    const past = !now && mins >= block.end;

    return {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      paddingAll: now ? "6px" : undefined,
      backgroundColor: now ? "#EAF2F0" : undefined,
      cornerRadius: now ? "6px" : undefined,
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 0,
          width: "6px",
          cornerRadius: "3px",
          backgroundColor: past ? band.tint : band.color,
          contents: [{ type: "filler" }],
        },
        {
          type: "text",
          text: `${hhmm(block.start)}  ${block.title}`,
          size: "sm",
          flex: 5,
          color: past ? MUTED : INK,
          weight: now ? "bold" : undefined,
        },
        ...(now
          ? [{ type: "text", text: "現在", size: "xxs", flex: 0, color: ACCENT, weight: "bold", align: "end" }]
          : []),
      ],
    };
  });
}

/** 今天：現在在一天的哪裡、今晚家事、主題日。 */
export function todayBubble({ dow, mins, block, laundry, theme, overdue, openCount }) {
  const weekday = isWeekday(dow);
  const body = [
    {
      type: "box",
      layout: "baseline",
      spacing: "sm",
      contents: [
        { type: "text", text: block ? block.title : "非表定時段", size: "lg", weight: "bold", color: INK, flex: 5, wrap: true },
        {
          type: "text",
          text: block ? `${hhmm(block.start)}–${hhmm(block.end)}` : "",
          size: "xs",
          color: MUTED,
          align: "end",
          flex: 3,
        },
      ],
    },
    ...dayArc(mins),
    separator(),
    ...timeline(mins),
    separator(),
    row("哥哥", weekday ? `${ANCHORS.leave}／${ANCHORS.home}` : "在家"),
    row("妹妹", theme ? `${theme.name} · ${theme.slot}` : weekday ? "在家（今天沒排主題）" : "全家一起"),
    row("今晚洗", laundry.wash),
    row("地板", laundry.floor),
    row("分工", laundry.duty),
  ];
  if (overdue.length) body.push(row("逾期家事", overdue.map((o) => o.name).join("、"), ALERT));
  body.push(row("未完成待辦", openCount ? `${openCount} 件` : "沒有，清空了"));

  return flex(
    `今天（週${DOW[dow]}）· ${block ? block.title : ""}`,
    bubble(
      { title: `今天 · 週${DOW[dow]}`, sub: weekday ? "平日" : "假日" },
      body,
      [button("看待辦", "cmd:todos"), button("一週安排", "cmd:week")],
    ),
  );
}

/** 待辦清單，每筆一個完成鈕。 */
export function todoBubble(open, done) {
  const body = [];
  if (!open.length) {
    body.push(line("目前沒有未完成的待辦。", { color: MUTED }));
  } else {
    open.slice(0, 10).forEach((t, i) => {
      body.push({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        alignItems: "center",
        contents: [
          { type: "text", text: String(i + 1), size: "xs", color: MUTED, flex: 0, align: "center" },
          {
            type: "box",
            layout: "vertical",
            flex: 5,
            contents: [
              line(t.text),
              ...(t.due
                ? [{ type: "text", text: `⏰ ${t.due.replace("T", " ")}`, size: "xxs", color: ACCENT }]
                : []),
            ],
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            flex: 2,
            action: { type: "postback", label: "完成", data: `done:${t.id}`, displayText: `完成 ${t.text}` },
          },
        ],
      });
    });
    if (open.length > 10) body.push(line(`⋯ 還有 ${open.length - 10} 件`, { color: MUTED, size: "xs" }));
  }
  if (done.length) {
    body.push(separator(), label("今天已完成"));
    done.slice(-5).forEach((t) => body.push(line(`✓ ${t.text}`, { color: MUTED, size: "xs" })));
  }
  return flex(
    `待辦 ${open.length} 件`,
    bubble({ title: `待辦 · ${open.length} 件未完成` }, body, [
      { type: "text", text: "直接打一句話就會加進待辦", size: "xxs", color: MUTED, align: "center" },
    ]),
  );
}

/** 一週安排：一天一張，共七張。 */
export function weekCarousel(todayDow) {
  const bubbles = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const weekday = isWeekday(d);
    const t = THEMES[d];
    const l = LAUNDRY[d];
    const body = [
      row("哥哥", weekday ? "08:30 出門 · 17:50 接" : "在家"),
      row("妹妹", t ? `${t.name}｜${t.slot}` : weekday ? "在家（沒排主題）" : "全家一起"),
      ...(t ? [row("內容", t.what), row("前晚備", t.prep)] : []),
      separator(),
      row("洗衣", l.wash),
      row("地板", l.floor),
      row("分工", l.duty),
    ];
    return bubble(
      { title: `週${DOW[d]}`, sub: weekday ? "平日" : "假日", color: d === todayDow ? "#1D2320" : ACCENT },
      body,
      null,
      "kilo",
    );
  });
  return flex("一週安排", { type: "carousel", contents: bubbles });
}

/** 家事：每晚固定、今晚輪值、長週期狀態。 */
export function choresBubble({ dow, laundry, lowfreq }) {
  const body = [
    label("每晚固定"),
    ...NIGHTLY.map((n) => line(`· ${n}`, { size: "xs" })),
    separator(),
    label(`今晚 · 週${DOW[dow]}`),
    row("洗衣", laundry.wash),
    row("地板", laundry.floor),
    row("分工", laundry.duty),
    separator(),
    label("長週期"),
  ];
  const footer = [];
  lowfreq.forEach((item) => {
    const state =
      item.days === null
        ? "還沒記錄"
        : item.overdue
          ? `${item.days} 天前 · 該做了`
          : `${item.days} 天前`;
    body.push(row(item.name, state, item.overdue ? ALERT : MUTED));
    if (item.overdue || item.days === null) {
      footer.push(button(`${item.name}做了`, `lf:${item.id}`, footer.length ? "secondary" : "primary"));
    }
  });
  return flex(
    "家事輪值",
    bubble({ title: "家事輪值", sub: "21:30 家事時間" }, body, footer.slice(0, 3).length ? footer.slice(0, 3) : null),
  );
}

const KIND_LABEL = { weekly: "每週", topic: "議題", setup: "設定" };

/** 這一週的討論清單：每週固定題、你丟的議題、還沒定案的設定題。 */
export function agendaBubble({ week, items }) {
  const decided = items.filter((it) => it.answer).length;
  const body = [];

  items.forEach((it, i) => {
    body.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: [
            { type: "text", text: String(i + 1), size: "xs", color: it.first && !it.answer ? ALERT : MUTED, flex: 0 },
            {
              type: "text",
              text: it.text,
              size: "sm",
              color: it.answer ? MUTED : INK,
              wrap: true,
              flex: 8,
              weight: it.first && !it.answer ? "bold" : undefined,
            },
            { type: "text", text: KIND_LABEL[it.kind], size: "xxs", color: MUTED, flex: 0, align: "end" },
          ],
        },
        ...(it.answer
          ? [{
              type: "box",
              layout: "baseline",
              spacing: "sm",
              margin: "xs",
              contents: [
                { type: "text", text: "→", size: "xs", color: ACCENT, flex: 0 },
                { type: "text", text: it.answer.text, size: "sm", color: ACCENT, weight: "bold", wrap: true, flex: 8 },
              ],
            }]
          : []),
      ],
    });
  });

  if (!items.length) body.push(line("這週沒有要談的。", { color: MUTED }));

  return flex(
    "這週的討論",
    bubble(
      { title: "這週的討論", sub: `${week} 爸媽時間 · 已回答 ${decided}/${items.length}` },
      [
        line("照編號回一句就記下來，例如「3. 先試一週」。", { color: MUTED, size: "xs" }),
        separator(),
        ...body,
      ],
      [{ type: "text", text: "平常想到：討論 加 要不要換保母", size: "xxs", color: MUTED, align: "center" }],
    ),
  );
}

/** 已經定案的安排——設定題答完就搬到這裡。 */
export function rulesBubble(setup, answers) {
  const decided = setup.map((it, i) => [it, answers[String(i + 1)]]).filter(([, a]) => a);
  const body = decided.length
    ? decided.flatMap(([it, answer]) => [
        line(it.text, { size: "xs", color: MUTED }),
        { type: "text", text: answer.text, size: "sm", color: INK, weight: "bold", wrap: true, margin: "xs" },
        separator(),
      ])
    : [line("還沒有定案的項目。打「討論」把設定題答完。", { color: MUTED })];

  return flex(
    "家規",
    bubble(
      { title: "目前的家規", sub: `${decided.length}/${setup.length} 題已定案` },
      decided.length ? body.slice(0, -1) : body,
      [{ type: "text", text: "要改：討論 3 新的答案", size: "xxs", color: MUTED, align: "center" }],
    ),
  );
}
