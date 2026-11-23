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
    // inside our house
    "g": { ground: "garden" },                 // Gram's garden bed
    // the fun park
    "p": { ground: "parkpath" },               // brick paths
    "R": { ground: "parkpath", solid: true },  // under a ride (the ride is drawn on top)
    "E": { ground: "parkpath" },               // the way out
    "Y": { ground: "parkpath", object: "bench", solid: true },
    "L": { ground: "parkpath", object: "lamp", solid: true },
    "G": { ground: "road", solid: true },      // the park's front gate (on Crescent Drive)
    "w": { ground: "innerWall", solid: true }, // walls between rooms
    "k": { ground: "kitchen" },                // kitchen floor tiles
    "q": { ground: "carpet" },                 // bedroom carpet
    "u": { ground: "bathroom" },               // bathroom tiles
    "z": { ground: "concrete" },               // garage floor
    "e": { ground: "floor", object: "desk", solid: true },
    "j": { ground: "bathroom", object: "toilet", solid: true },
    "y": { ground: "bathroom", object: "tub", solid: true },
    "a": { ground: "concrete", object: "car", solid: true },
    "c": { ground: "kitchen", object: "counter", solid: true },
    "v": { ground: "kitchen", object: "stove", solid: true },
    "f": { ground: "kitchen", object: "fridge", solid: true },
    "n": { ground: "floor", object: "chair", solid: true },
    "o": { ground: "floor", object: "sofa", solid: true },
    "t": { ground: "floor", object: "tv", solid: true },
    "b": { ground: "floor", object: "shelf", solid: true },
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
    // Our house, from the family's own floor plan: one floor, front door at the
    // bottom (facing Crescent Drive), garage on the right with its own door out.
    home: {
      name: "Our House",
      border: "X",
      indoors: true,
      layout: "house-3",
      tiles: [
        "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
        "IIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
        "qqqqqbwqqqqPwbeebw_____Pfcvccc",
        "BqqqqqwBqqqqw____w_nnn__kkkkkk",
        "qqqqqqwqqqqqw____w_KKK__kkkkkk",
        "Bqqqqqwqqqqqw______nnn__kkkkkk",
        "qqrrqqwqqqqqw____w______kkkkkk",
        "qqqqqqwqqqqqw____w______kkkkkk",
        "www_wwwww_wwwwwwww______wwwwww",
        "____________________t__Pwzzzzz",
        "________________________wzzzzb",
        "www_wwww_wwww_www__rrr__wzzzzb",
        "qqqqqbwjuuywb__bw_______zzzzzz",
        "qqBBqqwuuuyw____w__ooo__wzzazz",
        "qqqqqqwuuuuw____w_______wzzazz",
        "qqqqqqwuuuuwwwwww_______wzzzzz",
        "qqqqqqwwwwww____w_______wzzzzz",
        "qqqqqqwjuuuw____________wzzzzz",
        "Pqqqqq_uuuyw____wP______wzzzzz",
        "qqqqqqwuuuywb__bw___M___wzzMzz",
      ],
      rooms: [
        { name: "Bedroom", x0: 0, y0: 2, x1: 5, y1: 7 },
        { name: "Bedroom", x0: 7, y0: 2, x1: 11, y1: 7 },
        { name: "Study", x0: 13, y0: 2, x1: 16, y1: 7 },
        { name: "Kitchen", x0: 24, y0: 2, x1: 29, y1: 7 },
        { name: "Dining Room", x0: 18, y0: 2, x1: 23, y1: 8 },
        { name: "Hallway", x0: 0, y0: 9, x1: 16, y1: 10 },
        { name: "Main Bedroom", x0: 0, y0: 12, x1: 5, y1: 19 },
        { name: "Bathroom", x0: 7, y0: 12, x1: 10, y1: 15 },
        { name: "Main Bathroom", x0: 7, y0: 17, x1: 10, y1: 19 },
        { name: "Closet", x0: 12, y0: 12, x1: 15, y1: 14 },
        { name: "Closet", x0: 12, y0: 16, x1: 15, y1: 19 },
        { name: "Living Room", x0: 17, y0: 9, x1: 23, y1: 19 },
        { name: "Garage", x0: 24, y0: 9, x1: 29, y1: 19 },
      ],
      // the front door and the garage door both lead out to our driveway (set by buildCrescent)
      warps: [
        { x: 20, y: 19, to: "crescent", tx: 0, ty: 0, dir: "down" },
        { x: 27, y: 19, to: "crescent", tx: 0, ty: 0, dir: "down" },
      ],
      people: [
        { x: 26, y: 5, look: "mom", dir: "down", id: "mom", name: "MOM", talk: [
          "MOM: Off on a Garter Quest? How exciting!",
          "Your bike is right outside, and your little brother wants a ride in the wagon!",
          "Gram lives just across the street. Be home for dinner!",
        ] },
        { x: 22, y: 15, look: "dad", dir: "down", id: "dad", name: "DAD", talk: [
          "DAD: Hey, champ! Uncle Pat says the fish are biting down at the dock.",
          "Critters hide in the tall grass. Answer their questions to make friends!",
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
        { x: 5, y: 3, look: "elder", dir: "down", id: "gram", name: "GRAM", talk: [
          "GRAM: There's my favorite explorer! Come give Gram a hug.",
          "When I was little, I made friends with every critter on Crescent Drive. Can you?",
          "Tap the menu button to look in your CRITTER BOOK.",
        ] },
      ],
    },

    // Home base: built from the real street layout (see buildCrescent below).
    crescent: null,

    // 7 Garters, the theme park north of Forbes Bay. You get in by answering questions at the gate.
    park: {
      name: "7 Garters",
      border: "T",
      layout: "park-1",
      tiles: [
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
        "F......................................F",
        "F.T..................................T.F",
        "F.................S..............T.....F",
        "F....RRRRRR.SppppppppppppRRRRRRR.......F",
        "F....RRRRRR..ppppppppppppRRRRRRR.......F",
        "F.T..RRRRRR.......pp....SRRRRRRR.....T.F",
        "F....RRRRRR.......pp.....RRRRRRR.......F",
        "F....RRRRRR..T.**.pp.**T.RRRRRRR..T....F",
        "F....RRRRRR.......pp.....RRRRRRR.......F",
        "F.T....ppY........pp......Ypp........T.F",
        "F.....Lpp.........pp.......ppL.........F",
        "F..pppppppppppppppppppppppppppppppppp..F",
        "F..pppppppppppppppppppppppppppppppppp..F",
        "F..ppL.............pp.............Lpp..F",
        "F*.pp......T....Y..pp..Y....T......pp.*F",
        "F..pp..........LppppppppL..........pp..F",
        "F..pp.....**...ppppRRpppp.....Y..Y.pp..F",
        "F..pp..........ppppRRpppp...**.RR..pp..F",
        "F..pp..........LppppppppL......RR..pp..F",
        "F..pp.......T...Y..pp..Y...T.......pp..F",
        "F..ppL.............pp.............Lpp..F",
        "F..pppppppppppppppppppppppppppppppppp..F",
        "F..pppppppppppppppppppppppppppppppppp..F",
        "F.................LppL.................F",
        "F......**....*.....pp.....*....**......F",
        "F.T...T...T........pp........T...T...T.F",
        "F.................LppL.................F",
        "F..................pp..................F",
        "FFFFFFFFFFFFFFFFFFFEEFFFFFFFFFFFFFFFFFFF",
      ],
      // big things drawn over their footprint of "R" tiles
      landmarks: [
        { kind: "slide", x: 5, y: 4, w: 6, h: 6 },
        { kind: "wheel", x: 25, y: 4, w: 7, h: 6 },
        { kind: "fountain", x: 19, y: 17, w: 2, h: 2 },
        { kind: "popcorn", x: 31, y: 18, w: 2, h: 2 },
      ],
      warps: [
        { x: 19, y: 29, to: "crescent", tx: 0, ty: 0, dir: "down" },   // set by buildCrescent
        { x: 20, y: 29, to: "crescent", tx: 0, ty: 0, dir: "down" },
      ],
      signs: [
        { x: 12, y: 4, text: ["SUPER SLIDE", "Three twisty lanes! Answer 2 questions in a row to ride."] },
        { x: 24, y: 6, text: ["FERRIS WHEEL", "See all of Forbes Bay from the top! Answer 3 in a row to ride."] },
        { x: 18, y: 3, text: ["COMING SOON", "A ROLLER COASTER! Watch this space..."] },
      ],
      people: [
        { x: 8, y: 10, look: "staff", dir: "down", id: "slideHelper", name: "RIDE HELPER", action: "ride", ride: "slide", talk: [
          "RIDE HELPER: Ready for the SUPER SLIDE?",
          "Answer 2 questions in a row and up you go!",
        ] },
        { x: 27, y: 10, look: "staff2", dir: "down", id: "wheelHelper", name: "RIDE HELPER", action: "ride", ride: "wheel", talk: [
          "RIDE HELPER: All aboard the FERRIS WHEEL!",
          "Answer 3 questions in a row to ride all the way around.",
        ] },
        { x: 30, y: 19, look: "dad", dir: "left", talk: ["POPCORN SELLER: Popcorn! Get your fresh, hot popcorn!", "Did you know popcorn pops because of the water inside each kernel?"] },
        { x: 17, y: 24, look: "mom", dir: "right", talk: ["BALLOON LADY: Balloons! Every color of the rainbow!"] },
        { x: 10, y: 13, look: "friend", dir: "right", wander: true, talk: ["The Ferris wheel is so tall, you can see Uncle Pat's boat from the top!"] },
        { x: 30, y: 22, look: "friend", dir: "left", wander: true, talk: ["I went down the Super Slide three times! Wheee!"] },
        { x: 21, y: 20, look: "elder", dir: "down", wander: true, talk: ["I heard 7 Garters is building a roller coaster. How exciting!"] },
      ],
    },
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
    for (const w of MAPS.home.warps) { w.tx = sp.ours.land[0]; w.ty = sp.ours.land[1]; }
    MAPS.grams.warps[0].tx = sp.grams.land[0]; MAPS.grams.warps[0].ty = sp.grams.land[1];
    const ox = sp.ours.door[0];
    // a free tall-grass tile near (x, y), for placing squirrels
    const taken = new Set();
    const grassNear = (x, y) => {
      for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const tx = x + dx, ty = y + dy;
        if (G.tiles[ty]?.[tx] === "," && !taken.has(tx + "," + ty)) { taken.add(tx + "," + ty); return [tx, ty]; }
      }
      return [x, y];
    };
    // Gram's garden: a 4 x 3 bed in her backyard, or beside her house if that's full
    const rows = G.tiles.map((r) => [...r]);
    const [gx, gy] = sp.grams.door;
    const behind = sp.grams.land[1] < gy ? 3 : -5;   // the house is on the far side of the door from the street
    let garden = null;
    for (const [x0, ys] of [[gx - 2, [gy + behind]], [gx - 1, [gy + behind]], [gx - 3, [gy + behind]], [gx + 3, [gy + 1, gy, gy + 2]], [gx - 6, [gy + 1, gy, gy + 2]]]) {
      for (const y0 of ys) {
        let fits = true;
        for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) if (rows[y]?.[x] !== ",") fits = false;
        if (fits) { garden = { x0, y0, x1: x0 + 3, y1: y0 + 2 }; break; }
      }
      if (garden) break;
    }
    if (garden) {
      for (let y = garden.y0; y <= garden.y1; y++) for (let x = garden.x0; x <= garden.x1; x++) { rows[y][x] = "g"; taken.add(x + "," + y); }
    }
    // the fun park gate: where the road heads north off the map, closest to the dock
    const top = rows[0];
    let gateX = null;
    for (let d = 0; d < 20 && gateX == null; d++) {
      for (const x of [sp.dock.start[0] - d, sp.dock.start[0] + d]) {
        if (top[x] === "=" && top[x + 1] === "=") { gateX = x; break; }
      }
    }
    if (gateX == null) gateX = sp.dock.start[0] - 1;
    rows[0][gateX] = "G"; rows[0][gateX + 1] = "G";
    let parkSign = null;
    for (const x of [gateX + 2, gateX - 1, gateX + 3, gateX - 2]) if (rows[1][x] === "," || rows[1][x] === "-") { rows[1][x] = "S"; parkSign = [x, 1]; break; }
    for (const w of MAPS.park.warps) { w.tx = gateX + (w.x - 19); w.ty = 1; }
    if (parkSign) signs.push({ x: parkSign[0], y: parkSign[1], text: ["7 GARTERS THEME PARK", "Up through the gate! Answer 3 questions in a row at the ticket booth to get in."] });
    const hazel = grassNear(ox - 5, sp.ours.land[1] - 2);
    const pip = grassNear(sp.grams.door[0] + 5, sp.grams.land[1] + 3);
    // the wagon waits on the other side of our driveway from the bike
    const [lx, ly] = sp.ours.land;
    const wagonSpot = [[lx - 1, ly], [lx - 1, ly + 1], [lx + 1, ly + 1], [lx - 2, ly]].find(([x, y]) =>
      G.tiles[y]?.[x] === "," && !(sp.bike && sp.bike[0] === x && sp.bike[1] === y));
    return {
      name: "Crescent Drive",
      border: "T",
      layout: "osm-2", // change when the map is regenerated, so old saved spots reset
      // the boat starts tied up at the dock; it's an item you can ride, so its tile is water
      tiles: rows.map((row) => row.join("").replace(/O/g, "~")),
      garden,
      // big things drawn over the map
      landmarks: [{ kind: "gate", x: gateX - 1, y: 0, w: 4, h: 1 }],
      // gates you answer questions at to go through
      gates: [gateX, gateX + 1].map((x) => ({ x, y: 0, to: "park", tx: 19 + (x - gateX), ty: 27, dir: "up", questions: 3, name: "7 GARTERS" })),
      warps: [
        { x: sp.ours.door[0], y: sp.ours.door[1], to: "home", tx: 20, ty: 18, dir: "up" },
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
        { x: hazel[0], y: hazel[1], look: "squirrel", dir: "right", id: "hazel", name: "HAZEL", talk: [
          "HAZEL: Chitter chitter! Winter is coming and my pantry is empty!",
          "Maybe your mom knows how you could help...",
        ] },
        { x: pip[0], y: pip[1], look: "squirrel", dir: "left", id: "pip", name: "PIP", talk: [
          "PIP: Squeak! I'm Pip. I love pecans more than anything!",
          "I bet your dad would have a job for a helper like you.",
        ] },
        { x: sp.dock.pat[0], y: sp.dock.pat[1], look: "uncle", dir: "down", id: "pat", name: "UNCLE PAT", action: "fishing", talk: [
          "UNCLE PAT: Ahoy there, kiddo! You can take my boat out anytime. Just face it and press A.",
          "Want to go fishing?",
          "First you have to answer my math question!",
        ] },
      ],
      // where quest items (acorns, nuts) get hidden: the yards near home
      questArea: { x0: ox - 32, x1: ox + 32 },
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

  /* ---------- quests ----------
     A parent offers a quest. Items get hidden in the tall grass of the
     quest area; walking over one picks it up. Bring them all to the
     squirrel to finish. Critters stay away while a quest is on.        */
  const QUESTS = {
    acorns: {
      title: "Acorns for Hazel", giver: "mom", to: "hazel", toName: "HAZEL", kind: "collect",
      item: "acorn", items: "acorns", icon: "🌰", need: 8, map: "crescent",
      offer: ["MOM: The squirrels are getting ready for winter, and Hazel's pantry is empty!",
        "Can you find 8 acorns in the yards and bring them to Hazel? She's in the yard down the street."],
      accept: "MOM: Thank you, sweetie! Acorns hide in the tall grass. Look for the sparkles!",
      hint: "Acorns hide in the tall grass. Look for the sparkles!",
      thanks: ["HAZEL: Chitter chitter! 8 acorns! My pantry is full!", "Thank you, friend! Now I can sleep cozy all winter."],
    },
    nuts: {
      title: "Pecans for Pip", giver: "dad", to: "pip", toName: "PIP", kind: "collect",
      item: "nut", items: "pecans", icon: "🥜", need: 6, map: "crescent",
      offer: ["DAD: Pip the squirrel lost his pecans all over the neighborhood!",
        "Can you find 6 pecans and bring them back to Pip? He's near Gram's house."],
      accept: "DAD: That's my champ! Pecans fall in the tall grass. Keep your eyes peeled!",
      hint: "Pecans fall in the tall grass. Look for the sparkles!",
      thanks: ["PIP: Squeak squeak! My pecans! All 6 of them!", "You're the best helper on Crescent Drive!"],
    },
    fish: {
      title: "Fish for Uncle Pat", giver: "pat", to: "pat", toName: "UNCLE PAT", kind: "fish",
      items: "fish", icon: "🐟", need: 3,
      offer: ["UNCLE PAT: I'm having a fish fry tonight, but all I've caught is an old boot!",
        "Can you catch 3 fish for me?"],
      accept: "UNCLE PAT: That's my fishing buddy! Answer my question and grab a rod.",
      hint: "Catch them with the fishing rod here on the dock. Boots don't count!",
      doneBanner: "Tell UNCLE PAT you caught them!",
      thanks: ["UNCLE PAT: Three fish! That's a fish fry tonight!", "Thanks, kiddo. Bring your little brother, there's plenty to share."],
    },
    garden: {
      title: "Gram's Garden", giver: "gram", to: "gram", toName: "GRAM", kind: "collect",
      item: "weed", items: "weeds", icon: "🌱", need: 8, map: "crescent", area: "garden", tile: "g", spacing: 1, extra: 0,
      offer: ["GRAM: Oh, sweetheart, my garden is full of weeds! My flowers can't grow.",
        "Could you pull 8 weeds for me? The garden is in my backyard, right behind the house."],
      accept: "GRAM: Bless you! Just walk over each weed to pull it.",
      hint: "The weeds are in the garden behind Gram's house.",
      doneSay: "Go tell Gram the garden is all clear!",
      doneBanner: "Tell GRAM the garden is clear!",
      thanks: ["GRAM: Look at my garden! Not a weed in sight!", "Now my flowers can grow. Come see them bloom!"],
    },
  };
  // what to call each quest giver in "X might have another job for you"
  const GIVERS = { mom: "Mom", dad: "Dad", gram: "Gram", pat: "Uncle Pat" };
  const QUEST_STARS = 5;

  /* ---------- animal facts ----------
     Mixed in with math questions when you meet a critter. Every one is true. */
  const FACTS = {
    fizzbun: [
      { q: "What do rabbits love to eat?", a: "Grass and hay", wrong: ["Fish", "Rocks", "Pizza"], why: "Rabbits munch grass, hay and leafy greens." },
      { q: "Why do rabbits have such big ears?", a: "To hear danger far away", wrong: ["To fly", "To swim faster", "To dig holes"], why: "Big ears help rabbits hear danger and stay cool." },
      { q: "What is a baby rabbit called?", a: "A kit", wrong: ["A puppy", "A cub", "A chick"], why: "Baby rabbits are called kits!" },
      { q: "How do rabbits warn each other about danger?", a: "They thump their back feet", wrong: ["They whistle songs", "They clap their paws", "They bark"], why: "Rabbits thump the ground with their back feet to say 'watch out!'" },
      { q: "Where do wild rabbits often live?", a: "In underground burrows", wrong: ["In nests in the clouds", "In the ocean", "In beehives"], why: "Many rabbits dig burrows to stay safe and cozy." },
      { q: "What is a rabbit's happy jump called?", a: "A binky", wrong: ["A cartwheel", "A somersault", "A moonwalk"], why: "A happy rabbit leaps and twists in the air. It's called a binky!" },
      { q: "Why can rabbits see danger coming from almost anywhere?", a: "Their eyes are on the sides of their head", wrong: ["They have four eyes", "They wear glasses", "They never sleep"], why: "With eyes on the sides of their head, rabbits can see nearly all the way around." },
      { q: "What's special about a rabbit's teeth?", a: "They never stop growing", wrong: ["They glow at night", "They fall out every week", "They're made of wood"], why: "Rabbits chew hay and twigs all day to keep their teeth short." },
    ],
    squeaks: [
      { q: "Why do mice have whiskers?", a: "To feel their way around", wrong: ["To look fancy", "To catch fish", "To keep warm"], why: "Whiskers help mice feel their way in the dark." },
      { q: "What's special about a mouse's front teeth?", a: "They never stop growing", wrong: ["They glow", "They fall out every day", "They're made of gold"], why: "That's why mice chew so much: it keeps their teeth short!" },
      { q: "When are mice most busy?", a: "At night", wrong: ["At lunchtime", "Only in winter", "Never"], why: "Mice are nocturnal. They come out at night." },
      { q: "What does a mouse use its long tail for?", a: "Balance", wrong: ["Swimming", "Flying", "Digging"], why: "A mouse's tail helps it balance when it climbs." },
      { q: "What is a baby mouse called?", a: "A pup", wrong: ["A kitten", "A calf", "A joey"], why: "Baby mice are called pups." },
      { q: "How do mice talk to each other?", a: "With squeaks, some too high for us to hear", wrong: ["They write notes", "They whistle tunes", "They don't talk at all"], why: "Mice make squeaks, and some are so high that people can't hear them." },
      { q: "What do mice really like to eat most?", a: "Seeds and grains", wrong: ["Only cheese", "Rocks", "Ice cubes"], why: "Mice mostly eat seeds and grains. Cheese isn't really their favorite!" },
      { q: "How small a hole can a mouse squeeze through?", a: "About as wide as a pencil", wrong: ["Only a door", "A garage door", "Only open windows"], why: "Mice have bendy bodies and can squeeze through tiny holes." },
    ],
    sprigsnake: [
      { q: "How does a snake smell things?", a: "With its tongue", wrong: ["With its ears", "With its tail", "With its eyes"], why: "Snakes flick their tongues to taste the air." },
      { q: "What do green snakes like to eat?", a: "Bugs like crickets", wrong: ["Pizza", "Grass", "Rocks"], why: "Green snakes eat crickets, caterpillars and spiders." },
      { q: "Why is a green snake green?", a: "To hide in the leaves", wrong: ["It ate paint", "It's cold", "To glow at night"], why: "Its green color is camouflage." },
      { q: "Can snakes blink?", a: "No, they have no eyelids", wrong: ["Yes, all the time", "Only on Sundays", "Only when sleepy"], why: "Snakes can't blink! A clear scale covers each eye." },
      { q: "Are green snakes dangerous to people?", a: "No, they're gentle and harmless", wrong: ["Yes, very dangerous", "They breathe fire", "They bite everyone"], why: "Green snakes are shy and harmless." },
      { q: "Where do green snakes like to hang out?", a: "In bushes and vines", wrong: ["Under the ocean", "In the snow", "On rooftops"], why: "Green snakes climb in plants, often near water." },
      { q: "How do snakes move without legs?", a: "They push with muscles and belly scales", wrong: ["They roll like wheels", "They jump like frogs", "They fly"], why: "Snakes push with strong muscles and grip the ground with their belly scales." },
    ],
    sootsnake: [
      { q: "What are black rat snakes really good at?", a: "Climbing trees", wrong: ["Flying", "Swimming in the sea", "Digging tunnels"], why: "They can climb right up tree bark!" },
      { q: "Are black rat snakes venomous?", a: "No, they're harmless", wrong: ["Yes, very", "Only on Tuesdays", "Only the babies"], why: "They're not venomous. They squeeze their food instead." },
      { q: "How does a snake grow bigger?", a: "It sheds its skin", wrong: ["It pops", "It eats rocks", "It never grows"], why: "Snakes wiggle out of their old skin as they grow." },
      { q: "What do black rat snakes like to eat?", a: "Mice and rats", wrong: ["Salad", "Ice cream", "Rocks"], why: "They help farmers by eating mice and rats." },
      { q: "How do black rat snake babies start life?", a: "They hatch from eggs", wrong: ["They grow on trees", "They fall from clouds", "They're born in a box"], why: "Black rat snakes lay eggs, and the babies hatch in late summer." },
      { q: "Is a snake warm-blooded like you?", a: "No, it's cold-blooded", wrong: ["Yes, very warm", "It's hot like fire", "It has no blood"], why: "Snakes warm up in the sun because their bodies don't make their own heat." },
      { q: "What color is a baby black rat snake?", a: "Gray with dark blotches", wrong: ["Bright pink", "Glow-in-the-dark green", "Rainbow striped"], why: "Babies have a gray pattern and turn black as they grow up." },
    ],
    hoodini: [
      { q: "What does a cobra do to look big?", a: "Spreads out its hood", wrong: ["Puffs up like a balloon", "Grows wings", "Sings loudly"], why: "A cobra spreads its neck into a hood to say 'back off!'" },
      { q: "What should you do if you see a wild snake?", a: "Stay back and leave it alone", wrong: ["Give it a hug", "Pick it up", "Pet its head"], why: "Some snakes are venomous. Always keep your distance." },
      { q: "Snakes have no outside ears. How do they 'hear'?", a: "They feel vibrations", wrong: ["With antennas", "With their nose", "They can't at all"], why: "Snakes feel vibrations through the ground." },
      { q: "Where do cobras live in the wild?", a: "Warm parts of Africa and Asia", wrong: ["Antarctica", "Crescent Drive", "The Moon"], why: "Wild cobras live in warm parts of Africa and Asia." },
      { q: "Which is the longest venomous snake in the world?", a: "The king cobra", wrong: ["The garden snake", "The rubber snake", "The jump rope snake"], why: "King cobras can grow longer than a car!" },
      { q: "What can a spitting cobra do?", a: "Spray venom from its fangs", wrong: ["Blow bubbles", "Sing songs", "Spit seeds"], why: "Some cobras spray venom to protect themselves. Always stay far away!" },
      { q: "When a snake charmer plays the flute, what is the cobra following?", a: "The flute moving", wrong: ["The music's words", "The beat of a drum", "Its favorite song"], why: "Cobras can't hear the tune well. They watch the moving flute." },
    ],
    finny: [
      { q: "How do fish breathe underwater?", a: "With gills", wrong: ["With a snorkel", "They hold their breath", "With their fins"], why: "Gills take air out of the water." },
      { q: "What helps a fish swim?", a: "Its fins and tail", wrong: ["Its whiskers", "Tiny feet", "Its teeth"], why: "Fish wiggle their tails and steer with their fins." },
      { q: "What covers a fish's body?", a: "Scales", wrong: ["Feathers", "Fur", "Leaves"], why: "Slippery scales protect a fish." },
      { q: "Where do sunfish build their nests?", a: "In the sand at the bottom", wrong: ["In trees", "On the dock", "In the clouds"], why: "Sunfish dads sweep out little nests in the sand with their tails." },
      { q: "Do fish sleep?", a: "Yes, they rest quietly", wrong: ["Never ever", "Only on land", "Only upside down"], why: "Fish rest, even though they can't close their eyes." },
      { q: "How do fish feel ripples in the water around them?", a: "A special line along their sides", wrong: ["Their teeth", "A tiny antenna", "Their eyebrows"], why: "A line of sensors along each side, called the lateral line, feels movement nearby." },
      { q: "What is a big group of fish swimming together called?", a: "A school", wrong: ["A class", "A pack", "A herd"], why: "Fish swim together in a school to stay safe." },
      { q: "Are fish warm-blooded or cold-blooded?", a: "Cold-blooded", wrong: ["Warm-blooded", "Boiling-blooded", "They have no blood"], why: "Most fish are cold-blooded: they're as warm as the water around them." },
    ],
    pinchy: [
      { q: "Which way do crabs walk?", a: "Sideways", wrong: ["Only backwards", "Upside down", "They hop"], why: "Crabs scuttle sideways." },
      { q: "How many legs does a crab have?", a: "10, counting its claws", wrong: ["2", "4", "100"], why: "Crabs have 10 legs, and 2 of them are claws." },
      { q: "Where is a crab's skeleton?", a: "On the outside, as a shell", wrong: ["In its claws only", "It has none", "In its eyes"], why: "Crabs wear their skeleton on the outside!" },
      { q: "How does a crab grow bigger?", a: "It sheds its old shell", wrong: ["It blows itself up", "It eats its shell", "It never grows"], why: "Crabs molt: they climb out of their old shell and grow a new one." },
      { q: "Where are a crab's eyes?", a: "On little stalks", wrong: ["On its claws", "On its belly", "It has no eyes"], why: "Crab eyes sit on stalks so they can look all around." },
      { q: "What do crabs use their claws for?", a: "Eating and protecting themselves", wrong: ["Flying", "Knitting", "Swimming fast"], why: "Claws help crabs grab food and scare off enemies." },
      { q: "Can crabs breathe out of the water?", a: "For a while, if their gills stay wet", wrong: ["Never at all", "Only in space", "They don't need to breathe"], why: "Crabs keep their gills damp so they can visit the shore." },
    ],
    shelby: [
      { q: "Can a turtle climb out of its shell?", a: "No, it's part of its body", wrong: ["Yes, to take a bath", "Only at night", "Yes, to trade shells"], why: "A turtle's shell grows with it." },
      { q: "Do turtles breathe air?", a: "Yes, they swim up for air", wrong: ["No, they have gills", "Only on Sundays", "They never breathe"], why: "Turtles come up to the surface to breathe." },
      { q: "How do baby turtles start life?", a: "They hatch from eggs", wrong: ["They grow on trees", "They fall from clouds", "From a shell store"], why: "Mama turtles lay their eggs in sand or dirt." },
      { q: "What is the top of a turtle's shell called?", a: "The carapace", wrong: ["The roof", "The helmet", "The lid"], why: "The top shell is the carapace. The bottom is the plastron." },
      { q: "Do turtles have teeth?", a: "No, they have a hard beak", wrong: ["Yes, sharp ones", "Gold teeth", "Only baby teeth"], why: "Turtles bite with a hard beak instead of teeth." },
      { q: "How long can some turtles live?", a: "More than 100 years", wrong: ["One week", "Two days", "Exactly 5 years"], why: "Some turtles live more than 100 years!" },
      { q: "What do many pond turtles do when winter comes?", a: "Rest in the mud at the bottom", wrong: ["Fly south", "Knit sweaters", "Build a campfire"], why: "Many pond turtles rest in the mud under the water all winter." },
      { q: "Where do sea turtle mothers lay their eggs?", a: "On sandy beaches", wrong: ["In tree nests", "At the bottom of the sea", "In caves on mountains"], why: "Sea turtles crawl up onto sandy beaches to lay their eggs." },
    ],
    bloop: [
      { q: "Does a jellyfish have a brain?", a: "No, no brain at all", wrong: ["A huge brain", "Two brains", "A brain in its hat"], why: "Jellyfish have no brain, heart or bones!" },
      { q: "What is a jellyfish mostly made of?", a: "Water", wrong: ["Jelly", "Rubber", "Candy"], why: "A jellyfish is about 95 out of 100 parts water!" },
      { q: "Should you touch a jellyfish?", a: "No, it can sting", wrong: ["Yes, it's soft", "Only with your toes", "Yes, it tickles"], why: "Jellyfish can sting, even when they wash up on the beach." },
      { q: "How long have jellyfish been on Earth?", a: "Longer than the dinosaurs", wrong: ["Since last year", "Only 10 years", "Since TV was invented"], why: "Jellyfish have been around for more than 500 million years!" },
      { q: "How does a jellyfish swim?", a: "By squeezing its bell", wrong: ["With fins", "With legs", "With a tiny motor"], why: "A jellyfish squeezes its bell to push water and move." },
      { q: "What does a jellyfish use to catch food?", a: "Stinging tentacles", wrong: ["A net", "Its teeth", "A fishing rod"], why: "Tentacles sting tiny animals so the jellyfish can eat them." },
      { q: "Can some jellyfish glow?", a: "Yes, some glow in the dark", wrong: ["No, never", "Only on birthdays", "Only in jars"], why: "Some jellyfish make their own light. That's called bioluminescence!" },
    ],
    flitter: [
      { q: "When do most moths fly?", a: "At night", wrong: ["Only at noon", "Never", "Only in the rain"], why: "Most moths come out at night and love bright lights." },
      { q: "What do moths smell with?", a: "Their antennae", wrong: ["Their wings", "Their feet", "Their nose"], why: "Moth antennae can smell from far away." },
      { q: "What does a moth start life as?", a: "A caterpillar", wrong: ["A ladybug", "A worm", "A fish"], why: "Caterpillars spin cocoons and turn into moths." },
      { q: "How can you often tell a moth from a butterfly?", a: "Moths usually have feathery antennae", wrong: ["Moths have ten wings", "Moths are fish", "There's no difference"], why: "Moths often have feathery antennae. Butterflies have thin ones with little knobs." },
      { q: "What covers a moth's wings?", a: "Tiny scales", wrong: ["Feathers", "Long fur", "Glitter glue"], why: "Moth wings are covered in tiny scales, like dust." },
      { q: "What does a moth caterpillar spin before it changes?", a: "A cocoon", wrong: ["A spider web", "A scarf", "A trampoline"], why: "Caterpillars spin a silky cocoon, then come out as moths." },
      { q: "Which caterpillar spins silk that people make clothes from?", a: "The silkworm", wrong: ["The inchworm", "The bookworm", "The earthworm"], why: "Silkworms spin silk that people weave into cloth." },
      { q: "What's strange about a grown-up luna moth?", a: "It has no mouth", wrong: ["It has two heads", "It barks", "It can swim"], why: "Adult luna moths don't eat at all. They live only about a week." },
    ],
    mossy: [
      { q: "Does moss grow flowers?", a: "No, it spreads with spores", wrong: ["Yes, big red ones", "Only in winter", "Yes, candy flowers"], why: "Moss spreads with tiny spores instead of seeds." },
      { q: "Where does moss like to grow?", a: "Damp, shady places", wrong: ["In ovens", "On clouds", "In the hot desert sun"], why: "Moss loves cool, damp, shady spots." },
      { q: "Does moss have roots?", a: "No, it has tiny threads instead", wrong: ["Yes, huge roots", "Roots made of gold", "Roots that float"], why: "Moss holds on with tiny threads called rhizoids." },
      { q: "What can moss soak up like a sponge?", a: "Water", wrong: ["Sand", "Noise", "Moonlight"], why: "Moss can hold lots of water, which keeps the ground damp." },
      { q: "Is moss a plant?", a: "Yes, a tiny plant", wrong: ["No, it's an animal", "It's a rock", "It's a cloud"], why: "Moss is one of the oldest kinds of plants on Earth." },
    ],
    pebblet: [
      { q: "What slowly wears big rocks down into sand?", a: "Wind and water", wrong: ["Moonlight", "Singing", "Sleeping"], why: "Wind and water wear rocks down over a very long time." },
      { q: "What is very hot melted rock called?", a: "Lava", wrong: ["Soup", "Ice", "Slime"], why: "Lava cools down and turns into new rock!" },
      { q: "What are the three main kinds of rock?", a: "Igneous, sedimentary, metamorphic", wrong: ["Big, small, medium", "Red, blue, green", "Hard, soft, squishy"], why: "Rocks are made by fire, by layers, or by heat and squeezing." },
      { q: "What rock is made of layers of sand pressed together?", a: "Sandstone", wrong: ["Lava rock", "Ice", "Chalkboard"], why: "Sandstone forms when layers of sand get pressed together over a long time." },
      { q: "What is the hardest natural mineral?", a: "Diamond", wrong: ["Chalk", "Butter", "Soap"], why: "Diamonds are the hardest natural thing on Earth." },
      { q: "Which rock can float on water?", a: "Pumice", wrong: ["Granite", "Marble", "Brick"], why: "Pumice is full of tiny air bubbles, so it floats!" },
    ],
  };

  /** A fact question about a critter, skipping ones already asked. */
  function makeFact(id, asked = []) {
    const list = (FACTS[id] || []).filter((f) => !asked.includes(f.q));
    if (!list.length) return null;
    const f = pick(list);
    return { text: f.q, answer: f.a, choices: shuffle([f.a, ...f.wrong]), fact: true, why: f.why };
  }

  /* ---------- fun park rides ----------
     Answer this many questions in a row to ride. */
  const RIDES = {
    slide: { name: "SUPER SLIDE", questions: 2, frames: 330 },
    wheel: { name: "FERRIS WHEEL", questions: 3, frames: 520 },
  };

  /* What can bite on Uncle Pat's line. More copies = more often. */
  const CATCHES = ["finny", "finny", "finny", "finny", "pinchy", "pinchy", "shelby", "shelby", "bloop", "boot"];

  const START = { map: "home", x: 20, y: 18, dir: "up" };

  /* ---------- questions, by level ---------- */
  /**
   * Greater-than questions: "Which is greater: 14 or 9?" or, from Medium up,
   * "Which sign goes in the box: 23 ☐ 17?" (>, < or =). Hard uses bigger
   * numbers and sometimes equal pairs.
   */
  function makeCompare(mode) {
    const [lo, hi] = mode === "easy" ? [0, 10] : mode === "medium" ? [0, 20] : [10, 99];
    const a = randInt(lo, hi);
    let b = randInt(lo, hi);
    if (mode === "easy" || Math.random() < 0.45) {
      while (b === a) b = randInt(lo, hi);
      const big = Math.max(a, b), small = Math.min(a, b);
      return { text: `Which is greater: ${a} or ${b}?`, answer: big, choices: [a, b], why: `${big} is greater than ${small}.` };
    }
    if (mode === "hard" && Math.random() < 0.2) b = a;
    const sign = a > b ? ">" : a < b ? "<" : "=";
    const words = { ">": "is greater than", "<": "is less than", "=": "is equal to" };
    const tip = sign === "=" ? "They're the same, so the sign is =." : "The open mouth always eats the bigger number!";
    return { text: `Which sign goes in the box?  ${a} ☐ ${b}`, answer: sign, choices: [">", "<", "="], why: `${a} ${sign} ${b}: ${a} ${words[sign]} ${b}. ${tip}` };
  }

  function makeQuestion(mode) {
    if (Math.random() < 0.3) return makeCompare(mode);
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

  A.world = { TILES, CRITTERS, MAPS, START, CATCHES, QUESTS, QUEST_STARS, GIVERS, FACTS, RIDES, makeQuestion, makeFact };
})();
