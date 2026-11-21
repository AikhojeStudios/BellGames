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
  const { TILES, CRITTERS, MAPS, START, CATCHES, makeQuestion } = AD.world;

  const STEP = 14;            // frames to walk one tile
  const BIKE_STEP = 8;        // frames to ride one tile
  const SWIM_STEP = 20;       // frames to swim one tile
  const BITE_WINDOW = { easy: 80, medium: 60, hard: 45 }; // frames to react when a fish bites
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
      this.fishEl = h("div", { class: "advfish", hidden: true },
        this.fishMsg = h("p", { role: "status", "aria-live": "polite" }),
        this.fishBtn = h("button", { type: "button", class: "fishbtn", onclick: () => Input.press("a") }),
        h("button", { type: "button", class: "mback", text: "Done fishing", onclick: () => Input.press("b") }));

      this.knob = h("span", { class: "knob" });
      this.stick = h("div", { class: "joystick", role: "group", "aria-label": "Joystick: drag to walk" }, this.knob);
      const button = (name, label, text) => h("button", { class: "padbtn " + name, type: "button", "aria-label": label, dataset: { btn: name }, text });
      this.stage = h("div", { class: "advstage" },
        this.canvas, this.hud,
        this.stick,
        button("b", "B: back, or hop on and off your bike", "B"),
        button("a", "A: talk or choose", "A"),
        button("start", "Menu", "☰"),
        this.fishEl, this.talk, this.menuEl, this.bookEl);
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
      // where the bike is parked: from the save, or its starting spot
      this.bike = save?.bike && MAPS[save.bike.map] ? save.bike : this.bikeHome();
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
        // while riding, the bike is wherever you are
        bike: this.bike || { map: this.mapId, x: this.player.x, y: this.player.y },
      });
    },

    /** The bike's starting spot: the first map that lists one in its items. */
    bikeHome() {
      for (const [id, m] of Object.entries(MAPS)) {
        const it = (m.items || []).find((i) => i.kind === "bike");
        if (it) return { map: id, x: it.x, y: it.y };
      }
      return null;
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
      this.items = (this.map.items || []).filter((it) => it.kind !== "bike");
      if (this.bike && this.bike.map === id) this.items.push({ kind: "bike", x: this.bike.x, y: this.bike.y });
      this.grace = 2;
      this.fx = [];
      this.swimX = null;
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
    stepTime(x, y) { return this.riding ? BIKE_STEP : this.tileAt(x, y).swim ? SWIM_STEP : STEP; },

    blocked(x, y, who) {
      if (y < 0 || y >= this.map.tiles.length || x < 0 || x >= this.map.tiles[0].length) return true;
      if (this.tileAt(x, y).solid) return true;
      if (this.people.some((p) => p !== who && p.x === x && p.y === y)) return true;
      if (this.itemAt(x, y) && !(who === this.player && this.player.x === x && this.player.y === y)) return true;
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
      else if (this.scene === "fishing") this.updateFishing();
      if (this.scene === "world") this.updatePeople();
      this.updateFx();
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
      if (Input.take("b")) return this.bikeButton();

      const d = Input.dir();
      if (!d) { p.chain = false; p.turn = 0; return; }
      if (d !== p.dir) {
        p.dir = d;
        if (!p.chain) { p.turn = 5; return; } // a quick tap just turns around
      }
      if (p.turn > 0) { p.turn--; return; }
      const nx = p.x + DIRS[d][0], ny = p.y + DIRS[d][1];
      if (this.riding && this.tileAt(nx, ny).swim) {
        p.chain = false;
        if (!p.bumpWait) { sfx.bump(); p.bumpWait = 18; this.say(["Bikes can't swim! Press B to hop off first."]); }
        return;
      }
      if (this.blocked(nx, ny, p)) {
        p.chain = false;
        if (!p.bumpWait) { sfx.bump(); p.bumpWait = 18; }
        return;
      }
      p.fromX = p.x; p.fromY = p.y;
      p.x = nx; p.y = ny;
      p.moving = true; p.t = 0; p.leg ^= 1; p.dur = this.stepTime(nx, ny);
      p.ease = this.tileAt(nx, ny).swim || this.tileAt(p.fromX, p.fromY).swim;
    },

    /** B: get off if riding, or get on if the bike is right here. */
    bikeButton() {
      const p = this.player;
      if (this.riding) return this.getOff();
      const here = this.itemAt(p.x, p.y);
      const ahead = this.itemAt(p.x + DIRS[p.dir][0], p.y + DIRS[p.dir][1]);
      const bike = [here, ahead].find((it) => it && it.kind === "bike");
      if (bike) return this.getOn(bike);
      if (this.hasBike && this.map.indoors) return this.say(["No bikes in the house! Your bike is parked outside."]);
      if (this.hasBike && this.bike) {
        const where = this.bike.map === this.mapId ? "" : ` at ${MAPS[this.bike.map].name}`;
        this.say([`Your bike is parked${where}. Walk up to it and press A to ride.`]);
      }
    },

    getOn(bike) {
      this.items = this.items.filter((it) => it !== bike);
      this.bike = null;
      const first = !this.hasBike;
      this.hasBike = true;
      this.save();
      if (first) {
        App.Sound.win();
        return this.say(["It's your bike!", "Press B to hop off. Walk up to it and press A to ride again. Bikes go twice as fast!"], () => { this.riding = true; });
      }
      this.riding = true;
      tone(660, 0.06, "triangle", 0.1); tone(990, 0.08, "triangle", 0.1, 0.06);
    },

    /** Park the bike on a tile (where you are, unless given). */
    getOff(x = this.player.x, y = this.player.y) {
      this.riding = false;
      this.bike = { map: this.mapId, x, y };
      this.items.push({ kind: "bike", x, y });
      this.save();
      tone(440, 0.08, "triangle", 0.1);
    },

    /** Called when the player finishes a step. Returns true if a door or critter took over. */
    arrive() {
      const p = this.player;
      const warp = (this.map.warps || []).find((w) => w.x === p.x && w.y === p.y);
      if (warp) {
        if (this.riding && MAPS[warp.to].indoors) this.getOff(p.fromX, p.fromY);
        sfx.door();
        this.transition(() => { this.loadMap(warp.to, warp.tx, warp.ty, warp.dir); this.save(); });
        return true;
      }
      const here = this.tileAt(p.x, p.y);
      const wasSwimming = this.tileAt(p.fromX, p.fromY).swim;
      if (here.swim && !wasSwimming) { this.splash(p.x + 0.5, p.y + 0.56, 14, 1); tone(240, 0.18, "sine", 0.12); tone(520, 0.12, "sine", 0.06, 0.05); }
      else if (!here.swim && wasSwimming) this.splash(p.x + 0.5, p.y + 0.5, 5, 0.4);
      const pool = here.grass ? this.map.critters : here.swim ? this.map.waterCritters : null;
      if (pool) {
        if (this.grace > 0) this.grace--;
        else if (Math.random() < ENCOUNTER_RATE) { this.startBattle(pick(pool), here.swim); return true; }
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
        if (this.blocked(nx, ny, n) || this.tileAt(nx, ny).grass || this.tileAt(nx, ny).swim) continue;
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
        if (person.action === "fishing") return this.say(person.talk, () => this.fishingQuestion());
        return this.say(person.talk);
      }
      const item = this.itemAt(fx, fy);
      if (item && item.kind === "bike") return this.getOn(item);
      const sign = (this.map.signs || []).find((s) => s.x === fx && s.y === fy);
      if (sign) this.say(sign.text);
    },

    /* ---------------- water physics: splashes, ripples, wakes ----------------
       Particles live in tile units. Drops fly up and fall back with gravity
       (z is their height above the water) and leave a small ripple where
       they land. Rings spread out and fade. Wakes drift sideways and slow
       down from the water's drag.                                          */
    splash(x, y, n, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = (0.01 + Math.random() * 0.025) * power;
        this.fx.push({ kind: "drop", x, y, z: 0.12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: (0.04 + Math.random() * 0.05) * power, age: 0 });
      }
      this.fx.push({ kind: "ring", x, y, size: 0.7 * power + 0.2, life: 55, age: 0 });
    },
    ring(x, y, size = 0.45, life = 45) { this.fx.push({ kind: "ring", x, y, size, life, age: 0 }); },

    updateFx() {
      const p = this.player;
      if (this.scene === "world" && this.tileAt(Math.round(this.swimX ?? p.x), Math.round(this.swimY ?? p.y)).swim && this.swimX != null) {
        // a swimmer pushes water: a wake while moving, slow rings while floating
        if (p.moving && p.ease) {
          const [dx, dy] = DIRS[p.dir];
          if (this.tick % 7 === 0) {
            for (const k of [-1, 1]) {
              this.fx.push({ kind: "wake", x: this.swimX - dx * 0.25, y: this.swimY - dy * 0.15, vx: -dy * k * 0.02 - dx * 0.006, vy: dx * k * 0.014 - dy * 0.006, life: 42, age: 0 });
            }
          }
          if (this.tick % 18 === 0) this.ring(this.swimX, this.swimY, 0.35, 38);
        } else if (this.tick % 70 === 0) this.ring(this.swimX, this.swimY, 0.3, 50);
      }
      for (const f of this.fx) {
        f.age++;
        if (f.kind === "drop") {
          f.x += f.vx; f.y += f.vy; f.z += f.vz; f.vz -= 0.0065;
          if (f.z <= 0) { f.dead = true; this.ring(f.x, f.y, 0.14, 24); }
        } else if (f.kind === "wake") {
          f.x += f.vx; f.y += f.vy; f.vx *= 0.95; f.vy *= 0.95;
          if (f.age > f.life) f.dead = true;
        } else if (f.age > f.life) f.dead = true;
      }
      this.fx = this.fx.filter((f) => !f.dead);
      if (this.fx.length > 220) this.fx.splice(0, this.fx.length - 220);
    },

    /** Ripples and wakes, drawn on the water's surface. */
    drawSurfaceFx(c, camX, camY, waterPath) {
      const T = this.T;
      c.save(); c.clip(waterPath); c.lineCap = "round";
      for (const f of this.fx) {
        const x = f.x * T - camX, y = f.y * T - camY, k = f.age / f.life;
        if (f.kind === "ring") {
          const rx = f.size * T * (0.35 + k * 0.9);
          c.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.85})`; c.lineWidth = Math.max(1, T * 0.035 * (1 - k * 0.5));
          c.beginPath(); c.ellipse(x, y, rx, rx * 0.32, 0, 0, Math.PI * 2); c.stroke();
        } else if (f.kind === "wake") {
          c.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.7})`; c.lineWidth = Math.max(1, T * 0.03);
          c.beginPath(); c.moveTo(x - T * 0.12, y); c.quadraticCurveTo(x, y - T * 0.05, x + T * 0.12, y); c.stroke();
        }
      }
      c.restore();
    },

    /** Flying drops, drawn above everything. */
    drawDrops(c, camX, camY) {
      const T = this.T;
      c.fillStyle = "rgba(255,255,255,.95)"; c.strokeStyle = "rgba(60,140,160,.6)"; c.lineWidth = 1;
      for (const f of this.fx) {
        if (f.kind !== "drop") continue;
        const x = f.x * T - camX, y = (f.y - f.z) * T - camY, r = T * 0.04;
        c.beginPath(); c.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    },

    /** The sky mirrored in the water: soft clouds drifting by and a sun glint. */
    drawSky(c, waterPath, camX, camY, t) {
      const T = this.T, mw = this.map.tiles[0].length + 8;
      c.save(); c.clip(waterPath);
      for (let i = 0; i < 6; i++) {
        const x = ((((i * 13.7 + t * 0.12) % mw) + mw) % mw) - 4, y = (i * 9.1) % this.map.tiles.length;
        const cx = x * T - camX, cy = y * T - camY;
        for (const [ox, oy, rx, ry] of [[0, 0, 2.2, 0.7], [1.3, -0.25, 1.4, 0.55], [-1.2, 0.15, 1.3, 0.5]]) {
          const g = c.createRadialGradient(cx + ox * T, cy + oy * T, 0, cx + ox * T, cy + oy * T, rx * T);
          g.addColorStop(0, "rgba(255,255,255,.26)"); g.addColorStop(1, "rgba(255,255,255,0)");
          c.fillStyle = g;
          c.save(); c.translate(cx + ox * T, cy + oy * T); c.scale(1, ry / rx); c.translate(-(cx + ox * T), -(cy + oy * T));
          c.fillRect(cx + ox * T - rx * T, cy + oy * T - rx * T, rx * T * 2, rx * T * 2);
          c.restore();
        }
      }
      // sun glint: a few bright flecks that twinkle in a fixed spot on screen
      for (let i = 0; i < 9; i++) {
        const a = Math.sin(t * 2.3 + i * 1.7);
        if (a < 0.2) continue;
        const gx = this.W * 0.72 + Math.sin(i * 2.1) * T * 1.2, gy = this.H * 0.28 + Math.cos(i * 1.3) * T * 0.8;
        c.fillStyle = `rgba(255,255,240,${a * 0.85})`;
        c.beginPath(); c.ellipse(gx, gy, T * 0.12 * a, T * 0.035, 0, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    },

    /* ---------------- reflections ----------------
       Anything standing at the water's edge or on the dock is drawn again,
       upside down, into a buffer: mirrored at its base, tinted by the water,
       faded with distance, then copied onto the water in thin strips that
       sway with the ripples.                                              */
    drawReflections(things, waterPath, t) {
      if (!things.length) return;
      const W = this.W, H = this.H, dpr = this.dpr, T = this.T, c = this.ctx;
      const buf = (this.reflBuf = this.reflBuf || document.createElement("canvas"));
      if (buf.width !== Math.round(W * dpr) || buf.height !== Math.round(H * dpr)) {
        buf.width = Math.round(W * dpr); buf.height = Math.round(H * dpr);
      }
      const rc = buf.getContext("2d");
      rc.setTransform(1, 0, 0, 1, 0, 0);
      rc.clearRect(0, 0, buf.width, buf.height);
      rc.setTransform(dpr, 0, 0, dpr, 0, 0);
      let top = Infinity, bottom = -Infinity;
      for (const th of things) {
        const m = th.mirror, len = th.reach * T;
        rc.save(); rc.translate(0, 2 * m); rc.scale(1, -1); th.draw(rc); rc.restore();
        rc.save();
        rc.globalCompositeOperation = "destination-out";
        const g = rc.createLinearGradient(0, m, 0, m + len);
        g.addColorStop(0, "rgba(0,0,0,.05)"); g.addColorStop(1, "rgba(0,0,0,1)");
        rc.fillStyle = g; rc.fillRect(th.cx - T * 1.2, m, T * 2.4, len + T);
        rc.restore();
        top = Math.min(top, m); bottom = Math.max(bottom, m + len);
      }
      rc.save(); rc.globalCompositeOperation = "source-atop";
      rc.fillStyle = "rgba(40,115,140,.4)"; rc.fillRect(0, 0, W, H); rc.restore();
      c.save(); c.clip(waterPath); c.globalAlpha = 0.7;
      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H, Math.ceil(bottom));
      for (let y = y0; y < y1; y += 2) {
        const dx = Math.sin(y * 0.2 + t * 3.1) * 1.4 + Math.sin(y * 0.055 - t * 1.4) * 1.6;
        c.drawImage(buf, 0, y * dpr, buf.width, 2 * dpr, dx, y, W, 2);
      }
      c.restore();
    },

    /* ---------------- fishing with Uncle Pat ---------------- */
    fishingQuestion() {
      const q = makeQuestion(this.mode);
      const solved = q.text.replace("?", q.answer);
      this.openMenu({
        kind: "answers",
        title: q.text,
        items: q.choices.map(String),
        cols: 2,
        onPick: (i) => {
          this.menu = null;
          if (q.choices[i] === q.answer) {
            sfx.right();
            this.ui.award({ celebrate: false });
            this.say([`UNCLE PAT: That's right! ${solved}`, "Grab a rod. Let's go fishing!"], () => this.startFishing());
          } else {
            App.Sound.miss();
            this.say([`UNCLE PAT: Not quite. ${solved}`, "Talk to me again and I'll ask you another one!"]);
          }
        },
        onBack: () => { this.menu = null; this.say(["UNCLE PAT: Come back anytime!"]); },
      });
    },

    startFishing() {
      this.transition(() => {
        this.scene = "fishing";
        this.fish = { phase: "ready", t: 0, target: 0.6, catch: null, caught: 0 };
        this.fishSay("Press A to cast your line!", "Cast!");
      });
    },

    fishSay(msg, button) {
      this.fish.msg = msg;
      this.fish.button = button;
    },

    updateFishing() {
      const f = this.fish;
      f.t++;
      if (Input.take("b") || Input.take("start")) {
        sfx.blip();
        return this.transition(() => {
          this.scene = "world";
          this.fish = null;
          if (f.caught) this.say([`UNCLE PAT: Nice fishing! You caught ${f.caught} today.`]);
        });
      }
      const a = Input.take("a");
      if (f.phase === "ready" && a) {
        f.phase = "casting"; f.t = 0; f.target = 0.45 + Math.random() * 0.45;
        tone(700, 0.25, "triangle", 0.08); tone(400, 0.2, "triangle", 0.06, 0.2);
        this.fishSay("Swish!", "Casting...");
      } else if (f.phase === "casting" && f.t >= 36) {
        f.phase = "waiting"; f.t = 0; f.wait = randInt(100, 260);
        tone(300, 0.1, "sine", 0.1);
        this.fishSay("Wait for a bite... watch the bobber!", "Waiting...");
      } else if (f.phase === "waiting") {
        if (a) { f.wait += 40; this.fishSay("Too soon! Wait until the bobber dips under.", "Waiting..."); }
        if (f.t >= f.wait) {
          f.phase = "bite"; f.t = 0;
          [880, 988].forEach((fr, i) => tone(fr, 0.08, "square", 0.08, i * 0.1));
          this.fishSay("A bite! Press A now!", "Reel it in!");
        }
      } else if (f.phase === "bite") {
        if (a) {
          f.phase = "reeling"; f.t = 0; f.catch = pick(CATCHES);
          this.fishSay("Reel, reel, reel!", "Reeling...");
        } else if (f.t >= (BITE_WINDOW[this.mode] || 60)) {
          f.phase = "ready"; f.t = 0;
          App.Sound.miss();
          this.fishSay("It got away! Press A to cast again.", "Cast again");
        }
      } else if (f.phase === "reeling" && f.t >= 50) {
        f.phase = "caught"; f.t = 0;
        this.landCatch(f.catch);
      } else if (f.phase === "caught" && a) {
        f.phase = "ready"; f.t = 0;
        this.fishSay("Press A to cast your line!", "Cast!");
      }
    },

    landCatch(id) {
      const f = this.fish;
      if (id === "boot") {
        tone(220, 0.2, "triangle", 0.1); tone(180, 0.25, "triangle", 0.1, 0.18);
        return this.fishSay("You caught... an old boot! Ha! Uncle Pat tosses it in the bin.", "Cast again");
      }
      const cr = CRITTERS[id];
      const isNew = !this.friends.has(id);
      f.caught++;
      this.friends.add(id);
      this.seen.add(id);
      this.save();
      this.updateProgress();
      this.ui.award({ celebrate: false });
      App.Sound.win();
      if (isNew) App.FX.celebrate(true, "New friend!");
      this.fishSay(`You caught ${cr.name}! You say hi and let it swim away.${isNew ? " It's in your Critter Book now!" : ""}`, "Cast again");
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
        note: "Map data © OpenStreetMap contributors",
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
    startBattle(id, water = !!CRITTERS[id]?.water) {
      this.seen.add(id);
      sfx.meet();
      this.transition(() => {
        this.scene = "battle";
        this.battle = { id, c: CRITTERS[id], water, hearts: 0, bored: 0, phase: "intro", slide: 0, hop: 0, shake: 0 };
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
      else if (this.scene === "fishing") this.drawFishing();
      else this.drawWorld();
      if (this.fade) this.drawFade();
    },

    drawWorld() {
      const c = this.ctx, T = this.T, W = this.W, H = this.H, dpr = this.dpr;
      const t = this.tick / 60;
      const p = this.player;
      const pos = (e, dur) => {
        let k = e.moving ? e.t / dur : 1;
        if (e.moving && e.ease) k = (1 - Math.cos(Math.PI * k)) / 2; // swim strokes: push, glide, slow

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

      // ground. Water is painted afterwards as one layer, so it has no seams.
      const isWet = (ch) => {
        const g = TILES[ch]?.ground;
        return (g === "water" || g === "dock") && !AD.assets.tiles[ch];
      };
      const objects = [], wet = [], docks = [];
      const waterPath = new Path2D();
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const ch = this.charAt(tx, ty);
          const tile = TILES[ch];
          const sx = tx * T - camX, sy = ty * T - camY;
          const variant = AD.hash(tx, ty) % 4;
          if (isWet(ch)) {
            waterPath.rect(sx, sy, T, T);
            wet.push([tx, ty, sx, sy]);
            if (tile.ground === "dock") docks.push([tx, ty, sx, sy, ch]);
          } else {
            D.ground(c, tile.ground, ch, sx, sy, T, dpr, AD.maskOf(same(tx, ty, ch)), variant);
          }
          if (tile.object) objects.push({ y: ty + 1, tx, ty, ch, tile, sx, sy, variant });
        }
      }
      // things that stand up, and people
      const actors = [
        ...this.people.map((n) => ({ e: n, look: n.look, dur: NPC_STEP, at: pos(n, NPC_STEP) })),
        { e: p, look: this.riding ? "heroBike" : "hero", dur: p.dur, at: pp },
      ];
      const things = [
        ...objects.map((o) => ({ y: o.y, tx: o.tx, ty: o.ty, cx: o.sx + T / 2, base: o.sy + T, onWet: isWet(o.ch), draw: (cc) => {
          const house = o.ch === "h" ? this.houseOf[o.ty]?.[o.tx] ?? 0 : 0;
          const info = { color: AD.hash(house, this.mapId.length) % AD.HOUSES.length, window: o.ch === "h" && AD.hash(o.tx, o.ty, 3) % 3 === 0 };
          D.object(cc, o.tile.object, o.ch, o.sx, o.sy, T, dpr, AD.maskOf(same(o.tx, o.ty, o.ch)), o.variant, info);
        } })),
        ...actors.map((a) => ({ y: a.at.y + 0.95, tx: Math.round(a.at.x), ty: Math.round(a.at.y), actor: true,
          cx: a.at.x * T + T / 2 - camX, base: a.at.y * T + T * 0.9 - camY, draw: (cc) => this.drawActor(a, camX, camY, t, cc) })),
        ...this.items.map((it) => ({ y: it.y + 0.9, tx: it.x, ty: it.y, cx: it.x * T + T / 2 - camX, base: it.y * T + T * 0.92 - camY,
          draw: (cc) => D.object(cc, it.kind, it.kind, it.x * T - camX, it.y * T - camY, T, dpr, 0, 0) })),
      ].sort((a, b) => a.y - b.y);

      const swimmer = this.tileAt(Math.round(pp.x), Math.round(pp.y)).swim;
      this.swimX = swimmer && !this.riding ? pp.x + 0.5 : null;
      this.swimY = pp.y + 0.56;

      if (wet.length) {
        D.water(c, dpr, waterPath, camX, camY, t);
        this.drawSky(c, waterPath, camX, camY, t);
        // reflections of anything at the water's edge or on the dock (not swimmers)
        const mirrored = things.filter((th) => {
          if (th.actor && this.tileAt(th.tx, th.ty).swim) return false;
          return isWet(this.charAt(th.tx, th.ty)) || isWet(this.charAt(th.tx, th.ty + 1));
        }).map((th) => ({ ...th, mirror: th.onWet ? th.base - T * 0.2 : th.base, reach: th.actor ? 2.4 : 2.2 }));
        this.drawReflections(mirrored, waterPath, t);
        // soft foam where the water meets the shore
        c.lineCap = "round";
        for (const [tx, ty, sx, sy] of wet) {
          const edges = [[0, -1, sx, sy + 2, sx + T, sy + 2], [0, 1, sx, sy + T - 2, sx + T, sy + T - 2],
            [-1, 0, sx + 2, sy, sx + 2, sy + T], [1, 0, sx + T - 2, sy, sx + T - 2, sy + T]];
          for (const [dx, dy, x1, y1, x2, y2] of edges) {
            if (isWet(this.charAt(tx + dx, ty + dy))) continue;
            c.strokeStyle = "rgba(228,248,243,.95)"; c.lineWidth = T * 0.07;
            c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
            const lap = (4 + Math.sin(t * 2 + tx + ty) * 2.5) * (T / 48);
            c.strokeStyle = "rgba(228,248,243,.45)"; c.lineWidth = T * 0.035;
            c.beginPath(); c.moveTo(x1 - dx * lap, y1 - dy * lap); c.lineTo(x2 - dx * lap, y2 - dy * lap); c.stroke();
          }
        }
        for (const [tx, ty, sx, sy, ch] of docks) {
          D.ground(c, "dockPlanks", ch + "p", sx, sy, T, dpr, AD.maskOf(same(tx, ty, ch)), AD.hash(tx, ty) % 4);
        }
        this.drawSurfaceFx(c, camX, camY, waterPath);
      }

      things.forEach((it) => it.draw(c));
      this.drawDrops(c, camX, camY);
    },

    drawActor({ e, look, dur, at }, camX, camY, t, cc) {
      const c = cc || this.ctx, T = this.T;
      const cx = at.x * T + T / 2 - camX;
      const foot = at.y * T + T * 0.9 - camY;
      const phase = e.moving ? (e.t / dur) * 0.5 + (e.leg ? 0.5 : 0) : null;
      const gx0 = Math.round(at.x), gy0 = Math.round(at.y);
      if (this.tileAt(gx0, gy0).swim && look !== "heroBike") {
        // swimming: only head and shoulders above the water
        const waterY = foot - T * 0.3;
        c.save(); c.beginPath(); c.rect(cx - T, waterY - T * 2, T * 2, T * 2); c.clip();
        D.person(c, look, e.dir, cx, foot + T * 0.12 + Math.sin(t * 3) * T * 0.04, T * 1.1, null, t);
        c.restore();
        this.ripples(cx, waterY, T, t + (phase || 0), c);
        return;
      }
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
      if (b.water) { this.drawWater(0.48, t); }
      else {
      D.blob(c, [[-20, H * 0.5], [W * 0.3, H * 0.46], [W * 0.7, H * 0.52], [W + 20, H * 0.47], [W + 20, H + 20], [-20, H + 20]], r, 8);
      D.paint(c, D.C.tall, 2.5);
      }
      for (let i = 0; i < (b.water ? 0 : 18); i++) {
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
      if (b.water) {
        const hx = W * 0.28 - (1 - ease) * W * 0.7;
        c.save(); c.beginPath(); c.rect(0, 0, W, H * 0.66 - s * 0.35); c.clip();
        D.person(c, "hero", "up", hx, H * 0.66, s, null, t);
        c.restore();
        this.ripples(hx, H * 0.66 - s * 0.35, s, t);
      } else D.person(c, "hero", "up", W * 0.28 - (1 - ease) * W * 0.7, H * 0.66, s, null, t);
    },

    ripples(cx, y, s, t, c = this.ctx) {
      c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = Math.max(1.5, s * 0.04);
      c.beginPath(); c.ellipse(cx, y, s * 0.42, s * 0.1, 0, 0, Math.PI * 2); c.stroke();
      const k = (t * 0.8) % 1;
      c.globalAlpha = 1 - k;
      c.beginPath(); c.ellipse(cx, y, s * (0.45 + k * 0.4), s * (0.11 + k * 0.08), 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    },

    /** Water from height fraction top down to the bottom, with little waves. */
    drawWater(top, t) {
      const c = this.ctx, W = this.W, H = this.H;
      const path = new Path2D();
      path.moveTo(0, H * top);
      for (let x = 0; x <= W; x += 10) path.lineTo(x, H * top + Math.sin(x * 0.05 + t * 2) * 3);
      path.lineTo(W, H); path.lineTo(0, H); path.closePath();
      D.water(c, this.dpr, path, 0, 0, t);
      // a little deeper (darker) towards the bottom, lighter near the top
      const g = c.createLinearGradient(0, H * top, 0, H);
      g.addColorStop(0, "rgba(200,240,232,.25)"); g.addColorStop(1, "rgba(25,80,110,.3)");
      c.fillStyle = g; c.fill(path);
      c.strokeStyle = "rgba(228,248,243,.95)"; c.lineWidth = 3; c.stroke(path);
    },

    drawFishing() {
      const c = this.ctx, W = this.W, H = this.H, f = this.fish;
      const t = this.tick / 60;
      const sea = 0.42;
      const sky = c.createLinearGradient(0, 0, 0, H * sea);
      sky.addColorStop(0, "#9FD8F2"); sky.addColorStop(1, "#E4F5FB");
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      // sun and far shore
      c.fillStyle = "#FFD866"; c.beginPath(); c.arc(W * 0.82, H * 0.1, W * 0.07, 0, Math.PI * 2); c.fill();
      const r = D.rng(7);
      D.blob(c, [[-20, H * sea], [W * 0.15, H * (sea - 0.06)], [W * 0.4, H * (sea - 0.04)], [W * 0.7, H * (sea - 0.07)], [W + 20, H * (sea - 0.03)], [W + 20, H * sea + 4], [-20, H * sea + 4]], r, 6);
      D.paint(c, "#7DB35A", 2.5);
      this.drawWater(sea, t);
      // fish shadows swimming below
      for (let i = 0; i < 4; i++) {
        const dir = i % 2 ? 1 : -1;
        const x = (((i * 211 + dir * t * (14 + i * 5)) % (W + 80)) + W + 80) % (W + 80) - 40;
        const y = H * (sea + 0.16 + i * 0.09);
        c.fillStyle = "rgba(20,60,90,.28)";
        c.beginPath(); c.ellipse(x, y, 16, 6, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(x - dir * 14, y); c.lineTo(x - dir * 24, y - 6); c.lineTo(x - dir * 24, y + 6); c.closePath(); c.fill();
      }
      // the dock
      const dockY = H * (sea + 0.1);
      for (let x = 0.04; x < 0.34; x += 0.1) { c.fillStyle = "#7A5634"; c.fillRect(W * x, dockY, W * 0.03, H * 0.2); }
      D.blob(c, D.rectPts(-10, dockY - H * 0.035, W * 0.36 + 10, H * 0.05, 4), r, 3); D.paint(c, "#C99A66", 2.5);
      // you, with a rod
      const s = Math.min(W * 0.3, H * 0.2);
      const px = W * 0.2;
      D.person(c, "hero", "right", px, dockY - H * 0.01, s, null, t);
      const handX = px + s * 0.28, handY = dockY - s * 0.75;
      const tipX = px + s * 1.25, tipY = dockY - s * 1.8;
      c.strokeStyle = "#7A5634"; c.lineWidth = 4; c.lineCap = "round";
      c.beginPath(); c.moveTo(handX, handY); c.quadraticCurveTo((handX + tipX) / 2, tipY + s * 0.3, tipX, tipY); c.stroke();
      // the bobber
      const restX = W * (0.4 + f.target * 0.5), restY = H * sea + 6;
      let bx = tipX, by = tipY + 30, under = false;
      if (f.phase === "casting") {
        const k = f.t / 36;
        bx = tipX + (restX - tipX) * k; by = tipY + (restY - tipY) * k - Math.sin(k * Math.PI) * H * 0.12;
      } else if (f.phase === "waiting") {
        bx = restX; by = restY + Math.sin(t * 2.5) * 2;
        if (f.wait - f.t < 40 && Math.floor(f.t / 6) % 2) by += 2; // a little nibble first
      } else if (f.phase === "bite") {
        bx = restX + Math.sin(f.t * 0.9) * 2; by = restY + 7; under = true;
      } else if (f.phase === "reeling") {
        const k = f.t / 50;
        bx = restX + (W * 0.42 - restX) * k; by = restY + Math.sin(f.t * 0.6) * 3;
      }
      if (f.phase !== "ready" && f.phase !== "caught") {
        c.strokeStyle = "rgba(58,51,48,.7)"; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(tipX, tipY); c.quadraticCurveTo((tipX + bx) / 2, Math.max(tipY, by) - 10, bx, by); c.stroke();
        if (f.phase !== "casting") this.ripples(bx, restY + 2, 26, t);
        c.save();
        if (under) { c.beginPath(); c.rect(0, 0, W, restY + 2); c.clip(); }
        c.fillStyle = "#fff"; c.beginPath(); c.arc(bx, by, 7, 0, Math.PI); c.fill();
        c.fillStyle = "#E25636"; c.beginPath(); c.arc(bx, by, 7, Math.PI, Math.PI * 2); c.fill();
        c.strokeStyle = D.C.ink; c.lineWidth = 2; c.beginPath(); c.arc(bx, by, 7, 0, Math.PI * 2); c.stroke();
        c.restore();
        if (f.phase === "bite") {
          c.font = `bold ${Math.round(W * 0.09)}px Fredoka, sans-serif`; c.textAlign = "center";
          c.fillStyle = "#E25636"; c.strokeStyle = "#fff"; c.lineWidth = 5;
          const jump = Math.abs(Math.sin(f.t * 0.3)) * 8;
          c.strokeText("!", bx, by - 22 - jump); c.fillText("!", bx, by - 22 - jump);
          c.textAlign = "start";
        }
      }
      // the catch pops up out of the water
      if (f.phase === "caught" && f.catch) {
        const k = Math.min(1, f.t / 20);
        const size = Math.min(W * 0.4, H * 0.26);
        const cy = H * sea + size * 0.4 - Math.sin(k * Math.PI / 2) * size * 0.7;
        c.fillStyle = "rgba(255,255,255,.6)";
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t;
          c.beginPath(); c.arc(W * 0.6 + Math.cos(a) * size * 0.7, cy - size * 0.5 + Math.sin(a) * size * 0.5, 4, 0, Math.PI * 2); c.fill();
        }
        D.critter(c, f.catch, W * 0.6, cy, size, t, { happy: true });
      }
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
          ...(m.note ? [h("p", { class: "mnote", text: m.note })] : []),
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

      // fishing
      this.fishEl.hidden = !(this.scene === "fishing" && this.fish) || !!this.fade;
      if (!this.fishEl.hidden) {
        if (this.fishMsg.textContent !== this.fish.msg) this.fishMsg.textContent = this.fish.msg;
        if (this.fishBtn.textContent !== this.fish.button) this.fishBtn.textContent = this.fish.button;
        const live = ["ready", "bite", "caught"].includes(this.fish.phase);
        this.fishBtn.classList.toggle("wait", !live);
        this.fishBtn.classList.toggle("now", this.fish.phase === "bite");
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
