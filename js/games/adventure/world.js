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
     grass:  tall grass, where critters hide
     swim:   water you can swim in, where sea critters live                    */
  const TILES = {
    ".": { ground: "lawn" },
    ",": { ground: "tall", grass: true },
    "=": { ground: "road" },
    ":": { ground: "sidewalk" },
    "d": { ground: "drive" },
    "D": { ground: "porch" },
    "*": { ground: "flowers" },
    "~": { ground: "water", swim: true },
    "-": { ground: "sand" },
    "#": { ground: "dock" },
    "O": { ground: "water", object: "boat", solid: true },
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
    squeaks: { name: "SQUEAKS", art: "squeaks", about: "A quick little mouse. It counts every seed it finds." },
    sprigsnake: { name: "SPRIGSNAKE", art: "sprigsnake", about: "A bright green snake. It hides in the grass and is very shy." },
    sootsnake: { name: "SOOTSNAKE", art: "sootsnake", about: "A shiny black snake. A great climber that naps up in trees." },
    hoodini: { name: "HOODINI", art: "hoodini", about: "A cobra that puffs out its hood to look big. Very rare!" },
    // in the water
    finny: { name: "FINNY", art: "finny", water: true, about: "A sunny little fish. It swims in circles when it's happy." },
    pinchy: { name: "PINCHY", art: "pinchy", water: true, about: "A crab that walks sideways. Its claws wave hello." },
    shelby: { name: "SHELBY", art: "shelby", water: true, about: "A slow and gentle turtle. It has been swimming here for years." },
    bloop: { name: "BLOOP", art: "bloop", water: true, about: "A wobbly jellyfish. Look, but don't touch!" },
  };

  /* ---------- maps ---------- */
  const MAPS = {
    home: {
      name: "Home",
      border: "X",
      indoors: true,
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
      warps: [{ x: 3, y: 7, to: "crescent", tx: 14, ty: 15, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "mom", dir: "down", talk: [
          "MOM: Going on an adventure? How exciting!",
          "Critters hide in the tall grass in everyone's yards on Crescent Drive. Answer their questions to make friends.",
          "Your bike is right outside by the driveway. Gram lives just across the street. Be home for dinner!",
        ] },
      ],
    },

    grams: {
      name: "Gram's House",
      border: "X",
      indoors: true,
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
      warps: [{ x: 4, y: 7, to: "crescent", tx: 17, ty: 17, dir: "down" }],
      people: [
        { x: 5, y: 3, look: "elder", dir: "down", talk: [
          "GRAM: There's my favorite explorer! Come give Gram a hug.",
          "When I was little, I made friends with every critter on Crescent Drive. Can you?",
          "Tap the menu button to look in your CRITTER BOOK.",
        ] },
      ],
    },

    // Home base. Street layout traced from OpenStreetMap (© OpenStreetMap contributors).
    // Houses are placed on typical lots along each street.
    crescent: {
      name: "Crescent Drive",
      border: "T",
      tiles: [
        "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
        "========================================",
        "========================================",
        "::==:::::::::::==:::::::==:~~~~~~~~~~~~~",
        ",,==S,,,,,,,,,S==,,,,,,S==-~~~~~~~~~~~~~",
        ",,==Dhhh,,,hhhD==Dhhh,,,==-~~~~~~~~~~~~~",
        ",,==dhhh,T,hhhd==dhhh,T,==-~~~~~~~~~~~~~",
        ",,==,,,,,,,,,,,==,,,,,,,==S~~~~~~##~~~~~",
        ",,==Dhhh,,,hhhD==Dhhh,,,==-########O~~~~",
        ",,==dhhh,*,hhhd==dhhh,,,==-~~~~~~##~~~~~",
        ",,==,,,,,,,,,,,===========-~~~~~~~~~~~~~",
        ",,==Dhhh,,,hhhD===========-~~~~~~~~~~~~~",
        ",,==dhhh,T,hhhd==S,,,,,,==-~~~~~~~~~~~~~",
        ",,==,,,,,,,,,,S==DhhhT,,==-~~~~~~~~~~~~~",
        ",,==Dhhh,,,hhhD==dhhh,,,==-~~~~~~~~~~~~~",
        ",,==dhhh,,,hhhd==S,,,,T,==-~~~~~~~~~~~~~",
        ",,==,,,,,,,,,,,==Dhhh,,,==-~~~~~~~~~~~~~",
        ",,==Dhhh,*,hhhD==dhhh,,,==-~~~~~~~~~~~~~",
        ",,==dhhh,,,hhhd==,,,,T,,==-~~~~~~~~~~~~~",
        ",,==,,,,,,,,,,,==,,,,,,,==-~~~~~~~~~~~~~",
        ",,==DhhhT,,hhhD==,,,,,,,==,,~~,,,,,,,,,,",
        ",,==dhhh,,,hhhd===========,,~~,,,,,,,,,,",
        ",,==,,,,,,,,,,,===========,,~~,,,,,,,,T,",
        ",,==Dhhh,,,hhhD==S,,,,,D,d,,~~,,T,,,,,,,",
        ",,==dhhh,*,hhhd==Dhhh,hhh,,~~,,,,,,,,,,,",
        ",,==,,,,,,,,,,,==dhhh,hhh,,~~,,,,,,,,,,,",
        ",,==Dhhh,,,hhhD==,,,,,,,,,,~~,,,,,,,,,,,",
        ",,==dhhh,,Thhhd==Dhhh,,,,,,~~,,,,,,,T,,,",
        ",,==,,,,,,,,,,,==dhhh,,T,,,,~~,,,,,,,,,,",
        ",,==Dhhh,,,hhhD==,,,,,,,,,,,~~,,,,,,,,,,",
        ",,==dhhh,,,hhhd==Dhhh,,,,,,,~~,,,,,*,,,,",
        ",,==,,,,,,,,,,,==dhhh,,,,,,,~~,,,,,,,,,,",
        ",,===============,,,,,,,,,,~~,,,,,,,,,,,",
        ",,===============,,,,,,,,,,~~,,,,,T,,,,,",
        ",,==,,D,d,,D,d,,,,,,,,,,,,,~~,,,,,,,,,,,",
        ",,==,hhh,,hhh,,,,,,,*,,,,,,~~,,,,,,,,,,,",
        ",,==,hhh,,hhhT,,,,,,,,,,,,,,~~,*,,,,,,,,",
        "TT==TTTTTTTTTTTTTTTTTTTTTTT,~~,TTTTTTTTT",
      ],
      warps: [
        { x: 14, y: 14, to: "home", tx: 3, ty: 6, dir: "up" },   // Our House
        { x: 17, y: 16, to: "grams", tx: 4, ty: 6, dir: "up" },  // Gram's House
      ],
      signs: [
        { x: 14, y: 13, text: ["OUR HOUSE"] },
        { x: 17, y: 15, text: ["GRAM'S HOUSE", "Visitors always welcome. Cookies sometimes."] },
        { x: 14, y: 4, text: ["CRESCENT DRIVE", "Parkview Drive is just up north."] },
        { x: 4, y: 4, text: ["EDGEWOOD DRIVE"] },
        { x: 17, y: 12, text: ["ROCHELLE DRIVE"] },
        { x: 17, y: 23, text: ["MIDGETT DRIVE"] },
        { x: 23, y: 4, text: ["BROTHERS DRIVE", "Forbes Bay is just past the sand. Swim, but stay safe!"] },
        { x: 26, y: 7, text: ["FORBES BAY DOCK", "Uncle Pat's boat is tied up at the end."] },
      ],
      people: [
        { x: 16, y: 8, look: "friend", dir: "down", wander: true, talk: [
          "Hi! I saw a SQUEAKS run into a yard on Crescent Drive!",
        ] },
        { x: 20, y: 10, look: "friend", dir: "left", wander: true, talk: [
          "Snakes like the tall grass near the creek. Some are really shy!",
        ] },
        { x: 34, y: 7, look: "uncle", dir: "down", action: "fishing", talk: [
          "UNCLE PAT: Ahoy there, kiddo! Want to go fishing?",
          "First you have to answer my math question!",
        ] },
      ],
      // things you can pick up
      items: [{ x: 14, y: 16, kind: "bike" }],
      // more copies of a name = met more often
      critters: [
        "squeaks", "squeaks", "squeaks",
        "fizzbun", "fizzbun", "mossy", "mossy",
        "sprigsnake", "sprigsnake", "sootsnake", "sootsnake",
        "pebblet", "flitter",
        "hoodini",
      ],
      // who you can meet while swimming
      waterCritters: ["finny", "finny", "finny", "pinchy", "pinchy", "shelby", "bloop"],
    },
  };

  /* What can bite on Uncle Pat's line. More copies = more often. */
  const CATCHES = ["finny", "finny", "finny", "finny", "pinchy", "pinchy", "shelby", "shelby", "bloop", "boot"];

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

  A.world = { TILES, CRITTERS, MAPS, START, CATCHES, makeQuestion };
})();
