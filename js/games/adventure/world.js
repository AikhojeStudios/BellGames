/* =====================================================================
   Going on an Adventure — world data
   Maps are drawn with one character per tile (see TILES for the key).
   To add an area: add a map, then connect it with "warps" (a tile you
   step on that takes you somewhere else). People, signs and which
   critters live in the tall grass are all set per map.
   ===================================================================== */
(function () {
  "use strict";
  const A = (App.Adventure = App.Adventure || {});
  const { randInt, pick, shuffle } = App.util;

  /* ---------- tile key ----------
     art:   sprite name, or [frame1, frame2] for animated tiles
     under: sprite drawn first (for see-through art like trees)
     solid: can't walk onto it
     grass: tall grass, where critters hide                     */
  const TILES = {
    ".": { art: "grass" },
    ",": { art: "tall", grass: true },
    ":": { art: "path" },
    "*": { art: ["flower", "flower2"], under: "grass" },
    "T": { art: "tree", under: "grass", solid: true },
    "~": { art: ["water", "water2"], solid: true },
    "F": { art: "fence", under: "grass", solid: true },
    "S": { art: "sign", under: "grass", solid: true },
    "R": { art: "roof", solid: true },
    "W": { art: "wall", solid: true },
    "N": { art: "window", solid: true },
    "D": { art: "door" },
    "_": { art: "floor" },
    "H": { art: "wallTop", solid: true },
    "I": { art: "wallLow", solid: true },
    "r": { art: "rug" },
    "B": { art: "bed", under: "floor", solid: true },
    "K": { art: "table", under: "floor", solid: true },
    "P": { art: "plant", under: "floor", solid: true },
    "M": { art: "mat", under: "floor" },
    "X": { art: null, solid: true }, // darkness outside a room
  };

  /* ---------- critters ---------- */
  const CRITTERS = {
    fizzbun: { name: "FIZZBUN", art: "fizzbun", about: "A bouncy bunny. It thumps its foot to count." },
    mossy: { name: "MOSSY", art: "mossy", about: "A soft green blob. A sprout grows on its head." },
    pebblet: { name: "PEBBLET", art: "pebblet", about: "A sleepy little rock. It naps in the sun." },
    flitter: { name: "FLITTER", art: "flitter", about: "A dusty moth. It loves bright lights." },
  };

  /* ---------- maps ---------- */
  const MAPS = {
    home: {
      name: "Home",
      border: "X",
      tiles: [
        "HHHHHHHH",
        "IIIIIIII",
        "B______P",
        "________",
        "__rr____",
        "__rrK___",
        "________",
        "___M____",
      ],
      warps: [{ x: 3, y: 7, to: "town", tx: 5, ty: 6, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "elder", dir: "down", talk: [
          "MOM: Going on an adventure? How exciting!",
          "Critters hide in the tall grass. Answer their questions to make friends.",
          "Be home for dinner!",
        ] },
      ],
    },

    rowan: {
      name: "Rowan's House",
      border: "X",
      tiles: [
        "HHHHHHHH",
        "IIIIIIII",
        "P______P",
        "________",
        "___KK___",
        "________",
        "_rr_____",
        "____M___",
      ],
      warps: [{ x: 4, y: 7, to: "town", tx: 14, ty: 6, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "elder", dir: "down", talk: [
          "ROWAN: When I was little, I made friends with every critter in Sunny Meadow.",
          "Can you find them all? Press START to look in your CRITTER BOOK.",
        ] },
      ],
    },

    town: {
      name: "Willow Nook",
      border: "T",
      tiles: [
        "TTTTTTTTT::TTTTTTTTT",
        "TTTTTTTTT::TTTTTTTTT",
        "TT.......::.......TT",
        "TT.RRRR..::.RRRR..TT",
        "TT.RRRR..::.RRRR..TT",
        "TT.WNDW..::.WNDW..TT",
        "TT...:...::...:...TT",
        "TT.S.::::::::::...TT",
        "TT...:........*...TT",
        "TT.*.:...FFFFF....TT",
        "TT...:...F~~~F.*..TT",
        "TT,,,:...F~~~F....TT",
        "TT,,,:...FFFFF....TT",
        "TT,,,:............TT",
        "TTTTTTTTTTTTTTTTTTTT",
        "TTTTTTTTTTTTTTTTTTTT",
      ],
      warps: [
        { x: 5, y: 5, to: "home", tx: 3, ty: 6, dir: "up" },
        { x: 14, y: 5, to: "rowan", tx: 4, ty: 6, dir: "up" },
        { x: 9, y: 0, to: "meadow", tx: 9, ty: 12, dir: "up" },
        { x: 10, y: 0, to: "meadow", tx: 10, ty: 12, dir: "up" },
      ],
      signs: [{ x: 3, y: 7, text: ["WILLOW NOOK", "A cozy little town. North: Sunny Meadow."] }],
      people: [
        { x: 13, y: 8, look: "friend", dir: "left", wander: true, talk: [
          "Hi! I saw a FIZZBUN hop into the tall grass over there!",
        ] },
        { x: 7, y: 2, look: "friend", dir: "down", talk: [
          "Up north is Sunny Meadow. Lots of critters live there!",
        ] },
      ],
      critters: ["fizzbun", "fizzbun", "mossy"],
    },

    meadow: {
      name: "Sunny Meadow",
      border: "T",
      tiles: [
        "TTTTTTTTTTTTTTTTTTTT",
        "TT,,,,,......,,,,,TT",
        "TT,,,,,..*...,,,,,TT",
        "TT,,,,,......,,,,,TT",
        "TT......::::......TT",
        "TT.~~~..:..:..*...TT",
        "TT.~~~..:..:......TT",
        "TT......:..:..,,,.TT",
        "TT,,,...:..:..,,,.TT",
        "TT,,,...::::..,,,.TT",
        "TT,,,....::...,,,.TT",
        "TT.......::.S.....TT",
        "TT.*.....::...*...TT",
        "TTTTTTTTT::TTTTTTTTT",
      ],
      warps: [
        { x: 9, y: 13, to: "town", tx: 9, ty: 1, dir: "down" },
        { x: 10, y: 13, to: "town", tx: 10, ty: 1, dir: "down" },
      ],
      signs: [{ x: 12, y: 11, text: ["SUNNY MEADOW", "The path north is still being built. Come back soon!"] }],
      people: [
        { x: 6, y: 11, look: "friend", dir: "right", wander: true, talk: [
          "Critters get bored if you guess wrong. Take your time and think!",
        ] },
      ],
      critters: ["fizzbun", "mossy", "mossy", "pebblet", "pebblet", "flitter"],
    },
  };

  const START = { map: "home", x: 3, y: 4, dir: "down" };

  /* ---------- questions, by level ---------- */
  function makeQuestion(mode) {
    let a, b, op;
    if (mode === "easy") {
      op = "+"; a = randInt(0, 5); b = randInt(1, 5);
    } else if (mode === "medium") {
      op = pick(["+", "-"]);
      if (op === "+") { a = randInt(2, 12); b = randInt(1, 20 - a); }
      else { a = randInt(5, 20); b = randInt(1, a); }
    } else {
      op = pick(["+", "-"]);
      if (op === "+") { a = randInt(10, 79); b = randInt(2, Math.min(20, 99 - a)); }
      else { a = randInt(20, 99); b = randInt(2, 20); }
    }
    const answer = op === "+" ? a + b : a - b;
    const near = mode === "hard" ? [1, 2, 10, -1, -2, -10] : [1, 2, 3, -1, -2, -3];
    const choices = new Set([answer]);
    for (const d of shuffle(near)) {
      if (choices.size >= 4) break;
      if (answer + d >= 0) choices.add(answer + d);
    }
    return { text: `${a} ${op} ${b} = ?`, answer, choices: shuffle([...choices]) };
  }

  A.world = { TILES, CRITTERS, MAPS, START, makeQuestion };
})();
