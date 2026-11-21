/* The Monier — count US coins, then add and take away. */
(function () {
  "use strict";
  const { h, randInt, pick, shuffle, pace, timers } = App.util;

  const COINS = {
    penny: { value: 1, name: "Penny", size: 52 },
    nickel: { value: 5, name: "Nickel", size: 58 },
    dime: { value: 10, name: "Dime", size: 46 },
    quarter: { value: 25, name: "Quarter", size: 66 },
  };
  const ORDER = ["quarter", "dime", "nickel", "penny"];
  const coinSrc = (type) => `assets/coins/${type}.webp`;
  const byValueDesc = (a, b) => COINS[b.type].value - COINS[a.type].value;
  const valueOf = (coins) => coins.reduce((s, c) => s + COINS[c.type].value, 0);

  const MODES = {
    easy: {
      label: "Easy", tag: "Count the coins", ops: ["count"], maxTotal: 35,
      coins: ["dime", "nickel", "penny"],
      pool: [{ t: "dime", min: 0, max: 2 }, { t: "nickel", min: 0, max: 2 }, { t: "penny", min: 1, max: 5 }],
    },
    medium: {
      label: "Medium", tag: "Add & take away", ops: ["+", "-"], maxTotal: 65,
      coins: ["quarter", "dime", "nickel", "penny"],
      pool: [{ t: "quarter", min: 0, max: 1 }, { t: "dime", min: 0, max: 2 }, { t: "nickel", min: 0, max: 2 }, { t: "penny", min: 0, max: 4 }],
    },
    hard: {
      label: "Hard", tag: "Bigger money math", ops: ["+", "-"], maxTotal: 99,
      coins: ["quarter", "dime", "nickel", "penny"],
      pool: [{ t: "quarter", min: 0, max: 2 }, { t: "dime", min: 0, max: 3 }, { t: "nickel", min: 0, max: 3 }, { t: "penny", min: 0, max: 5 }],
    },
  };

  const PROMPTS = {
    count: ["How much money?", "¢", "count"],
    "+": ["Add it up!", "+", "add"],
    "-": ["How much is left?", "−", "sub"],
  };

  const coinImg = (type, size) =>
    h("img", { src: coinSrc(type), alt: COINS[type].name, width: size, height: size, draggable: "false" });

  /* ---------- puzzle making ---------- */
  function makeAdd(m) {
    const groups = shuffle(m.pool.map((p) => p.t)).slice(0, 2)
      .map((t) => ({ type: t, count: randInt(1, Math.max(1, m.pool.find((p) => p.t === t).max)) }))
      .sort(byValueDesc);
    const total = groups.reduce((s, g) => s + g.count * COINS[g.type].value, 0);
    if (total < 3 || total > m.maxTotal) return null;
    const coins = groups.flatMap((g, gi) => Array.from({ length: g.count }, () => ({ type: g.type, group: gi, taken: false })));
    const parts = groups.map((g) => g.count * COINS[g.type].value);
    return { op: "+", coins, answer: total, reveal: `${parts.join(" + ")} = ${total}¢` };
  }

  function makeSet(m, op) {
    const coins = m.pool.flatMap((p) => Array.from({ length: randInt(p.min, p.max) }, () => ({ type: p.t, group: 0, taken: false })));
    coins.sort(byValueDesc);
    const total = valueOf(coins);
    if (total < 3 || total > m.maxTotal || coins.length < 2) return null;

    if (op === "count") {
      const subtotals = ORDER.map((t) => valueOf(coins.filter((c) => c.type === t))).filter(Boolean);
      return { op, coins, answer: total, reveal: `${subtotals.join(" + ")} = ${total}¢` };
    }
    // take away: cross out 1–3 coins, never all of them
    const k = randInt(1, Math.min(3, coins.length - 1));
    const taken = shuffle([...coins.keys()]).slice(0, k);
    taken.forEach((i) => (coins[i].taken = true));
    const away = valueOf(coins.filter((c) => c.taken));
    return { op, coins, answer: total - away, reveal: `${total} − ${away} = ${total - away}¢` };
  }

  function makePuzzle(mode) {
    const m = MODES[mode];
    const op = pick(m.ops);
    for (let tries = 0; tries < 60; tries++) {
      const q = op === "+" ? makeAdd(m) : makeSet(m, op);
      if (q) return q;
    }
    return {
      op: "count", answer: 12, reveal: "10 + 2 = 12¢",
      coins: ["dime", "penny", "penny"].map((type) => ({ type, group: 0, taken: false })),
    };
  }

  /* ---------- the game ---------- */
  const Monier = {
    id: "monier",
    title: "The Monier",
    tagline: "Count the money",
    accent: "gold",
    modes: MODES,
    locked: false,
    t: timers(),

    art() {
      return h("div", { class: "coinpile" }, ["quarter", "dime", "penny"].map((t) => coinImg(t, 58)));
    },
    modeArt(mode) {
      return h("span", { class: "coinpile sm" }, MODES[mode].coins.map((t) => coinImg(t, 38)));
    },

    mount(ui) {
      this.prompt = App.Prompt();
      this.tray = h("div", { class: "tray" });
      this.entry = new App.NumberInput({ unit: "¢" });
      this.reveal = h("div", { class: "reveal", "aria-live": "polite" });
      this.legend = h("div", { class: "legend", "aria-label": "Coin values" });
      ui.body.append(
        this.prompt.el,
        h("div", { class: "card" },
          this.tray,
          h("div", { class: "answerrow" }, this.entry.el, App.HelpButton("Count with me", () => this.press("help"))),
          this.reveal),
        this.legend,
        App.Keypad((k) => this.press(k)));
    },

    start(mode) {
      this.mode = mode;
      this.legend.replaceChildren(...MODES[mode].coins.map((t) =>
        h("div", { class: "legendcoin" }, coinImg(t, 32),
          h("span", { class: "v", text: COINS[t].value + "¢" }),
          h("span", { class: "n", text: COINS[t].name }))));
      this.next();
    },
    stop() { this.t.clear(); this.locked = true; },

    next() {
      this.t.clear();
      this.locked = false;
      this.wrong = 0;
      this.cur = makePuzzle(this.mode);
      this.entry.clear();
      this.reveal.classList.remove("show");
      const [text, icon, tone] = PROMPTS[this.cur.op];
      this.prompt.set(text, icon, tone);
      this.renderTray();
    },

    renderTray() {
      const { coins, op } = this.cur;
      const groups = [];
      coins.forEach((c, i) => {
        if (!groups[c.group]) groups[c.group] = h("div", { class: "group" });
        const el = h("div", {
          class: "coin" + (c.taken ? " taken" : ""),
          style: { width: COINS[c.type].size + "px", height: COINS[c.type].size + "px", "animation-delay": pace(i * 50, 0) + "ms" },
          dataset: { val: COINS[c.type].value, taken: c.taken ? "1" : "0" },
        }, coinImg(c.type, COINS[c.type].size));
        groups[c.group].append(el);
      });
      const parts = [];
      groups.forEach((g, i) => {
        if (i > 0 && op === "+") parts.push(h("div", { class: "op", text: "+" }));
        parts.push(g);
      });
      this.qmark = h("span", { class: "qmark", text: "?" });
      parts.push(h("div", { class: "eq" }, h("span", { text: "=" }), this.qmark));
      this.tray.replaceChildren(...parts);
    },

    submit() {
      if (this.entry.number == null) return;
      if (this.entry.number === this.cur.answer) this.win();
      else this.miss();
    },

    win() {
      this.locked = true;
      this.qmark.textContent = this.cur.answer + "¢";
      this.qmark.classList.add("solved");
      this.reveal.textContent = this.cur.reveal;
      this.reveal.classList.add("show");
      this.ui.award();
      this.t.after(pace(1900, 900), () => this.next());
    },

    miss() {
      this.wrong++;
      App.Sound.miss();
      this.entry.shake();
      this.entry.clear();
      if (this.wrong >= 2) this.t.after(500, () => this.help());
    },

    /** Count the coins out loud, one by one, building a running total. */
    help() {
      if (this.locked) return;
      this.locked = true;
      const coins = [...this.tray.querySelectorAll(".coin")].filter((e) => e.dataset.taken !== "1");
      let run = 0;
      let i = 0;
      this.entry.clear();
      const step = () => {
        if (i >= coins.length) {
          this.entry.set(this.cur.answer);
          this.locked = false;
          return;
        }
        const el = coins[i++];
        run += Number(el.dataset.val);
        App.util.replay(el, "lit");
        this.entry.set(run);
        App.Sound.count();
        this.t.after(pace(640, 250), step);
      };
      this.t.after(300, step);
    },

    press(k) { App.pressNumberKey(this, k); },
    onKey(e) {
      const k = App.keyFromEvent(e);
      if (!k) return;
      if (k === "back" || k === "enter") e.preventDefault();
      this.press(k);
    },
  };

  App.Games.register(Monier);
})();
