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
    "w": { ground: "innerWall", solid: true }, // walls between rooms
    "k": { ground: "kitchen" },                // kitchen floor tiles
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
    // Our house: one floor with a kitchen, dining room and living room.
    home: {
      name: "Our House",
      border: "X",
      indoors: true,
      layout: "house-2",
      tiles: [
        "HHHHHHHHHHHHHHHH",
        "IIIIIIIIIIIIIIII",
        "fcvccw__nnn____P",
        "kkkkk___KKK_____",
        "kkkkkw__KKK____P",
        "kkkkkw__nnn_____",
        "wwwww_wwwwww_www",
        "bb____rrrr____tP",
        "_____rrrrrr_____",
        "_ooo_rrrrrr_____",
        "P______________P",
        "_______M________",
      ],
      rooms: [
        { name: "Kitchen", x0: 0, y0: 2, x1: 4, y1: 5 },
        { name: "Dining Room", x0: 5, y0: 2, x1: 15, y1: 5 },
        { name: "Living Room", x0: 0, y0: 7, x1: 15, y1: 11 },
      ],
      warps: [{ x: 7, y: 11, to: "crescent", tx: 0, ty: 0, dir: "down" }], // set by buildCrescent
      people: [
        { x: 2, y: 4, look: "mom", dir: "down", id: "mom", name: "MOM", talk: [
          "MOM: Off on a Garter Quest? How exciting!",
          "Your bike is right outside, and your little brother wants a ride in the wagon!",
          "Gram lives just across the street. Be home for dinner!",
        ] },
        { x: 4, y: 8, look: "dad", dir: "down", id: "dad", name: "DAD", talk: [
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
      warps: [
        { x: sp.ours.door[0], y: sp.ours.door[1], to: "home", tx: 7, ty: 10, dir: "up" },
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
    ],
    squeaks: [
      { q: "Why do mice have whiskers?", a: "To feel their way around", wrong: ["To look fancy", "To catch fish", "To keep warm"], why: "Whiskers help mice feel their way in the dark." },
      { q: "What's special about a mouse's front teeth?", a: "They never stop growing", wrong: ["They glow", "They fall out every day", "They're made of gold"], why: "That's why mice chew so much: it keeps their teeth short!" },
      { q: "When are mice most busy?", a: "At night", wrong: ["At lunchtime", "Only in winter", "Never"], why: "Mice are nocturnal. They come out at night." },
    ],
    sprigsnake: [
      { q: "How does a snake smell things?", a: "With its tongue", wrong: ["With its ears", "With its tail", "With its eyes"], why: "Snakes flick their tongues to taste the air." },
      { q: "What do green snakes like to eat?", a: "Bugs like crickets", wrong: ["Pizza", "Grass", "Rocks"], why: "Green snakes eat crickets, caterpillars and spiders." },
      { q: "Why is a green snake green?", a: "To hide in the leaves", wrong: ["It ate paint", "It's cold", "To glow at night"], why: "Its green color is camouflage." },
    ],
    sootsnake: [
      { q: "What are black rat snakes really good at?", a: "Climbing trees", wrong: ["Flying", "Swimming in the sea", "Digging tunnels"], why: "They can climb right up tree bark!" },
      { q: "Are black rat snakes venomous?", a: "No, they're harmless", wrong: ["Yes, very", "Only on Tuesdays", "Only the babies"], why: "They're not venomous. They squeeze their food instead." },
      { q: "How does a snake grow bigger?", a: "It sheds its skin", wrong: ["It pops", "It eats rocks", "It never grows"], why: "Snakes wiggle out of their old skin as they grow." },
    ],
    hoodini: [
      { q: "What does a cobra do to look big?", a: "Spreads out its hood", wrong: ["Puffs up like a balloon", "Grows wings", "Sings loudly"], why: "A cobra spreads its neck into a hood to say 'back off!'" },
      { q: "What should you do if you see a wild snake?", a: "Stay back and leave it alone", wrong: ["Give it a hug", "Pick it up", "Pet its head"], why: "Some snakes are venomous. Always keep your distance." },
      { q: "Snakes have no outside ears. How do they 'hear'?", a: "They feel vibrations", wrong: ["With antennas", "With their nose", "They can't at all"], why: "Snakes feel vibrations through the ground." },
    ],
    finny: [
      { q: "How do fish breathe underwater?", a: "With gills", wrong: ["With a snorkel", "They hold their breath", "With their fins"], why: "Gills take air out of the water." },
      { q: "What helps a fish swim?", a: "Its fins and tail", wrong: ["Its whiskers", "Tiny feet", "Its teeth"], why: "Fish wiggle their tails and steer with their fins." },
      { q: "What covers a fish's body?", a: "Scales", wrong: ["Feathers", "Fur", "Leaves"], why: "Slippery scales protect a fish." },
    ],
    pinchy: [
      { q: "Which way do crabs walk?", a: "Sideways", wrong: ["Only backwards", "Upside down", "They hop"], why: "Crabs scuttle sideways." },
      { q: "How many legs does a crab have?", a: "10, counting its claws", wrong: ["2", "4", "100"], why: "Crabs have 10 legs, and 2 of them are claws." },
      { q: "Where is a crab's skeleton?", a: "On the outside, as a shell", wrong: ["In its claws only", "It has none", "In its eyes"], why: "Crabs wear their skeleton on the outside!" },
    ],
    shelby: [
      { q: "Can a turtle climb out of its shell?", a: "No, it's part of its body", wrong: ["Yes, to take a bath", "Only at night", "Yes, to trade shells"], why: "A turtle's shell grows with it." },
      { q: "Do turtles breathe air?", a: "Yes, they swim up for air", wrong: ["No, they have gills", "Only on Sundays", "They never breathe"], why: "Turtles come up to the surface to breathe." },
      { q: "How do baby turtles start life?", a: "They hatch from eggs", wrong: ["They grow on trees", "They fall from clouds", "From a shell store"], why: "Mama turtles lay their eggs in sand or dirt." },
    ],
    bloop: [
      { q: "Does a jellyfish have a brain?", a: "No, no brain at all", wrong: ["A huge brain", "Two brains", "A brain in its hat"], why: "Jellyfish have no brain, heart or bones!" },
      { q: "What is a jellyfish mostly made of?", a: "Water", wrong: ["Jelly", "Rubber", "Candy"], why: "A jellyfish is about 95 out of 100 parts water!" },
      { q: "Should you touch a jellyfish?", a: "No, it can sting", wrong: ["Yes, it's soft", "Only with your toes", "Yes, it tickles"], why: "Jellyfish can sting, even when they wash up on the beach." },
    ],
    flitter: [
      { q: "When do most moths fly?", a: "At night", wrong: ["Only at noon", "Never", "Only in the rain"], why: "Most moths come out at night and love bright lights." },
      { q: "What do moths smell with?", a: "Their antennae", wrong: ["Their wings", "Their feet", "Their nose"], why: "Moth antennae can smell from far away." },
      { q: "What does a moth start life as?", a: "A caterpillar", wrong: ["A ladybug", "A worm", "A fish"], why: "Caterpillars spin cocoons and turn into moths." },
    ],
    mossy: [
      { q: "Does moss grow flowers?", a: "No, it spreads with spores", wrong: ["Yes, big red ones", "Only in winter", "Yes, candy flowers"], why: "Moss spreads with tiny spores instead of seeds." },
      { q: "Where does moss like to grow?", a: "Damp, shady places", wrong: ["In ovens", "On clouds", "In the hot desert sun"], why: "Moss loves cool, damp, shady spots." },
    ],
    pebblet: [
      { q: "What slowly wears big rocks down into sand?", a: "Wind and water", wrong: ["Moonlight", "Singing", "Sleeping"], why: "Wind and water wear rocks down over a very long time." },
      { q: "What is very hot melted rock called?", a: "Lava", wrong: ["Soup", "Ice", "Slime"], why: "Lava cools down and turns into new rock!" },
    ],
  };

  /** A fact question about a critter, skipping ones already asked. */
  function makeFact(id, asked = []) {
    const list = (FACTS[id] || []).filter((f) => !asked.includes(f.q));
    if (!list.length) return null;
    const f = pick(list);
    return { text: f.q, answer: f.a, choices: shuffle([f.a, ...f.wrong]), fact: true, why: f.why };
  }

  /* What can bite on Uncle Pat's line. More copies = more often. */
  const CATCHES = ["finny", "finny", "finny", "finny", "pinchy", "pinchy", "shelby", "shelby", "bloop", "boot"];

  const START = { map: "home", x: 7, y: 10, dir: "up" };

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

  A.world = { TILES, CRITTERS, MAPS, START, CATCHES, QUESTS, QUEST_STARS, GIVERS, FACTS, makeQuestion, makeFact };
})();
