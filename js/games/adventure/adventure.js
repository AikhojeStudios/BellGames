/* =====================================================================
   Going on an Adventure — engine
   Walk around the neighborhood, talk to people, read signs, and meet
   critters in the tall grass. Critters become friends when you answer
   their math questions.
     draw.js   pictures (your drawings, or placeholder doodles)
     world.js  maps, people, critters and questions
   The world is drawn on a canvas; talking, menus and the Critter Book
   are regular page elements on top, so they can be tapped directly.
   ===================================================================== */
(function () {
  "use strict";
  const { h, pick, randInt } = App.util;
  const AD = App.Adventure;
  const D = AD.draw;
  const { TILES, CRITTERS, MAPS, START, makeQuestion } = AD.world;

  const STEP = 14;            // frames to walk one tile
  const BIKE_STEP = 8;        // frames to ride one tile
  const NPC_STEP = 22;        // people stroll a bit slower
  const LINE = 30;            // characters per line of talking
  const LINES = 3;            // lines per page of talking
  const FRIENDS_NEEDED = 3;   // right answers to make a friend
  const BORED_LIMIT = 3;      // wrong answers before a critter leaves
  const ENCOUNTER_RATE = 0.09;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
  const KEYS = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    z: "a", " ": "a", Enter: "a", x: "b", Backspace: "b", Shift: "start", m: "start",
  };

  /* ---------------- input ---------------- */
  const Input = {
    held: [],
    pressed: new Set(),
    hold(d) { if (!this.held.includes(d)) { this.held.push(d); this.pressed.add(d); } },
    release(d) { this.held = this.held.filter((x) => x !== d); },
    press(b) { this.pressed.add(b); },
    take(b) { return this.pressed.delete(b); },
    dir() { return this.held[this.held.length - 1] || null; },
    clear() { this.held = []; this.pressed.clear(); },
  };

  /* ---------------- text ---------------- */
  function wrap(text) {
    const lines = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? line + " " + word : word;
      if (next.length > LINE && line) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  const paginate = (texts) => [].concat(texts).flatMap((t) => {
    const lines = wrap(t);
    const out = [];
    for (let i = 0; i < lines.length; i += LINES) out.push(lines.slice(i, i + LINES).join("\n"));
    return out;
  });

  const tone = (...a) => App.Sound.tone(...a);
  const sfx = {
    bump: () => tone(140, 0.07, "triangle", 0.1),
    door: () => { tone(520, 0.08, "triangle", 0.1); tone(390, 0.1, "triangle", 0.1, 0.08); },
    blip: () => tone(880, 0.04, "triangle", 0.07),
    meet: () => [392, 523, 659, 523, 784].forEach((f, i) => tone(f, 0.1, "triangle", 0.12, i * 0.08)),
    right: () => [659, 784, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.12, i * 0.08)),
  };

  /* ================================================================== */
  const Adventure = {
    id: "adventure",
    title: "Going on an Adventure",
    tagline: "Explore the neighborhood & make critter friends",
    accent: "olive",
    wide: true, // gets a full-width tile on the home screen
    modes: {
      easy: { label: "Easy", tag: "Adding up to 10" },
      medium: { label: "Medium", tag: "Add & take away to 20" },
      hard: { label: "Hard", tag: "Bigger numbers to 100" },
    },

    /** Home-screen picture, drawn with the game's own art. */
    art() {
      const dpr = 2, s = 32;
      const c = h("canvas", { class: "advart", width: 4 * s * dpr, height: 2 * s * dpr, "aria-hidden": "true" });
      const x = c.getContext("2d");
      x.scale(dpr, dpr);
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 4; tx++) D.ground(x, tx >= 2 ? "tall" : ty ? "sidewalk" : "lawn", tx >= 2 ? "," : ty ? ":" : ".", tx * s, ty * s, s, dpr, 0, tx + ty * 4);
      }
      D.object(x, "tree", "T", 0, 0, s, dpr, 0, 1);
      D.person(x, "hero", "right", 1.5 * s, 1.85 * s, s, null, 0);
      D.critter(x, "fizzbun", 3.1 * s, 1.55 * s, s * 0.95, 0.4, {});
      D.ground(x, "tall", ",", 2 * s, 1.55 * s, s, dpr, 0, 9);
      return c;
    },

    /* ---------------- set up the screen ---------------- */
    mount(ui) {
      this.canvas = h("canvas", { class: "advworld", "aria-label": "Adventure world" });
      this.ctx = this.canvas.getContext("2d");

      this.hud = h("div", { class: "advhud", hidden: true },
        this.hudName = h("b"), this.hudHearts = h("span", { class: "hearts", "aria-label": "Friendship" }));
      this.talk = h("div", { class: "advtalk", hidden: true, role: "status", "aria-live": "polite", onclick: () => Input.press("a") },
        this.talkText = h("p"), this.talkMore = h("span", { class: "more", "aria-hidden": "true", text: "▼" }));
      this.menuEl = h("div", { class: "advmenu", hidden: true });
      this.bookEl = h("div", { class: "advbook", hidden: true });

      this.knob = h("span", { class: "knob" });
      this.stick = h("div", { class: "joystick", role: "group", "aria-label": "Joystick: drag to walk" }, this.knob);
      const button = (name, label, text) => h("button", { class: "padbtn " + name, type: "button", "aria-label": label, dataset: { btn: name }, text });
      this.stage = h("div", { class: "advstage" },
        this.canvas, this.hud,
        this.stick,
        button("b", "B: back, or hop on and off your bike", "B"),
        button("a", "A: talk or choose", "A"),
        button("start", "Menu", "☰"),
        this.talk, this.menuEl, this.bookEl);
      ui.body.append(this.stage);

      // joystick: drag from the middle in any direction
      const move = (e) => {
        const r = this.stick.getBoundingClientRect();
        const R = r.width / 2;
        let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
        const dist = Math.hypot(dx, dy);
        const k = dist > R * 0.6 ? (R * 0.6) / dist : 1;
        this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        const d = dist < R * 0.25 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        if (d === this.stickDir) return;
        if (this.stickDir) Input.release(this.stickDir);
        if (d) Input.hold(d);
        this.stickDir = d;
      };
      const end = () => {
        this.knob.style.transform = "";
        if (this.stickDir) Input.release(this.stickDir);
        this.stickDir = null;
        this.stick.classList.remove("on");
      };
      this.stick.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.stick.setPointerCapture(e.pointerId);
        this.stick.classList.add("on");
        move(e);
      });
      this.stick.addEventListener("pointermove", (e) => { if (this.stick.hasPointerCapture(e.pointerId)) move(e); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => this.stick.addEventListener(ev, end));

      this.stage.addEventListener("pointerdown", (e) => {
        const b = e.target.closest("[data-btn]");
        if (!b) return;
        e.preventDefault();
        Input.press(b.dataset.btn);
      });
      this.stage.addEventListener("contextmenu", (e) => e.preventDefault());
      window.addEventListener("blur", () => Input.clear());
    },

    /* ---------------- start / stop ---------------- */
    start(mode) {
      this.stop();
      this.mode = mode;
      const save = App.Store.get("adventure", null);
      this.friends = new Set(save?.friends || []);
      this.seen = new Set(save?.seen || []);
      this.hasBike = !!save?.hasBike;
      this.riding = false;
      const at = save && MAPS[save.map] ? save : START;
      this.loadMap(at.map, at.x, at.y, at.dir);
      this.scene = "world";
      this.dialog = this.menu = this.fade = this.battle = null;
      this.tick = 0;
      Input.clear();
      this.updateProgress();
      if (!save) {
        this.say([
          "Welcome to GOING ON AN ADVENTURE!",
          "Drag the joystick to walk. Press A to talk to people and read signs.",
          "Go outside and look for critters in the tall grass!",
        ]);
      }
      this.last = null;
      this.acc = 0;
      this.raf = requestAnimationFrame((t) => this.frame(t));
    },

    stop() {
      if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; this.save(); }
      Input.clear();
    },

    pause() { Input.clear(); },

    save() {
      if (!this.player) return;
      App.Store.set("adventure", {
        map: this.mapId, x: this.player.x, y: this.player.y, dir: this.player.dir,
        friends: [...this.friends], seen: [...this.seen], hasBike: this.hasBike,
      });
    },

    updateProgress() {
      this.ui.setProgress(this.friends.size / Object.keys(CRITTERS).length);
    },

    onKey(e) {
      const k = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
      if (!k) return;
      if (e.target.closest?.("button") && k === "a" && e.key !== "z") return; // let Enter/Space click a focused button
      e.preventDefault();
      if (DIRS[k]) Input.hold(k);
      else if (!e.repeat) Input.press(k);
    },
    onKeyUp(e) {
      const k = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
      if (k && DIRS[k]) Input.release(k);
    },

    /* ---------------- the map ---------------- */
    loadMap(id, x, y, dir) {
      this.mapId = id;
      this.map = MAPS[id];
      this.player = { x, y, fromX: x, fromY: y, dir, moving: false, t: 0, dur: STEP, leg: 0, turn: 0, chain: false, bumpWait: 0 };
      this.people = (this.map.people || []).map((p) => ({
        ...p, home: { x: p.x, y: p.y }, fromX: p.x, fromY: p.y, moving: false, t: 0, wait: randInt(60, 200),
      }));
      this.items = (this.map.items || []).filter((it) => !(it.kind === "bike" && this.hasBike));
      if (this.map.indoors) this.riding = false;
      this.grace = 2;
      this.labelHouses();
    },

    /** Give each house (a joined-up group of house tiles) its own colours. */
    labelHouses() {
      const rows = this.map.tiles;
      this.houseOf = rows.map((r) => [...r].map(() => -1));
      let n = 0;
      rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch !== "h" || this.houseOf[y][x] >= 0) return;
        const stack = [[x, y]];
        while (stack.length) {
          const [cx, cy] = stack.pop();
          if (rows[cy]?.[cx] !== "h" || this.houseOf[cy][cx] >= 0) continue;
          this.houseOf[cy][cx] = n;
          stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        n++;
      }));
    },

    charAt(x, y) { return this.map.tiles[y]?.[x] ?? this.map.border; },
    tileAt(x, y) { return TILES[this.charAt(x, y)] || TILES[this.map.border]; },
    personAt(x, y) { return this.people.find((p) => p.x === x && p.y === y); },
    itemAt(x, y) { return this.items.find((it) => it.x === x && it.y === y); },
    stepTime() { return this.riding ? BIKE_STEP : STEP; },

    blocked(x, y, who) {
      if (y < 0 || y >= this.map.tiles.length || x < 0 || x >= this.map.tiles[0].length) return true;
      if (this.tileAt(x, y).solid) return true;
      if (this.people.some((p) => p !== who && p.x === x && p.y === y)) return true;
      if (this.itemAt(x, y)) return true;
      const pl = this.player;
      return who !== pl && pl.x === x && pl.y === y;
    },

    /* ---------------- main loop ---------------- */
    frame(now) {
      this.raf = requestAnimationFrame((t) => this.frame(t));
      if (this.last != null) this.acc += Math.min(now - this.last, 100);
      this.last = now;
      while (this.acc >= 1000 / 60) { this.update(); this.acc -= 1000 / 60; }
      this.render();
      this.syncUI();
    },

    update() {
      this.tick++;
      if (this.fade) {
        const f = this.fade;
        f.t++;
        if (f.phase === "out" && f.t >= f.dur) { f.fn(); f.phase = "in"; f.t = 0; }
        else if (f.phase === "in" && f.t >= 14) this.fade = null;
        Input.pressed.clear();
        return;
      }
      if (this.dialog) this.updateDialog();
      else if (this.menu) this.updateMenu();
      else if (this.scene === "world") this.updateWorld();
      else if (this.scene === "battle") this.updateBattle();
      else if (this.scene === "book") this.updateBook();
      if (this.scene === "world") this.updatePeople();
      Input.pressed.clear();
    },

    transition(fn, { flash = false } = {}) {
      this.fade = { t: 0, dur: flash ? 30 : 14, phase: "out", fn, flash };
    },

    /* ---------------- walking ---------------- */
    updateWorld() {
      const p = this.player;
      if (p.moving) {
        p.t++;
        if (p.t < p.dur) return;
        p.moving = false;
        p.chain = true;
        if (this.arrive()) return;
      }
      if (p.bumpWait > 0) p.bumpWait--;
      if (Input.take("start")) return this.openStartMenu();
      if (Input.take("a")) return this.interact();
      if (Input.take("b")) return this.toggleBike();

      const d = Input.dir();
      if (!d) { p.chain = false; p.turn = 0; return; }
      if (d !== p.dir) {
        p.dir = d;
        if (!p.chain) { p.turn = 5; return; } // a quick tap just turns around
      }
      if (p.turn > 0) { p.turn--; return; }
      const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];
      if (this.blocked(nx, ny, p)) {
        p.chain = false;
        if (!p.bumpWait) { sfx.bump(); p.bumpWait = 18; }
        return;
      }
      p.fromX = p.x; p.fromY = p.y;
      p.x = nx; p.y = ny;
      p.moving = true; p.t = 0; p.leg ^= 1; p.dur = this.stepTime();
    },

    toggleBike() {
      if (!this.hasBike) return;
      if (this.map.indoors) return this.say(["No bikes in the house!"]);
      this.riding = !this.riding;
      if (this.riding) { tone(660, 0.06, "triangle", 0.1); tone(990, 0.08, "triangle", 0.1, 0.06); }
      else tone(440, 0.08, "triangle", 0.1);
    },

    /** Called when the player finishes a step. Returns true if a door or critter took over. */
    arrive() {
      const p = this.player;
      const warp = (this.map.warps || []).find((w) => w.x === p.x && w.y === p.y);
      if (warp) {
        sfx.door();
        this.transition(() => { this.loadMap(warp.to, warp.tx, warp.ty, warp.dir); this.save(); });
        return true;
      }
      if (this.tileAt(p.x, p.y).grass && this.map.critters) {
        if (this.grace > 0) this.grace--;
        else if (Math.random() < ENCOUNTER_RATE) { this.startBattle(pick(this.map.critters)); return true; }
      }
      return false;
    },

    updatePeople() {
      const busy = this.dialog || this.menu || this.fade;
      for (const n of this.people) {
        if (n.moving) { if (++n.t >= NPC_STEP) n.moving = false; continue; }
        if (!n.wander || busy || --n.wait > 0) continue;
        n.wait = randInt(90, 240);
        const d = pick(Object.keys(DIRS));
        n.dir = d;
        const nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1];
        if (Math.abs(nx - n.home.x) > 3 || Math.abs(ny - n.home.y) > 3) continue;
        if (this.blocked(nx, ny, n) || this.tileAt(nx, ny).grass) continue;
        if ((this.map.warps || []).some((w) => w.x === nx && w.y === ny)) continue;
        n.fromX = n.x; n.fromY = n.y; n.x = nx; n.y = ny;
        n.moving = true; n.t = 0;
      }
    },

    interact() {
      const p = this.player;
      const fx = p.x + DIRS[p.dir][0], fy = p.y + DIRS[p.dir][1];
      const person = this.personAt(fx, fy);
      if (person) {
        if (!person.moving) person.dir = OPPOSITE[p.dir];
        return this.say(person.talk);
      }
      const item = this.itemAt(fx, fy);
      if (item && item.kind === "bike") {
        this.items = this.items.filter((it) => it !== item);
        this.hasBike = true;
        this.save();
        App.Sound.win();
        return this.say(["It's your bike!", "Press B to hop on and off. Bikes go twice as fast!"], () => { this.riding = true; });
      }
      const sign = (this.map.signs || []).find((s) => s.x === fx && s.y === fy);
      if (sign) this.say(sign.text);
    },

    /* ---------------- talking ---------------- */
    say(texts, then) {
      this.dialog = { pages: paginate(texts), i: 0, shown: 0, then };
    },

    updateDialog() {
      const d = this.dialog;
      const total = d.pages[d.i].length;
      const skip = Input.take("a") || Input.take("b");
      if (d.shown < total) {
        d.shown = skip ? total : Math.min(total, d.shown + 1.1);
        return;
      }
      if (!skip) return;
      sfx.blip();
      d.i++;
      d.shown = 0;
      if (d.i >= d.pages.length) {
        this.dialog = null;
        d.then?.();
      }
    },

    /* ---------------- menus ---------------- */
    openMenu(menu) {
      this.menu = { i: 0, cols: 1, ...menu };
      this.menuDirty = true;
    },

    updateMenu() {
      const m = this.menu;
      const n = m.items.length;
      const before = m.i;
      if (Input.take("up")) m.i = Math.max(0, m.i - m.cols);
      if (Input.take("down")) m.i = Math.min(n - 1, m.i + m.cols);
      if (m.cols > 1 && Input.take("left") && m.i % m.cols > 0) m.i--;
      if (m.cols > 1 && Input.take("right") && m.i % m.cols < m.cols - 1 && m.i < n - 1) m.i++;
      if (m.i !== before) sfx.blip();
      if (Input.take("a")) { sfx.blip(); m.onPick(m.i); return; }
      if ((Input.take("b") || Input.take("start")) && m.onBack) { sfx.blip(); m.onBack(); }
    },

    openStartMenu() {
      sfx.blip();
      this.save();
      this.openMenu({
        kind: "start",
        title: "Menu",
        items: ["Critter Book", "Close"],
        onPick: (i) => {
          this.menu = null;
          if (i === 0) { this.scene = "book"; this.bookDirty = true; }
        },
        onBack: () => { this.menu = null; },
      });
    },

    updateBook() {
      if (Input.take("a") || Input.take("b") || Input.take("start")) { sfx.blip(); this.scene = "world"; }
    },

    /* ---------------- meeting a critter ---------------- */
    startBattle(id) {
      this.seen.add(id);
      sfx.meet();
      this.transition(() => {
        this.scene = "battle";
        this.battle = { id, c: CRITTERS[id], hearts: 0, bored: 0, phase: "intro", slide: 0, hop: 0, shake: 0 };
      }, { flash: true });
    },

    updateBattle() {
      const b = this.battle;
      if (b.hop > 0) b.hop--;
      if (b.shake > 0) b.shake--;
      if (b.phase === "intro" && ++b.slide >= 40) {
        b.phase = "talk";
        this.say([`A wild ${b.c.name} appeared!`], () => this.battleMenu());
      }
    },

    battleMenu() {
      this.battle.phase = "menu";
      this.openMenu({
        kind: "battle",
        title: "What will you do?",
        items: ["Answer", "Run"],
        cols: 2,
        onPick: (i) => {
          this.menu = null;
          if (i === 0) this.askQuestion();
          else this.say(["You waved goodbye."], () => this.endBattle());
        },
      });
    },

    askQuestion() {
      const q = makeQuestion(this.mode);
      this.battle.q = q;
      this.openMenu({
        kind: "answers",
        title: q.text,
        items: q.choices.map(String),
        cols: 2,
        onPick: (i) => { this.menu = null; this.answer(q.choices[i]); },
        onBack: () => { this.menu = null; this.battleMenu(); },
      });
    },

    answer(v) {
      const b = this.battle;
      const solved = b.q.text.replace("?", b.q.answer);
      if (v === b.q.answer) {
        b.hearts++;
        b.hop = 24;
        sfx.right();
        this.ui.award({ celebrate: false });
        if (b.hearts >= FRIENDS_NEEDED) return this.say([`Yes! ${solved}`], () => this.befriend());
        return this.say([`Yes! ${solved}`, `${b.c.name} likes you more!`], () => this.battleMenu());
      }
      b.bored++;
      b.shake = 18;
      App.Sound.miss();
      if (b.bored >= BORED_LIMIT) {
        return this.say([`Not quite. ${solved}`, `${b.c.name} got bored and wandered off.`], () => this.endBattle());
      }
      this.say([`Not quite. ${solved}`, "Let's try another one!"], () => this.battleMenu());
    },

    befriend() {
      const b = this.battle;
      const isNew = !this.friends.has(b.id);
      this.friends.add(b.id);
      this.save();
      this.updateProgress();
      App.Sound.win();
      if (isNew) App.FX.celebrate(true, "New friend!");
      this.say([
        `${b.c.name} wants to be your friend!`,
        isNew ? `${b.c.name} was added to your CRITTER BOOK.` : `${b.c.name} is happy to play with you again.`,
      ], () => this.endBattle());
    },

    endBattle() {
      this.transition(() => { this.scene = "world"; this.battle = null; this.grace = 3; });
    },

    /* ================= drawing the canvas ================= */
    fit() {
      const w = this.stage.clientWidth, hh = this.stage.clientHeight;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      if (w !== this.W || hh !== this.H || dpr !== this.dpr) {
        this.W = w; this.H = hh; this.dpr = dpr;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(hh * dpr);
        const T = Math.max(40, Math.min(64, Math.round(w / 9)));
        if (T !== this.T) { this.T = T; AD.draw && AD.clearCache(); }
      }
      return w > 0;
    },

    render() {
      if (!this.fit()) return;
      const c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.imageSmoothingEnabled = true;
      c.fillStyle = D.C.dark;
      c.fillRect(0, 0, this.W, this.H);
      if (this.scene === "battle") this.drawBattle();
      else this.drawWorld();
      if (this.fade) this.drawFade();
    },

    drawWorld() {
      const c = this.ctx, T = this.T, W = this.W, H = this.H, dpr = this.dpr;
      const t = this.tick / 60;
      const p = this.player;
      const pos = (e, dur) => {
        const k = e.moving ? e.t / dur : 1;
        return { x: e.fromX + (e.x - e.fromX) * k, y: e.fromY + (e.y - e.fromY) * k };
      };
      const pp = pos(p, p.dur);
      const camX = Math.round(pp.x * T + T / 2 - W / 2);
      const camY = Math.round(pp.y * T + T / 2 - H * 0.46);
      const x0 = Math.floor(camX / T) - 1, x1 = Math.ceil((camX + W) / T) + 1;
      const y0 = Math.floor(camY / T) - 1, y1 = Math.ceil((camY + H) / T) + 2;

      const same = (tx, ty, ch) => (dx, dy) => {
        const o = this.charAt(tx + dx, ty + dy);
        return ch === "h" ? o === "h" : o === ch;
      };

      // ground
      const objects = [];
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const ch = this.charAt(tx, ty);
          const tile = TILES[ch];
          const sx = tx * T - camX, sy = ty * T - camY;
          const variant = AD.hash(tx, ty) % 4;
          D.ground(c, tile.ground, ch, sx, sy, T, dpr, AD.maskOf(same(tx, ty, ch)), variant);
          if (tile.object) objects.push({ y: ty + 1, tx, ty, ch, tile, sx, sy, variant });
        }
      }

      // things that stand up, and people, back to front
      const actors = [
        ...this.people.map((n) => ({ e: n, look: n.look, dur: NPC_STEP, at: pos(n, NPC_STEP) })),
        { e: p, look: this.riding ? "heroBike" : "hero", dur: p.dur, at: pp },
      ];
      const items = [
        ...objects.map((o) => ({ y: o.y, draw: () => {
          const house = o.ch === "h" ? this.houseOf[o.ty]?.[o.tx] ?? 0 : 0;
          const info = { color: AD.hash(house, this.mapId.length) % AD.HOUSES.length, window: o.ch === "h" && AD.hash(o.tx, o.ty, 3) % 3 === 0 };
          D.object(c, o.tile.object, o.ch, o.sx, o.sy, T, dpr, AD.maskOf(same(o.tx, o.ty, o.ch)), o.variant, info);
        } })),
        ...actors.map((a) => ({ y: a.at.y + 0.95, draw: () => this.drawActor(a, camX, camY, t) })),
        ...this.items.map((it) => ({ y: it.y + 1, draw: () => {
          D.object(c, it.kind, it.kind, it.x * T - camX, it.y * T - camY, T, dpr, 0, 0);
        } })),
      ].sort((a, b) => a.y - b.y);
      items.forEach((it) => it.draw());
    },

    drawActor({ e, look, dur, at }, camX, camY, t) {
      const c = this.ctx, T = this.T;
      const cx = at.x * T + T / 2 - camX;
      const foot = at.y * T + T * 0.9 - camY;
      const phase = e.moving ? (e.t / dur) * 0.5 + (e.leg ? 0.5 : 0) : null;
      D.person(c, look, e.dir, cx, foot, T, phase, t);
      // tall grass hides your feet
      const gx = Math.round(at.x), gy = Math.round(at.y);
      if (this.tileAt(gx, gy).grass && look !== "heroBike") {
        const sx = gx * T - camX, sy = gy * T - camY;
        c.save();
        c.beginPath(); c.rect(sx - T * 0.2, sy + T * 0.62, T * 1.4, T * 0.5); c.clip();
        D.ground(c, "tall", ",", sx, sy, T, this.dpr, 0, AD.hash(gx, gy) % 4);
        c.restore();
      }
    },

    drawBattle() {
      const c = this.ctx, W = this.W, H = this.H, b = this.battle;
      const t = this.tick / 60;
      // sky and ground
      const sky = c.createLinearGradient(0, 0, 0, H * 0.55);
      sky.addColorStop(0, "#BFE6F7"); sky.addColorStop(1, "#E9F7FB");
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const r = D.rng(42);
      D.blob(c, [[-20, H * 0.5], [W * 0.3, H * 0.46], [W * 0.7, H * 0.52], [W + 20, H * 0.47], [W + 20, H + 20], [-20, H + 20]], r, 8);
      D.paint(c, D.C.tall, 2.5);
      for (let i = 0; i < 18; i++) {
        const x = r() * W, y = H * (0.55 + r() * 0.4), k = 10 + r() * 8;
        c.beginPath(); c.moveTo(x - 4, y); c.quadraticCurveTo(x - 2, y - k / 2, x, y - k); c.moveTo(x + 4, y); c.quadraticCurveTo(x + 2, y - k / 2, x + 3, y - k * 0.8);
        c.strokeStyle = D.C.blade; c.lineWidth = 2; c.lineCap = "round"; c.stroke();
      }

      const k = Math.min(1, b.slide / 40);
      const ease = 1 - (1 - k) * (1 - k);
      const size = Math.min(W * 0.42, H * 0.3);
      // the critter
      const ccx = W * 0.68 + (1 - ease) * W * 0.7 + (b.shake ? (b.shake % 6 < 3 ? -4 : 4) : 0);
      const cbase = H * 0.42 - (b.hop ? Math.abs(Math.sin(((24 - b.hop) / 24) * Math.PI * 2)) * size * 0.15 : 0);
      c.fillStyle = "rgba(60,110,40,.25)";
      c.beginPath(); c.ellipse(W * 0.68 + (1 - ease) * W * 0.7, H * 0.42, size * 0.55, size * 0.12, 0, 0, Math.PI * 2); c.fill();
      const blink = Math.floor(t * 10) % 32 === 0;
      D.critter(c, b.id, ccx, cbase, size, t, { blink, happy: b.hearts > 0 || b.hop > 0 });

      // you, seen from behind
      const s = Math.min(W * 0.36, H * 0.24);
      c.fillStyle = "rgba(60,110,40,.25)";
      c.beginPath(); c.ellipse(W * 0.28 - (1 - ease) * W * 0.7, H * 0.66, s * 0.6, s * 0.12, 0, 0, Math.PI * 2); c.fill();
      D.person(c, "hero", "up", W * 0.28 - (1 - ease) * W * 0.7, H * 0.66, s, null, t);
    },

    drawFade() {
      const f = this.fade, c = this.ctx;
      let a;
      if (f.phase === "in") a = 1 - f.t / 14;
      else if (f.flash && f.t < 18) a = Math.floor(f.t / 3) % 2 ? 0.85 : 0;
      else a = f.flash ? (f.t - 18) / (f.dur - 18) : f.t / f.dur;
      c.globalAlpha = Math.max(0, Math.min(1, a));
      c.fillStyle = f.flash ? D.C.dark : "#FFFDF7";
      c.fillRect(0, 0, this.W, this.H);
      c.globalAlpha = 1;
    },

    /* ================= page elements on top ================= */
    syncUI() {
      const busy = !!(this.dialog || this.menu || this.fade || this.scene !== "world");
      this.stage.classList.toggle("busy", busy);

      // talking
      const d = this.dialog;
      this.talk.hidden = !d;
      if (d) {
        const page = d.pages[d.i];
        const text = page.slice(0, Math.floor(d.shown));
        if (this.talkText.textContent !== text) this.talkText.textContent = text;
        this.talkMore.hidden = d.shown < page.length;
      }

      // menus
      const m = this.menu;
      this.menuEl.hidden = !m || !!d;
      if (m && this.menuDirty) {
        this.menuDirty = false;
        this.menuEl.dataset.kind = m.kind;
        this.menuEl.replaceChildren(
          h("p", { class: "mtitle", text: m.title }),
          h("div", { class: "mitems", style: { "--cols": m.cols } },
            m.items.map((it, i) => h("button", {
              type: "button", class: "mitem", text: it,
              onclick: () => { m.i = i; Input.press("a"); },
            }))),
          ...(m.onBack ? [h("button", { type: "button", class: "mback", text: "Back", onclick: () => Input.press("b") })] : []));
      }
      if (m) this.menuEl.querySelectorAll(".mitem").forEach((el, i) => el.classList.toggle("sel", i === m.i));

      // friendship hearts while meeting a critter
      const b = this.battle;
      this.hud.hidden = !(this.scene === "battle" && b && b.slide >= 40);
      if (!this.hud.hidden) {
        this.hudName.textContent = b.c.name;
        const hearts = "♥".repeat(b.hearts) + "♡".repeat(FRIENDS_NEEDED - b.hearts);
        if (this.hudHearts.textContent !== hearts) this.hudHearts.textContent = hearts;
      }

      // critter book
      this.bookEl.hidden = this.scene !== "book";
      if (this.scene === "book" && this.bookDirty) {
        this.bookDirty = false;
        const ids = Object.keys(CRITTERS);
        this.bookEl.replaceChildren(
          h("div", { class: "bookhead" },
            h("h2", { text: "Critter Book" }),
            h("span", { text: `Friends: ${this.friends.size} of ${ids.length}` })),
          h("div", { class: "bookgrid" }, ids.map((id) => {
            const cr = CRITTERS[id];
            const known = this.friends.has(id), met = this.seen.has(id);
            const cv = h("canvas", { width: 240, height: 200 });
            const x = cv.getContext("2d");
            if (known) { x.scale(2, 2); D.critter(x, id, 60, 92, 76, 0.3, { happy: true }); }
            else if (met) x.drawImage(D.silhouette(id, 240, 200, "#B9AE9B"), 0, 0);
            return h("div", { class: "bookcard" + (known ? "" : " unknown") }, cv,
              h("b", { text: known ? cr.name : "???" }),
              h("small", { text: known ? cr.about : met ? "You've met this critter. Make friends to learn more!" : "Not found yet." }));
          })),
          h("button", { type: "button", class: "mback", text: "Back", onclick: () => Input.press("b") }));
      }
    },
  };

  App.Games.register(Adventure);
})();
