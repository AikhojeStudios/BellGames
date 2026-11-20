/* Number Path — fill the missing numbers on the snake. */
(function () {
  "use strict";
  const { h, randInt, pick, shuffle, pace, timers } = App.util;

  const MODES = {
    easy: { label: "Easy", tag: "Count by 1s", steps: [1], len: 6, blanks: 1, startMax: 9 },
    medium: { label: "Medium", tag: "Count by 1s & 2s", steps: [1, 2], len: 7, blanks: 2, startMax: 14 },
    hard: { label: "Hard", tag: "Skip count by 2, 5, 10", steps: [2, 5, 10], len: 6, blanks: 2, startMax: 20 },
  };

  function makePuzzle(mode) {
    const m = MODES[mode];
    for (let tries = 0; tries < 40; tries++) {
      const step = pick(m.steps);
      const start = randInt(1, m.startMax);
      const seq = Array.from({ length: m.len }, (_, i) => start + i * step);
      if (seq[seq.length - 1] > 99) continue;
      // never hide the first number: it shows where to start
      const blanks = shuffle([...seq.keys()].slice(1)).slice(0, m.blanks).sort((a, b) => a - b);
      return { seq, step, blanks, filled: new Set() };
    }
    return { seq: [2, 4, 6, 8, 10, 12], step: 2, blanks: [3], filled: new Set() };
  }

  const Path = {
    id: "path",
    title: "Number Path",
    tagline: "Fill the missing numbers",
    accent: "green",
    modes: MODES,
    locked: false,
    t: timers(),

    art() {
      return h("div", { class: "tilecombo" }, App.mascot(),
        h("span", { class: "bubbles" }, ["1", "2", "?"].map((n) => h("span", { class: "bubble", text: n }))));
    },

    mount(ui) {
      this.prompt = App.Prompt();
      this.box = h("div", { class: "snakebox" });
      this.entry = new App.NumberInput();
      this.reveal = h("div", { class: "reveal", "aria-live": "polite" });
      ui.body.append(
        this.prompt.el,
        h("div", { class: "card" },
          this.box,
          h("div", { class: "answerrow" }, this.entry.el, App.HelpButton("Show me", () => this.press("help"))),
          this.reveal),
        App.Keypad((k) => this.press(k)));
    },

    start(mode) { this.mode = mode; this.next(); },
    stop() { this.t.clear(); this.locked = true; },

    next() {
      this.t.clear();
      this.locked = false;
      this.cur = makePuzzle(this.mode);
      this.entry.clear();
      this.reveal.classList.remove("show");
      this.prompt.set("Fill in the missing number!", "🔢", "add");
      this.render();
    },

    activeIndex() { return this.cur.blanks.find((b) => !this.cur.filled.has(b)); },

    render(justFilled) {
      const act = this.activeIndex();
      const cells = this.cur.seq.map((v, i) => {
        const blank = this.cur.blanks.includes(i) && !this.cur.filled.has(i);
        return {
          text: blank ? "?" : v,
          cls: [blank && "blank", i === act && "active", i === justFilled && "pop"].filter(Boolean).join(" "),
        };
      });
      this.snake = App.snakeRow(cells);
      this.box.replaceChildren(this.snake.el);
    },

    submit() {
      const idx = this.activeIndex();
      if (idx === undefined || this.entry.number == null) return;
      if (this.entry.number !== this.cur.seq[idx]) return this.miss();
      this.cur.filled.add(idx);
      App.Sound.count();
      this.entry.clear();
      this.render(idx);
      if (this.activeIndex() === undefined) this.win();
      else this.prompt.set("Yes! One more…", "🔢", "add");
    },

    win() {
      this.locked = true;
      this.snake.el.classList.add("win");
      this.reveal.textContent = this.cur.seq.join(", ");
      this.reveal.classList.add("show");
      this.ui.award();
      this.t.after(pace(2000, 1000), () => this.next());
    },

    miss() {
      App.Sound.miss();
      this.entry.shake();
      this.entry.clear();
      this.prompt.set(`It goes up by ${this.cur.step} each time`, "💡", "hint");
    },

    help() {
      const idx = this.activeIndex();
      if (idx === undefined) return;
      const prev = this.cur.seq[idx - 1];
      this.entry.set(this.cur.seq[idx]);
      this.prompt.set(`${prev} + ${this.cur.step} = ${this.cur.seq[idx]}. Press OK!`, "💡", "hint");
    },

    press(k) { App.pressNumberKey(this, k); },
    onKey(e) {
      const k = App.keyFromEvent(e);
      if (!k) return;
      if (k === "back" || k === "enter") e.preventDefault();
      this.press(k);
    },
  };

  App.Games.register(Path);
})();
