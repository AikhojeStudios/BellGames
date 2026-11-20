# Play & Learn

Money, counting and number games for young kids. Plain HTML, CSS and JavaScript with no build step: open `index.html` in a browser, or host the folder on any static host (for example GitHub Pages).

## Games

| Game | What kids practise |
|---|---|
| **The Monier** | Counting US coins, then adding and taking away |
| **Number Path** | Filling in missing numbers, counting by 1, 2, 5 and 10 |
| **Feed the Snake** | Matching numbers, before/after, bigger/smaller, simple sums |
| **Snake Chase** | Steering a snake to eat numbers that fit a rule (even, odd, bigger than…) |

Each game has Easy, Medium and Hard levels. Stars and the sound setting are saved in the browser.

## Files

```
index.html          page shell (home screen and level picker)
css/styles.css      all styles, grouped by section
js/core.js          shared helpers: sound, saved stars, keypad, celebrations, snake drawing
js/games/*.js       one file per game
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
