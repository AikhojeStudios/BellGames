#!/usr/bin/env python3
"""
Turn an OpenStreetMap export (map.osm) into a Garter Quest map.

  python3 tools/osm_to_map.py map.osm > js/games/adventure/crescent-map.js

What it does:
  1. Reads roads, streams, ponds, coastline and buildings from the export.
  2. Straightens the map along the HOME_STREET: distance along the street becomes
     left-to-right, and distance from it becomes up-and-down. The home street
     ends up as one straight road across the map (its south end on the left),
     and every other street keeps where it meets it and which side it's on.
  3. Draws everything onto a grid of tiles (TILE_M metres per tile).
  4. Fills the bay: coastline is drawn as a wall, then the water side is flooded.
  5. Places houses on lots along the streets (OSM has no houses here), each with
     a doorstep and a driveway to the street. Every yard is tall grass.
  6. Writes a JS file with the tile rows plus where the houses, doorsteps and
     street names are, for world.js to use.

Map data © OpenStreetMap contributors (ODbL).
"""
import sys, math, json, xml.etree.ElementTree as ET
from collections import deque

HOME_STREET = "Crescent Drive"
TILE_M = 10            # metres per tile
ROAD_TILES = 2         # roads are this many tiles wide
ACROSS_M = 150         # how far either side of the home street to include
ALONG_PAD_M = 60       # extra before the south end of the home street
NORTH_PAD_M = 260      # extra past the north end (Forbes Bay is up there)
SMOOTH_M = 60          # how much to smooth the home street's bends before straightening
ROADS = {"residential", "secondary", "tertiary", "unclassified", "primary", "living_street"}

def load(path):
    root = ET.parse(path).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    ways = []
    for w in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in w.findall("tag")}
        refs = [nd.get("ref") for nd in w.findall("nd")]
        pts = [nodes[r] for r in refs if r in nodes]
        if len(pts) >= 2:
            ways.append({"tags": tags, "pts": pts, "closed": refs[0] == refs[-1]})
    return ways

def main(path):
    ways = load(path)
    home = [w for w in ways if w["tags"].get("name") == HOME_STREET and "highway" in w["tags"]]
    if not home:
        sys.exit(f"No street called {HOME_STREET} in this export")
    hp = [p for w in home for p in w["pts"]]
    lat0 = sum(p[0] for p in hp) / len(hp); lon0 = sum(p[1] for p in hp) / len(hp)
    kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
    def metres(p): return ((p[1] - lon0) * kx, -(p[0] - lat0) * ky)   # x east, y south

    # The home street's centre line, south end first, resampled and smoothed so
    # its bends become gentle curves we can measure along.
    line = [metres(p) for p in home[0]["pts"]]
    for w in home[1:]: line += [metres(p) for p in w["pts"]]
    if line[0][1] < line[-1][1]: line.reverse()
    dense = []
    for a, b in zip(line, line[1:]):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 5))
        dense += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n)]
    dense.append(line[-1])
    K = SMOOTH_M // 5
    ref = [(sum(q[0] for q in dense[max(0, i - K):i + K + 1]) / len(dense[max(0, i - K):i + K + 1]),
            sum(q[1] for q in dense[max(0, i - K):i + K + 1]) / len(dense[max(0, i - K):i + K + 1])) for i in range(len(dense))]
    arc = [0.0]
    for a, b in zip(ref, ref[1:]): arc.append(arc[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    L = arc[-1]

    def proj(p):
        """(distance along the home street, distance to its left (negative) or right)."""
        q = metres(p)
        best = None
        last = len(ref) - 2
        for i in range(len(ref) - 1):
            (ax, ay), (bx, by) = ref[i], ref[i + 1]
            dx, dy = bx - ax, by - ay
            seg = dx * dx + dy * dy or 1
            t = ((q[0] - ax) * dx + (q[1] - ay) * dy) / seg
            if i > 0: t = max(t, 0)          # the ends carry on straight
            if i < last: t = min(t, 1)
            px, py = ax + dx * t, ay + dy * t
            dist = math.hypot(q[0] - px, q[1] - py)
            if best is None or dist < best[0]:
                side = dx * (q[1] - ay) - dy * (q[0] - ax)    # > 0 means right of travel
                best = (dist, arc[i] + t * math.sqrt(seg), dist if side > 0 else -dist)
        return (best[1], best[2])

    x0 = -ALONG_PAD_M; x1 = L + NORTH_PAD_M
    y0 = -ACROSS_M; y1 = ACROSS_M
    W = int((x1 - x0) / TILE_M) + 1; Ht = int((y1 - y0) / TILE_M) + 1
    g = [[","] * W for _ in range(Ht)]
    def cell(q): return ((q[0] - x0) / TILE_M, (q[1] - y0) / TILE_M)
    def inside(x, y): return 0 <= x < W and 0 <= y < Ht

    def stroke(pts, ch, width, over=None, real=None):
        r = width / 2
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            if real is not None:
                ra, rb = real[i], real[i + 1]
                if math.hypot(b[0] - a[0], b[1] - a[1]) > 2.5 * math.hypot(rb[0] - ra[0], rb[1] - ra[1]) + 25:
                    continue   # straightening tore this piece apart; skip it
            (ax, ay), (bx, by) = cell(a), cell(b)
            n = int(max(abs(bx - ax), abs(by - ay)) * 3) + 1
            for i in range(n + 1):
                t = i / n
                cx, cy = ax + (bx - ax) * t, ay + (by - ay) * t
                for yy in range(int(math.floor(cy - r)), int(math.ceil(cy + r)) + 1):
                    for xx in range(int(math.floor(cx - r)), int(math.ceil(cx + r)) + 1):
                        if inside(xx, yy) and (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 <= r * r + 0.15:
                            if over is None or g[yy][xx] in over:
                                g[yy][xx] = ch

    def fill_poly(pts, ch):
        poly = [cell(q) for q in pts]
        for yy in range(Ht):
            yc = yy + 0.5; xs_ = []
            for (ax, ay), (bx, by) in zip(poly, poly[1:] + poly[:1]):
                if (ay <= yc < by) or (by <= yc < ay):
                    xs_.append(ax + (yc - ay) * (bx - ax) / (by - ay))
            xs_.sort()
            for i in range(0, len(xs_) - 1, 2):
                for xx in range(max(0, int(math.ceil(xs_[i] - 0.5))), min(W, int(math.floor(xs_[i + 1] - 0.5)) + 1)):
                    g[yy][xx] = ch

    P = lambda w: [proj(p) for p in w["pts"]]
    Mreal = lambda w: [metres(p) for p in w["pts"]]
    # water: ponds and rivers, then streams, then the coastline as a wall + flood
    for w in ways:
        t = w["tags"]
        if t.get("natural") == "water" and w["closed"]:
            fill_poly(P(w), "~")
    for w in ways:
        t = w["tags"]
        if t.get("waterway") in ("stream", "river", "canal"):
            stroke(P(w), "~", 2 if t.get("waterway") == "stream" else 3, real=Mreal(w))
    coast = [w for w in ways if w["tags"].get("natural") == "coastline"]
    if coast:
        for w in coast: stroke(P(w), "C", 1.6)
        # OSM coastlines have the land on the left and the water on the right.
        # Split the map into areas walled off by the shoreline, then let points
        # just to the right (water) and left (land) of the shore vote on each area.
        comp = [[-1] * W for _ in range(Ht)]
        n = 0
        for sy in range(Ht):
            for sx in range(W):
                if comp[sy][sx] >= 0 or g[sy][sx] == "C": continue
                q = deque([(sx, sy)]); comp[sy][sx] = n
                while q:
                    x, y = q.popleft()
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if inside(nx, ny) and comp[ny][nx] < 0 and g[ny][nx] != "C":
                            comp[ny][nx] = n; q.append((nx, ny))
                n += 1
        votes = [0] * n
        for w in coast:
            pts = [cell(q) for q in P(w)]
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                dx, dy = bx - ax, by - ay; Lg = math.hypot(dx, dy)
                if Lg == 0 or Lg > 30: continue
                for k in (0.25, 0.5, 0.75):
                    mx, my = ax + dx * k, ay + dy * k
                    for side, vote in ((1, 1), (-1, -1)):
                        sx, sy = int(mx - side * dy / Lg * 2.2), int(my + side * dx / Lg * 2.2)
                        if inside(sx, sy) and comp[sy][sx] >= 0: votes[comp[sy][sx]] += vote
        for y in range(Ht):
            for x in range(W):
                if g[y][x] == "C": g[y][x] = "-"            # the shoreline becomes sand
                elif comp[y][x] >= 0 and votes[comp[y][x]] > 0: g[y][x] = "~"
    # roads (bridges go over water)
    names = {}
    for w in ways:
        t = w["tags"]
        if t.get("highway") in ROADS and t.get("name") != HOME_STREET:
            pts = P(w)
            stroke(pts, "=", ROAD_TILES + (1 if t["highway"] in ("secondary", "primary") else 0), real=Mreal(w))
            if t.get("name"):
                names.setdefault(t["name"], []).extend(cell(q) for q in pts)
    # the home street itself: perfectly straight across the middle
    mid = int(round((0 - y0) / TILE_M))
    end_x = min(W, int(round((L - x0) / TILE_M)) + 1)
    for x in range(end_x):
        for k in range(ROAD_TILES):
            g[mid - ROAD_TILES // 2 + k][x] = "="
    names.setdefault(HOME_STREET, []).extend((x + 0.5, mid) for x in range(end_x))
    # sand along the edge of the bay
    for y in range(Ht):
        for x in range(W):
            if g[y][x] == "," and any(inside(x + dx, y + dy) and g[y + dy][x + dx] == "~" for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                big = sum(1 for dx in range(-3, 4) for dy in range(-3, 4) if inside(x+dx, y+dy) and g[y+dy][x+dx] == "~")
                if big > 14: g[y][x] = "-"   # only beside wide water, not the little creek

    # houses on lots, facing a street: 3 wide, 2 tall, doorstep + driveway to the road
    houses = []
    def free(x, y, w, h, margin=1):
        for yy in range(y - margin, y + h + margin):
            for xx in range(x - margin, x + w + margin):
                if not inside(xx, yy) or g[yy][xx] != ",": return False
        return True
    for y in range(1, Ht - 1):
        x = 1
        while x < W - 4:
            placed = False
            for face, step in (("down", 1), ("up", -1)):
                hy = y
                door_y = hy + 2 if face == "down" else hy - 1
                # the street must be within 3 tiles of the doorstep, straight out from it
                path = []
                yy = door_y
                ok = False
                for _ in range(4):
                    if not inside(x + 1, yy): break
                    if g[yy][x + 1] == "=": ok = True; break
                    if g[yy][x + 1] != ",": break
                    path.append(yy); yy += step
                if not ok or not path or not free(x, hy, 3, 2): continue
                for xx in range(x, x + 3):
                    for k in range(2): g[hy + k][xx] = "h"
                g[path[0]][x + 1] = "D"
                for py in path[1:]: g[py][x + 1] = "d"
                houses.append({"x": x, "y": hy, "door": [x + 1, path[0]], "face": face})
                placed = True
                break
            x += 5 if placed else 1

    # a border of trees and a few backyard trees and flowers
    for x in range(W):
        for y in (0, Ht - 1):
            if g[y][x] in ",-": g[y][x] = "T"
    for y in range(Ht):
        for x in (0, W - 1):
            if g[y][x] in ",-": g[y][x] = "T"
    import random
    rnd = random.Random(7)
    for y in range(2, Ht - 2):
        for x in range(2, W - 2):
            if g[y][x] == "," and all(g[y+dy][x+dx] == "," for dx in (-1,0,1) for dy in (-1,0,1)):
                r = rnd.random()
                if r < 0.05: g[y][x] = "T"
                elif r < 0.07: g[y][x] = "*"

    # ---- the places that matter to the story ----
    def land_from(h):
        dx_, dy_ = h["door"]
        return [dx_, dy_ + 1] if h["face"] == "down" else [dx_, dy_ - 1]
    # Our House and Gram's House: a pair facing each other across the home street,
    # about 40% of the way along it.
    above = [h for h in houses if h["face"] == "down" and h["door"][1] < mid and mid - h["door"][1] <= 3]
    below = [h for h in houses if h["face"] == "up" and h["door"][1] > mid and h["door"][1] - mid <= 3]
    target = end_x * 0.4
    best = None
    for a in above:
        for b in below:
            score = abs(a["x"] - b["x"]) * 3 + abs(a["x"] - target)
            if best is None or score < best[0]: best = (score, a, b)
    special = {}
    if best:
        _, ours, grams = best
        for key, h in (("ours", ours), ("grams", grams)):
            dx_, dy_ = h["door"]
            spot = None
            for mx in (dx_ - 2, dx_ + 2, dx_ - 1, dx_ + 3):
                if inside(mx, dy_) and g[dy_][mx] == ",": spot = (mx, dy_); break
            if spot: g[spot[1]][spot[0]] = "S"
            special[key] = {"door": h["door"], "land": land_from(h), "mailbox": list(spot) if spot else None}
        # the bike waits beside our driveway
        lx, ly = special["ours"]["land"]
        for bx, by in ((lx + 1, ly), (lx - 1, ly), (lx + 1, ly - 1), (lx - 1, ly - 1)):
            if inside(bx, by) and g[by][bx] == ",":
                special["bike"] = [bx, by]; break
    # the dock: from the bay's shore, straight out into the water above the home street
    for row in range(mid - 5, 2, -1):
        xs_ = [x for x in range(end_x, W) if g[row][x] == "~"]
        if not xs_: continue
        x_start = xs_[0]
        if not all(inside(x_start + k, row) and g[row][x_start + k] == "~" for k in range(9)): continue
        if g[row][x_start - 1] not in "-,": continue
        for k in range(7): g[row][x_start + k] = "#"
        for k in (5, 6):
            g[row - 1][x_start + k] = "#"; g[row + 1][x_start + k] = "#"
        g[row][x_start + 7] = "O"
        shore = (x_start - 1, row - 1) if g[row - 1][x_start - 1] in "-," else None
        if shore: g[shore[1]][shore[0]] = "S"
        special["dock"] = {"start": [x_start, row], "pat": [x_start + 6, row - 1], "boat": [x_start + 7, row],
                           "sign": list(shore) if shore else None}
        break

    # where to put each street's sign: on grass beside the street, near its middle
    signs = {}
    for name, cells in names.items():
        cells = [(int(cx), int(cy)) for cx, cy in cells if inside(int(cx), int(cy))]
        if not cells: continue
        cells.sort()
        mx, my = cells[len(cells) // 2]
        best = None
        for r in range(1, 6):
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    x, y = mx + dx, my + dy
                    if inside(x, y) and g[y][x] == "," and any(inside(x+a, y+b) and g[y+b][x+a] == "=" for a, b in ((1,0),(-1,0),(0,1),(0,-1))):
                        best = best or (x, y)
            if best: break
        if best:
            g[best[1]][best[0]] = "S"
            signs[name] = list(best)

    # the home street's row, for placing things on it
    hc = [(x + 0.5, mid) for x in range(0, W, 4)]
    rows = ["".join(r) for r in g]
    out = {"tiles": rows, "houses": houses, "signs": signs, "special": special, "street": mid,
           "homeStreet": {"name": HOME_STREET, "cells": [[round(x, 1), round(y, 1)] for x, y in hc]}}
    print("/* Generated by tools/osm_to_map.py from an OpenStreetMap export.")
    print("   Map data © OpenStreetMap contributors (ODbL). Don't edit by hand: re-run the tool. */")
    print("App.Adventure = App.Adventure || {};")
    print("App.Adventure.crescentMap = " + json.dumps(out, separators=(",", ":")) + ";")

if __name__ == "__main__":
    main(sys.argv[1])
