/* =====================================================================
   Play & Learn — shared core
   Everything the games have in common lives here: helpers, sound,
   saved progress, celebrations, screens, the number keypad and the
   game registry. Each game in js/games/ registers itself with
   App.Games.register({...}); js/app.js builds the screens from that.
   ===================================================================== */
(function () {
  "use strict";
  const App = (window.App = {});

  /* ---------------- small helpers ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /** h("div", {class:"x", onclick:fn}, child, "text", [more]) → element */
  function h(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "style") {
          for (const [p, val] of Object.entries(v)) node.style.setProperty(p, val);
        } else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid != null && kid !== false) node.append(kid);
    }
    return node;
  }

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  /** Re-trigger a CSS animation class. */
  const replay = (node, cls) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /** Pick a delay, shorter when the device asks for less motion. */
  const pace = (ms, reducedMs = Math.round(ms / 2)) => (reduceMotion ? reducedMs : ms);

  /** Timers a game can cancel all at once when the player leaves. */
  function timers() {
    const ids = new Set();
    return {
      after(ms, fn) {
        const id = setTimeout(() => { ids.delete(id); fn(); }, ms);
        ids.add(id);
        return id;
      },
      clear() { ids.forEach(clearTimeout); ids.clear(); },
    };
  }

  App.util = { $, $$, h, randInt, pick, shuffle, replay, reduceMotion, pace, timers };

  /* ---------------- saved data ---------------- */
  // localStorage can be missing or throw (private mode, blocked storage),
  // so every read and write is guarded and the games work without it.
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("bellgames:" + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("bellgames:" + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  /** Lifetime stars per game and level, e.g. { monier: { easy: 12 } }. */
  const Progress = {
    data: Store.get("stars", {}),
    add(game, mode, n = 1) {
      const g = (this.data[game] = this.data[game] || {});
      g[mode] = (g[mode] || 0) + n;
      Store.set("stars", this.data);
    },
    of(game, mode) {
      const g = this.data[game] || {};
      return mode ? g[mode] || 0 : Object.values(g).reduce((a, b) => a + b, 0);
    },
    total() {
      return Object.keys(this.data).reduce((sum, g) => sum + this.of(g), 0);
    },
  };

  App.Store = Store;
  App.Progress = Progress;

  /* ---------------- sound ---------------- */
  // Tiny synthesized beeps: no audio files to load.
  const Sound = {
    muted: Store.get("muted", false),
    ctx: null,
    tone(freq, dur = 0.12, type = "sine", vol = 0.18, when = 0) {
      if (this.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
        const t = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (e) { /* audio unavailable */ }
    },
    tap() { this.tone(560, 0.06, "square", 0.08); },
    count() { this.tone(700, 0.08, "triangle", 0.14); },
    yum() { this.tone(680, 0.09, "triangle", 0.18); this.tone(920, 0.1, "triangle", 0.18, 0.07); },
    win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, "sine", 0.2, i * 0.09)); },
    miss() { this.tone(300, 0.16, "sine", 0.16); this.tone(230, 0.2, "sine", 0.16, 0.12); },
    toggle() {
      this.muted = !this.muted;
      Store.set("muted", this.muted);
      this.sync();
      if (!this.muted) this.tap();
    },
    sync() {
      $$("[data-action=mute]").forEach((b) => {
        b.textContent = this.muted ? "🔇" : "🔊";
        b.setAttribute("aria-label", this.muted ? "Turn sound on" : "Turn sound off");
        b.setAttribute("aria-pressed", String(this.muted));
      });
    },
  };
  App.Sound = Sound;

  /* ---------------- celebrations ---------------- */
  const FX = {
    celebrate(big, text) {
      const cheer = $("#cheer");
      cheer.textContent = text || (big ? "⭐ GREAT!" : "🎉 YES!");
      replay(cheer, "show");
      if (reduceMotion) return;
      const burst = $("#burst");
      const bits = ["⭐", "🎉", "💚", "✨", "🍎", "⭐"];
      const n = big ? 30 : 16;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 90 + Math.random() * (big ? 200 : 140);
        const bit = h("span", {
          class: "bit",
          text: bits[i % bits.length],
          style: {
            "--dx": Math.cos(ang) * dist + "px",
            "--dy": Math.sin(ang) * dist - 60 + "px",
            "--dr": Math.random() * 720 - 360 + "deg",
            "animation-delay": Math.random() * 0.12 + "s",
          },
        });
        burst.append(bit);
        setTimeout(() => bit.remove(), 1150);
      }
    },
  };
  App.FX = FX;

  /* ---------------- shared UI pieces ---------------- */

  /** The pill above each puzzle: a coloured badge and a line of text. */
  App.Prompt = function Prompt() {
    const badge = h("span", { class: "badge", "aria-hidden": "true" });
    const text = h("span", { class: "ptext" });
    const el = h("div", { class: "prompt", role: "status", "aria-live": "polite" }, badge, text);
    return {
      el,
      set(message, icon, tone) {
        text.textContent = message;
        if (icon != null) badge.textContent = icon;
        el.dataset.tone = tone || "";
      },
    };
  };

  /** The dark answer display, with what the child has typed so far. */
  App.NumberInput = class NumberInput {
    constructor({ maxLen = 2, unit = "" } = {}) {
      this.value = "";
      this.maxLen = maxLen;
      this.num = h("span", { class: "num placeholder", text: "?" });
      this.el = h("div", { class: "readout", "aria-live": "polite", "aria-label": "Your answer" },
        this.num, unit && h("span", { class: "unit", text: unit }));
    }
    set(v) { this.value = String(v); this.render(); }
    clear() { this.set(""); }
    get number() { return this.value === "" ? null : parseInt(this.value, 10); }
    /** Apply a digit or "back"; returns true when something changed. */
    type(k) {
      if (k === "back") {
        if (!this.value) return false;
        this.value = this.value.slice(0, -1);
      } else if (/^\d$/.test(k)) {
        if (this.value.length >= this.maxLen || (this.value === "" && k === "0")) return false;
        this.value += k;
      } else return false;
      this.render();
      return true;
    }
    render() {
      const empty = this.value === "";
      this.num.textContent = empty ? "?" : this.value;
      this.num.classList.toggle("placeholder", empty);
    }
    shake() { replay(this.el, "shake"); }
  };

  /** 0–9 keypad with back and enter. */
  App.Keypad = function Keypad(onKey) {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "enter"];
    const labels = { back: "⌫", enter: "OK" };
    const names = { back: "Delete", enter: "Check answer" };
    const pad = h("div", { class: "keypad" },
      keys.map((k) => h("button", {
        class: "key" + (labels[k] ? " " + k : ""),
        type: "button",
        dataset: { k },
        "aria-label": names[k] || k,
        text: labels[k] || k,
      })));
    pad.addEventListener("click", (e) => {
      const b = e.target.closest(".key");
      if (b) onKey(b.dataset.k);
    });
    return pad;
  };

  /** Purple "show me" button that sits beside the answer display. */
  App.HelpButton = function HelpButton(label, onClick) {
    return h("button", { class: "helpbtn", type: "button", onclick: onClick, "aria-label": label },
      h("span", { class: "hicon", text: "💡", "aria-hidden": "true" }),
      h("span", { class: "hlabel", text: label }));
  };

  /** Shared key handling for the type-a-number games (Monier, Path). */
  App.pressNumberKey = function (game, k) {
    if (k === "help") { if (!game.locked) game.help(); return; }
    if (game.locked) return;
    if (k === "enter") { game.submit(); return; }
    if (game.entry.type(k)) Sound.tap();
  };

  /** Map a keyboard event to a keypad key, or null. */
  App.keyFromEvent = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    if (/^\d$/.test(e.key)) return e.key;
    if (e.key === "Enter") return "enter";
    if (e.key === "Backspace") return "back";
    if (e.key === "h" || e.key === "H" || e.key === "?") return "help";
    return null;
  };

  /** A cute snake mascot (inline SVG), used on tiles and level cards. */
  App.mascot = function mascot(extraClass = "") {
    const wrap = h("span", { class: "mascot " + extraClass, "aria-hidden": "true" });
    wrap.innerHTML = `
      <svg viewBox="0 0 120 84" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 66 C28 44 44 78 62 60 S90 38 96 34" fill="none" stroke="#2A7F46" stroke-width="19" stroke-linecap="round"/>
        <path d="M12 66 C28 44 44 78 62 60 S90 38 96 34" fill="none" stroke="#4CB868" stroke-width="13" stroke-linecap="round"/>
        <path d="M12 66 C28 44 44 78 62 60 S90 38 96 34" fill="none" stroke="#8FE3A3" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 11"/>
        <path d="M108 40 l9 2 m-9 -2 l8 6" stroke="#E25636" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="98" cy="32" r="16" fill="#4CB868" stroke="#2A7F46" stroke-width="3"/>
        <circle cx="92" cy="27" r="5" fill="#fff"/><circle cx="104" cy="27" r="5" fill="#fff"/>
        <circle cx="93.2" cy="27.6" r="2.4" fill="#16324F"/><circle cx="105.2" cy="27.6" r="2.4" fill="#16324F"/>
        <circle cx="88" cy="36" r="3" fill="#FF9E7A" opacity=".75"/><circle cx="108" cy="36" r="3" fill="#FF9E7A" opacity=".75"/>
        <path d="M94 37 q4 4 8 0" fill="none" stroke="#16324F" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`;
    return wrap;
  };

  /**
   * A row of round snake segments (used by Number Path and Feed the Snake).
   * cells: [{ text, cls }]. Sizes itself to fit the row; the head leads.
   */
  App.snakeRow = function snakeRow(cells, { tail = true } = {}) {
    const head = h("div", { class: "seg head", "aria-hidden": "true" },
      h("span", { class: "eye l" }), h("span", { class: "eye r" }),
      h("span", { class: "cheek l" }), h("span", { class: "cheek r" }),
      h("span", { class: "mouth" }), h("span", { class: "tongue" }));
    const segs = cells.map((c, i) =>
      h("div", { class: "seg " + (c.cls || ""), style: { "--i": i + 1 }, text: c.text ?? "" }));
    const parts = [head, ...segs];
    if (tail) parts.push(h("div", { class: "seg tail", style: { "--i": segs.length + 1 }, "aria-hidden": "true" }));
    const track = h("div", { class: "snaketrack", style: { "--n": cells.length + (tail ? 1.9 : 1.3) } }, parts);
    return { el: h("div", { class: "snake" }, track), head, segs };
  };

  /* ---------------- game registry ---------------- */
  App.Games = {
    list: [],
    byId: {},
    register(def) {
      this.list.push(def);
      this.byId[def.id] = def;
    },
  };
})();
