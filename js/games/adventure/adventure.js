/* =====================================================================
   Going on an Adventure — engine
   A top-down tile world on a handheld-style screen (160×144, four
   greens). Walk around, talk to people, read signs, and meet critters
   in the tall grass. Critters become friends when you answer their
   math questions. Art lives in art.js, places and people in world.js.
   ===================================================================== */
(function () {
  "use strict";
  const { h, pick, randInt } = App.util;
  const { draw, get, PALETTE: P } = App.Adventure.art;
  const { TILES, CRITTERS, MAPS, START, makeQuestion } = App.Adventure.world;

  const W = 160, H = 144, T = 16, SCALE = 4;
  const STEP = 14;           // frames to walk one tile
  const NPC_STEP = 22;       // people stroll a bit slower
  const FONT = '8px "Press Start 2P", ui-monospace, monospace';
  const LINE = 18;           // characters per line of text
  const FRIENDS_NEEDED = 3;  // right answers to make a friend
  const BORED_LIMIT = 3;     // wrong answers before a critter leaves
  const ENCOUNTER_RATE = 0.14;
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
  /** Each message becomes one or more two-line pages. */
  const paginate = (texts) => [].concat(texts).flatMap((t) => {
    const lines = wrap(t);
    const out = [];
    for (let i = 0; i < lines.length; i += 2) out.push(lines.slice(i, i + 2));
    return out;
  });

  /** A solid dark copy of a sprite, for critters you've seen but not befriended. */
  const shadows = {};
  function shadow(name) {
    if (shadows[name]) return shadows[name];
    const src = get(name);
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = P[2];
    x.fillRect(0, 0, c.width, c.height);
    return (shadows[name] = c);
  }

  const tone = (...a) => App.Sound.tone(...a);
  const sfx = {
    bump: () => tone(110, 0.08, "square", 0.08),
    door: () => { tone(330, 0.08, "square", 0.08); tone(220, 0.1, "square", 0.08, 0.08); },
    blip: () => tone(880, 0.04, "square", 0.06),
    meet: () => [392, 523, 659, 523, 784].forEach((f, i) => tone(f, 0.1, "square", 0.08, i * 0.08)),
    right: () => [659, 784, 1046].forEach((f, i) => tone(f, 0.12, "square", 0.09, i * 0.08)),
  };

  /* ================================================================== */
  const Adventure = {
    id: "adventure",
    title: "Going on an Adventure",
    tagline: "Explore & make critter friends",
    accent: "olive",
    wide: true, // gets a full-width tile on the home screen
    modes: {
      easy: { label: "Easy", tag: "Adding up to 10" },
      medium: { label: "Medium", tag: "Add & take away to 20" },
      hard: { label: "Hard", tag: "Bigger numbers to 100" },
    },

    /** Home-screen picture: a real little scene drawn with the game's own art. */
    art() {
      const c = h("canvas", { class: "advart", width: 64, height: 32, "aria-hidden": "true" });
      const x = c.getContext("2d");
      x.fillStyle = P[0];
      x.fillRect(0, 0, 64, 32);
      [["grass", "tree"], ["grass", "grass"], ["tall", "tall"], ["tall", "tall"]].forEach(([top, bottom], i) => {
        draw(x, top === "tree" ? "grass" : top, i * 16, 0);
        draw(x, bottom, i * 16, 16);
      });
      draw(x, "tree", 0, 0);
      draw(x, "path", 0, 16); draw(x, "path", 16, 16);
      draw(x, "fizzbun", 38, 2);
      x.drawImage(get("tall"), 0, 10, 16, 6, 32, 10, 16, 6);
      x.drawImage(get("tall"), 0, 10, 16, 6, 48, 10, 16, 6);
      draw(x, "hero_side", 17, 11, { flip: true });
      return c;
    },

    /* ---------------- set up the screen ---------------- */
    mount(ui) {
      this.canvas = h("canvas", { class: "lcd", width: W * SCALE, height: H * SCALE, "aria-label": "Adventure screen" });
      this.ctx = this.canvas.getContext("2d");

      const cross = h("div", { class: "cross", role: "group", "aria-label": "Direction pad" },
        ["up", "left", "right", "down"].map((d) => h("span", { class: "arm " + d, "aria-hidden": "true" })),
        h("span", { class: "hub", "aria-hidden": "true" }));
      const btn = (name, label, cls) => h("button", { class: cls, type: "button", "aria-label": label, dataset: { btn: name }, text: name === "start" ? "START" : name.toUpperCase() });

      const shell = h("div", { class: "handheld" },
        h("div", { class: "bezel" },
          h("div", { class: "bezeltop" }, h("span", { class: "led", "aria-hidden": "true" }), h("span", { text: "• MEADOW SCREEN •" })),
          this.canvas),
        h("div", { class: "brand", "aria-hidden": "true" }, "Play & Learn ", h("b", { text: "Adventure" })),
        h("div", { class: "controls" },
          cross,
          h("div", { class: "ab" }, btn("b", "B button", "round b"), btn("a", "A button", "round a"))),
        h("div", { class: "startrow" }, btn("start", "Start: open menu", "pill")),
        h("p", { class: "advhelp", text: "Arrows walk · A talks and picks · B goes back · START opens the menu" }));
      ui.body.append(shell);

      // the cross: press and slide a finger to change direction
      const setPad = (e) => {
        const r = cross.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (Math.hypot(dx, dy) < 10) return;
        const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        if (d === this.padDir) return;
        if (this.padDir) Input.release(this.padDir);
        Input.hold(d);
        this.padDir = d;
        cross.dataset.dir = d;
      };
      const clearPad = () => {
        if (this.padDir) Input.release(this.padDir);
        this.padDir = null;
        delete cross.dataset.dir;
      };
      cross.addEventListener("pointerdown", (e) => { e.preventDefault(); cross.setPointerCapture(e.pointerId); setPad(e); });
      cross.addEventListener("pointermove", (e) => { if (cross.hasPointerCapture(e.pointerId)) setPad(e); });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => cross.addEventListener(ev, clearPad));

      shell.addEventListener("pointerdown", (e) => {
        const b = e.target.closest("[data-btn]");
        if (!b) return;
        e.preventDefault();
        Input.press(b.dataset.btn);
      });
      shell.addEventListener("contextmenu", (e) => e.preventDefault());
      window.addEventListener("blur", () => Input.clear());
      document.fonts?.load(FONT).catch(() => {});
    },

    /* ---------------- start / stop ---------------- */
    start(mode) {
      this.stop();
      this.mode = mode;
      const save = App.Store.get("adventure", null);
      this.friends = new Set(save?.friends || []);
      this.seen = new Set(save?.seen || []);
      const at = save && MAPS[save.map] ? save : START;
      this.loadMap(at.map, at.x, at.y, at.dir);
      this.scene = "world";
      this.dialog = this.menu = this.fade = this.battle = null;
      this.grace = 0;
      this.tick = 0;
      Input.clear();
      this.updateProgress();
      if (!save) {
        this.say([
          "Welcome to GOING ON AN ADVENTURE!",
          "Walk with the arrows. Press A to talk to people and read signs.",
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
        friends: [...this.friends], seen: [...this.seen],
      });
    },

    updateProgress() {
      this.ui.setProgress(this.friends.size / Object.keys(CRITTERS).length);
    },

    onKey(e) {
      const k = KEYS[e.key] || KEYS[e.key.toLowerCase?.()];
      if (!k) return;
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
      this.player = { x, y, fromX: x, fromY: y, dir, moving: false, t: 0, leg: 0, turn: 0, chain: false, bumpWait: 0 };
      this.people = (this.map.people || []).map((p) => ({
        ...p, home: { x: p.x, y: p.y }, fromX: p.x, fromY: p.y, moving: false, t: 0, leg: 0, wait: randInt(60, 200),
      }));
    },

    tileAt(x, y) {
      const ch = this.map.tiles[y]?.[x] ?? this.map.border;
      return TILES[ch] || TILES[this.map.border];
    },

    personAt(x, y) { return this.people.find((p) => p.x === x && p.y === y); },

    blocked(x, y, who) {
      if (y < 0 || y >= this.map.tiles.length || x < 0 || x >= this.map.tiles[0].length) return true;
      if (this.tileAt(x, y).solid) return true;
      if (this.people.some((p) => p !== who && p.x === x && p.y === y)) return true;
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
    },

    update() {
      this.tick++;
      if (this.fade) {
        const f = this.fade;
        f.t++;
        if (f.phase === "out" && f.t >= f.dur) { f.fn(); f.phase = "in"; f.t = 0; }
        else if (f.phase === "in" && f.t >= 12) this.fade = null;
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

    /** Fade out, run fn (switch map or scene), fade back in. */
    transition(fn, { color = 0, flash = false } = {}) {
      this.fade = { t: 0, dur: flash ? 30 : 12, phase: "out", fn, color, flash };
    },

    /* ---------------- walking ---------------- */
    updateWorld() {
      const p = this.player;
      if (p.moving) {
        p.t++;
        if (p.t < STEP) return;
        p.moving = false;
        p.chain = true;
        if (this.arrive()) return;
      }
      if (p.bumpWait > 0) p.bumpWait--;
      if (Input.take("start")) return this.openStartMenu();
      if (Input.take("a")) return this.interact();

      const d = Input.dir();
      if (!d) { p.chain = false; p.turn = 0; return; }
      if (d !== p.dir) {
        p.dir = d;
        if (!p.chain) { p.turn = 5; return; } // a quick tap just turns around
      }
      if (p.turn > 0) { p.turn--; return; }
      const [dx, dy] = DIRS[d];
      const nx = p.x + dx, ny = p.y + dy;
      if (this.blocked(nx, ny, p)) {
        p.chain = false;
        if (!p.bumpWait) { sfx.bump(); p.bumpWait = 18; }
        return;
      }
      p.fromX = p.x; p.fromY = p.y;
      p.x = nx; p.y = ny;
      p.moving = true; p.t = 0; p.leg ^= 1;
    },

    /** Called when the player finishes a step. Returns true if a warp or critter took over. */
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
        if (Math.abs(nx - n.home.x) > 2 || Math.abs(ny - n.home.y) > 2) continue;
        if (this.blocked(nx, ny, n) || this.tileAt(nx, ny).grass) continue;
        if ((this.map.warps || []).some((w) => w.x === nx && w.y === ny)) continue;
        n.fromX = n.x; n.fromY = n.y; n.x = nx; n.y = ny;
        n.moving = true; n.t = 0; n.leg ^= 1;
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
      const sign = (this.map.signs || []).find((s) => s.x === fx && s.y === fy);
      if (sign) this.say(sign.text);
    },

    /* ---------------- talking ---------------- */
    say(texts, then) {
      this.dialog = { pages: paginate(texts), i: 0, shown: 0, then };
    },

    updateDialog() {
      const d = this.dialog;
      const total = d.pages[d.i].join("").length;
      const skip = Input.take("a") || Input.take("b");
      if (d.shown < total) {
        d.shown = skip ? total : Math.min(total, d.shown + 0.75);
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
    openMenu(menu) { this.menu = { i: 0, cols: 1, ...menu }; },

    updateMenu() {
      const m = this.menu;
      const n = m.items.length;
      if (Input.take("up")) m.i = Math.max(0, m.i - m.cols);
      if (Input.take("down")) m.i = Math.min(n - 1, m.i + m.cols);
      if (m.cols > 1 && Input.take("left") && m.i % m.cols > 0) m.i--;
      if (m.cols > 1 && Input.take("right") && m.i % m.cols < m.cols - 1 && m.i < n - 1) m.i++;
      if (Input.take("a")) { sfx.blip(); m.onPick(m.i); return; }
      if ((Input.take("b") || Input.take("start")) && m.onBack) { sfx.blip(); m.onBack(); }
    },

    openStartMenu() {
      sfx.blip();
      this.save();
      this.openMenu({
        items: ["CRITTERS", "CLOSE"],
        box: { x: 72, y: 0, w: 88, h: 48 },
        onPick: (i) => {
          this.menu = null;
          if (i === 0) this.scene = "book";
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
      }, { color: 3, flash: true });
    },

    updateBattle() {
      const b = this.battle;
      if (b.hop > 0) b.hop--;
      if (b.shake > 0) b.shake--;
      if (b.phase === "intro") {
        if (++b.slide >= 40) {
          b.phase = "talk";
          this.say([`A wild ${b.c.name} appeared!`], () => this.battleMenu());
        }
      }
    },

    battleMenu() {
      this.battle.phase = "menu";
      this.openMenu({
        items: ["ANSWER", "RUN"],
        box: { x: 88, y: 96, w: 72, h: 48 },
        prompt: ["What will", "you do?"],
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
        items: q.choices.map(String),
        cols: 2,
        box: { x: 0, y: 96, w: 160, h: 48 },
        question: q.text,
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
      this.grace = 3;
      this.transition(() => { this.scene = "world"; this.battle = null; });
    },

    /* ================= drawing ================= */
    render() {
      const c = this.ctx;
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      c.imageSmoothingEnabled = false;
      c.fillStyle = P[0];
      c.fillRect(0, 0, W, H);
      if (this.scene === "world") this.drawWorld();
      else if (this.scene === "battle") this.drawBattle();
      else if (this.scene === "book") this.drawBook();
      if (this.menu) this.drawMenu();
      if (this.dialog) this.drawDialog();
      if (this.fade) this.drawFade();
    },

    drawWorld() {
      const c = this.ctx;
      const p = this.player;
      const pos = (e, dur) => {
        const k = e.moving ? e.t / dur : 1;
        return { x: (e.fromX + (e.x - e.fromX) * k) * T, y: (e.fromY + (e.y - e.fromY) * k) * T };
      };
      const pp = pos(p, STEP);
      const camX = Math.round(pp.x - 64);
      const camY = Math.round(pp.y - 64);
      const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
      const frame = Math.floor(this.tick / 32) % 2;

      for (let ty = y0; ty <= y0 + 9; ty++) {
        for (let tx = x0; tx <= x0 + 10; tx++) {
          const t = this.tileAt(tx, ty);
          const sx = tx * T - camX, sy = ty * T - camY;
          if (t.art == null) { c.fillStyle = P[3]; c.fillRect(sx, sy, T, T); continue; }
          if (t.under) draw(c, t.under, sx, sy);
          draw(c, Array.isArray(t.art) ? t.art[frame] : t.art, sx, sy);
        }
      }

      const actors = [
        ...this.people.map((n) => ({ e: n, look: n.look, dur: NPC_STEP, at: pos(n, NPC_STEP) })),
        { e: p, look: "hero", dur: STEP, at: pp },
      ].sort((a, b) => a.at.y - b.at.y);
      for (const { e, look, dur, at } of actors) {
        const sx = Math.round(at.x - camX), sy = Math.round(at.y - camY);
        const side = e.dir === "left" || e.dir === "right";
        const stepping = e.moving && e.t < dur / 2;
        const name = `${look}_${side ? "side" : e.dir}${stepping ? "_step" : ""}`;
        const flip = e.dir === "right" || (!side && stepping && e.leg === 1);
        draw(c, name, sx, sy - 4, { flip });
        // standing in tall grass hides your feet
        if (!e.moving && this.tileAt(e.x, e.y).grass) {
          c.drawImage(get("tall"), 0, 9, 16, 7, sx, sy + 9, 16, 7);
        }
      }
    },

    drawBattle() {
      const c = this.ctx;
      const b = this.battle;
      const k = Math.min(1, b.slide / 40);
      const ease = 1 - (1 - k) * (1 - k);

      // ground spots
      c.fillStyle = P[1];
      c.beginPath(); c.ellipse(120, 56, 32, 7, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(40, 90, 34, 7, 0, 0, Math.PI * 2); c.fill();

      // the critter
      const hop = b.hop ? Math.sin(((24 - b.hop) / 24) * Math.PI * 2) * 6 : 0;
      const shake = b.shake ? (b.shake % 6 < 3 ? -2 : 2) : 0;
      draw(c, b.c.art, Math.round(104 + (1 - ease) * 90 + shake), Math.round(24 - Math.abs(hop)), { scale: 2 });

      // you, seen from behind
      draw(c, "hero_up", Math.round(24 - (1 - ease) * 90), 58, { scale: 2 });

      // name and friendship hearts
      if (k >= 1) {
        this.text(b.c.name, 8, 8);
        for (let i = 0; i < FRIENDS_NEEDED; i++) draw(c, i < b.hearts ? "heart" : "heartEmpty", 8 + i * 11, 20);
        c.fillStyle = P[3];
        c.fillRect(6, 31, 66, 2);
        c.fillRect(70, 27, 2, 6);
      }
      if (!this.dialog && !this.menu) this.box(0, 96, 160, 48);
    },

    drawBook() {
      const c = this.ctx;
      this.box(0, 0, 160, 144);
      this.text("CRITTER BOOK", 8, 8);
      const ids = Object.keys(CRITTERS);
      this.text(`FRIENDS ${this.friends.size}/${ids.length}`, 8, 20, 2);
      ids.forEach((id, i) => {
        const cx = 8 + (i % 2) * 76;
        const cy = 34 + Math.floor(i / 2) * 50;
        c.fillStyle = P[1];
        c.fillRect(cx, cy, 68, 46);
        c.fillStyle = P[0];
        c.fillRect(cx + 2, cy + 2, 64, 42);
        const cr = CRITTERS[id];
        if (this.friends.has(id)) {
          draw(c, cr.art, cx + 18, cy + 4, { scale: 2 });
        } else if (this.seen.has(id)) {
          c.drawImage(shadow(cr.art), cx + 18, cy + 4, 32, 32);
        } else {
          this.text("?", cx + 30, cy + 16, 1);
        }
        const label = this.friends.has(id) ? cr.name : "???";
        this.text(label, cx + 34 - label.length * 4, cy + 36, 3);
      });
      this.text("B: BACK", 96, 134, 2);
    },

    drawDialog() {
      const d = this.dialog;
      this.box(0, 96, 160, 48);
      let left = Math.floor(d.shown);
      d.pages[d.i].forEach((line, i) => {
        const part = line.slice(0, Math.max(0, left));
        left -= line.length;
        this.text(part, 8, 106 + i * 16);
      });
      const done = d.shown >= d.pages[d.i].join("").length;
      if (done && Math.floor(this.tick / 20) % 2 === 0) draw(this.ctx, "more", 146, 134);
    },

    drawMenu() {
      const m = this.menu;
      const { x, y, w, h: hh } = m.box;
      if (m.prompt) {
        this.box(0, 96, 88, 48);
        m.prompt.forEach((line, i) => this.text(line, 8, 106 + i * 16));
      }
      this.box(x, y, w, hh);
      if (m.question) {
        this.text(m.question, 8, 103);
        m.items.forEach((item, i) => {
          const ix = 24 + (i % 2) * 72;
          const iy = 118 + Math.floor(i / 2) * 13;
          this.text(item, ix, iy);
          if (i === m.i) draw(this.ctx, "cursor", ix - 11, iy);
        });
        return;
      }
      m.items.forEach((item, i) => {
        const iy = y + 10 + i * 16;
        this.text(item, x + 16, iy);
        if (i === m.i) draw(this.ctx, "cursor", x + 6, iy);
      });
    },

    drawFade() {
      const f = this.fade;
      const c = this.ctx;
      let a;
      if (f.phase === "in") a = 1 - f.t / 12;
      else if (f.flash && f.t < 18) a = Math.floor(f.t / 3) % 2 ? 0.9 : 0;
      else a = f.flash ? (f.t - 18) / (f.dur - 18) : f.t / f.dur;
      c.globalAlpha = Math.max(0, Math.min(1, a));
      c.fillStyle = P[f.color];
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    },

    /** A text box with the classic double border. */
    box(x, y, w, hh) {
      const c = this.ctx;
      c.fillStyle = P[3]; c.fillRect(x, y, w, hh);
      c.fillStyle = P[0]; c.fillRect(x + 2, y + 2, w - 4, hh - 4);
      c.fillStyle = P[2]; c.fillRect(x + 3, y + 3, w - 6, hh - 6);
      c.fillStyle = P[0]; c.fillRect(x + 4, y + 4, w - 8, hh - 8);
    },

    text(str, x, y, shade = 3) {
      const c = this.ctx;
      c.font = FONT;
      c.textBaseline = "top";
      c.fillStyle = P[shade];
      c.fillText(str, x, y);
    },
  };

  App.Games.register(Adventure);
})();
