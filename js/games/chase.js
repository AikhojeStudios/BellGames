/* Snake Chase — steer the snake and eat only the numbers that fit the rule. */
(function () {
  "use strict";
  const { h, randInt, pick, pace, replay, reduceMotion } = App.util;

  const MODES = {
    easy: { label: "Easy", tag: "Eat the right ones", speed: 520, goal: 5, foods: 4, rules: ["even", "specific"], range: [1, 9] },
    medium: { label: "Medium", tag: "Bigger or odd", speed: 450, goal: 6, foods: 4, rules: ["bigger", "odd"], range: [1, 9] },
    hard: { label: "Hard", tag: "Trickier rules", speed: 380, goal: 7, foods: 5, rules: ["smaller", "even", "bigger"], range: [1, 12] },
  };
  const GRID = 8;
  const MIN_LEN = 3;
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right" };

  const COLORS = {
    grassA: "#D6F2DF", grassB: "#C6EBD2",
    outline: "#2A7F46", body: "#4CB868", shine: "#8FE3A3",
    food: "#FFC93C", foodDeep: "#E5A413", foodRim: "#B9820F", foodText: "#5A3D00",
    ink: "#16324F", tongue: "#E25636",
  };

  function makeRule(cfg) {
    const [lo, hi] = cfg.range;
    const type = pick(cfg.rules);
    if (type === "even") return { text: "Eat the EVEN numbers", test: (n) => n % 2 === 0 };
    if (type === "odd") return { text: "Eat the ODD numbers", test: (n) => n % 2 === 1 };
    if (type === "bigger") { const k = randInt(lo + 2, hi - 2); return { text: `Eat numbers BIGGER than ${k}`, test: (n) => n > k }; }
    if (type === "smaller") { const k = randInt(lo + 2, hi - 2); return { text: `Eat numbers SMALLER than ${k}`, test: (n) => n < k }; }
    const N = randInt(lo, hi);
    return { text: `Eat the number ${N}`, test: (n) => n === N };
  }

  const Chase = {
    id: "slither",
    title: "Snake Chase",
    tagline: "Steer & eat the right food",
    accent: "sky",
    modes: MODES,

    art() {
      return h("div", { class: "tilecombo" }, App.mascot(),
        h("span", { class: "bubbles" }, ["2", "4"].map((n) => h("span", { class: "bubble gold", text: n }))));
    },

    mount(ui) {
      this.prompt = App.Prompt();
      this.canvas = h("canvas", { class: "board", "aria-label": "Snake board. Use the arrow buttons, swipe, or tap where to go." });
      this.overlay = h("button", { class: "overlay", type: "button", onclick: () => this.resume() },
        h("span", { class: "obig", text: "▶" }), h("span", { class: "otext" }));
      this.goalText = h("div", { class: "slfoot", "aria-live": "polite" });
      const dpad = h("div", { class: "dpad" },
        Object.entries({ up: "▲", left: "◀", right: "▶", down: "▼" }).map(([d, t]) =>
          h("button", { class: "dbtn " + d, type: "button", "aria-label": "Go " + d, text: t, dataset: { d } })));
      dpad.addEventListener("click", (e) => {
        const b = e.target.closest(".dbtn");
        if (b) this.steer(b.dataset.d);
      });
      ui.body.append(this.prompt.el, h("div", { class: "card boardcard" }, this.canvas, this.overlay), this.goalText, dpad);
      this.ctx = this.canvas.getContext("2d");
      this.bindPointer();
    },

    start(mode) {
      this.stop();
      this.cfg = MODES[mode];
      const c = Math.floor(GRID / 2);
      this.snake = [{ x: c, y: c }, { x: c - 1, y: c }, { x: c - 2, y: c }];
      this.prev = this.snake.map((p) => ({ ...p }));
      this.dir = DIRS.right;
      this.queue = [];
      this.correct = 0;
      this.foods = [];
      this.sparks = [];
      this.rule = makeRule(this.cfg);
      this.prompt.set(this.rule.text, "🎯", "count");
      this.fillFoods();
      this.updateGoal();
      this.running = false;
      this.showOverlay("Tap to start!");
      this.lastTime = null;
      this.acc = 0;
      this.raf = requestAnimationFrame((t) => this.frame(t));
    },

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      this.running = false;
    },

    pause() {
      if (!this.running) return;
      this.running = false;
      this.showOverlay("Paused — tap to keep going");
    },

    resume() {
      this.overlay.hidden = true;
      this.running = true;
      this.lastTime = null;
    },

    showOverlay(text) {
      this.overlay.querySelector(".otext").textContent = text;
      this.overlay.hidden = false;
    },

    /* ---------- input ---------- */
    steer(name) {
      const nd = DIRS[name];
      if (!nd) return;
      if (!this.running) this.resume();
      const last = this.queue[this.queue.length - 1] || this.dir;
      if (nd === last || (nd.x === -last.x && nd.y === -last.y)) return; // same way, or straight back
      if (this.queue.length < 2) this.queue.push(nd);
    },

    bindPointer() {
      let start = null;
      this.canvas.addEventListener("pointerdown", (e) => { start = { x: e.clientX, y: e.clientY }; });
      this.canvas.addEventListener("pointerup", (e) => {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (Math.hypot(dx, dy) > 24) {
          // swipe
          this.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
        } else {
          // tap: turn toward the spot that was tapped
          const r = this.canvas.getBoundingClientRect();
          const cell = r.width / GRID;
          const hx = (this.snake[0].x + 0.5) * cell;
          const hy = (this.snake[0].y + 0.5) * cell;
          const tx = e.clientX - r.left - hx;
          const ty = e.clientY - r.top - hy;
          const horizontal = this.dir.y !== 0; // moving up/down → turn left/right, and vice versa
          if (horizontal && Math.abs(tx) > cell / 2) this.steer(tx > 0 ? "right" : "left");
          else if (!horizontal && Math.abs(ty) > cell / 2) this.steer(ty > 0 ? "down" : "up");
        }
      });
      this.canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    },

    onKey(e) {
      const d = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
      if (d) { e.preventDefault(); this.steer(d); }
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (this.running) this.pause(); else this.resume();
      }
    },

    /* ---------- rules ---------- */
    freeCell() {
      const head = this.snake[0];
      const ahead = [1, 2].map((k) => ({ x: (head.x + this.dir.x * k + GRID) % GRID, y: (head.y + this.dir.y * k + GRID) % GRID }));
      const busy = (x, y) => [...this.snake, ...this.foods, ...ahead].some((p) => p.x === x && p.y === y);
      const free = [];
      for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (!busy(x, y)) free.push({ x, y });
      return free.length ? pick(free) : { x: 0, y: 0 };
    },

    fillFoods() {
      const [lo, hi] = this.cfg.range;
      while (this.foods.length < this.cfg.foods) {
        this.foods.push({ ...this.freeCell(), val: randInt(lo, hi), born: performance.now() });
      }
      // always leave at least one good number on the board
      if (!this.foods.some((f) => this.rule.test(f.val))) {
        const good = [];
        for (let v = lo; v <= hi; v++) if (this.rule.test(v)) good.push(v);
        pick(this.foods).val = pick(good);
      }
    },

    tick() {
      if (this.queue.length) this.dir = this.queue.shift();
      this.prev = this.snake.map((p) => ({ ...p }));
      const head = this.snake[0];
      const nx = (head.x + this.dir.x + GRID) % GRID;
      const ny = (head.y + this.dir.y + GRID) % GRID;
      this.snake.unshift({ x: nx, y: ny });

      const fi = this.foods.findIndex((f) => f.x === nx && f.y === ny);
      if (fi < 0) { this.snake.pop(); return; }

      const food = this.foods.splice(fi, 1)[0];
      if (this.rule.test(food.val)) {
        App.Sound.yum();
        this.correct++;
        this.ui.award({ celebrate: false });
        this.spark(nx, ny, "+1", "#2E9A50");
        if (this.correct >= this.cfg.goal) {
          this.correct = 0;
          App.Sound.win();
          App.FX.celebrate(true, "⭐ GREAT!");
          this.rule = makeRule(this.cfg);
          this.prompt.set(this.rule.text, "🎯", "count");
        }
      } else {
        App.Sound.miss();
        replay(this.canvas, "flash");
        this.spark(nx, ny, "✗", "#E25636");
        this.snake.pop();
        if (this.snake.length > MIN_LEN) this.snake.pop();
      }
      this.fillFoods();
      this.updateGoal();
    },

    updateGoal() {
      this.goalText.textContent = `Yum: ${this.correct} / ${this.cfg.goal}`;
      this.ui.setProgress(this.correct / this.cfg.goal);
    },

    spark(x, y, text, color) {
      this.sparks.push({ x, y, text, color, born: performance.now() });
    },

    /* ---------- animation loop ---------- */
    frame(now) {
      this.raf = requestAnimationFrame((t) => this.frame(t));
      if (this.running) {
        if (this.lastTime != null) this.acc += Math.min(now - this.lastTime, 250);
        this.lastTime = now;
        while (this.acc >= this.cfg.speed) { this.acc -= this.cfg.speed; this.tick(); }
      }
      this.draw(now, reduceMotion ? 1 : this.acc / this.cfg.speed);
    },

    fitCanvas() {
      const w = this.canvas.clientWidth;
      if (!w) return false;
      const dpr = window.devicePixelRatio || 1;
      if (this.canvas.width !== Math.round(w * dpr)) {
        this.canvas.width = this.canvas.height = Math.round(w * dpr);
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cell = w / GRID;
      return true;
    },

    draw(now, alpha) {
      if (!this.fitCanvas()) return;
      const { ctx, cell } = this;

      // grass
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          ctx.fillStyle = (x + y) % 2 ? COLORS.grassB : COLORS.grassA;
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }

      // foods: golden fruit that bob gently
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const f of this.foods) {
        const grow = Math.min(1, (now - f.born) / 300);
        const bob = reduceMotion ? 0 : Math.sin(now / 320 + f.x * 1.7 + f.y) * cell * 0.04;
        const cx = (f.x + 0.5) * cell;
        const cy = (f.y + 0.5) * cell + bob;
        const r = cell * 0.4 * (0.5 + 0.5 * grow);
        ctx.fillStyle = "rgba(22,50,79,.15)";
        ctx.beginPath(); ctx.ellipse(cx, (f.y + 0.86) * cell, r * 0.8, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
        g.addColorStop(0, "#FFE9A6"); g.addColorStop(0.55, COLORS.food); g.addColorStop(1, COLORS.foodDeep);
        ctx.fillStyle = g;
        ctx.strokeStyle = COLORS.foodRim;
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = COLORS.foodText;
        ctx.font = `700 ${Math.round(r * 1.05)}px Fredoka, Nunito, system-ui, sans-serif`;
        ctx.fillText(String(f.val), cx, cy + r * 0.06);
      }

      // snake: glide each segment from its last spot to its new one
      const pts = this.snake.map((p, i) => {
        const q = this.prev[i] || p;
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const wrapped = Math.abs(dx) > 1 || Math.abs(dy) > 1;
        const k = wrapped ? 1 : alpha;
        return { x: (q.x + dx * k + 0.5) * cell, y: (q.y + dy * k + 0.5) * cell };
      });
      // split the body where it wraps around an edge
      const runs = [[pts[0]]];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (Math.abs(a.x - b.x) > cell * 1.5 || Math.abs(a.y - b.y) > cell * 1.5) runs.push([]);
        runs[runs.length - 1].push(b);
      }
      const stroke = (width, color) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = ctx.lineJoin = "round";
        for (const run of runs) {
          if (run.length === 1) { ctx.beginPath(); ctx.arc(run[0].x, run[0].y, width / 2, 0, Math.PI * 2); ctx.fill(); continue; }
          ctx.beginPath();
          run.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.stroke();
        }
      };
      stroke(cell * 0.74, COLORS.outline);
      stroke(cell * 0.6, COLORS.body);
      ctx.globalAlpha = 0.55;
      stroke(cell * 0.16, COLORS.shine);
      ctx.globalAlpha = 1;

      // head
      const hp = pts[0];
      const d = this.dir;
      const hr = cell * 0.42;
      // tongue flicks now and then
      if (!reduceMotion && Math.floor(now / 900) % 3 === 0) {
        ctx.strokeStyle = COLORS.tongue;
        ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.beginPath();
        const tx = hp.x + d.x * hr * 1.5, ty = hp.y + d.y * hr * 1.5;
        ctx.moveTo(hp.x + d.x * hr * 0.8, hp.y + d.y * hr * 0.8);
        ctx.lineTo(tx, ty);
        ctx.lineTo(tx + (d.x * 0.3 - d.y * 0.25) * hr, ty + (d.y * 0.3 + d.x * 0.25) * hr);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (d.x * 0.3 + d.y * 0.25) * hr, ty + (d.y * 0.3 - d.x * 0.25) * hr);
        ctx.stroke();
      }
      ctx.fillStyle = COLORS.body;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = Math.max(2, cell * 0.07);
      ctx.beginPath(); ctx.arc(hp.x, hp.y, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // eyes sit to each side of the way it's facing, pupils look ahead
      const side = { x: -d.y, y: d.x };
      for (const s of [-1, 1]) {
        const ex = hp.x + d.x * hr * 0.25 + side.x * s * hr * 0.42;
        const ey = hp.y + d.y * hr * 0.25 + side.y * s * hr * 0.42;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(ex, ey, hr * 0.27, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath(); ctx.arc(ex + d.x * hr * 0.1, ey + d.y * hr * 0.1, hr * 0.13, 0, Math.PI * 2); ctx.fill();
      }

      // +1 / ✗ sparks float up and fade
      this.sparks = this.sparks.filter((s) => now - s.born < 800);
      for (const s of this.sparks) {
        const t = (now - s.born) / 800;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = s.color;
        ctx.font = `700 ${Math.round(cell * 0.5)}px Fredoka, Nunito, system-ui, sans-serif`;
        ctx.fillText(s.text, (s.x + 0.5) * cell, (s.y + 0.2 - t * 0.8) * cell);
      }
      ctx.globalAlpha = 1;
    },
  };

  App.Games.register(Chase);
})();
