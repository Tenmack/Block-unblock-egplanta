/*
 * Gravibloc: tilt the board, every block slides until it hits something,
 * touching blocks of the same colour pop. Clear the board within the moves.
 *
 * Levels are generated from a seed and checked by a breadth-first solver,
 * so every level is winnable and level N is the same for every player.
 */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);

  // ---------------------------------------------------------------- storage
  const SAVE_KEY = 'gravibloc.v1';
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
  const save = Object.assign({ level: 1, coins: 0, muted: false, theme: 'candy', owned: ['candy'], stars: {} }, loadSave());
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }

  // ---------------------------------------------------------------- themes
  const THEMES = {
    candy:  { name: 'Candy',  price: 0,   colors: ['#ff5d73', '#ffb627', '#3ecf8e', '#4ea8ff', '#b980ff'] },
    pastel: { name: 'Pastel', price: 100, colors: ['#ffadc6', '#ffe08a', '#a8e6b8', '#9fd3ff', '#d4b8ff'] },
    neon:   { name: 'Neon',   price: 150, colors: ['#ff2bd6', '#00e5ff', '#b4ff00', '#ffe600', '#ff7a00'] },
    ocean:  { name: 'Ocean',  price: 250, colors: ['#ff7f6e', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'] },
  };
  const HINT_COST = 10;
  const AD_COINS = 25;

  // ---------------------------------------------------------------- rules
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIR_LIST = ['up', 'right', 'down', 'left'];

  // Slide every block in a direction until it hits a wall, the edge or another block.
  function slide(grid, walls, w, h, dx, dy) {
    const out = new Int32Array(w * h);
    let moved = false;
    if (dx !== 0) {
      const start = dx > 0 ? w - 1 : 0, step = dx > 0 ? -1 : 1;
      for (let y = 0; y < h; y++) {
        let target = start;
        for (let x = start; x >= 0 && x < w; x += step) {
          const i = y * w + x;
          if (walls[i]) { target = x + step; continue; }
          const v = grid[i];
          if (v) { const t = y * w + target; out[t] = v; if (t !== i) moved = true; target += step; }
        }
      }
    } else {
      const start = dy > 0 ? h - 1 : 0, step = dy > 0 ? -1 : 1;
      for (let x = 0; x < w; x++) {
        let target = start;
        for (let y = start; y >= 0 && y < h; y += step) {
          const i = y * w + x;
          if (walls[i]) { target = y + step; continue; }
          const v = grid[i];
          if (v) { const t = target * w + x; out[t] = v; if (t !== i) moved = true; target += step; }
        }
      }
    }
    return { out, moved };
  }

  // Remove every group of 2+ touching same-colour blocks. Mutates grid, returns [pos, value] pairs.
  function popGroups(grid, w, h, colorOf) {
    const n = w * h, seen = new Uint8Array(n), popped = [], stack = [];
    for (let i = 0; i < n; i++) {
      if (!grid[i] || seen[i]) continue;
      const c = colorOf(grid[i]), comp = [];
      seen[i] = 1; stack.push(i);
      while (stack.length) {
        const j = stack.pop(); comp.push(j);
        const x = j % w, y = (j / w) | 0;
        const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
        for (const k of nb) {
          if (k >= 0 && grid[k] && !seen[k] && colorOf(grid[k]) === c) { seen[k] = 1; stack.push(k); }
        }
      }
      if (comp.length >= 2) for (const j of comp) popped.push([j, grid[j]]);
    }
    for (const [j] of popped) grid[j] = 0;
    return popped;
  }

  const ident = (v) => v;
  function isEmpty(g) { for (let i = 0; i < g.length; i++) if (g[i]) return false; return true; }
  // A colour with exactly one block left can never pop.
  function hasLoner(g, colorOf) {
    const cnt = new Int32Array(16);
    for (let i = 0; i < g.length; i++) if (g[i]) cnt[colorOf(g[i])]++;
    for (let c = 0; c < 16; c++) if (cnt[c] === 1) return true;
    return false;
  }

  // Shortest solution by breadth-first search over colour grids. null = none found within limits.
  function solve(grid0, walls, w, h, maxDepth, maxNodes) {
    if (isEmpty(grid0)) return [];
    const key = (g) => String.fromCharCode.apply(null, g);
    const seen = new Set([key(grid0)]);
    let frontier = [{ g: grid0, path: [] }], nodes = 0;
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next = [];
      for (const node of frontier) {
        for (const d of DIR_LIST) {
          const [dx, dy] = DIRS[d];
          const { out, moved } = slide(node.g, walls, w, h, dx, dy);
          if (!moved) continue;
          popGroups(out, w, h, ident);
          const path = node.path.concat(d);
          if (isEmpty(out)) return path;
          if (hasLoner(out, ident)) continue;
          const k = key(out);
          if (seen.has(k)) continue;
          seen.add(k);
          if (++nodes > maxNodes) return null;
          next.push({ g: out, path });
        }
      }
      frontier = next;
    }
    return null;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const levelCache = new Map();
  function genLevel(n) {
    if (levelCache.has(n)) return levelCache.get(n);
    const rand = mulberry32((Math.imul(n, 2654435761) ^ 0x9e3779b9) >>> 0);
    const size = n <= 6 ? 5 : n <= 24 ? 6 : 7;
    let nColors = Math.min(5, 2 + Math.floor((n - 1) / 6));
    const target = Math.min(10, 1 + Math.round(Math.sqrt(n) * 1.5));
    let best = null;
    for (let attempt = 0; attempt < 120 && !(best && best.score === 0); attempt++) {
      if (attempt > 0 && attempt % 40 === 0 && nColors > 2) nColors--; // soften if it is hard to find one
      const w = size, h = size, cells = w * h;
      const walls = new Uint8Array(cells);
      const nWalls = Math.floor(cells * (0.1 + rand() * 0.12));
      const order = [...Array(cells).keys()];
      for (let i = cells - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      let p = 0;
      for (; p < nWalls; p++) walls[order[p]] = 1;
      const grid = new Int32Array(cells);
      for (let c = 1; c <= nColors; c++) {
        const per = n >= 10 && rand() < 0.4 ? 3 : 2;
        for (let k = 0; k < per; k++) grid[order[p++]] = c;
      }
      // No free pops at the start.
      const probe = grid.slice();
      if (popGroups(probe, w, h, ident).length) continue;
      const sol = solve(grid, walls, w, h, target + 3, 9000);
      if (!sol || sol.length < Math.min(2, target)) continue;
      const score = Math.abs(sol.length - target);
      if (!best || score < best.score) best = { w, h, walls, grid, sol, score };
    }
    if (!best) { const fallback = genLevel(n + 100000); levelCache.set(n, fallback); return fallback; }
    const slack = n <= 8 ? 3 : n <= 30 ? 2 : 1;
    const level = { n, w: best.w, h: best.h, walls: best.walls, start: best.grid, par: best.sol.length, moves: best.sol.length + slack };
    levelCache.set(n, level);
    return level;
  }

  // ---------------------------------------------------------------- audio
  const Sfx = (() => {
    let ctx = null, paused = false;
    function ensure() {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended' && !paused) ctx.resume();
      return ctx;
    }
    function tone(f, d, type = 'sine', vol = 0.15, bend = 1, delay = 0) {
      if (save.muted || paused) return;
      const c = ensure(); if (!c) return;
      const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + d);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
    }
    return {
      unlock: ensure,
      pause(p) { paused = p; if (ctx) { if (p) ctx.suspend(); else ctx.resume(); } },
      slide() { tone(200, 0.09, 'triangle', 0.07, 1.6); },
      pop(i) { tone(520 + i * 70, 0.14, 'sine', 0.16, 1.7); tone(1040 + i * 140, 0.08, 'triangle', 0.05, 1.2, 0.02); },
      bump() { tone(110, 0.07, 'square', 0.04, 0.8); },
      click() { tone(700, 0.04, 'square', 0.03); },
      coin() { tone(988, 0.07, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 1, 0.07); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, 1, i * 0.09)); },
      lose() { tone(330, 0.45, 'sawtooth', 0.05, 0.5); },
    };
  })();

  // ---------------------------------------------------------------- state
  let L = null;                 // current level definition
  let grid = null;              // Int32Array of block ids (0 = empty)
  let colorOfId = [0];          // id -> colour index (1-based)
  let movesLeft = 0, history = [], usedExtraMoves = false;
  let state = 'menu';           // menu | play | won | lost
  let anim = null, queued = null, hint = null, shake = null, look = [0, 0];
  const particles = [];
  const cid = (v) => colorOfId[v];

  function startLevel(n) {
    L = genLevel(n);
    grid = new Int32Array(L.w * L.h);
    colorOfId = [0];
    for (let i = 0; i < L.start.length; i++) {
      if (L.start[i]) { colorOfId.push(L.start[i]); grid[i] = colorOfId.length - 1; }
    }
    movesLeft = L.moves; history = []; usedExtraMoves = false;
    anim = null; queued = null; hint = null; look = [0, 0]; particles.length = 0;
    state = 'play';
    hideCard();
    updateHud();
  }

  function colorGrid() { const g = new Int32Array(grid.length); for (let i = 0; i < grid.length; i++) g[i] = grid[i] ? cid(grid[i]) : 0; return g; }

  function move(dir) {
    if (state !== 'play') return;
    if (anim) { queued = dir; return; }
    const [dx, dy] = DIRS[dir];
    const { out, moved } = slide(grid, L.walls, L.w, L.h, dx, dy);
    look = [dx, dy];
    if (!moved) { shake = { dx, dy, t0: performance.now() }; Sfx.bump(); return; }
    history.push({ grid: grid.slice(), moves: movesLeft });
    const popped = popGroups(out, L.w, L.h, cid);
    const from = new Map(), to = new Map();
    for (let i = 0; i < grid.length; i++) if (grid[i]) from.set(grid[i], i);
    for (let i = 0; i < out.length; i++) if (out[i]) to.set(out[i], i);
    for (const [pos, id] of popped) to.set(id, pos);
    grid = out; movesLeft--; hint = null;
    anim = { t0: performance.now(), slide: 130, pop: 220, from, to, popped: new Set(popped.map((p) => p[1])), popFired: false };
    Sfx.slide();
    updateHud();
  }

  function onAnimDone() {
    anim = null;
    if (isEmpty(grid)) return win();
    const g = colorGrid();
    if (hasLoner(g, ident)) return lose('lonely');
    if (movesLeft <= 0) return lose('moves');
    if (queued) { const q = queued; queued = null; move(q); }
  }

  function starsFor() { const extra = L.moves - movesLeft - L.par; return extra <= 0 ? 3 : extra === 1 ? 2 : 1; }

  function win() {
    state = 'won'; queued = null;
    const stars = usedExtraMoves ? 1 : starsFor();
    const reward = 5 + stars * 5;
    save.coins += reward;
    save.stars[L.n] = Math.max(save.stars[L.n] || 0, stars);
    if (save.level <= L.n) save.level = L.n + 1;
    persist();
    Sfx.win(); burstAll();
    Ads.gameplayStop();
    lastWin = { stars, reward };
    setTimeout(winCard, 450);
  }

  let lastWin = null;
  function winCard() {
    const { stars, reward } = lastWin;
    {
      showCard(`
        <h2>Level ${L.n} clear!</h2>
        <div class="stars">${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span></div>
        <p>+${reward} coins${stars < 3 ? ` · solve it in ${L.par} moves for 3 stars` : ''}</p>`,
        [
          { label: 'Next level', cls: 'green', onClick: nextLevel },
          ...(Ads.hasRewarded ? [{ label: `Double coins (ad)`, cls: 'alt', onClick: async (btn) => {
            btn.disabled = true;
            if (await Ads.rewarded()) { save.coins += reward; persist(); Sfx.coin(); updateHud(); btn.textContent = `+${reward} more!`; }
            else { btn.disabled = false; toast('Ad not available right now'); }
          } }] : []),
          { label: 'Replay', cls: 'alt', onClick: () => { startLevel(L.n); Ads.gameplayStart(); } },
        ]);
      updateHud();
    }
  }

  let lastMidgame = 0;
  async function nextLevel() {
    const n = L.n + 1;
    // Interstitial at a natural break: every 3rd level from level 4, at most once every 2 minutes.
    if (n >= 4 && n % 3 === 1 && Date.now() - lastMidgame > 120000) {
      lastMidgame = Date.now();
      await Ads.midgame();
    }
    startLevel(n);
    Ads.gameplayStart();
  }

  let lastLose = 'moves';
  function lose(reason) {
    state = 'lost'; queued = null; lastLose = reason;
    Sfx.lose();
    Ads.gameplayStop();
    setTimeout(loseCard, 350);
  }
  function loseCard() {
    const reason = lastLose;
    const msg = reason === 'lonely'
      ? 'A block is left with no partner of its colour, so it can never pop.'
      : 'You ran out of moves.';
    {
      showCard(`<h2>${reason === 'lonely' ? 'Stuck!' : 'Out of moves'}</h2><p>${msg}</p>`, [
        ...(reason === 'moves' && Ads.hasRewarded && !usedExtraMoves ? [{ label: '+3 moves (ad)', cls: 'green', onClick: async (btn) => {
          btn.disabled = true;
          if (await Ads.rewarded()) { usedExtraMoves = true; movesLeft += 3; state = 'play'; hideCard(); updateHud(); Ads.gameplayStart(); }
          else { btn.disabled = false; toast('Ad not available right now'); }
        } }] : []),
        { label: 'Undo last move', cls: reason === 'lonely' ? 'green' : 'alt', onClick: () => { undo(); Ads.gameplayStart(); } },
        { label: 'Try again', cls: 'alt', onClick: () => { startLevel(L.n); Ads.gameplayStart(); } },
      ]);
    }
  }

  function undo() {
    if (anim) return;
    if (!history.length) { toast('Nothing to undo'); return; }
    const prev = history.pop();
    grid = prev.grid; movesLeft = prev.moves; hint = null;
    state = 'play'; hideCard(); updateHud(); Sfx.click();
  }

  function findHint() {
    return solve(colorGrid(), L.walls, L.w, L.h, Math.max(1, movesLeft), 40000);
  }
  async function askHint() {
    if (state !== 'play' || anim) return;
    const sol = findHint();
    if (!sol || !sol.length) { toast('No win from here. Try Undo.'); return; }
    if (save.coins >= HINT_COST) {
      save.coins -= HINT_COST; persist(); updateHud();
      hint = { dir: sol[0], t0: performance.now() };
      return;
    }
    if (!Ads.hasRewarded) { toast(`Hints cost ${HINT_COST} coins. Clear levels to earn more.`); return; }
    Ads.gameplayStop();
    showCard(`<h2>Need a hint?</h2><p>Hints cost ${HINT_COST} coins. Watch a short ad to get one free.</p>`, [
      { label: 'Watch ad for hint', cls: 'green', onClick: async (btn) => {
        btn.disabled = true;
        const ok = await Ads.rewarded();
        hideCard(); Ads.gameplayStart();
        if (ok) hint = { dir: sol[0], t0: performance.now() }; else toast('Ad not available right now');
      } },
      { label: 'No thanks', cls: 'alt', onClick: () => { hideCard(); Ads.gameplayStart(); } },
    ]);
  }

  // ---------------------------------------------------------------- UI
  const card = $('#card'), overlay = $('#overlay');
  function showCard(html, buttons) {
    card.innerHTML = html + '<div class="btns"></div>';
    const box = card.querySelector('.btns');
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '');
      el.innerHTML = b.label;
      if (b.disabled) el.disabled = true;
      el.addEventListener('click', () => { Sfx.unlock(); Sfx.click(); b.onClick(el); });
      box.appendChild(el);
    }
    overlay.classList.remove('hidden');
  }
  function hideCard() { overlay.classList.add('hidden'); }

  let toastTimer = 0;
  function toast(text) {
    const t = $('#toast'); t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function updateHud() {
    if (L) $('#lvl').textContent = `Level ${L.n}`;
    $('#moves').textContent = movesLeft;
    $('#movesBox').classList.toggle('low', movesLeft <= 1 && state === 'play');
    $('#coins').textContent = save.coins;
    $('#hintTag').textContent = save.coins >= HINT_COST || !Ads.hasRewarded ? HINT_COST : 'AD';
    $('#btnMute').style.opacity = save.muted ? 0.5 : 1;
  }

  function swatches(theme) { return THEMES[theme].colors.map((c) => `<i style="background:${c}"></i>`).join(''); }

  function openShop() {
    const resumeTo = state;
    if (state === 'play') Ads.gameplayStop();
    const render = () => {
      const items = Object.entries(THEMES).map(([k, t]) => {
        const owned = save.owned.includes(k);
        const label = save.theme === k ? 'In use' : owned ? 'Use' : `<i class="coin"></i>${t.price}`;
        const dis = save.theme === k || (!owned && save.coins < t.price);
        return `<div class="theme"><b>${t.name}</b><div class="sw">${swatches(k)}</div>
          <button class="btn ${owned ? 'alt' : ''}" data-theme="${k}" ${dis ? 'disabled' : ''}>${label}</button></div>`;
      }).join('');
      showCard(`<h2>Shop</h2><p>You have <b style="color:var(--accent)">${save.coins}</b> coins.</p><div class="shop">${items}</div>`, [
        ...(Ads.hasRewarded ? [{ label: `<i class="coin"></i> +${AD_COINS} free (ad)`, cls: 'green', onClick: async (btn) => {
          btn.disabled = true;
          if (await Ads.rewarded()) { save.coins += AD_COINS; persist(); Sfx.coin(); updateHud(); }
          else toast('Ad not available right now');
          render();
        } }] : []),
        { label: 'Close', cls: 'alt', onClick: () => { hideCard(); if (resumeTo === 'play') Ads.gameplayStart(); else if (resumeTo === 'menu') showMenu(); else if (resumeTo === 'won') winCard(); else if (resumeTo === 'lost') loseCard(); } },
      ]);
      card.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.theme, t = THEMES[k];
        if (!save.owned.includes(k)) { if (save.coins < t.price) return; save.coins -= t.price; save.owned.push(k); Sfx.coin(); }
        else Sfx.click();
        save.theme = k; persist(); updateHud(); render();
      }));
    };
    render();
  }

  function showMenu() {
    state = 'menu';
    const lvl = save.level;
    showCard(`
      <h1>Gravibloc</h1>
      <div class="demo">${swatches(save.theme)}</div>
      <p>Swipe or use the arrow keys to tilt the board. Every block slides until it hits something.
      Touching blocks of the same colour pop. Clear the board before you run out of moves.</p>`,
      [
        { label: lvl > 1 ? `Continue · Level ${lvl}` : 'Play', cls: 'green', onClick: () => { startLevel(lvl); Ads.gameplayStart(); } },
        { label: '<i class="coin"></i> Shop', cls: 'alt', onClick: openShop },
        ...(lvl > 1 ? [{ label: 'Start from level 1', cls: 'alt', onClick: () => { startLevel(1); Ads.gameplayStart(); } }] : []),
      ]);
  }

  // ---------------------------------------------------------------- rendering
  const canvas = $('#board'), ctx = canvas.getContext('2d');
  let dpr = 1, cw = 0, ch = 0;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }
  window.addEventListener('resize', resize);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function drawBlock(cx, cy, s, color, scale, alpha, wob) {
    const z = s * scale;
    if (z <= 0.5) return;
    ctx.globalAlpha = alpha;
    const x = cx - z / 2, y = cy - z / 2, r = z * 0.3;
    rr(x, y + z * 0.07, z, z, r); ctx.fillStyle = shade(color, -0.35); ctx.fill();
    rr(x, y, z, z, r); ctx.fillStyle = color; ctx.fill();
    rr(x + z * 0.12, y + z * 0.08, z * 0.76, z * 0.3, z * 0.15); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
    // eyes
    const ex = z * 0.19, ey = cy - z * 0.02 + wob, er = z * 0.12, pr = z * 0.06;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.arc(cx + sx * ex, ey, er, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sx * ex + look[0] * er * 0.45, ey + look[1] * er * 0.45, pr, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1c33'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.6 + Math.random() * 0.4, t: 0, color, r: 2 + Math.random() * 4 });
    }
  }
  let layout = { bx: 0, by: 0, cs: 0 };
  function burstAll() {
    const { bx, by, cs } = layout;
    for (let i = 0; i < 24; i++) {
      const c = THEMES[save.theme].colors[i % 5];
      burst(bx + Math.random() * cs * L.w, by + Math.random() * cs * L.h, c, 3);
    }
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (L) drawBoard(now, dt);
    requestAnimationFrame(frame);
  }

  function drawBoard(now, dt) {
    const pad = 10;
    const cs = Math.floor(Math.min((cw - pad * 2 - 8) / L.w, (ch - pad * 2 - 8) / L.h, 84));
    const bw = cs * L.w, bh = cs * L.h;
    let bx = Math.round((cw - bw) / 2), by = Math.round((ch - bh) / 2);
    if (shake) {
      const t = (now - shake.t0) / 220;
      if (t >= 1) shake = null;
      else { const a = Math.sin(t * Math.PI * 3) * (1 - t) * 6; bx += shake.dx * a; by += shake.dy * a; }
    }
    layout = { bx, by, cs };
    const colors = THEMES[save.theme].colors;

    rr(bx - pad, by - pad + 6, bw + pad * 2, bh + pad * 2, 22); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
    rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 22); ctx.fillStyle = '#2f3263'; ctx.fill();
    for (let i = 0; i < L.w * L.h; i++) {
      const x = bx + (i % L.w) * cs, y = by + ((i / L.w) | 0) * cs;
      if (L.walls[i]) {
        rr(x + 2, y + 4, cs - 4, cs - 4, cs * 0.2); ctx.fillStyle = '#15162c'; ctx.fill();
        rr(x + 2, y + 2, cs - 4, cs - 4, cs * 0.2); ctx.fillStyle = '#4a4e8a'; ctx.fill();
        rr(x + cs * 0.22, y + cs * 0.22, cs * 0.56, cs * 0.56, cs * 0.12); ctx.fillStyle = '#5a5fa3'; ctx.fill();
      } else {
        rr(x + 3, y + 3, cs - 6, cs - 6, cs * 0.2); ctx.fillStyle = '#272a55'; ctx.fill();
      }
    }

    const s = cs * 0.84;
    const pos = (i) => [bx + (i % L.w) * cs + cs / 2, by + ((i / L.w) | 0) * cs + cs / 2];
    const idle = Math.sin(now / 400) * cs * 0.01;

    if (anim) {
      const t = now - anim.t0;
      const p = easeOut(Math.min(1, t / anim.slide));
      if (t >= anim.slide && !anim.popFired) {
        anim.popFired = true;
        let k = 0;
        for (const id of anim.popped) { const [x, y] = pos(anim.to.get(id)); burst(x, y, colors[cid(id) - 1]); }
        if (anim.popped.size) Sfx.pop(Math.min(6, anim.popped.size - 2 + k));
      }
      for (const [id, toI] of anim.to) {
        const [x0, y0] = pos(anim.from.get(id)), [x1, y1] = pos(toI);
        let scale = 1, alpha = 1;
        if (anim.popped.has(id) && t > anim.slide) {
          const q = Math.min(1, (t - anim.slide) / anim.pop);
          scale = q < 0.3 ? 1 + q * 0.6 : (1.18 * (1 - (q - 0.3) / 0.7)); alpha = 1 - q * 0.6;
        }
        drawBlock(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, s, colors[cid(id) - 1], scale, alpha, 0);
      }
      if (t >= anim.slide + (anim.popped.size ? anim.pop : 0)) onAnimDone();
    } else {
      for (let i = 0; i < grid.length; i++) {
        if (!grid[i]) continue;
        const [x, y] = pos(i);
        drawBlock(x, y, s, colors[cid(grid[i]) - 1], 1, 1, idle);
      }
    }

    // hint arrow
    if (hint) {
      const t = (now - hint.t0) / 1000;
      if (t > 2.4) hint = null;
      else {
        const [dx, dy] = DIRS[hint.dir];
        const cx = bx + bw / 2 + dx * Math.sin(t * 6) * 8, cy = by + bh / 2 + dy * Math.sin(t * 6) * 8;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(dy, dx));
        ctx.globalAlpha = Math.min(1, t * 4) * (t > 2 ? (2.4 - t) / 0.4 : 1);
        const a = Math.min(bw, bh) * 0.22;
        ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(-a * 0.2, -a * 0.75); ctx.lineTo(-a * 0.2, -a * 0.3);
        ctx.lineTo(-a, -a * 0.3); ctx.lineTo(-a, a * 0.3); ctx.lineTo(-a * 0.2, a * 0.3); ctx.lineTo(-a * 0.2, a * 0.75); ctx.closePath();
        ctx.fillStyle = '#ffb627'; ctx.strokeStyle = '#1b1c33'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
        ctx.restore();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.t += dt; if (q.t >= q.life) { particles.splice(i, 1); continue; }
      q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- input
  const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  window.addEventListener('keydown', (e) => {
    if (KEYS[e.key]) { e.preventDefault(); Sfx.unlock(); move(KEYS[e.key]); }
    else if ((e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') && state === 'play') undo();
    else if ((e.key === 'r' || e.key === 'R') && (state === 'play' || state === 'lost')) { startLevel(L.n); Ads.gameplayStart(); }
  });
  let touch = null;
  const stage = $('#stage');
  stage.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY }; Sfx.unlock(); });
  window.addEventListener('pointerup', (e) => {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y; touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  window.addEventListener('pointercancel', () => { touch = null; });
  // Stop the page from scrolling when the game runs inside a portal iframe.
  window.addEventListener('keydown', (e) => { if (e.key === ' ') e.preventDefault(); });

  $('#btnUndo').addEventListener('click', () => { if (state === 'play') undo(); });
  $('#btnRestart').addEventListener('click', () => { if (L && state !== 'menu') { Sfx.click(); startLevel(L.n); Ads.gameplayStart(); } });
  $('#btnHint').addEventListener('click', askHint);
  $('#btnShop').addEventListener('click', () => { Sfx.click(); openShop(); });
  $('#btnMute').addEventListener('click', () => { save.muted = !save.muted; persist(); updateHud(); if (!save.muted) Sfx.click(); });

  // Ads pause the game and its sound.
  let adPaused = false;
  Ads.onPause = () => { adPaused = true; Sfx.pause(true); };
  Ads.onResume = () => { if (adPaused) { adPaused = false; Sfx.pause(false); } };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (state === 'play') Ads.gameplayStop(); }
    else if (state === 'play' && overlay.classList.contains('hidden')) Ads.gameplayStart();
  });

  // ---------------------------------------------------------------- boot
  window.Gravibloc = { genLevel, solve, slide, popGroups, get state() { return state; }, get level() { return L; }, move };
  resize();
  requestAnimationFrame(frame);
  Ads.init().then(() => {
    genLevel(save.level); // warm the first level before the menu shows
    Ads.loadingDone();
    updateHud();
    showMenu();
  });
})();
