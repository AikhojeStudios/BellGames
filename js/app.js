/* =====================================================================
   Play & Learn — app shell
   Builds the home screen, the level picker and one screen per
   registered game, and routes clicks and keys to the right place.
   ===================================================================== */
(function () {
  "use strict";
  const { $, $$, h } = App.util;
  const { Games, Progress, Sound, FX } = App;

  const LEVEL_ORDER = ["easy", "medium", "hard"];
  let current = "hub"; // id of the visible screen
  let activeGame = null; // game definition while one is being played

  /* ---------------- screens ---------------- */
  function show(id) {
    if (activeGame && id !== "game-" + activeGame.id) {
      activeGame.stop?.();
      activeGame = null;
    }
    $$(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    current = id;
    window.scrollTo(0, 0);
    if (id === "hub") renderHub();
  }

  function iconButton(action, label, text, extra = {}) {
    return h("button", { class: "iconbtn", type: "button", "data-action": action, "aria-label": label, text, ...extra });
  }

  /* ---------------- home ---------------- */
  function renderHub() {
    $("#totalStars").textContent = Progress.total();
    const tiles = $("#tiles");
    tiles.replaceChildren(
      ...Games.list.map((g) => {
        const stars = Progress.of(g.id);
        return h("button", {
          class: "tile" + (g.wide ? " wide" : ""), type: "button", "data-action": "levels", "data-game": g.id,
          style: { "--accent": `var(--${g.accent})`, "--accent-deep": `var(--${g.accent}-deep)`, "--accent-soft": `var(--${g.accent}-soft)` },
        },
        h("div", { class: "tileart" }, g.art()),
        h("div", { class: "tiletext" },
          h("span", { class: "tt", text: g.title }),
          h("span", { class: "ts", text: g.tagline })),
        stars > 0 && h("span", { class: "tilestars", "aria-label": stars + " stars" }, "⭐ " + stars));
      })
    );
  }

  /* ---------------- level picker ---------------- */
  function openLevels(id) {
    const g = Games.byId[id];
    const screen = $("#levels");
    screen.style.setProperty("--accent", `var(--${g.accent})`);
    screen.style.setProperty("--accent-deep", `var(--${g.accent}-deep)`);
    $("#levelsTitle").textContent = g.title;
    $("#levelCards").replaceChildren(
      ...LEVEL_ORDER.filter((m) => g.modes[m]).map((m) => {
        const mode = g.modes[m];
        const stars = Progress.of(g.id, m);
        return h("button", { class: "modecard " + m, type: "button", onclick: () => startGame(g, m) },
          h("span", { class: "mart" }, g.modeArt ? g.modeArt(m) : h("span", { class: "levelpips", "aria-hidden": "true" },
            LEVEL_ORDER.map((x, i) => h("i", { class: i <= LEVEL_ORDER.indexOf(m) ? "on" : "" }))
          )),
          h("span", { class: "mtext" },
            h("span", { class: "ml", text: mode.label }),
            h("span", { class: "mt", text: mode.tag })),
          stars > 0 && h("span", { class: "mstars", text: "⭐ " + stars }),
          h("span", { class: "go", "aria-hidden": "true", text: "▶" }));
      })
    );
    show("levels");
  }

  /* ---------------- game screens ---------------- */
  function buildGameScreen(g) {
    const levelName = h("span", { class: "lv" });
    const fill = h("i");
    const count = h("span", { class: "count", text: "0" });
    const chip = h("button", { class: "diffchip", type: "button", "data-action": "levels", "data-game": g.id, "aria-label": "Change level" },
      h("span", { class: "dl" }, h("small", { text: "Level" }), levelName),
      h("span", { class: "progress" }, fill));
    const top = h("div", { class: "topbar" },
      iconButton("home", "Home", "🏠"),
      chip,
      h("div", { class: "jar", "aria-label": "Stars this round" }, h("span", { class: "star", text: "⭐" }), count),
      iconButton("mute", "Turn sound off", "🔊"));
    const body = h("div", { class: "gamebody" });
    const root = h("section", {
      class: "screen game", id: "game-" + g.id, "aria-label": g.title,
      style: { "--accent": `var(--${g.accent})`, "--accent-deep": `var(--${g.accent}-deep)`, "--accent-soft": `var(--${g.accent}-soft)` },
    }, top, body);

    // The handle each game uses to talk to its own screen chrome.
    const ui = {
      root, body, stars: 0, mode: "easy",
      reset(mode) {
        this.mode = mode;
        this.stars = 0;
        chip.className = "diffchip " + mode;
        levelName.textContent = g.modes[mode].label;
        count.textContent = "0";
        this.setProgress(0);
      },
      /** Give a star. Returns true on every 5th (a "big" moment). */
      award({ celebrate = true, text } = {}) {
        this.stars++;
        Progress.add(g.id, this.mode);
        count.textContent = this.stars;
        App.util.replay(count.parentElement, "bump");
        const big = this.stars % 5 === 0;
        this.setProgress(((this.stars - 1) % 5 + 1) / 5);
        if (celebrate) { Sound.win(); FX.celebrate(big, text && text(big)); }
        return big;
      },
      setProgress(f) { fill.style.width = Math.round(f * 100) + "%"; },
    };
    $("#app").append(root);
    g.mount(ui);
    g.ui = ui;
  }

  function startGame(g, mode) {
    show("game-" + g.id);
    activeGame = g;
    g.ui.reset(mode);
    g.start(mode);
  }

  /* ---------------- input routing ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    if (action === "home") show("hub");
    else if (action === "levels") openLevels(t.dataset.game);
    else if (action === "mute") Sound.toggle();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (activeGame) openLevels(activeGame.id);
      else if (current !== "hub") show("hub");
      return;
    }
    activeGame?.onKey?.(e);
  });

  document.addEventListener("keyup", (e) => activeGame?.onKeyUp?.(e));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) activeGame?.pause?.();
  });

  /* ---------------- start up ---------------- */
  Games.list.forEach(buildGameScreen);
  Sound.sync();
  show("hub");
})();
