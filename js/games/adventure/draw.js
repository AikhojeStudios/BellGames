/* =====================================================================
   Garter Quest — drawing
   Two sources of pictures:
     1. Your hand-drawn PNGs, listed in A.assets below. When a file is
        listed and loads, it is used.
     2. Placeholder doodles drawn in code (everything below the assets
        list), used for anything you haven't drawn yet.
   So art can be swapped in one piece at a time.
   ===================================================================== */
(function () {
  "use strict";
  const A = (App.Adventure = App.Adventure || {});

  /* =================================================================
     YOUR DRAWINGS
     Put PNG files (transparent background) in assets/adventure/ and
     list them here. Examples are commented out.
     ================================================================= */
  A.assets = {
    // People: one sheet per person. Each row is a direction, each column a frame.
    // Column 0 is standing; the "walk" list is the frame order while walking.
    // If there's no "right" row, the "left" row is mirrored.
    people: {
      // hero: { src: "assets/adventure/hero.png", frameW: 128, frameH: 160,
      //         rows: { down: 0, up: 1, left: 2 }, walk: [1, 0, 2, 0] },
      // heroBike: the hero riding the bike, same layout as hero.
    },
    // Critters: the main picture, plus optional eyes-closed and happy versions.
    // The game adds the bobbing, blinking, hopping and shaking.
    critters: {
      // fizzbun: { src: "assets/adventure/critter-fizzbun.png",
      //            blink: "assets/adventure/critter-fizzbun-blink.png",
      //            happy: "assets/adventure/critter-fizzbun-happy.png" },
    },
    // Ground tiles, by map letter (see TILES in world.js). One square picture,
    // or a list of pictures to pick from at random so the ground doesn't repeat.
    tiles: {
      // ",": ["assets/adventure/tall-grass-1.png", "assets/adventure/tall-grass-2.png"],
    },
    // Things that stand up off the ground (trees, signs, furniture), by map letter.
    // w and h are in tiles; the bottom of the picture sits on the tile.
    objects: {
      // "T": { src: "assets/adventure/tree.png", w: 1.6, h: 2.2 },
      // "bike": { src: "assets/adventure/bike.png", w: 1, h: 0.8 },   // the parked bike
      // "wagon": { src: "assets/adventure/wagon.png", w: 1, h: 0.8 }, // the parked wagon
      // "boat": { src: "assets/adventure/boat.png", w: 2, h: 1 },     // the boat (drawn facing right)
    },
  };

  const images = {};
  /** The loaded image for a path, or null while it's loading or if it's missing. */
  function img(src) {
    if (!src) return null;
    let im = images[src];
    if (!im) {
      im = images[src] = new Image();
      im.onerror = () => console.warn("Couldn't load drawing: " + src);
      im.src = src;
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  A.img = img;

  /* =================================================================
     PLACEHOLDER DOODLES
     ================================================================= */
  const C = {
    ink: "#3A3330",
    lawn: "#A6D177", lawnDark: "#7FB455",
    tall: "#8CC35F", blade: "#4F8C3B", bladeLite: "#BCE08F",
    road: "#8E8C95", curb: "#6E6B76", roadLine: "#F4D35E",
    walk: "#E0D8C8", seam: "#BEB4A2", drive: "#D0C6B4",
    wood: "#E4C59A", woodLine: "#C6A073",
    paper: "#F5E7C9", stripe: "#ECD7AF", base: "#A47D57",
    dark: "#2E2925",
    water: "#7CC4E4", waterLite: "#C0E7F5",
    trunk: "#8A5A3C", leaf: "#62A24C", leafDark: "#4B8A3B", leafLite: "#93C96E",
  };
  const HOUSES = [
    { wall: "#F7D6B9", roof: "#C9654F" },
    { wall: "#D2E4F3", roof: "#5B7FA9" },
    { wall: "#F8E8A8", roof: "#B6874B" },
    { wall: "#DFD0F1", roof: "#7E64A9" },
    { wall: "#DAEDC9", roof: "#5F8D5B" },
  ];
  A.HOUSES = HOUSES;

  /* seeded randomness, so a doodle looks the same every frame */
  function hash(...n) {
    let h = 2166136261;
    for (const v of n) { h ^= v | 0; h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  A.hash = hash;

  /* ---------- hand-drawn shape helpers ---------- */
  /** A closed, slightly wobbly, smooth shape through the points. */
  function blob(c, pts, r, j) {
    const q = pts.map(([x, y]) => [x + (r() - 0.5) * j, y + (r() - 0.5) * j]);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    c.beginPath();
    c.moveTo(...mid(q[q.length - 1], q[0]));
    q.forEach((p, i) => { const m = mid(p, q[(i + 1) % q.length]); c.quadraticCurveTo(p[0], p[1], m[0], m[1]); });
    c.closePath();
  }
  /** Points around a rectangle, a few per side, for blob(). */
  function rectPts(x, y, w, h, n = 3) {
    const p = [];
    for (let i = 0; i < n; i++) p.push([x + (w * i) / n, y]);
    for (let i = 0; i < n; i++) p.push([x + w, y + (h * i) / n]);
    for (let i = 0; i < n; i++) p.push([x + w - (w * i) / n, y + h]);
    for (let i = 0; i < n; i++) p.push([x, y + h - (h * i) / n]);
    return p;
  }
  function ellipsePts(cx, cy, rx, ry, n = 10) {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    });
  }
  function ink(c, w, color = C.ink) {
    c.strokeStyle = color; c.lineWidth = w; c.lineJoin = c.lineCap = "round"; c.stroke();
  }
  function paint(c, fill, w) { c.fillStyle = fill; c.fill(); if (w) ink(c, w); }
  /** A wobbly line from a to b. */
  function line(c, x1, y1, x2, y2, r, j, w, color = C.ink) {
    c.beginPath();
    c.moveTo(x1 + (r() - 0.5) * j, y1 + (r() - 0.5) * j);
    c.quadraticCurveTo((x1 + x2) / 2 + (r() - 0.5) * j * 2, (y1 + y2) / 2 + (r() - 0.5) * j * 2, x2 + (r() - 0.5) * j, y2 + (r() - 0.5) * j);
    ink(c, w, color);
  }
  function ellipse(c, cx, cy, rx, ry, rot = 0) {
    c.beginPath(); c.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  }

  /* ---------- ground (fills one tile square) ----------
     Each gets (ctx, size, random, same) where same(dx, dy) says whether
     the neighbouring tile is the same kind, for joined-up edges.      */
  const GROUND = {
    lawn(c, s, r) {
      c.fillStyle = C.lawn; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) {
        const x = r() * s, y = r() * s, k = s * 0.06;
        c.beginPath(); c.moveTo(x - k, y); c.lineTo(x, y - k * 1.6); c.moveTo(x, y); c.lineTo(x + k, y - k * 1.4);
        ink(c, s * 0.03, C.lawnDark);
      }
    },
    tall(c, s, r) {
      c.fillStyle = C.tall; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 9; i++) {
        const x = r() * s, y = s * (0.25 + r() * 0.8), hgt = s * (0.2 + r() * 0.16), lean = (r() - 0.5) * s * 0.12;
        c.beginPath();
        c.moveTo(x - s * 0.07, y); c.quadraticCurveTo(x - s * 0.04 + lean, y - hgt * 0.5, x + lean, y - hgt);
        c.moveTo(x + s * 0.07, y); c.quadraticCurveTo(x + s * 0.03 + lean, y - hgt * 0.5, x + lean * 1.3 + s * 0.02, y - hgt * 0.85);
        ink(c, s * 0.04, i % 3 === 0 ? C.bladeLite : C.blade);
      }
    },
    road(c, s, r, same) {
      c.fillStyle = C.road; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 5; i++) { c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(r() * s, r() * s, s * 0.04, s * 0.04); }
      const k = s * 0.08;
      c.fillStyle = C.curb;
      if (!same(0, -1)) c.fillRect(0, 0, s, k);
      if (!same(0, 1)) c.fillRect(0, s - k, s, k);
      if (!same(-1, 0)) c.fillRect(0, 0, k, s);
      if (!same(1, 0)) c.fillRect(s - k, 0, k, s);
      c.fillStyle = C.roadLine;
      if (same(0, 1) && !same(0, -1) && same(-1, 0) && same(1, 0)) c.fillRect(s * 0.2, s - s * 0.05, s * 0.4, s * 0.1);
      if (same(1, 0) && !same(-1, 0) && same(0, -1) && same(0, 1)) c.fillRect(s - s * 0.05, s * 0.2, s * 0.1, s * 0.4);
    },
    sidewalk(c, s, r) {
      c.fillStyle = C.walk; c.fillRect(0, 0, s, s);
      c.strokeStyle = C.seam; c.lineWidth = s * 0.03; c.strokeRect(0, 0, s, s);
      if (r() < 0.35) line(c, s * 0.2, s * 0.3, s * 0.55, s * 0.6, r, s * 0.05, s * 0.025, C.seam);
    },
    drive(c, s, r) {
      c.fillStyle = C.drive; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 8; i++) { c.fillStyle = "rgba(90,80,70,.12)"; c.fillRect(r() * s, r() * s, s * 0.035, s * 0.035); }
    },
    porch(c, s, r) {
      GROUND.lawn(c, s, r);
      blob(c, rectPts(s * 0.1, s * 0.08, s * 0.8, s * 0.84), r, s * 0.04); paint(c, "#D8B68C", s * 0.04);
      blob(c, rectPts(s * 0.24, s * 0.3, s * 0.52, s * 0.36), r, s * 0.03); paint(c, "#C4604F", s * 0.03);
    },
    flowers(c, s, r) {
      GROUND.lawn(c, s, r);
      const colors = ["#F28DA8", "#F7D35C", "#FFFFFF", "#C69CF0"];
      for (let i = 0; i < 4; i++) {
        const x = s * (0.15 + r() * 0.7), y = s * (0.15 + r() * 0.7), p = s * 0.06, col = colors[Math.floor(r() * colors.length)];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ellipse(c, x + Math.cos(a) * p, y + Math.sin(a) * p, p * 0.8, p * 0.8); paint(c, col);
        }
        ellipse(c, x, y, p * 0.6, p * 0.6); paint(c, "#E2A33B");
      }
    },
    water(c, s, r) {
      c.fillStyle = "#5FB2BC"; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 2; i++) line(c, s * r(), s * (0.2 + r() * 0.6), s * r(), s * (0.2 + r() * 0.6), r, s * 0.05, s * 0.03, C.waterLite);
    },
    sand(c, s, r) {
      c.fillStyle = "#EFDCA8"; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? "rgba(160,120,60,.18)" : "rgba(255,255,255,.4)"; c.fillRect(r() * s, r() * s, s * 0.035, s * 0.035); }
    },
    dock(c, s, r, same) {
      GROUND.water(c, s, r);
      GROUND.dockPlanks(c, s, r, same);
    },
    dockPlanks(c, s, r, same) {
      const m = s * 0.08;
      const x0 = same(-1, 0) ? 0 : m, x1 = same(1, 0) ? s : s - m;
      const y0 = same(0, -1) ? 0 : m, y1 = same(0, 1) ? s : s - m;
      const vertical = same(0, -1) || same(0, 1);
      const n = 4;
      for (let i = 0; i < n; i++) {
        if (vertical && !(same(-1, 0) || same(1, 0))) {
          const yy = (i * s) / n;
          blob(c, rectPts(x0, yy + s * 0.01, x1 - x0, s / n - s * 0.03, 2), r, s * 0.015);
        } else {
          const xx = (i * s) / n;
          blob(c, rectPts(xx + s * 0.01, y0, s / n - s * 0.03, y1 - y0, 2), r, s * 0.015);
        }
        paint(c, i % 2 ? "#C79A66" : "#D2A673", s * 0.025);
      }
      [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y], i) => {
        const outer = (i < 2 ? !same(0, -1) : !same(0, 1)) && (i % 2 ? !same(1, 0) : !same(-1, 0));
        if (outer) { ellipse(c, x, y, s * 0.07, s * 0.07); paint(c, "#7A5634", s * 0.025); }
      });
    },
    floor(c, s, r) {
      c.fillStyle = C.wood; c.fillRect(0, 0, s, s);
      c.strokeStyle = C.woodLine; c.lineWidth = s * 0.025;
      for (let i = 0; i < 4; i++) {
        const y = (i + 1) * (s / 4);
        c.beginPath(); c.moveTo(0, y); c.lineTo(s, y); c.stroke();
        const x = ((i % 2) * 0.5 + 0.25) * s;
        c.beginPath(); c.moveTo(x, y - s / 4); c.lineTo(x, y); c.stroke();
      }
    },
    wallTop(c, s) {
      c.fillStyle = C.paper; c.fillRect(0, 0, s, s);
      c.fillStyle = C.stripe;
      for (let i = 0; i < 4; i++) c.fillRect(i * (s / 4), 0, s / 8, s);
    },
    wallLow(c, s, r) {
      GROUND.wallTop(c, s, r);
      c.fillStyle = C.base; c.fillRect(0, s * 0.78, s, s * 0.22);
      c.fillStyle = C.ink; c.fillRect(0, s * 0.76, s, s * 0.03);
    },
    rug(c, s, r, same) {
      GROUND.floor(c, s, r);
      const m = s * 0.06;
      const x0 = same(-1, 0) ? 0 : m, y0 = same(0, -1) ? 0 : m;
      const x1 = same(1, 0) ? s : s - m, y1 = same(0, 1) ? s : s - m;
      c.fillStyle = "#D9735E"; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      c.strokeStyle = "#F4D35E"; c.lineWidth = s * 0.04;
      c.beginPath();
      if (!same(0, -1)) { c.moveTo(x0, y0 + m * 1.5); c.lineTo(x1, y0 + m * 1.5); }
      if (!same(0, 1)) { c.moveTo(x0, y1 - m * 1.5); c.lineTo(x1, y1 - m * 1.5); }
      if (!same(-1, 0)) { c.moveTo(x0 + m * 1.5, y0); c.lineTo(x0 + m * 1.5, y1); }
      if (!same(1, 0)) { c.moveTo(x1 - m * 1.5, y0); c.lineTo(x1 - m * 1.5, y1); }
      c.stroke();
    },
    mat(c, s, r) {
      GROUND.floor(c, s, r);
      blob(c, rectPts(s * 0.12, s * 0.2, s * 0.76, s * 0.55), r, s * 0.03); paint(c, "#6F9BC9", s * 0.035);
    },
    void(c, s) { c.fillStyle = C.dark; c.fillRect(0, 0, s, s); },
    garden(c, s, r, same) { gardenBed(c, s, r, same, false); },
    gardenBloom(c, s, r, same) { gardenBed(c, s, r, same, true); },
    carpet(c, s, r) {
      c.fillStyle = "#CFC3DD"; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,.35)" : "rgba(90,70,120,.12)"; c.fillRect(r() * s, r() * s, s * 0.03, s * 0.03); }
    },
    bathroom(c, s) {
      c.fillStyle = "#F4FAFC"; c.fillRect(0, 0, s, s);
      c.strokeStyle = "#B9DCE8"; c.lineWidth = s * 0.025;
      for (let i = 0; i <= 3; i++) { c.beginPath(); c.moveTo(0, (i * s) / 3); c.lineTo(s, (i * s) / 3); c.moveTo((i * s) / 3, 0); c.lineTo((i * s) / 3, s); c.stroke(); }
    },
    concrete(c, s, r) {
      c.fillStyle = "#C3C0B8"; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 6; i++) { c.fillStyle = "rgba(80,75,70,.12)"; c.fillRect(r() * s, r() * s, s * 0.04, s * 0.04); }
      if (r() < 0.3) line(c, s * 0.1, s * r(), s * 0.6, s * r(), r, s * 0.05, s * 0.02, "rgba(80,75,70,.35)");
    },
    kitchen(c, s) {
      const n = 4, q = s / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        c.fillStyle = (x + y) % 2 ? "#DCEBF2" : "#FFFFFF"; c.fillRect(x * q, y * q, q, q);
      }
    },
    /** A wall between rooms, seen from above, with its face showing on the south side. */
    innerWall(c, s, r, same) {
      c.fillStyle = "#CDB892"; c.fillRect(0, 0, s, s);
      if (!same(0, 1)) {
        c.fillStyle = "#EADFC6"; c.fillRect(0, s * 0.55, s, s * 0.45);
        c.fillStyle = C.base; c.fillRect(0, s * 0.9, s, s * 0.1);
      }
      c.strokeStyle = C.ink; c.lineWidth = s * 0.04;
      c.beginPath();
      if (!same(0, -1)) { c.moveTo(0, s * 0.02); c.lineTo(s, s * 0.02); }
      if (!same(-1, 0)) { c.moveTo(s * 0.02, 0); c.lineTo(s * 0.02, s); }
      if (!same(1, 0)) { c.moveTo(s * 0.98, 0); c.lineTo(s * 0.98, s); }
      if (!same(0, 1)) { c.moveTo(0, s * 0.55); c.lineTo(s, s * 0.55); }
      c.stroke();
    },
  };

  /** Soil in rows with a wooden edge; when it blooms, flowers grow in the rows. */
  function gardenBed(c, s, r, same, bloom) {
    c.fillStyle = "#8B5E3C"; c.fillRect(0, 0, s, s);
    c.strokeStyle = "#6E4A2E"; c.lineWidth = s * 0.05;
    for (let y = s * 0.2; y < s; y += s * 0.3) { c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (r() - 0.5) * s * 0.04); c.stroke(); }
    if (bloom) {
      const colors = ["#F28DA8", "#F7D35C", "#FFFFFF", "#C69CF0", "#FF7A59"];
      for (let i = 0; i < 4; i++) {
        const x = s * (0.15 + (i % 2) * 0.45 + r() * 0.2), y = s * (0.2 + Math.floor(i / 2) * 0.45 + r() * 0.1);
        line(c, x, y + s * 0.18, x, y, r, 0, s * 0.04, "#4F8C3B");
        ellipse(c, x + s * 0.06, y + s * 0.1, s * 0.06, s * 0.03, 0.5); paint(c, "#62A24C");
        const col = colors[Math.floor(r() * colors.length)];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ellipse(c, x + Math.cos(a) * s * 0.06, y + Math.sin(a) * s * 0.06, s * 0.05, s * 0.05); paint(c, col); }
        ellipse(c, x, y, s * 0.035, s * 0.035); paint(c, "#E2A33B");
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const x = s * (0.2 + r() * 0.6), y = s * (0.25 + r() * 0.6);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - s * 0.04, y - s * 0.06); c.moveTo(x, y); c.lineTo(x + s * 0.04, y - s * 0.06); ink(c, s * 0.03, "#7FB455");
      }
    }
    c.fillStyle = "#A4774A";
    const e = s * 0.07;
    if (!same(0, -1)) c.fillRect(0, 0, s, e);
    if (!same(0, 1)) c.fillRect(0, s - e, s, e);
    if (!same(-1, 0)) c.fillRect(0, 0, e, s);
    if (!same(1, 0)) c.fillRect(s - e, 0, e, s);
  }

  /* ---------- objects (stand up off the ground; may spill over the tile above) ----------
     Drawn into a canvas 2 tiles wide and 2.5 tiles tall; the tile itself is at
     (0.5s, 1.5s). Each gets (ctx, size, random, same, info).                      */
  const OBJECTS = {
    tree(c, s, r) {
      ellipse(c, s / 2, s * 0.9, s * 0.38, s * 0.1); paint(c, "rgba(0,0,0,.15)");
      blob(c, rectPts(s * 0.42, s * 0.45, s * 0.16, s * 0.47, 2), r, s * 0.03); paint(c, C.trunk, s * 0.04);
      const parts = [[0.5, 0.05, 0.42], [0.27, 0.22, 0.28], [0.73, 0.22, 0.28], [0.5, 0.3, 0.32]];
      parts.forEach(([x, y, rad], i) => {
        blob(c, ellipsePts(s * x, s * y, s * rad, s * rad * 0.9, 9), r, s * 0.06);
        paint(c, i === 3 ? C.leafDark : C.leaf, s * 0.045);
      });
      ellipse(c, s * 0.4, s * -0.08, s * 0.12, s * 0.08, -0.4); paint(c, C.leafLite);
    },
    fence(c, s, r, same) {
      const y = s * 0.15, hgt = s * 0.7;
      c.fillStyle = "#F7F1E6";
      const rail = (yy) => {
        blob(c, rectPts(same(-1, 0) ? -2 : s * 0.08, yy, (same(-1, 0) ? s * 0.08 : 0) + (same(1, 0) ? s + 2 : s * 0.84), s * 0.1, 2), r, s * 0.02);
        paint(c, "#F7F1E6", s * 0.035);
      };
      rail(y + hgt * 0.25); rail(y + hgt * 0.65);
      for (let i = 0; i < 3; i++) {
        const x = s * (0.15 + i * 0.3);
        blob(c, [[x, y + s * 0.08], [x + s * 0.07, y], [x + s * 0.14, y + s * 0.08], [x + s * 0.14, y + hgt], [x, y + hgt]], r, s * 0.02);
        paint(c, "#FFFAF0", s * 0.035);
      }
    },
    sign(c, s, r) {
      blob(c, rectPts(s * 0.45, s * 0.4, s * 0.1, s * 0.55, 2), r, s * 0.02); paint(c, C.trunk, s * 0.035);
      blob(c, rectPts(s * 0.1, s * 0.05, s * 0.8, s * 0.45), r, s * 0.04); paint(c, "#E9C48F", s * 0.045);
      line(c, s * 0.22, s * 0.2, s * 0.75, s * 0.2, r, s * 0.03, s * 0.035, C.base);
      line(c, s * 0.22, s * 0.33, s * 0.6, s * 0.33, r, s * 0.03, s * 0.035, C.base);
    },
    house(c, s, r, same, info) {
      const col = HOUSES[info.color % HOUSES.length];
      const front = !same(0, 1); // the row we see the wall of
      const ext = s * 0.04;
      const x0 = same(-1, 0) ? -ext : s * 0.04, x1 = same(1, 0) ? s + ext : s * 0.96;
      const y0 = same(0, -1) ? -ext : s * 0.02;
      const roofBottom = front ? s * 0.42 : s + ext;
      // roof
      c.fillStyle = col.roof;
      c.fillRect(x0, y0, x1 - x0, roofBottom - y0);
      c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = s * 0.03;
      for (let yy = y0 + s * 0.14; yy < roofBottom - s * 0.05; yy += s * 0.2) {
        for (let xx = x0 + ((yy / (s * 0.2)) % 2) * s * 0.12; xx < x1 - s * 0.08; xx += s * 0.25) {
          c.beginPath(); c.arc(xx + s * 0.1, yy, s * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
        }
      }
      // wall and window on the front row
      if (front) {
        c.fillStyle = col.wall;
        c.fillRect(x0, roofBottom, x1 - x0, s * 0.96 - roofBottom);
        c.fillStyle = "rgba(0,0,0,.15)";
        c.fillRect(x0, roofBottom, x1 - x0, s * 0.06);
        if (info.window) {
          blob(c, rectPts(s * 0.3, s * 0.55, s * 0.4, s * 0.28, 2), r, s * 0.02); paint(c, "#BFE3F2", s * 0.035);
          line(c, s * 0.5, s * 0.56, s * 0.5, s * 0.82, r, s * 0.01, s * 0.03);
        }
        line(c, x0, roofBottom, x1, roofBottom, r, s * 0.02, s * 0.045);
        if (!same(0, 1)) line(c, x0, s * 0.96, x1, s * 0.96, r, s * 0.02, s * 0.045);
      }
      // outline on the outside edges only, so joined tiles read as one house
      const bottom = front ? s * 0.96 : s + ext;
      if (!same(-1, 0)) line(c, x0, y0, x0, bottom, r, s * 0.02, s * 0.045);
      if (!same(1, 0)) line(c, x1, y0, x1, bottom, r, s * 0.02, s * 0.045);
      if (!same(0, -1)) line(c, x0, y0, x1, y0, r, s * 0.02, s * 0.045);
    },
    boat(c, s, r) {
      ellipse(c, s * 0.5, s * 0.6, s * 0.95, s * 0.4); paint(c, "rgba(255,255,255,.3)");
      const hull = [[-0.35, 0.35], [0.9, 0.3], [1.35, 0.55], [0.9, 0.82], [-0.35, 0.78], [-0.42, 0.56]].map(([x, y]) => [x * s, y * s]);
      blob(c, hull, r, s * 0.02); paint(c, "#F4EFE4", s * 0.045);
      const inner = [[-0.25, 0.43], [0.85, 0.4], [1.15, 0.55], [0.85, 0.72], [-0.25, 0.7]].map(([x, y]) => [x * s, y * s]);
      blob(c, inner, r, s * 0.02); paint(c, "#C99A6B", s * 0.03);
      line(c, s * 0.2, s * 0.42, s * 0.2, s * 0.71, r, s * 0.01, s * 0.06, "#A4774A");
      line(c, s * 0.6, s * 0.41, s * 0.6, s * 0.72, r, s * 0.01, s * 0.06, "#A4774A");
      line(c, -s * 0.34, s * 0.8, s * 0.88, s * 0.84, r, s * 0.01, s * 0.05, "#D9433B");
      line(c, -s * 0.42, s * 0.56, -s * 0.9, s * 0.4, r, s * 0.02, s * 0.025, "#8A6A4A");
    },
    counter(c, s, r, same) {
      const x0 = same(-1, 0) ? -1 : s * 0.02, x1 = same(1, 0) ? s + 1 : s * 0.98;
      c.fillStyle = "#B99A72"; c.fillRect(x0, s * 0.55, x1 - x0, s * 0.4);
      c.fillStyle = "#EFE9DE"; c.fillRect(x0, s * 0.05, x1 - x0, s * 0.55);
      c.strokeStyle = C.ink; c.lineWidth = s * 0.04; c.strokeRect(x0, s * 0.05, x1 - x0, s * 0.9);
      c.beginPath(); c.moveTo(x0, s * 0.6); c.lineTo(x1, s * 0.6); c.stroke();
      ellipse(c, s * 0.5, s * 0.78, s * 0.06, s * 0.03); paint(c, "#7A5634");
    },
    stove(c, s, r, same) {
      OBJECTS.counter(c, s, r, same);
      c.fillStyle = "#3A3330"; c.fillRect(s * 0.12, s * 0.1, s * 0.76, s * 0.45);
      [[0.32, 0.22], [0.68, 0.22], [0.32, 0.44], [0.68, 0.44]].forEach(([x, y]) => { ellipse(c, s * x, s * y, s * 0.1, s * 0.06); ink(c, s * 0.03, "#E25636"); });
    },
    fridge(c, s) {
      c.beginPath(); c.roundRect(s * 0.08, -s * 0.45, s * 0.84, s * 1.38, s * 0.08); paint(c, "#F4F6F8", s * 0.045);
      c.beginPath(); c.moveTo(s * 0.08, s * 0.1); c.lineTo(s * 0.92, s * 0.1); ink(c, s * 0.035);
      c.beginPath(); c.moveTo(s * 0.78, -s * 0.3); c.lineTo(s * 0.78, -s * 0.05); c.moveTo(s * 0.78, s * 0.2); c.lineTo(s * 0.78, s * 0.55); ink(c, s * 0.05, "#9AA4AE");
      ellipse(c, s * 0.3, -s * 0.2, s * 0.06, s * 0.06); paint(c, "#F28DA8");
    },
    chair(c, s) {
      c.beginPath(); c.roundRect(s * 0.25, s * 0.15, s * 0.5, s * 0.18, s * 0.05); paint(c, "#A4774A", s * 0.035);
      c.beginPath(); c.roundRect(s * 0.22, s * 0.32, s * 0.56, s * 0.4, s * 0.06); paint(c, "#C99A6B", s * 0.035);
      c.fillStyle = "#7A5634"; c.fillRect(s * 0.26, s * 0.72, s * 0.06, s * 0.2); c.fillRect(s * 0.68, s * 0.72, s * 0.06, s * 0.2);
    },
    sofa(c, s, r, same) {
      const x0 = same(-1, 0) ? -1 : s * 0.04, x1 = same(1, 0) ? s + 1 : s * 0.96;
      c.fillStyle = "#5E7FBF"; c.fillRect(x0, s * 0.05, x1 - x0, s * 0.4);
      c.fillStyle = "#7C9BD6"; c.fillRect(x0, s * 0.42, x1 - x0, s * 0.45);
      c.strokeStyle = C.ink; c.lineWidth = s * 0.04; c.strokeRect(x0, s * 0.05, x1 - x0, s * 0.82);
      if (!same(-1, 0)) { c.beginPath(); c.roundRect(x0 - s * 0.02, s * 0.2, s * 0.16, s * 0.7, s * 0.06); paint(c, "#5E7FBF", s * 0.04); }
      if (!same(1, 0)) { c.beginPath(); c.roundRect(x1 - s * 0.14, s * 0.2, s * 0.16, s * 0.7, s * 0.06); paint(c, "#5E7FBF", s * 0.04); }
    },
    tv(c, s) {
      c.fillStyle = "#7A5634"; c.fillRect(s * 0.1, s * 0.55, s * 0.8, s * 0.35);
      c.beginPath(); c.roundRect(s * 0.06, -s * 0.15, s * 0.88, s * 0.66, s * 0.04); paint(c, "#26262B", s * 0.04);
      const g = c.createLinearGradient(0, -s * 0.1, 0, s * 0.45); g.addColorStop(0, "#5EC2E8"); g.addColorStop(1, "#7C5CD6");
      c.fillStyle = g; c.fillRect(s * 0.13, -s * 0.08, s * 0.74, s * 0.52);
    },
    shelf(c, s) {
      c.beginPath(); c.roundRect(s * 0.06, -s * 0.5, s * 0.88, s * 1.4, s * 0.04); paint(c, "#A4774A", s * 0.045);
      const cols = ["#D9433B", "#4F86B0", "#F2B544", "#62A24C", "#7C5CD6"];
      for (let row = 0; row < 3; row++) {
        const y = -s * 0.42 + row * s * 0.44;
        c.fillStyle = "#7A5634"; c.fillRect(s * 0.1, y + s * 0.36, s * 0.8, s * 0.04);
        for (let i = 0; i < 5; i++) { c.fillStyle = cols[(i + row) % 5]; c.fillRect(s * (0.14 + i * 0.15), y + s * (0.08 + (i % 2) * 0.04), s * 0.11, s * (0.28 - (i % 2) * 0.04)); }
      }
    },
    desk(c, s, r, same) {
      const x0 = same(-1, 0) ? -1 : s * 0.04, x1 = same(1, 0) ? s + 1 : s * 0.96;
      c.fillStyle = "#A4774A"; c.fillRect(x0, s * 0.55, x1 - x0, s * 0.35);
      c.fillStyle = "#C99A6B"; c.fillRect(x0, s * 0.1, x1 - x0, s * 0.5);
      c.strokeStyle = C.ink; c.lineWidth = s * 0.04; c.strokeRect(x0, s * 0.1, x1 - x0, s * 0.8);
      if (!same(-1, 0)) {   // a laptop on the left end
        c.beginPath(); c.roundRect(s * 0.2, s * 0.15, s * 0.5, s * 0.32, s * 0.03); paint(c, "#3A3A42", s * 0.03);
        c.fillStyle = "#8ACFE8"; c.fillRect(s * 0.25, s * 0.19, s * 0.4, s * 0.22);
      } else { c.fillStyle = "#FFFFFF"; c.fillRect(s * 0.25, s * 0.2, s * 0.35, s * 0.25); }
    },
    toilet(c, s) {
      c.beginPath(); c.roundRect(s * 0.25, s * 0.05, s * 0.5, s * 0.25, s * 0.06); paint(c, "#FFFFFF", s * 0.04);
      ellipse(c, s / 2, s * 0.58, s * 0.24, s * 0.3); paint(c, "#FFFFFF", s * 0.04);
      ellipse(c, s / 2, s * 0.6, s * 0.14, s * 0.18); paint(c, "#BFE3F2");
    },
    tub(c, s, r, same) {
      const y0 = same(0, -1) ? -1 : s * 0.06, y1 = same(0, 1) ? s + 1 : s * 0.94;
      c.beginPath(); c.roundRect(s * 0.1, y0, s * 0.8, y1 - y0, s * 0.18); paint(c, "#FFFFFF", s * 0.045);
      c.beginPath(); c.roundRect(s * 0.2, y0 + s * 0.1, s * 0.6, y1 - y0 - s * 0.2, s * 0.12); paint(c, "#9AD3EA");
      if (!same(0, -1)) { ellipse(c, s / 2, s * 0.14, s * 0.05, s * 0.05); paint(c, "#B9C6D1"); }
    },
    /** A car seen from above, parked nose-up. Two car tiles stack; only the bottom one draws it. */
    car(c, s, r, same) {
      if (same(0, 1)) return;
      const x0 = -s * 0.12, w = s * 1.24, y0 = -s * 1.05, hh = s * 1.95;
      ellipse(c, s / 2, s * 0.92, s * 0.65, s * 0.08); paint(c, "rgba(0,0,0,.18)");
      c.beginPath(); c.roundRect(x0, y0, w, hh, s * 0.3); paint(c, "#3E6E9E", s * 0.05);
      c.beginPath(); c.roundRect(x0 + s * 0.14, y0 + s * 0.35, w - s * 0.28, s * 0.3, s * 0.1); paint(c, "#BFE3F2", s * 0.035);
      c.beginPath(); c.roundRect(x0 + s * 0.14, y0 + s * 1.35, w - s * 0.28, s * 0.24, s * 0.08); paint(c, "#BFE3F2", s * 0.035);
      c.beginPath(); c.roundRect(x0 + s * 0.18, y0 + s * 0.7, w - s * 0.36, s * 0.6, s * 0.06); paint(c, "#5D8BBD", s * 0.03);
      [[x0 + s * 0.12, y0 + s * 0.05], [x0 + w - s * 0.32, y0 + s * 0.05]].forEach(([x, y]) => { c.fillStyle = "#F7D35C"; c.fillRect(x, y, s * 0.2, s * 0.08); });
    },
    bed(c, s, r) {
      blob(c, rectPts(s * 0.08, s * 0.02, s * 0.84, s * 0.94), r, s * 0.03); paint(c, "#8DB8E0", s * 0.04);
      blob(c, rectPts(s * 0.18, s * 0.08, s * 0.64, s * 0.24), r, s * 0.03); paint(c, "#FFFFFF", s * 0.035);
      line(c, s * 0.1, s * 0.45, s * 0.9, s * 0.45, r, s * 0.02, s * 0.035);
    },
    table(c, s, r) {
      ellipse(c, s / 2, s * 0.85, s * 0.35, s * 0.08); paint(c, "rgba(0,0,0,.15)");
      blob(c, rectPts(s * 0.12, s * 0.62, s * 0.08, s * 0.28, 1), r, s * 0.01); paint(c, C.base, s * 0.03);
      blob(c, rectPts(s * 0.8, s * 0.62, s * 0.08, s * 0.28, 1), r, s * 0.01); paint(c, C.base, s * 0.03);
      blob(c, rectPts(s * 0.05, s * 0.3, s * 0.9, s * 0.36), r, s * 0.03); paint(c, "#C99A6B", s * 0.04);
    },
    plant(c, s, r) {
      blob(c, rectPts(s * 0.3, s * 0.55, s * 0.4, s * 0.38, 2), r, s * 0.03); paint(c, "#D9825B", s * 0.04);
      [[-0.2, 0.25], [0.2, 0.25], [0, 0.12]].forEach(([dx, y]) => {
        ellipse(c, s * (0.5 + dx), s * y + s * 0.2, s * 0.14, s * 0.22, dx * 2); paint(c, C.leaf, s * 0.035);
      });
    },
  };

  /* ---------- water ----------
     One painted texture that repeats seamlessly, shared by every water tile,
     so the bay looks like one body of water instead of a grid of squares.
     Teal base, soft light patches, long pointed streaks, white curls and
     sparkles. A second layer with only the shine drifts the other way.    */
  const WATER = { w: 640, h: 384 };
  const waterCache = {};
  function waterTextures(dpr) {
    if (waterCache[dpr]) return waterCache[dpr];
    const make = (paintIt) => {
      const cv = document.createElement("canvas");
      cv.width = WATER.w * dpr; cv.height = WATER.h * dpr;
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      paintIt(c);
      return cv;
    };
    // draw a shape nine times so it wraps around every edge
    const wrapped = (c, fn) => {
      for (const dx of [-WATER.w, 0, WATER.w]) for (const dy of [-WATER.h, 0, WATER.h]) {
        c.save(); c.translate(dx, dy); fn(); c.restore();
      }
    };
    const lens = (c, x, y, rx, ry) => {
      c.beginPath(); c.moveTo(x - rx, y);
      c.quadraticCurveTo(x, y - ry, x + rx, y); c.quadraticCurveTo(x, y + ry, x - rx, y); c.closePath();
    };
    const base = make((c) => {
      const r = rng(2024);
      c.fillStyle = "#5FB2BC"; c.fillRect(0, 0, WATER.w, WATER.h);
      for (let i = 0; i < 6; i++) {
        const x = r() * WATER.w, y = r() * WATER.h, rad = 110 + r() * 170;
        wrapped(c, () => {
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, "rgba(165,228,216,.55)"); g.addColorStop(1, "rgba(165,228,216,0)");
          c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        });
      }
      const tones = ["rgba(58,136,162,.42)", "rgba(140,214,207,.45)", "rgba(72,152,173,.35)", "rgba(176,231,222,.38)", "rgba(48,121,150,.32)"];
      for (let i = 0; i < 80; i++) {
        const x = r() * WATER.w, y = r() * WATER.h, rx = 40 + r() * 230, ry = 2.5 + r() * 8, col = tones[i % tones.length];
        wrapped(c, () => { lens(c, x, y, rx, ry); c.fillStyle = col; c.fill(); });
      }
    });
    const shine = make((c) => {
      const r = rng(77);
      c.strokeStyle = "rgba(255,255,255,.8)"; c.lineCap = "round"; c.lineWidth = 1.6;
      for (let i = 0; i < 16; i++) {
        const x = r() * WATER.w, y = r() * WATER.h, len = 40 + r() * 120, amp = 2 + r() * 4, waves = 1 + Math.floor(r() * 3);
        wrapped(c, () => {
          c.beginPath();
          for (let k = 0; k <= 24; k++) {
            const px = x + (k / 24) * len, py = y + Math.sin((k / 24) * Math.PI * 2 * waves) * amp * (1 - k / 48);
            if (k) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.stroke();
        });
      }
      for (let i = 0; i < 6; i++) {
        const x = r() * WATER.w, y = r() * WATER.h, rad = 6 + r() * 6;
        wrapped(c, () => { c.beginPath(); c.arc(x, y, rad, Math.PI * 0.55, Math.PI * 1.45); c.stroke(); });
      }
      c.fillStyle = "rgba(255,255,255,.85)";
      for (let i = 0; i < 22; i++) {
        const x = r() * WATER.w, y = r() * WATER.h, w = 2 + r() * 3;
        wrapped(c, () => { c.beginPath(); c.ellipse(x, y, w, w * 0.4, 0, 0, Math.PI * 2); c.fill(); });
      }
    });
    return (waterCache[dpr] = { base, shine });
  }

  /**
   * Paint water inside a path. (ox, oy) is the world position of the
   * screen's top-left, so the texture lines up across every tile.
   */
  function water(c, dpr, path, ox, oy, t) {
    const tex = waterTextures(dpr);
    const at = (dx, dy) => new DOMMatrix().translate(dx, dy).scale(1 / dpr);
    const base = c.createPattern(tex.base, "repeat");
    base.setTransform(at(-ox + t * 5, -oy));
    c.fillStyle = base; c.fill(path);
    const shine = c.createPattern(tex.shine, "repeat");
    shine.setTransform(at(-ox - t * 7, -oy + Math.sin(t * 0.6) * 3));
    c.globalAlpha = 0.6 + Math.sin(t * 1.4) * 0.25;
    c.fillStyle = shine; c.fill(path);
    c.globalAlpha = 1;
  }

  /* ---------- caches: each tile look is drawn once per size ---------- */
  const cache = new Map();
  function cached(key, w, h, dpr, fn) {
    let cv = cache.get(key);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
      const c = cv.getContext("2d");
      c.scale(dpr, dpr);
      fn(c);
      cache.set(key, cv);
    }
    return cv;
  }
  A.clearCache = () => cache.clear();

  /** Draw the ground of one tile at (x, y). */
  function ground(c, name, ch, x, y, s, dpr, mask, variant) {
    const pics = A.assets.tiles[ch];
    if (pics) {
      const list = [].concat(pics);
      const im = img(list[variant % list.length]);
      if (im) { c.drawImage(im, x, y, s, s); return; }
    }
    const cv = cached(`g|${name}|${mask}|${variant}|${s}|${dpr}`, s, s, dpr, (cc) => {
      GROUND[name](cc, s, rng(hash(variant, name.length, mask) + 7), (dx, dy) => sameFromMask(mask, dx, dy));
    });
    c.drawImage(cv, x, y, s, s);
  }
  /** Draw a standing object for one tile whose top-left is (x, y). */
  function object(c, name, ch, x, y, s, dpr, mask, variant, info = {}) {
    const pic = A.assets.objects[ch];
    const im = pic && img(pic.src);
    if (im) {
      const w = (pic.w || 1) * s, hh = (pic.h || 1) * s;
      c.drawImage(im, x + s / 2 - w / 2, y + s - hh, w, hh);
      return;
    }
    const cv = cached(`o|${name}|${mask}|${variant}|${info.color}|${info.window}|${s}|${dpr}`, s * 2, s * 2.5, dpr, (cc) => {
      cc.translate(s * 0.5, s * 1.5);
      OBJECTS[name](cc, s, rng(hash(variant, name.length, mask) + 11), (dx, dy) => sameFromMask(mask, dx, dy), info);
    });
    c.drawImage(cv, x - s * 0.5, y - s * 1.5, s * 2, s * 2.5);
  }
  const BIT = { "0,-1": 1, "1,0": 2, "0,1": 4, "-1,0": 8 };
  const sameFromMask = (mask, dx, dy) => !!(mask & BIT[dx + "," + dy]);
  A.maskOf = (same) => [[0, -1], [1, 0], [0, 1], [-1, 0]].reduce((m, [dx, dy]) => m | (same(dx, dy) ? BIT[dx + "," + dy] : 0), 0);

  /* ---------- people ---------- */
  const LOOKS = {
    // the hero: white tee with a print on the back, green shorts, braids
    hero: { shirt: "#F3F1EA", pants: "#2F7A4F", skin: "#6E4128", hair: "#1C1310", braids: true, shorts: true, print: "#9A9A96" },
    friend: { shirt: "#7CC47F", pants: "#6B5B95", skin: "#C98E63", hair: "#2B1D14", bow: "#F28DA8" },
    brother: { shirt: "#F3F1EA", pants: "#3D4F7A", skin: "#7A4A2E", hair: "#1C1310", braids: true, shorts: true },
    mom: { shirt: "#F28DA8", pants: "#4A6FA5", skin: "#7A4A2E", hair: "#1C1310", long: true },
    dad: { shirt: "#3E6E9E", pants: "#4A4A55", skin: "#6E4128", hair: "#1C1310", beard: true },
    elder: { shirt: "#8E7CC3", pants: "#5A5A5A", skin: "#7A4A2E", hair: "#E8E4DC", glasses: true },
    uncle: { shirt: "#4F86B0", pants: "#6B5B4B", skin: "#E0AC85", hair: "#8B5A2B", hat: "#C9B27C", beard: true },
  };

  /**
   * Draw a person standing on a tile. (cx, foot) is the middle of their feet,
   * s the tile size, phase 0–1 through a step (or null when standing).
   */
  function person(c, look, dir, cx, foot, s, phase, t) {
    if (look === "heroBike" && !(A.assets.people.heroBike && img(A.assets.people.heroBike.src))) {
      // no riding drawing yet: draw the bike and the hero sitting on it
      const spin = (phase || 0) * Math.PI * 2;
      const lift = s * 0.14;
      ellipse(c, cx, foot, s * 0.42, s * 0.08); paint(c, "rgba(0,0,0,.16)");
      if (dir === "left" || dir === "right") {
        bikeSide(c, cx, foot, s, dir === "left" ? -spin : spin);
        person(c, "hero", dir, cx - (dir === "left" ? -1 : 1) * s * 0.04, foot - lift, s, phase, t);
      } else if (dir === "up") {
        bikeEnd(c, cx, foot, s, false);
        person(c, "hero", dir, cx, foot - lift, s, phase, t);
        bikeEnd(c, cx, foot - s * 0.05, s * 0.9, true);
      } else {
        person(c, "hero", dir, cx, foot - lift, s, phase, t);
        bikeEnd(c, cx, foot, s, true);
      }
      return;
    }
    const sheet = A.assets.people[look];
    const im = sheet && img(sheet.src);
    if (im) return personSheet(c, sheet, im, dir, cx, foot, s, phase);
    if (look === "squirrel") return squirrel(c, dir, cx, foot, s, t);

    const L = LOOKS[look] || LOOKS.friend;
    const u = s / 16;
    const swing = phase == null ? 0 : Math.sin(phase * Math.PI * 2);
    const bob = phase == null ? 0 : Math.abs(swing) * 0.8 * u;
    const side = dir === "left" || dir === "right";
    const lw = Math.max(1.4, u * 0.7);
    c.save();
    if (dir === "right") { c.translate(cx * 2, 0); c.scale(-1, 1); }
    // shadow
    ellipse(c, cx, foot, 5 * u, 1.6 * u); paint(c, "rgba(0,0,0,.16)");
    // legs
    const legTop = foot - 5.5 * u;
    // a leg: shorts show skin below them
    const leg = (x, y) => {
      if (L.shorts) {
        c.beginPath(); c.roundRect(x, y, 2.6 * u, 5.5 * u, u); paint(c, L.skin, lw);
        c.beginPath(); c.roundRect(x - 0.2 * u, y - 0.2 * u, 3 * u, 2.6 * u, 0.8 * u); paint(c, L.pants, lw);
      } else { c.beginPath(); c.roundRect(x, y, 2.6 * u, 5.5 * u, u); paint(c, L.pants, lw); }
    };
    if (side) {
      for (const k of [-1, 1]) leg(cx - 1.3 * u + swing * k * 1.8 * u, legTop);
    } else {
      [-1, 1].forEach((k) => {
        const lift = Math.max(0, swing * k) * 1.4 * u;
        leg(cx + k * 2.1 * u - 1.3 * u, legTop - lift);
      });
    }
    // backpack behind (side and front views)
    const bodyTop = foot - 12 * u - bob;
    if (L.pack && side) { c.beginPath(); c.roundRect(cx + 2.4 * u, bodyTop + 1 * u, 3 * u, 5 * u, u); paint(c, L.pack, lw); }
    // body
    c.beginPath(); c.roundRect(cx - (side ? 3.4 : 4.4) * u, bodyTop, (side ? 6.8 : 8.8) * u, 7.2 * u, 2.2 * u); paint(c, L.shirt, lw);
    if (L.pack && dir === "up") { c.beginPath(); c.roundRect(cx - 3 * u, bodyTop + 0.8 * u, 6 * u, 5.4 * u, 1.4 * u); paint(c, L.pack, lw); }
    if (L.print && dir === "up") {
      // the print on the back of the tee: a hoop and net
      c.strokeStyle = L.print; c.lineWidth = Math.max(1, lw * 0.6);
      c.beginPath(); c.ellipse(cx, bodyTop + 2.4 * u, 2.1 * u, 1.2 * u, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      for (const k of [-1.6, -0.5, 0.5, 1.6]) { c.moveTo(cx + k * u, bodyTop + 3.2 * u); c.lineTo(cx + k * 0.6 * u, bodyTop + 5.4 * u); }
      c.moveTo(cx - 1.4 * u, bodyTop + 4.3 * u); c.lineTo(cx + 1.4 * u, bodyTop + 4.3 * u);
      c.stroke();
    }
    // arms
    if (!side) {
      [-1, 1].forEach((k) => {
        ellipse(c, cx + k * 5 * u, bodyTop + 3.6 * u - swing * k * 0.8 * u, 1.3 * u, 2.4 * u, k * 0.2); paint(c, L.shirt, lw);
      });
    } else {
      ellipse(c, cx - swing * 1.5 * u, bodyTop + 3.6 * u, 1.3 * u, 2.4 * u, swing * 0.4); paint(c, L.shirt, lw);
    }
    // head
    const hy = bodyTop - 3.8 * u;
    if (L.long && dir !== "up") { c.beginPath(); c.roundRect(cx - 4.6 * u, hy - 1 * u, 9.2 * u, 7 * u, 3 * u); paint(c, L.hair, lw); }
    ellipse(c, cx, hy, 4.6 * u, 4.4 * u); paint(c, dir === "up" ? L.hair : L.skin, lw);
    if (dir !== "up") {
      // hair or cap on top
      c.beginPath();
      if (side) c.ellipse(cx + 0.8 * u, hy - 1.4 * u, 4.4 * u, 3 * u, 0, Math.PI * 0.95, Math.PI * 2.15);
      else c.ellipse(cx, hy - 1.4 * u, 4.6 * u, 3.2 * u, 0, Math.PI, Math.PI * 2);
      paint(c, L.cap || L.hair, lw);
      if (L.cap) {
        ellipse(c, side ? cx - 4.2 * u : cx, hy - 1.2 * u, side ? 2.6 * u : 3.6 * u, 1 * u); paint(c, L.cap, lw);
      }
      if (L.hat) {
        ellipse(c, cx + (side ? -0.6 * u : 0), hy - 2.4 * u, 6.2 * u, 1.6 * u); paint(c, L.hat, lw);
        c.beginPath(); c.ellipse(cx, hy - 2.6 * u, 3.8 * u, 3 * u, 0, Math.PI, Math.PI * 2); c.closePath(); paint(c, L.hat, lw);
      }
      if (L.beard) {
        c.beginPath(); c.ellipse(side ? cx - 1.2 * u : cx, hy + 2.2 * u, side ? 3 * u : 3.8 * u, 2.4 * u, 0, 0, Math.PI); c.closePath(); paint(c, L.hair, lw);
      }
      if (L.bow) { ellipse(c, cx + 3.4 * u, hy - 3.6 * u, 1.6 * u, 1.1 * u, 0.5); paint(c, L.bow, lw); }
      if (L.braids) braids(c, L, cx, hy, u, lw, dir);
      // face
      const blink = Math.floor((t + cx * 0.01) * 10) % 37 === 0;
      const eyes = side ? [cx - 2.2 * u] : [cx - 1.7 * u, cx + 1.7 * u];
      eyes.forEach((ex) => {
        if (blink) { c.beginPath(); c.moveTo(ex - 0.7 * u, hy + 0.6 * u); c.lineTo(ex + 0.7 * u, hy + 0.6 * u); ink(c, lw); }
        else { ellipse(c, ex, hy + 0.6 * u, 0.65 * u, 0.85 * u); paint(c, C.ink); }
      });
      if (L.glasses) {
        eyes.forEach((ex) => { ellipse(c, ex, hy + 0.6 * u, 1.4 * u, 1.3 * u); ink(c, lw * 0.8); });
      }
      ellipse(c, side ? cx - 2.6 * u : cx - 2.8 * u, hy + 2 * u, 0.9 * u, 0.6 * u); paint(c, "rgba(240,120,120,.45)");
      if (!side) { ellipse(c, cx + 2.8 * u, hy + 2 * u, 0.9 * u, 0.6 * u); paint(c, "rgba(240,120,120,.45)"); }
      c.beginPath(); c.arc(side ? cx - 2.6 * u : cx, hy + 1.8 * u, 1.2 * u, 0.15 * Math.PI, 0.85 * Math.PI); ink(c, lw * 0.9);
    } else if (L.cap) {
      c.beginPath(); c.ellipse(cx, hy - 1 * u, 4.6 * u, 3.4 * u, 0, Math.PI, Math.PI * 2); paint(c, L.cap, lw);
    } else if (L.braids) {
      braids(c, L, cx, hy, u, lw, dir);
    } else if (L.hat) {
      ellipse(c, cx, hy - 2.4 * u, 6.2 * u, 1.6 * u); paint(c, L.hat, lw);
      c.beginPath(); c.ellipse(cx, hy - 2.6 * u, 3.8 * u, 3 * u, 0, Math.PI, Math.PI * 2); c.closePath(); paint(c, L.hat, lw);
    }
    c.restore();
  }

  /** A squirrel with a big bushy tail, holding an acorn. */
  function squirrel(c, dir, cx, foot, s, t) {
    const u = s / 16, lw = Math.max(1.3, u * 0.6);
    const k = dir === "left" ? -1 : 1;              // which way it's looking
    const flick = Math.max(0, Math.sin(t * 2.3)) ** 6 * 0.35;
    ellipse(c, cx, foot, 4 * u, 1.3 * u); paint(c, "rgba(0,0,0,.16)");
    // tail: a big curl behind
    c.save(); c.translate(cx - k * 2.5 * u, foot - 3 * u); c.rotate(-k * flick);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-k * 6 * u, -1 * u, -k * 6 * u, -10 * u, -k * 1 * u, -11 * u);
    c.bezierCurveTo(k * 2 * u, -11.5 * u, k * 1.5 * u, -8 * u, -k * 1 * u, -8 * u);
    c.bezierCurveTo(-k * 3 * u, -6 * u, -k * 2 * u, -2 * u, k * 1 * u, -1 * u);
    c.closePath(); paint(c, "#B8743F", lw);
    c.beginPath(); c.moveTo(-k * 1 * u, -2 * u); c.quadraticCurveTo(-k * 4.5 * u, -6 * u, -k * 1 * u, -9.5 * u); ink(c, lw, "#D9A06B");
    c.restore();
    // body, belly and paws holding an acorn
    ellipse(c, cx, foot - 3.5 * u, 3.2 * u, 3.6 * u); paint(c, "#A9663A", lw);
    ellipse(c, cx + k * 0.6 * u, foot - 3 * u, 1.8 * u, 2.4 * u); paint(c, "#F2D9B8");
    ellipse(c, cx + k * 1.4 * u, foot - 4.2 * u, 1.2 * u, 1.4 * u); paint(c, "#B07A45", lw * 0.7);
    c.beginPath(); c.arc(cx + k * 1.4 * u, foot - 5 * u, 1.2 * u, Math.PI, Math.PI * 2); paint(c, "#6E4A2A", lw * 0.6);
    // head and ears
    const hy = foot - 8 * u;
    [-1, 1].forEach((e) => { c.beginPath(); c.moveTo(cx + e * 1.2 * u, hy - 1.8 * u); c.lineTo(cx + e * 1.9 * u, hy - 3.6 * u); c.lineTo(cx + e * 2.4 * u, hy - 1.2 * u); c.closePath(); paint(c, "#A9663A", lw); });
    ellipse(c, cx, hy, 2.7 * u, 2.4 * u); paint(c, "#A9663A", lw);
    ellipse(c, cx + k * 1.6 * u, hy + 0.6 * u, 1.3 * u, 0.9 * u); paint(c, "#F2D9B8");
    const blink = Math.floor((t + cx * 0.01) * 10) % 41 === 0;
    [-0.6, 1].forEach((e) => {
      const ex = cx + k * e * u;
      if (blink) { c.beginPath(); c.moveTo(ex - 0.5 * u, hy - 0.2 * u); c.lineTo(ex + 0.5 * u, hy - 0.2 * u); ink(c, lw * 0.8); }
      else { ellipse(c, ex, hy - 0.2 * u, 0.55 * u, 0.7 * u); paint(c, C.ink); }
    });
    ellipse(c, cx + k * 2.5 * u, hy + 0.3 * u, 0.5 * u, 0.4 * u); paint(c, C.ink);
  }

  /** Something to collect on a quest, glinting in the grass. (cx, cy) is its middle. */
  function pickup(c, kind, cx, cy, s, t) {
    const pic = A.assets.objects[kind];
    const im = pic && img(pic.src);
    const bob = Math.sin(t * 3 + cx * 0.05) * s * 0.03;
    const lw = Math.max(1.3, s * 0.035);
    ellipse(c, cx, cy + s * 0.2, s * 0.16, s * 0.05); paint(c, "rgba(0,0,0,.18)");
    if (im) { const w = s * (pic.w || 0.4), hh = s * (pic.h || 0.4); c.drawImage(im, cx - w / 2, cy - hh / 2 + bob, w, hh); }
    else if (kind === "weed") {
      const sway = Math.sin(t * 2 + cx) * s * 0.03;
      for (const [a, len] of [[-0.6, 0.22], [-0.2, 0.3], [0.25, 0.26], [0.65, 0.2]]) {
        c.beginPath(); c.moveTo(cx, cy + s * 0.18);
        c.quadraticCurveTo(cx + a * s * 0.15 + sway, cy, cx + a * s * 0.3 + sway, cy + s * 0.18 - len * s);
        ink(c, s * 0.05, "#4F8C3B");
      }
      ellipse(c, cx + s * 0.05 + sway, cy - s * 0.12, s * 0.06, s * 0.06); paint(c, "#F7D35C", lw * 0.6);
    }
    else if (kind === "acorn") {
      ellipse(c, cx, cy + s * 0.04 + bob, s * 0.13, s * 0.16); paint(c, "#C98B4B", lw);
      c.beginPath(); c.arc(cx, cy - s * 0.04 + bob, s * 0.15, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); paint(c, "#7A5634", lw);
      c.beginPath(); c.moveTo(cx, cy - s * 0.18 + bob); c.lineTo(cx + s * 0.04, cy - s * 0.25 + bob); ink(c, lw, "#5A3D22");
    } else {
      ellipse(c, cx, cy + bob, s * 0.17, s * 0.11, -0.3); paint(c, "#B5733D", lw);
      c.beginPath(); c.moveTo(cx - s * 0.12, cy + s * 0.04 + bob); c.quadraticCurveTo(cx, cy - s * 0.04 + bob, cx + s * 0.12, cy - s * 0.06 + bob); ink(c, lw * 0.8, "#7A4A22");
    }
    // a twinkle so it's easy to spot
    const tw = (Math.sin(t * 4 + cx * 0.1) + 1) / 2;
    if (tw > 0.5) {
      const r = s * 0.1 * tw, x = cx + s * 0.16, y = cy - s * 0.2 + bob;
      c.fillStyle = `rgba(255,250,210,${tw})`;
      c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r, y); c.lineTo(x + r * 0.3, y + r * 0.3);
      c.lineTo(x, y + r); c.lineTo(x - r * 0.3, y + r * 0.3); c.lineTo(x - r, y); c.lineTo(x - r * 0.3, y - r * 0.3); c.closePath(); c.fill();
    }
  }

  /** Cornrow braids running back over the head, gathered into a little puff. */
  function braids(c, L, cx, hy, u, lw, dir) {
    const side = dir === "left" || dir === "right";
    // side views are always drawn facing left (person() mirrors the canvas for right)
    if (dir === "up") { ellipse(c, cx, hy + 2.8 * u, 1.9 * u, 2 * u); paint(c, L.hair, lw); }
    else if (side) { ellipse(c, cx + 4.4 * u, hy + 0.6 * u, 1.7 * u, 1.9 * u); paint(c, L.hair, lw); }
    c.strokeStyle = "rgba(255,255,255,.22)"; c.lineWidth = Math.max(1, lw * 0.55); c.lineCap = "round";
    for (const k of [-2.2, -0.7, 0.8, 2.3]) {
      c.beginPath();
      if (dir === "up") { c.moveTo(cx + k * u, hy - 4 * u); c.quadraticCurveTo(cx + k * 1.15 * u, hy - 1 * u, cx + k * 0.5 * u, hy + 2.2 * u); }
      else if (side) { c.moveTo(cx - 2.5 * u, hy - 3.8 * u + k * 0.45 * u); c.quadraticCurveTo(cx, hy - 4.6 * u + k * 0.5 * u, cx + 3.6 * u, hy - 1.6 * u + k * 0.5 * u); }
      else { c.moveTo(cx + k * u, hy - 1.2 * u); c.quadraticCurveTo(cx + k * 1.1 * u, hy - 3.6 * u, cx + k * 0.8 * u, hy - 4.3 * u); }
      c.stroke();
    }
  }

  function personSheet(c, sheet, im, dir, cx, foot, s, phase) {
    const rows = sheet.rows || { down: 0, up: 1, left: 2 };
    let row = rows[dir];
    let flip = false;
    if (row == null && dir === "right") { row = rows.left; flip = true; }
    const walk = sheet.walk || [0];
    const col = phase == null ? 0 : walk[Math.floor(phase * walk.length) % walk.length];
    const hh = s * (sheet.height || 1.3);
    const w = (hh * sheet.frameW) / sheet.frameH;
    c.save();
    if (flip) { c.translate(cx * 2, 0); c.scale(-1, 1); }
    c.drawImage(im, col * sheet.frameW, (row || 0) * sheet.frameH, sheet.frameW, sheet.frameH, cx - w / 2, foot - hh, w, hh);
    c.restore();
  }

  /* ---------- critters ----------
     (cx, base) is the middle of the ground under the critter; size is about
     its height. mood: { blink, hop, happy } from the game.                 */
  function critter(c, id, cx, base, size, t, mood = {}) {
    const pics = A.assets.critters[id];
    if (pics) {
      const im = img((mood.blink && pics.blink) || (mood.happy && pics.happy) || pics.src) || img(pics.src);
      if (im) {
        const hh = size, w = (hh * im.naturalWidth) / im.naturalHeight;
        const squash = 1 + Math.sin(t * 2.4) * 0.025;
        c.drawImage(im, cx - (w * (2 - squash)) / 2, base - hh * squash, w * (2 - squash), hh * squash);
        return;
      }
    }
    const u = size / 32;
    const lw = Math.max(1.5, u * 1.1);
    const breathe = Math.sin(t * 2.4) * 0.6 * u;
    const blink = mood.blink;
    ellipse(c, cx, base, 11 * u, 2.6 * u); paint(c, "rgba(0,0,0,.14)");

    const eyes = (y, gap, r, sleepy) => {
      [-1, 1].forEach((k) => {
        const ex = cx + k * gap;
        if (blink || sleepy) { c.beginPath(); c.arc(ex, y, r, 0.1 * Math.PI, 0.9 * Math.PI); ink(c, lw); }
        else { ellipse(c, ex, y, r * 0.8, r); paint(c, C.ink); ellipse(c, ex - r * 0.25, y - r * 0.35, r * 0.28, r * 0.28); paint(c, "#fff"); }
      });
    };
    const cheeks = (y, gap) => [-1, 1].forEach((k) => { ellipse(c, cx + k * gap, y, 1.6 * u, 1 * u); paint(c, "rgba(240,120,130,.5)"); });

    if (id === "fizzbun") {
      [-1, 1].forEach((k) => {
        ellipse(c, cx + k * 5 * u, base - 25 * u - breathe, 3.2 * u, 8.5 * u, k * 0.18); paint(c, "#FFF6EA", lw);
        ellipse(c, cx + k * 5 * u, base - 24.5 * u - breathe, 1.4 * u, 5.5 * u, k * 0.18); paint(c, "#F6B8C8");
      });
      ellipse(c, cx, base - 10 * u - breathe / 2, 11 * u + breathe / 3, 10 * u + breathe); paint(c, "#FFF6EA", lw);
      [-1, 1].forEach((k) => { ellipse(c, cx + k * 5 * u, base - 1 * u, 3 * u, 1.6 * u); paint(c, "#FFF6EA", lw); });
      eyes(base - 13 * u - breathe, 4 * u, 1.6 * u);
      cheeks(base - 9.5 * u - breathe, 6.5 * u);
      ellipse(c, cx, base - 10.5 * u - breathe, 1.1 * u, 0.8 * u); paint(c, "#E8798F");
      c.beginPath(); c.moveTo(cx - 1.6 * u, base - 8.6 * u - breathe); c.quadraticCurveTo(cx, base - 7.4 * u - breathe, cx + 1.6 * u, base - 8.6 * u - breathe); ink(c, lw * 0.8);
    } else if (id === "mossy") {
      const sway = Math.sin(t * 1.8) * 0.25;
      c.save(); c.translate(cx, base - 18 * u - breathe); c.rotate(sway);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(1 * u, -3 * u, 0, -5.5 * u); ink(c, lw, "#3E7A34");
      ellipse(c, 3 * u, -6 * u, 3.4 * u, 1.8 * u, -0.5); paint(c, "#9BD27A", lw);
      c.restore();
      c.beginPath();
      c.moveTo(cx - 13 * u, base - 1 * u);
      c.bezierCurveTo(cx - 14 * u, base - 22 * u - breathe, cx + 14 * u, base - 22 * u - breathe, cx + 13 * u, base - 1 * u);
      c.closePath(); paint(c, "#7DBB5E", lw);
      [[-6, -12, 2.4], [5, -15, 1.8], [7, -6, 2]].forEach(([x, y, r]) => { ellipse(c, cx + x * u, base + y * u - breathe, r * u, r * 0.8 * u); paint(c, "#5E9E48"); });
      eyes(base - 9 * u - breathe, 4.5 * u, 1.7 * u);
      cheeks(base - 6 * u - breathe, 7.5 * u);
    } else if (id === "pebblet") {
      const r2 = rng(99);
      blob(c, ellipsePts(cx, base - 9 * u - breathe / 2, 12 * u, 9.5 * u + breathe / 2, 9), r2, 4 * u); paint(c, "#ABA8A0", lw);
      ellipse(c, cx - 5 * u, base - 14 * u, 3 * u, 1.6 * u, -0.3); paint(c, "#C9C6BE");
      ellipse(c, cx + 6 * u, base - 5 * u, 2.4 * u, 1.4 * u); paint(c, "#8E8B84");
      eyes(base - 10 * u - breathe / 2, 4 * u, 1.8 * u, !mood.happy);
      c.beginPath(); c.arc(cx, base - 6 * u - breathe / 2, 1.3 * u, 0, Math.PI); ink(c, lw * 0.8);
      if (!mood.happy) {
        c.font = `${Math.round(5 * u)}px "Patrick Hand", sans-serif`;
        c.fillStyle = C.ink;
        c.fillText("z", cx + 10 * u, base - 18 * u - (t % 2) * 3 * u);
      }
    } else if (SNAKES[id]) {
      snake(c, SNAKES[id], cx, base, u, lw, t, blink);
    } else if (id === "squeaks") {
      const twitch = Math.sin(t * 14) * 0.4 * u * (Math.sin(t * 1.3) > 0.6 ? 1 : 0);
      c.beginPath(); c.moveTo(cx + 8 * u, base - 3 * u);
      c.bezierCurveTo(cx + 16 * u, base - 2 * u, cx + 15 * u, base - 12 * u + Math.sin(t * 3) * 2 * u, cx + 11 * u, base - 11 * u);
      ink(c, lw * 1.2, "#D99A9A");
      ellipse(c, cx + 1 * u, base - 7 * u - breathe / 2, 10 * u, 7 * u + breathe / 2); paint(c, "#B8A699", lw);
      ellipse(c, cx + 2 * u, base - 5 * u, 6 * u, 3.5 * u); paint(c, "#D9CCC0");
      [-1, 1].forEach((k) => {
        ellipse(c, cx - 4 * u + k * 5 * u, base - 18 * u - breathe, 4.6 * u, 4.6 * u); paint(c, "#B8A699", lw);
        ellipse(c, cx - 4 * u + k * 5 * u, base - 18 * u - breathe, 2.8 * u, 2.8 * u); paint(c, "#F2B8C0");
      });
      ellipse(c, cx - 4 * u, base - 11 * u - breathe, 7 * u, 6 * u); paint(c, "#B8A699", lw);
      eyes(base - 12 * u - breathe, 2.6 * u, 1.3 * u);
      ellipse(c, cx - 4 * u + twitch, base - 8.6 * u - breathe, 1.2 * u, 0.9 * u); paint(c, "#E8798F");
      [-1, 1].forEach((k) => {
        [-0.6, 0.6].forEach((a) => {
          c.beginPath(); c.moveTo(cx - 4 * u + k * 2 * u, base - 8.4 * u - breathe);
          c.lineTo(cx - 4 * u + k * 7 * u, base - 8.4 * u - breathe + a * 2 * u + twitch); ink(c, lw * 0.6);
        });
      });
      [-1, 1].forEach((k) => { ellipse(c, cx - 1 * u + k * 4 * u, base - 0.8 * u, 2.4 * u, 1.2 * u); paint(c, "#F2B8C0", lw * 0.8); });
    } else if (id === "finny") {
      const by = base - 12 * u + Math.sin(t * 2.2) * 1.4 * u;
      const wag = Math.sin(t * 7) * 1.8 * u;
      c.beginPath(); c.moveTo(cx + 9 * u, by); c.lineTo(cx + 17 * u, by - 6 * u + wag); c.lineTo(cx + 17 * u, by + 6 * u + wag); c.closePath(); paint(c, "#4F9FB5", lw);
      c.beginPath(); c.moveTo(cx - 4 * u, by - 7 * u); c.quadraticCurveTo(cx + 2 * u, by - 13 * u, cx + 7 * u, by - 6 * u); c.closePath(); paint(c, "#4F9FB5", lw);
      ellipse(c, cx, by, 12 * u, 8 * u + breathe / 2); paint(c, "#6FB7C9", lw);
      ellipse(c, cx - 1 * u, by + 3.4 * u, 8 * u, 3.4 * u); paint(c, "#F4B860");
      [2, 6].forEach((x) => { c.beginPath(); c.moveTo(cx + x * u, by - 6 * u); c.quadraticCurveTo(cx + (x + 1.5) * u, by, cx + x * u, by + 6 * u); ink(c, lw * 0.8, "#4F9FB5"); });
      ellipse(c, cx + 1 * u, by + 1 * u, 3 * u, 1.6 * u, 0.4 + Math.sin(t * 5) * 0.3); paint(c, "#4F9FB5", lw * 0.7);
      if (blink) { c.beginPath(); c.moveTo(cx - 8 * u, by - 2 * u); c.lineTo(cx - 5 * u, by - 2 * u); ink(c, lw); }
      else { ellipse(c, cx - 6.5 * u, by - 2 * u, 2.2 * u, 2.4 * u); paint(c, "#fff", lw * 0.7); ellipse(c, cx - 7 * u, by - 1.8 * u, 1.1 * u, 1.3 * u); paint(c, C.ink); }
      c.beginPath(); c.arc(cx - 10.5 * u, by + 2 * u, 1.2 * u, -0.3 * Math.PI, 0.5 * Math.PI); ink(c, lw * 0.8);
      ellipse(c, cx - 15 * u, by - 7 * u - (t * 6 % 6) * u, 1.2 * u, 1.2 * u); ink(c, lw * 0.6, "#7CC4E4");
    } else if (id === "pinchy") {
      const snap = Math.abs(Math.sin(t * 4)) * 0.5;
      [-1, 1].forEach((k) => {
        [0, 1, 2].forEach((i) => {
          c.beginPath(); c.moveTo(cx + k * 8 * u, base - 5 * u + i * 1.6 * u); c.lineTo(cx + k * (13 + i) * u, base - 1 * u + i * 0.4 * u); ink(c, lw * 1.1, "#C4552F");
        });
        c.beginPath(); c.moveTo(cx + k * 7 * u, base - 10 * u); c.quadraticCurveTo(cx + k * 12 * u, base - 13 * u, cx + k * 12 * u, base - 17 * u); ink(c, lw * 1.4, "#C4552F");
        c.save(); c.translate(cx + k * 12.5 * u, base - 19 * u); c.scale(k, 1);
        c.beginPath(); c.moveTo(0, 2 * u); c.ellipse(0, 0, 3.6 * u, 4 * u, 0, Math.PI * (0.55 + snap * 0.3), Math.PI * (2.45 - snap * 0.3)); c.closePath();
        paint(c, "#E8704A", lw); c.restore();
      });
      ellipse(c, cx, base - 7 * u - breathe / 2, 11 * u, 6.5 * u + breathe / 2); paint(c, "#E8704A", lw);
      [-1, 1].forEach((k) => {
        c.beginPath(); c.moveTo(cx + k * 3 * u, base - 12 * u); c.lineTo(cx + k * 3.6 * u, base - 16 * u); ink(c, lw, "#C4552F");
        if (blink) { c.beginPath(); c.moveTo(cx + k * 3.6 * u - 1 * u, base - 17 * u); c.lineTo(cx + k * 3.6 * u + 1 * u, base - 17 * u); ink(c, lw); }
        else { ellipse(c, cx + k * 3.6 * u, base - 17 * u, 1.8 * u, 2 * u); paint(c, "#fff", lw * 0.7); ellipse(c, cx + k * 3.6 * u, base - 16.6 * u, 0.9 * u, 1.1 * u); paint(c, C.ink); }
      });
      c.beginPath(); c.arc(cx, base - 7 * u, 2 * u, 0.15 * Math.PI, 0.85 * Math.PI); ink(c, lw * 0.9);
      cheeks(base - 7.5 * u, 6 * u);
    } else if (id === "shelby") {
      const peek = Math.sin(t * 1.5) * 0.8 * u;
      [[-8, 1, -0.5], [8, 1, 0.5], [-7, -10, 0.6], [7, -10, -0.6]].forEach(([x, y, a]) => {
        ellipse(c, cx + x * u, base + y * u - 1 * u, 4 * u, 2.2 * u, a); paint(c, "#9CCB7A", lw);
      });
      ellipse(c, cx - 13 * u - peek, base - 8 * u, 4.6 * u, 4 * u); paint(c, "#9CCB7A", lw);
      ellipse(c, cx, base - 7 * u - breathe / 2, 12 * u, 8.6 * u + breathe / 2); paint(c, "#6E9F5A", lw);
      [[-5, -9], [3, -10], [-1, -4], [7, -5], [-7, -3]].forEach(([x, y]) => {
        blob(c, ellipsePts(cx + x * u, base + y * u, 2.6 * u, 2.2 * u, 6), rng(x * 7 + y), 0.4 * u); paint(c, "#8DBE70", lw * 0.6);
      });
      const ex = cx - 14.5 * u - peek;
      if (blink) { c.beginPath(); c.moveTo(ex - 1 * u, base - 9 * u); c.lineTo(ex + 1 * u, base - 9 * u); ink(c, lw); }
      else { ellipse(c, ex, base - 9 * u, 0.9 * u, 1.1 * u); paint(c, C.ink); }
      c.beginPath(); c.arc(ex + 1 * u, base - 7 * u, 1.3 * u, 0.1 * Math.PI, 0.8 * Math.PI); ink(c, lw * 0.8);
    } else if (id === "bloop") {
      const by = base - 15 * u + Math.sin(t * 1.8) * 2 * u;
      const squish = 1 + Math.sin(t * 3.6) * 0.06;
      for (let i = 0; i < 5; i++) {
        const x = cx + (i - 2) * 3.6 * u;
        c.beginPath(); c.moveTo(x, by);
        for (let k = 1; k <= 6; k++) c.lineTo(x + Math.sin(t * 3 + i + k) * 1.4 * u, by + k * 2.4 * u);
        ink(c, lw, "#D97AA6");
      }
      c.beginPath(); c.ellipse(cx, by, 11 * u * (2 - squish), 10 * u * squish, 0, Math.PI, Math.PI * 2);
      c.quadraticCurveTo(cx, by + 3 * u, cx - 11 * u * (2 - squish), by); c.closePath();
      paint(c, "rgba(243,166,200,.9)", lw);
      ellipse(c, cx - 4 * u, by - 6 * u, 3 * u, 2 * u, -0.4); paint(c, "rgba(255,255,255,.55)");
      eyes(by - 3 * u, 3.6 * u, 1.3 * u);
      cheeks(by - 0.8 * u, 6.4 * u);
    } else if (id === "boot") {
      c.beginPath(); c.moveTo(cx - 6 * u, base - 24 * u); c.lineTo(cx + 3 * u, base - 24 * u); c.lineTo(cx + 3 * u, base - 9 * u);
      c.quadraticCurveTo(cx + 13 * u, base - 8 * u, cx + 12 * u, base - 2 * u); c.lineTo(cx - 7 * u, base - 2 * u); c.closePath();
      paint(c, "#7A5634", lw);
      c.beginPath(); c.moveTo(cx - 7 * u, base - 4 * u); c.lineTo(cx + 12 * u, base - 4 * u); ink(c, lw * 1.2);
      [-20, -16, -12].forEach((y) => { c.beginPath(); c.moveTo(cx - 3 * u, base + y * u); c.lineTo(cx + 1 * u, base + y * u - 1 * u); ink(c, lw * 0.8, "#E8D6B0"); });
      ellipse(c, cx + 6 * u, base - 26 * u - (t * 8 % 8) * u, 1.3 * u, 1.3 * u); ink(c, lw * 0.6, "#7CC4E4");
    } else if (id === "flitter") {
      const hover = -5 * u + Math.sin(t * 3) * 1.6 * u;
      const flap = 0.7 + 0.3 * Math.abs(Math.sin(t * 7));
      const by = base - 12 * u + hover;
      [-1, 1].forEach((k) => {
        c.save(); c.translate(cx, by); c.scale(k * flap, 1);
        ellipse(c, 7 * u, -4 * u, 7 * u, 5.5 * u, -0.4); paint(c, "#E9CC96", lw);
        ellipse(c, 6 * u, 4 * u, 5 * u, 3.8 * u, 0.4); paint(c, "#E2BE80", lw);
        ellipse(c, 8 * u, -4.5 * u, 1.8 * u, 1.8 * u); paint(c, "#B98A4E");
        c.restore();
      });
      ellipse(c, cx, by + 1 * u, 2.6 * u, 6 * u); paint(c, "#8A6A4A", lw);
      ellipse(c, cx, by - 5.5 * u, 3.6 * u, 3.2 * u); paint(c, "#A3805C", lw);
      [-1, 1].forEach((k) => {
        c.beginPath(); c.moveTo(cx + k * 1.2 * u, by - 8 * u); c.quadraticCurveTo(cx + k * 3 * u, by - 13 * u, cx + k * 5 * u, by - 12.5 * u); ink(c, lw * 0.8);
      });
      eyes(by - 5.8 * u, 1.6 * u, 1 * u);
    }
  }

  /* Snakes share one drawing with different colours and poses. */
  const SNAKES = {
    sootsnake: { body: "#2C2C33", edge: "#101014", belly: "#F1EEE4", mark: "#4A4A55", lift: 20 },
    sprigsnake: { body: "#7CC35A", edge: "#3F7F2E", belly: "#E9F18E", mark: "#93D46F", lift: 18 },
    hoodini: { body: "#C9A35E", edge: "#7A5C2C", belly: "#F3DFAE", mark: "#A9803F", lift: 27, hood: true },
  };
  function snake(c, S, cx, base, u, lw, t, blink) {
    const sway = Math.sin(t * (S.hood ? 1.6 : 2.2)) * (S.hood ? 2.6 : 1.4) * u;
    const thick = (w, color, draw) => { draw(); c.lineWidth = w; c.strokeStyle = color; c.lineCap = c.lineJoin = "round"; c.stroke(); };
    const tube = (draw, w) => { thick(w + lw * 2, S.edge, draw); thick(w, S.body, draw); };
    // coils on the ground
    tube(() => { c.beginPath(); c.ellipse(cx, base - 3.5 * u, 11 * u, 3.6 * u, 0, 0, Math.PI * 2); }, 5 * u);
    tube(() => { c.beginPath(); c.ellipse(cx - 1 * u, base - 7.5 * u, 8 * u, 2.8 * u, 0, Math.PI * 0.1, Math.PI * 1.9); }, 4.6 * u);
    [-7, -1, 6].forEach((x) => { ellipse(c, cx + x * u, base - 1.4 * u, 1.6 * u, 0.8 * u); paint(c, S.mark); });
    // neck rising to the head
    const hx = cx - 2 * u + sway, hy = base - S.lift * u;
    const neck = () => { c.beginPath(); c.moveTo(cx + 6 * u, base - 8 * u); c.bezierCurveTo(cx + 9 * u, base - (S.lift * 0.6) * u, hx + 4 * u, hy + 6 * u, hx, hy + 2 * u); };
    tube(neck, 4.2 * u);
    thick(1.6 * u, S.belly, () => { c.beginPath(); c.moveTo(cx + 5.6 * u, base - 9 * u); c.bezierCurveTo(cx + 8 * u, base - (S.lift * 0.6) * u, hx + 3 * u, hy + 6 * u, hx - 0.6 * u, hy + 3 * u); });
    if (S.hood) {
      ellipse(c, hx, hy + 2 * u, 7.5 * u, 8 * u); paint(c, S.body, lw);
      ellipse(c, hx, hy + 3 * u, 4.6 * u, 5.4 * u); paint(c, S.belly);
      [-1, 1].forEach((k) => { ellipse(c, hx + k * 2.2 * u, hy + 1.6 * u, 1.3 * u, 1.3 * u); ink(c, lw * 0.8, S.edge); });
    }
    // tongue flick
    if (Math.sin(t * 3) > 0.7) {
      c.beginPath(); c.moveTo(hx, hy + 2.6 * u); c.lineTo(hx, hy + 5.5 * u);
      c.moveTo(hx, hy + 5.5 * u); c.lineTo(hx - 1 * u, hy + 7 * u); c.moveTo(hx, hy + 5.5 * u); c.lineTo(hx + 1 * u, hy + 7 * u);
      ink(c, lw * 0.8, "#D9434A");
    }
    ellipse(c, hx, hy, 4.6 * u, 3.6 * u); paint(c, S.body, lw);
    ellipse(c, hx, hy + 1.6 * u, 2.6 * u, 1.4 * u); paint(c, S.belly);
    [-1, 1].forEach((k) => {
      const ex = hx + k * 2 * u, ey = hy - 0.6 * u;
      if (blink) { c.beginPath(); c.moveTo(ex - 0.8 * u, ey); c.lineTo(ex + 0.8 * u, ey); ink(c, lw, "#fff"); }
      else { ellipse(c, ex, ey, 1.1 * u, 1.2 * u); paint(c, "#fff"); ellipse(c, ex, ey + 0.2 * u, 0.6 * u, 0.8 * u); paint(c, C.ink); }
    });
  }

  /* ---------- the bike ---------- */
  /** A side-view bike with its wheels touching y = ground. */
  function bikeSide(c, cx, ground, s, spin) {
    const r = s * 0.19, lw = Math.max(1.4, s * 0.04);
    [-1, 1].forEach((k) => {
      const wx = cx + k * s * 0.3, wy = ground - r;
      ellipse(c, wx, wy, r, r); paint(c, "rgba(255,255,255,.35)", lw * 1.4);
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI) / 3;
        c.beginPath(); c.moveTo(wx - Math.cos(a) * r, wy - Math.sin(a) * r); c.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r);
        ink(c, lw * 0.4, "#6E6B76");
      }
    });
    const bx = cx - s * 0.3, fx = cx + s * 0.3, wy = ground - r;
    c.beginPath();
    c.moveTo(bx, wy); c.lineTo(cx - s * 0.02, wy); c.lineTo(cx - s * 0.1, wy - s * 0.3); c.lineTo(bx, wy);
    c.moveTo(cx - s * 0.02, wy); c.lineTo(cx + s * 0.2, wy - s * 0.27); c.lineTo(cx - s * 0.1, wy - s * 0.3);
    c.moveTo(fx, wy); c.lineTo(cx + s * 0.2, wy - s * 0.36);
    ink(c, lw * 1.3, "#D9433B");
    c.beginPath(); c.moveTo(cx + s * 0.14, wy - s * 0.4); c.lineTo(cx + s * 0.27, wy - s * 0.36); ink(c, lw * 1.2);
    ellipse(c, cx - s * 0.12, wy - s * 0.33, s * 0.09, s * 0.03); paint(c, C.ink);
  }
  OBJECTS.bike = (c, s) => {
    ellipse(c, s / 2, s * 0.92, s * 0.42, s * 0.07); paint(c, "rgba(0,0,0,.15)");
    bikeSide(c, s / 2, s * 0.92, s, 0.3);
  };
  /** A front/back-view wheel and handlebars, for riding up or down. */
  function bikeEnd(c, cx, ground, s, front) {
    const lw = Math.max(1.4, s * 0.04);
    c.beginPath(); c.roundRect(cx - s * 0.05, ground - s * 0.38, s * 0.1, s * 0.38, s * 0.05); paint(c, "#4A4650", lw);
    if (front) {
      c.beginPath(); c.moveTo(cx - s * 0.26, ground - s * 0.62); c.lineTo(cx + s * 0.26, ground - s * 0.62); ink(c, lw * 1.4);
      c.beginPath(); c.moveTo(cx, ground - s * 0.62); c.lineTo(cx, ground - s * 0.36); ink(c, lw * 1.3, "#D9433B");
    }
  }

  /**
   * The rowboat, centred at (cx, cy) on the water, pointing the way it's facing.
   * Side views show the whole hull; up and down show it end-on (shorter, wider).
   */
  function boat(c, cx, cy, s, dir, t, occupied) {
    const pic = A.assets.objects.boat;
    const im = pic && img(pic.src);
    const lw = Math.max(1.5, s * 0.045);
    c.save();
    c.translate(cx, cy);
    // a soft shadow ring on the water
    c.fillStyle = "rgba(20,70,90,.22)";
    c.beginPath(); c.ellipse(0, s * 0.18, s * 0.95, s * 0.32, 0, 0, Math.PI * 2); c.fill();
    if (dir === "up" || dir === "down") c.rotate(dir === "up" ? -Math.PI / 2 : Math.PI / 2);
    else if (dir === "left") c.scale(-1, 1);
    if (dir === "up" || dir === "down") c.scale(0.8, 1.1);
    if (im) {
      const w = (pic.w || 2) * s, hh = (pic.h || 1) * s;
      c.drawImage(im, -w / 2, -hh / 2, w, hh);
      c.restore();
      return;
    }
    const r = rng(5);
    const hull = [[-0.85, -0.28], [0.4, -0.3], [0.88, 0], [0.4, 0.3], [-0.85, 0.28], [-0.92, 0]].map(([x, y]) => [x * s, y * s]);
    blob(c, hull, r, s * 0.015); paint(c, "#F4EFE4", lw);
    const inner = [[-0.75, -0.19], [0.36, -0.21], [0.7, 0], [0.36, 0.21], [-0.75, 0.19]].map(([x, y]) => [x * s, y * s]);
    blob(c, inner, r, s * 0.015); paint(c, "#C99A6B", lw * 0.7);
    if (!occupied) {
      line(c, -0.35 * s, -0.2 * s, -0.35 * s, 0.2 * s, r, s * 0.01, s * 0.06, "#A4774A");
      line(c, 0.15 * s, -0.21 * s, 0.15 * s, 0.21 * s, r, s * 0.01, s * 0.06, "#A4774A");
    } else {
      // oars dipping in time
      const sw = Math.sin(t * 4) * 0.25;
      for (const k of [-1, 1]) {
        c.beginPath(); c.moveTo(-0.1 * s, k * 0.22 * s); c.lineTo((-0.1 + sw) * s, k * 0.7 * s);
        ink(c, s * 0.05, "#8A6A4A");
        ellipse(c, (-0.1 + sw) * s, k * 0.72 * s, s * 0.09, s * 0.05, sw); paint(c, "#A4774A", lw * 0.6);
      }
    }
    line(c, -0.86 * s, 0.24 * s, 0.4 * s, 0.27 * s, r, s * 0.01, s * 0.045, "#D9433B");
    c.restore();
  }

  /* ---------- the wagon ---------- */
  function wheel(c, x, y, r, spin, lw) {
    ellipse(c, x, y, r, r); paint(c, "#2B2B30", lw);
    ellipse(c, x, y, r * 0.62, r * 0.62); paint(c, "#F7F7F2", lw * 0.6);
    c.strokeStyle = "#C9C9C2"; c.lineWidth = Math.max(1, lw * 0.6);
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.094;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); c.stroke();
    }
    ellipse(c, x, y, r * 0.17, r * 0.17); paint(c, "#D9433B");
  }

  /**
   * A red wagon whose wheels rest on y = gy, centred on cx, facing dir.
   * rider: draw little brother sitting inside. grip: [x, y] of the pusher's
   * hands, so the handle reaches them.
   */
  function wagon(c, cx, gy, s, dir, t, phase, rider, grip) {
    const pic = A.assets.objects.wagon;
    const im = pic && !rider && img(pic.src);
    if (im) { const w = (pic.w || 1) * s, hh = (pic.h || 0.8) * s; c.drawImage(im, cx - w / 2, gy - hh, w, hh); return; }
    const lw = Math.max(1.4, s * 0.04);
    const side = dir === "left" || dir === "right", k = dir === "left" ? -1 : 1;
    const spin = (phase || 0) * Math.PI * 4 * k;
    ellipse(c, cx, gy, side ? s * 0.5 : s * 0.38, s * 0.09); paint(c, "rgba(0,0,0,.16)");
    const W = side ? s * 0.88 : s * 0.64;
    const top = gy - s * 0.62, lip = gy - s * 0.42, bottom = gy - s * 0.14;
    // wheels on the far side
    if (side) { wheel(c, cx - s * 0.27, gy - s * 0.2, s * 0.1, spin, lw); wheel(c, cx + s * 0.27, gy - s * 0.2, s * 0.1, spin, lw); }
    else { wheel(c, cx - W / 2 + s * 0.05, gy - s * 0.36, s * 0.085, spin, lw); wheel(c, cx + W / 2 - s * 0.05, gy - s * 0.36, s * 0.085, spin, lw); }
    // the inside of the tub
    c.beginPath(); c.roundRect(cx - W / 2, top, W, lip - top + s * 0.05, s * 0.07); paint(c, "#A42A26", lw);
    c.fillStyle = "#6E6A72"; c.fillRect(cx - W / 2 + s * 0.06, top + s * 0.05, W - s * 0.12, s * 0.06);
    // little brother, sitting in the wagon
    if (rider) {
      c.save(); c.beginPath(); c.rect(cx - s * 2, gy - s * 3, s * 4, s * 3 - (gy - lip) + s * 0.03); c.clip();
      person(c, "brother", dir, cx + (side ? -k * s * 0.05 : 0), lip + s * 0.42, s * 0.82, null, t);
      c.restore();
    }
    // the front panel
    c.beginPath(); c.roundRect(cx - W / 2, lip, W, bottom - lip, s * 0.05); paint(c, "#DB3B33", lw);
    c.fillStyle = "rgba(255,255,255,.28)"; c.fillRect(cx - W / 2 + s * 0.07, lip + s * 0.05, W - s * 0.14, s * 0.035);
    // wheels on the near side
    if (side) { wheel(c, cx - s * 0.27, gy - s * 0.1, s * 0.14, spin, lw); wheel(c, cx + s * 0.27, gy - s * 0.1, s * 0.14, spin, lw); }
    else { wheel(c, cx - W / 2 + s * 0.03, gy - s * 0.09, s * 0.12, spin, lw); wheel(c, cx + W / 2 - s * 0.03, gy - s * 0.09, s * 0.12, spin, lw); }
    // the handle, reaching back to whoever is pushing
    if (grip) {
      const ax = side ? cx - k * W / 2 : cx, ay = side ? lip : dir === "down" ? top + s * 0.05 : bottom;
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + grip[0]) / 2, Math.min(ay, grip[1]) - s * 0.12, grip[0], grip[1]);
      ink(c, s * 0.07, "#26262B");
      ellipse(c, grip[0], grip[1], s * 0.07, s * 0.05); paint(c, "#26262B");
    }
  }
  OBJECTS.wagon = (c, s) => wagon(c, s / 2, s * 0.92, s, "right", 0, 0, false, null);

  /** A solid silhouette of a critter (for ones you've met but not befriended). */
  function silhouette(id, w, hh, color) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = hh;
    const c = cv.getContext("2d");
    critter(c, id, w / 2, hh * 0.92, hh * 0.8, 0, {});
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, w, hh);
    return cv;
  }

  A.draw = { C, ground, object, person, critter, silhouette, water, boat, wagon, pickup, blob, rectPts, ellipsePts, rng, paint, line };
})();
