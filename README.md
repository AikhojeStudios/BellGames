# Play & Learn

Money, counting and number games for young kids. Plain HTML, CSS and JavaScript with no build step: open `index.html` in a browser, or host the folder on any static host (for example GitHub Pages).

## Games

| Game | What kids practise |
|---|---|
| **The Monier** | Counting US coins, then adding and taking away |
| **Number Path** | Filling in missing numbers, counting by 1, 2, 5 and 10 |
| **Feed the Snake** | Matching numbers, before/after, bigger/smaller, simple sums |
| **Snake Chase** | Steering a snake to eat numbers that fit a rule (even, odd, bigger than…) |
| **Going on an Adventure** | Exploring a little world and making critter friends by answering adding and taking-away questions |

Each game has Easy, Medium and Hard levels. Stars and the sound setting are saved in the browser.

## Files

```
index.html          page shell (home screen and level picker)
css/styles.css      all styles, grouped by section
js/core.js          shared helpers: sound, saved stars, keypad, celebrations, snake drawing
js/games/*.js       one file per game
js/games/adventure/ the adventure game: draw.js (pictures), world.js (maps, people, critters), adventure.js (engine)
js/app.js           builds the screens and routes clicks and keys
assets/coins/       coin pictures
```

## Adding a game

1. Create `js/games/yourgame.js` and call `App.Games.register({...})` with an `id`, `title`, `tagline`, `accent` (`gold`, `green`, `coral` or `sky`), `modes` (`easy`/`medium`/`hard`, each with a `label` and `tag`), and `art()`, `mount(ui)`, `start(mode)` and `stop()` functions. `onKey(e)` and `pause()` are optional.
2. Add a `<script>` tag for it in `index.html`, before `js/app.js`.

`mount(ui)` gets the game's screen: put your content in `ui.body` and call `ui.award()` when the child gets one right.

## Controls

- Number games: tap the keypad or type digits, then press Enter. Press `H` for help.
- Feed the Snake: tap an apple, or type its number.
- Snake Chase: arrow keys or WASD, swipe, tap the board, or use the on-screen arrows. Press Space to pause.
- Esc goes back to the level picker.

## Going on an Adventure

Home base is Crescent Drive: Our House and Gram's House face each other across the street, and Forbes Bay is to the east. Walk around the neighborhood, ride your bike, swim in the bay and the creek (sea critters live there), go fishing with Uncle Pat at the dock once you answer his math question, talk to people, read signs, and meet critters in the tall grass (every yard is tall grass). Answer 3 questions right to make a critter your friend; 3 wrong answers and it wanders off. Friends are kept in the Critter Book (the ☰ button). Progress is saved in the browser.

- **Pictures** (`js/games/adventure/draw.js`): every picture is either one of your hand-drawn PNGs or a placeholder doodle drawn in code. Add your drawings one at a time; anything not drawn yet keeps its placeholder.
- **Maps, people, critters, questions** (`js/games/adventure/world.js`): maps are one character per tile, using the `TILES` key at the top of the file. Each map lists its `warps` (doors), `people` (where they stand, what they say, whether they wander), `signs`, and which `critters` live in its tall grass.
- **Engine** (`js/games/adventure/adventure.js`): walking, talking, menus, meeting critters, the Critter Book and saving.

### Adding hand-drawn art

Save drawings as PNG with a transparent background in `assets/adventure/`, then list them in `A.assets` at the top of `draw.js`:

- **People**: one sheet per person, a grid of equal-sized frames. Each row is a direction (down, up, left; right is mirrored from left). Column 0 is standing; `walk` lists the walking frames in order. Keep the feet on the same line in every frame.
- **Critters**: the main picture, plus optional eyes-closed (`blink`) and `happy` versions. The game adds bobbing, blinking, hopping and shaking.
- **Ground tiles**: square pictures by map letter. Give a list to vary them so the ground doesn't look repeated.
- **Objects** (trees, signs, furniture): by map letter, with a size in tiles. The bottom of the picture sits on its tile.

Controls: drag the joystick to walk, A to talk and choose, B to go back, ☰ for the menu. On a keyboard: arrows or WASD walk, Z / Space / Enter is A, X / Backspace is B, Shift or M opens the menu.

The Crescent Drive street layout is traced from OpenStreetMap (© OpenStreetMap contributors, ODbL); house positions are placed on typical lots. The credit also appears in the game's menu.
