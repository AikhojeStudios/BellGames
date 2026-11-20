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
     ground: how the floor of the tile is drawn (see GROUND in draw.js)
     object: something standing on it, like a tree or a house (OBJECTS in draw.js)
     solid:  can't walk onto it
     grass:  tall grass, where critters hide                                   */
  const TILES = {
    ".": { ground: "lawn" },
    ",": { ground: "tall", grass: true },
    "=": { ground: "road" },
    ":": { ground: "sidewalk" },
    "d": { ground: "drive" },
    "D": { ground: "porch" },
    "*": { ground: "flowers" },
    "~": { ground: "water", solid: true },
    "T": { ground: "lawn", object: "tree", solid: true },
    "F": { ground: "lawn", object: "fence", solid: true },
    "S": { ground: "lawn", object: "sign", solid: true },
    "h": { ground: "lawn", object: "house", solid: true },
    "_": { ground: "floor" },
    "H": { ground: "wallTop", solid: true },
    "I": { ground: "wallLow", solid: true },
    "r": { ground: "rug" },
    "M": { ground: "mat" },
    "B": { ground: "floor", object: "bed", solid: true },
    "K": { ground: "floor", object: "table", solid: true },
    "P": { ground: "floor", object: "plant", solid: true },
    "X": { ground: "void", solid: true }, // darkness outside a room
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
      warps: [{ x: 3, y: 7, to: "street", tx: 3, ty: 6, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "mom", dir: "down", talk: [
          "MOM: Going on an adventure? How exciting!",
          "Critters hide in the tall grass in everyone's yards. Answer their questions to make friends.",
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
      warps: [{ x: 4, y: 7, to: "street", tx: 18, ty: 6, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "elder", dir: "down", talk: [
          "ROWAN: When I was little, I made friends with every critter on this street.",
          "Can you find them all? Tap the menu button to look in your CRITTER BOOK.",
        ] },
      ],
    },

    // A stand-in street until the real neighborhood map is ready.
    street: {
      name: "Our Street",
      border: "T",
      tiles: [
        "TTTTTTTTTTTTTTTTTTTTTT",
        "T,,,,,,,,,,,,,,,,,,,,T",
        "T,hhhh,,,hhhhh,,hhhh,T",
        "T,hhhh,,,hhhhh,,hhhh,T",
        "T,hhhh,T,hhhhh,,hhhh,T",
        "T,,D,,,,,,,D,,,,,,D,,T",
        "T,,d,,*,,,,d,,*,,,d,,T",
        "::::::::::::::::::::::",
        "======================",
        "======================",
        "::::::::::::::::::::::",
        "T,,,d,,,,,,d,,,,,,d,,T",
        "T,,,D,,,,,,D,,,,,,D,,T",
        "T,hhhhh,,hhhhh,,hhhh,T",
        "T,hhhhh,,hhhhh,,hhhh,T",
        "T,hhhhh,,hhhhh,,hhhh,T",
        "T,,,,,,,,,S,,,,,,,,,,T",
        "T,,*,,T,,,,,,,T,,,*,,T",
        "TTTTTTTTTTTTTTTTTTTTTT",
      ],
      warps: [
        { x: 3, y: 5, to: "home", tx: 3, ty: 6, dir: "up" },
        { x: 18, y: 5, to: "rowan", tx: 4, ty: 6, dir: "up" },
      ],
      signs: [{ x: 10, y: 16, text: ["OUR STREET", "Watch out for critters in the tall grass!"] }],
      people: [
        { x: 8, y: 7, look: "friend", dir: "left", wander: true, talk: [
          "Hi! I saw a FIZZBUN hop into a yard over there!",
        ] },
        { x: 14, y: 10, look: "friend", dir: "down", wander: true, talk: [
          "Critters get bored if you guess wrong. Take your time and think!",
        ] },
      ],
      critters: ["fizzbun", "fizzbun", "mossy", "mossy", "pebblet", "pebblet", "flitter"],
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
