/* =====================================================================
   Garter Quest — world data
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
      warps: [{ x: 3, y: 7, to: "crescent", tx: 0, ty: 0, dir: "down" }], // set by buildCrescent
      people: [
        { x: 5, y: 3, look: "mom", dir: "down", talk: [
          "MOM: Off on a Garter Quest? How exciting!",
          "Critters hide in the tall grass in everyone's yards on Crescent Drive. Answer their questions to make friends.",
          "Your bike is right outside by the driveway, and your little brother wants a ride in the wagon!",
          "Gram lives just across the street. Be home for dinner!",
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
      warps: [{ x: 4, y: 7, to: "crescent", tx: 0, ty: 0, dir: "up" }], // set by buildCrescent
      people: [
        { x: 5, y: 3, look: "elder", dir: "down", talk: [
          "GRAM: There's my favorite explorer! Come give Gram a hug.",
          "When I was little, I made friends with every critter on Crescent Drive. Can you?",
          "Tap the menu button to look in your CRITTER BOOK.",
        ] },
      ],
    },

    // Home base: built from the real street layout (see buildCrescent below).
    crescent: null,
  };

  /* ---------- Crescent Drive ----------
     The tiles come from js/games/adventure/crescent-map.js, made by
     tools/osm_to_map.py from an OpenStreetMap export: Crescent Drive runs
     straight across the middle, with the real cross streets, the creek and
     Forbes Bay where they really are relative to it. Houses are placed on
     lots. Here we add the story: our house, Gram's, people, signs, the bike
     and Uncle Pat's dock.                                                   */
  function buildCrescent() {
    const G = A.crescentMap;
    const sp = G.special;
    const street = G.street;
    const signs = [
      { x: sp.ours.mailbox[0], y: sp.ours.mailbox[1], text: ["OUR HOUSE"] },
      { x: sp.grams.mailbox[0], y: sp.grams.mailbox[1], text: ["GRAM'S HOUSE", "Visitors always welcome. Cookies sometimes."] },
    ];
    const extra = {
      "Crescent Drive": "Home sweet home!",
      "Parkview Drive": "Forbes Bay is just past the end of Crescent Drive.",
      "Rivershore Road": "Uncle Pat's dock is out on the bay.",
      "Brothers Drive": "The creek runs behind here. Snakes love it!",
    };
    for (const [name, [x, y]] of Object.entries(G.signs)) {
      signs.push({ x, y, text: [name.toUpperCase()].concat(extra[name] ? [extra[name]] : []) });
    }
    if (sp.dock.sign) signs.push({ x: sp.dock.sign[0], y: sp.dock.sign[1], text: ["FORBES BAY DOCK", "Uncle Pat's boat is tied up at the end. Take it for a ride!"] });
    MAPS.home.warps[0].tx = sp.ours.land[0]; MAPS.home.warps[0].ty = sp.ours.land[1];
    MAPS.grams.warps[0].tx = sp.grams.land[0]; MAPS.grams.warps[0].ty = sp.grams.land[1];
    const ox = sp.ours.door[0];
    // the wagon waits on the other side of our driveway from the bike
    const [lx, ly] = sp.ours.land;
    const wagonSpot = [[lx - 1, ly], [lx - 1, ly + 1], [lx + 1, ly + 1], [lx - 2, ly]].find(([x, y]) =>
      G.tiles[y]?.[x] === "," && !(sp.bike && sp.bike[0] === x && sp.bike[1] === y));
    return {
      name: "Crescent Drive",
      border: "T",
      layout: "osm-2", // change when the map is regenerated, so old saved spots reset
      // the boat starts tied up at the dock; it's an item you can ride, so its tile is water
      tiles: G.tiles.map((row) => row.replace(/O/g, "~")),
      warps: [
        { x: sp.ours.door[0], y: sp.ours.door[1], to: "home", tx: 3, ty: 6, dir: "up" },
        { x: sp.grams.door[0], y: sp.grams.door[1], to: "grams", tx: 4, ty: 6, dir: "up" },
      ],
      signs,
      people: [
        { x: ox + 5, y: street, look: "friend", dir: "left", wander: true, talk: [
          "Hi! I saw a SQUEAKS run into a yard on Crescent Drive!",
        ] },
        { x: ox - 14, y: street - 1, look: "friend", dir: "right", wander: true, talk: [
          "Snakes like the tall grass near the creek. Some are really shy!",
        ] },
        { x: sp.dock.pat[0], y: sp.dock.pat[1], look: "uncle", dir: "down", action: "fishing", talk: [
          "UNCLE PAT: Ahoy there, kiddo! You can take my boat out anytime. Just face it and press A.",
          "Want to go fishing?",
          "First you have to answer my math question!",
        ] },
      ],
      // things you can pick up
      items: [
        ...(sp.bike ? [{ x: sp.bike[0], y: sp.bike[1], kind: "bike" }] : []),
        ...(wagonSpot ? [{ x: wagonSpot[0], y: wagonSpot[1], kind: "wagon", dir: "down" }] : []),
        { x: sp.dock.boat[0], y: sp.dock.boat[1], kind: "boat", dir: "right" },
      ],
      // Sea routes to other places go here: a warp with byBoat: true only works
      // when you sail onto it, and your boat comes along. For example:
      // { x: 139, y: 10, to: "island", tx: 1, ty: 5, dir: "right", byBoat: true },
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
    };
  }
  MAPS.crescent = buildCrescent();

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
