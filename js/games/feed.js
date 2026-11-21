/* Feed the Snake — tap the apple with the right number. */
(function () {
  "use strict";
  const { h, randInt, pick, shuffle, pace, timers, replay } = App.util;

  const MODES = {
    easy: { label: "Easy", tag: "Find the number", types: ["match", "after"], range: [1, 9], choices: 3 },
    medium: { label: "Medium", tag: "Before, after, bigger", types: ["after", "before", "bigger"], range: [1, 12], choices: 4 },
    hard: { label: "Hard", tag: "Compare & add", types: ["bigger", "smaller", "sum"], range: [1, 9], choices: 4 },
  };

  function makePuzzle(mode) {
    const m = MODES[mode];
    const [lo, hi] = m.range;
    const type = pick(m.types);
    let text, correct;

    if (type === "bigger" || type === "smaller") {
      // compare exactly two different numbers
      const a = randInt(lo, hi);
      let b = randInt(lo, hi);
      while (b === a) b = randInt(lo, hi);
      correct = type === "bigger" ? Math.max(a, b) : Math.min(a, b);
      text = type === "bigger" ? "Feed me the BIGGER number" : "Feed me the SMALLER number";
      return { text, correct, choices: shuffle([a, b]) };
    }

    if (type === "match") { correct = randInt(lo, hi); text = `Feed me the number ${correct}`; }
    else if (type === "after") { const n = randInt(lo, hi - 1); correct = n + 1; text = `What comes AFTER ${n}?`; }
    else if (type === "before") { const n = randInt(lo + 1, hi); correct = n - 1; text = `What comes BEFORE ${n}?`; }
    else { const a = randInt(1, 5), b = randInt(1, 5); correct = a + b; text = `Feed me ${a} + ${b}`; }

    const set = new Set([correct]);
    for (let guard = 0; set.size < m.choices && guard < 60; guard++) {
      const d = type === "sum" ? randInt(2, 10) : correct + randInt(-3, 3);
      if (d >= 1) set.add(d);
    }
    return { text, correct, choices: shuffle([...set]) };
  }

  const Feed = {
    id: "feed",
    title: "Feed the Snake",
    tagline: "Feed the hungry snake",
    accent: "coral",
    modes: MODES,
    locked: false,
    t: timers(),
    typed: "",

    art() {
      return h("div", { class: "tilecombo" }, App.mascot(), h("span", { class: "apple mini", "aria-hidden": "true" }));
    },

    mount(ui) {
      this.snakeBox = h("div", { class: "feedsnake" });
      this.prompt = App.Prompt();
      this.foods = h("div", { class: "foods" });
      ui.body.append(
        h("div", { class: "card feedcard" }, this.snakeBox, this.prompt.el, this.foods),
        h("p", { class: "hint", text: "Tap the right apple" }));
    },

    start(mode) { this.mode = mode; this.next(); },
    stop() { this.t.clear(); this.locked = true; },

    next() {
      this.t.clear();
      this.locked = false;
      this.typed = "";
      this.cur = makePuzzle(this.mode);
      this.prompt.set(this.cur.text, "🍎", "sub");
      this.renderSnake();
      this.foods.replaceChildren(...this.cur.choices.map((v, i) =>
        h("button", {
          class: "apple food", type: "button", text: v, "aria-label": "Feed " + v,
          style: { "animation-delay": pace(i * 70, 0) + "ms" },
          dataset: { v },
          onclick: (e) => this.pick(v, e.currentTarget),
        })));
    },

    renderSnake() {
      // the snake grows with each apple it eats this round
      const len = Math.min(2 + this.ui.stars, 12);
      this.snake = App.snakeRow(Array.from({ length: len }, () => ({})));
      this.snakeBox.replaceChildren(this.snake.el);
    },

    pick(v, btn) {
      if (this.locked) return;
      if (v !== this.cur.correct) {
        App.Sound.miss();
        replay(btn, "wrong");
        return;
      }
      this.locked = true;
      App.Sound.yum();
      btn.classList.add("eaten");
      replay(this.snake.head, "chomp");
      this.ui.award({ text: (big) => (big ? "⭐ YUM!" : "😋 YUM!") });
      this.t.after(pace(850, 600), () => this.next());
    },

    /** Typing a number picks the apple with that number (1 or 2 digits). */
    onKey(e) {
      if (!/^\d$/.test(e.key) || this.locked) return;
      this.typed += e.key;
      const vals = this.cur.choices.map(String);
      const exact = vals.includes(this.typed);
      const longer = vals.some((v) => v.length > this.typed.length && v.startsWith(this.typed));
      const choose = () => {
        const v = Number(this.typed);
        this.typed = "";
        const btn = this.foods.querySelector(`[data-v="${v}"]`);
        if (btn) this.pick(v, btn);
      };
      if (exact && !longer) choose();
      else if (longer) this.t.after(700, () => { if (this.typed) choose(); });
      else this.typed = "";
    },
  };

  App.Games.register(Feed);
})();
