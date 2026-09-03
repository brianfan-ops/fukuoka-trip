/**
 * Flex 版型。LINE 在深色模式下會把沒指定背景的泡泡變深，
 * 所以每個容器都明確給底色與字色。
 */
import { DOW, LAUNDRY, THEMES, NIGHTLY, ANCHORS, isWeekday } from "./data.js";

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

/** 今天：現在時段、今晚家事、主題日。 */
export function todayBubble({ dow, block, nextBlock, laundry, theme, overdue, openCount }) {
  const weekday = isWeekday(dow);
  const body = [
    row("現在", block ? block.title : "非表定時段"),
    row("接下來", nextBlock ? `${nextBlock.at} ${nextBlock.title}` : "—"),
    separator(),
    row("哥哥", weekday ? `${ANCHORS.leave}／${ANCHORS.home}` : "在家"),
    row("妹妹", theme ? `${theme.name} · ${theme.slot}` : weekday ? "在家（今天沒排主題）" : "全家一起"),
    separator(),
    row("今晚洗", laundry.wash),
    row("地板", laundry.floor),
    row("分工", laundry.duty),
  ];
  if (overdue.length) {
    body.push(separator(), row("逾期家事", overdue.map((o) => o.name).join("、"), ALERT));
  }
  body.push(row("未完成待辦", openCount ? `${openCount} 件` : "沒有，清空了"));
  return flex(
    `今天（週${DOW[dow]}）`,
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

/** 下週討論清單。已經有答案的直接顯示在題目下面。 */
export function agendaBubble(items, answers = {}) {
  const body = [];
  let decided = 0;
  items.forEach((it, i) => {
    const answer = answers[String(i + 1)];
    if (answer) decided += 1;
    body.push({
      type: "box",
      layout: "vertical",
      spacing: "none",
      contents: [
        {
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: [
            { type: "text", text: String(i + 1), size: "xs", color: it.first && !answer ? ALERT : MUTED, flex: 0 },
            {
              type: "text",
              text: it.text,
              size: "sm",
              color: answer ? MUTED : INK,
              wrap: true,
              flex: 8,
              weight: it.first && !answer ? "bold" : undefined,
            },
          ],
        },
        ...(answer
          ? [{
              type: "box",
              layout: "baseline",
              spacing: "sm",
              margin: "xs",
              contents: [
                { type: "text", text: "→", size: "xs", color: ACCENT, flex: 0 },
                { type: "text", text: answer.text, size: "sm", color: ACCENT, weight: "bold", wrap: true, flex: 8 },
              ],
            }]
          : []),
      ],
    });
  });

  return flex(
    "下週討論",
    bubble(
      { title: "下週行程討論", sub: `週日 23:00 爸媽時間 · 已決定 ${decided}/${items.length}` },
      [
        line(
          decided === items.length ? "全部都有答案了。" : "照編號回一句就記下來，例如「3. 先試一週」。",
          { color: MUTED, size: "xs" },
        ),
        separator(),
        ...body,
      ],
    ),
  );
}
