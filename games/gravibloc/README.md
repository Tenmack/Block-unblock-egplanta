# Gravibloc

Tilt the board and every block slides until it hits something. Touching blocks
of the same colour pop. Clear the board within the move limit.

- Endless levels, generated from a seed. A solver checks each one, so every
  level can be won and level N is the same for every player.
- Plain HTML5 (no engine, no build step), about 45 KB in total. Works on
  phones (swipe) and desktop (arrow keys or WASD; Z undoes, R restarts).
- Progress, coins and themes are saved in the browser.

## Money

| Where | What it is |
|---|---|
| Rewarded ad | +3 moves when out of moves, a free hint, double coins after a level, +25 coins in the shop |
| Interstitial ad | Before levels 4, 7, 10 and so on, at most once every 2 minutes |
| Shop | Coins buy colour themes, which keeps players watching rewarded ads |

The ad code is in `ads.js`. It supports the CrazyGames, Poki and
GameDistribution SDKs. If an SDK is blocked, the game runs without ads.

## Building the upload files

```bash
./build.sh                  # dist/gravibloc-{itch,crazygames,poki,gamedistribution}.zip
GD_ID=<game id> ./build.sh  # GameDistribution needs its game id built in
```

Upload the matching zip to each portal. itch.io gets the build without ads.

To try it locally, run `python3 -m http.server` in this folder and open
`http://localhost:8000/?portal=crazygames` (or `poki`, `gamedistribution`).
The GameDistribution SDK hangs when the page is opened straight from a file,
so use the local server.
