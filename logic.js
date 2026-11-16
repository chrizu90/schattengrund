/* Schattengrund – Spiellogik (ohne DOM, auch in Node testbar) */
(function (root) {
  "use strict";

  const W = 48, H = 32, MAXDEPTH = 10;
  const WALL = 0, FLOOR = 1, STAIRS = 2;
  const DIRS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];

  /* ---------- Zufall (seedbar, Zustand speicherbar) ---------- */
  function rnd(G) {
    G.rs = (G.rs + 0x6D2B79F5) >>> 0;
    let t = G.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (G, a, b) => a + Math.floor(rnd(G) * (b - a + 1));
  const pick = (G, arr) => arr[Math.floor(rnd(G) * arr.length)];
  const chance = (G, p) => rnd(G) < p;
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

  /* ---------- Daten ---------- */
  const CLASSES = {
    krieger: { name: "Krieger", hp: 32, atk: 4, def: 1, crit: 0.05, evade: 0.05, color: "#e8c46a", ability: "wirbel",
      desc: "Robust und geradeaus. Wirbelschlag trifft alle Gegner um dich herum." },
    schurke: { name: "Schurkin", hp: 24, atk: 3, def: 0, crit: 0.2, evade: 0.14, color: "#8fd18b", ability: "dolch",
      desc: "Flink, oft kritisch. Dolchwurf trifft den nächsten Gegner aus der Ferne." },
    magier: { name: "Magier", hp: 20, atk: 2, def: 0, crit: 0.05, evade: 0.05, color: "#8fb8ff", ability: "feuer",
      desc: "Zerbrechlich, aber stark. Feuerball verbrennt Ziel und Umgebung." }
  };
  const ABILITIES = {
    wirbel: { name: "Wirbelschlag", cd: 6 },
    dolch: { name: "Dolchwurf", cd: 4 },
    feuer: { name: "Feuerball", cd: 5 }
  };
  const MON = {
    ratte:     { n: "Ratte", g: "r", c: "#b8946c", hp: 4, atk: 2, def: 0, xp: 2, spd: 120, min: 1, max: 3, w: 10 },
    fledermaus:{ n: "Fledermaus", g: "b", c: "#a68cc4", hp: 3, atk: 2, def: 0, xp: 2, spd: 150, min: 1, max: 4, w: 7, erratic: true },
    goblin:    { n: "Goblin", g: "g", c: "#86bf6c", hp: 7, atk: 3, def: 1, xp: 4, spd: 100, min: 1, max: 5, w: 10 },
    schleim:   { n: "Schleim", g: "s", c: "#5fc9ad", hp: 11, atk: 2, def: 0, xp: 4, spd: 60, min: 2, max: 6, w: 6, split: true },
    schuetze:  { n: "Koboldschütze", g: "k", c: "#e0aa45", hp: 6, atk: 3, def: 0, xp: 5, spd: 100, min: 2, max: 7, w: 6, ranged: 5 },
    skelett:   { n: "Skelett", g: "z", c: "#ebe5d6", hp: 12, atk: 4, def: 2, xp: 7, spd: 100, min: 3, max: 8, w: 8 },
    ork:       { n: "Ork", g: "o", c: "#79a843", hp: 16, atk: 5, def: 2, xp: 10, spd: 100, min: 4, max: 9, w: 8 },
    schamane:  { n: "Schamane", g: "h", c: "#cf78dc", hp: 10, atk: 2, def: 1, xp: 9, spd: 100, min: 5, max: 10, w: 5, caster: 6 },
    geist:     { n: "Geist", g: "G", c: "#a6cbef", hp: 11, atk: 5, def: 0, xp: 10, spd: 100, min: 6, max: 10, w: 5, phase: true },
    oger:      { n: "Oger", g: "O", c: "#cc8552", hp: 30, atk: 8, def: 3, xp: 20, spd: 80, min: 7, max: 10, w: 4 },
    troll:     { n: "Troll", g: "T", c: "#62957a", hp: 26, atk: 7, def: 3, xp: 18, spd: 100, min: 8, max: 10, w: 4, regen: 1 },
    lich:      { n: "Lich", g: "L", c: "#ff6b6b", hp: 90, atk: 9, def: 4, xp: 100, spd: 100, min: 99, max: 99, w: 0, caster: 7, boss: true }
  };
  const ITEMS = {
    heiltrank:   { n: "Heiltrank", g: "!", c: "#ef6b6b", w: 10, minD: 1 },
    grosstrank:  { n: "Großer Heiltrank", g: "!", c: "#ff9d9d", w: 3, minD: 4 },
    kraft:       { n: "Trank der Stärke", g: "!", c: "#f0b54d", w: 2, minD: 2 },
    teleport:    { n: "Rolle der Versetzung", g: "?", c: "#94bdf0", w: 5, minD: 1 },
    feuer:       { n: "Rolle des Feuers", g: "?", c: "#ffa457", w: 4, minD: 2 },
    karte:       { n: "Rolle der Karte", g: "?", c: "#ddd6bb", w: 4, minD: 1 },
    waffe:       { n: "Waffe", g: ")", c: "#d6dde8", w: 6, minD: 1 },
    ruestung:    { n: "Rüstung", g: "[", c: "#aebbcc", w: 5, minD: 1 }
  };
  const WEAPON_NAMES = ["Kurzschwert", "Streitaxt", "Kriegshammer", "Runenklinge", "Drachenzahn"];
  const ARMOR_NAMES = ["Lederwams", "Kettenhemd", "Schuppenpanzer", "Plattenrüstung", "Mithrilhemd"];
  const PERKS = {
    zaeh:    { n: "Zähigkeit", d: "+8 maximale Lebenspunkte", apply: p => { p.maxHp += 8; p.hp += 8; } },
    kraft:   { n: "Kraft", d: "+1 Angriff", apply: p => { p.atk += 1; } },
    panzer:  { n: "Panzerhaut", d: "+1 Verteidigung", apply: p => { p.def += 1; } },
    praez:   { n: "Präzision", d: "+8 % kritische Treffer", apply: p => { p.crit += 0.08; } },
    raub:    { n: "Lebensraub", d: "Jeder Treffer heilt 1 LP", apply: p => { p.leech += 1; } },
    regen:   { n: "Regeneration", d: "Schnellere Heilung über Zeit", apply: p => { p.regen += 1; } },
    flink:   { n: "Ausweichen", d: "+6 % Ausweichen", apply: p => { p.evade += 0.06; } },
    fokus:   { n: "Fokus", d: "Fähigkeit lädt 1 Zug schneller", apply: p => { p.cdr += 1; } },
    dornen:  { n: "Dornen", d: "Angreifer erleiden 2 Schaden", apply: p => { p.thorns += 2; } },
    glueck:  { n: "Glück", d: "Gegner lassen öfter etwas fallen", apply: p => { p.luck += 1; } },
    sicht:   { n: "Weitsicht", d: "+2 Sichtweite", apply: p => { p.sight += 2; } },
    wucht:   { n: "Wucht", d: "+20 % Chance, Gegner zu betäuben", apply: p => { p.stun += 0.2; } },
    meister: { n: "Meisterschaft", d: "Fähigkeit macht 50 % mehr Schaden", apply: p => { p.power += 0.5; } }
  };

  /* ---------- Hilfen ---------- */
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const cheb = (a, b, c, d) => Math.max(Math.abs(a - c), Math.abs(b - d));
  function tile(G, x, y) { return inb(x, y) ? G.map[idx(x, y)] : WALL; }
  function passable(G, x, y) { const t = tile(G, x, y); return t === FLOOR || t === STAIRS; }
  function monAt(G, x, y) { for (const m of G.monsters) if (m.x === x && m.y === y) return m; return null; }
  function itemAt(G, x, y) { for (const it of G.items) if (it.x === x && it.y === y) return it; return null; }
  function msg(G, text, kind) { G.log.push({ t: text, k: kind || "", turn: G.turn }); if (G.log.length > 60) G.log.splice(0, G.log.length - 60); }
  function xpNext(lvl) { return 10 + (lvl - 1) * 12; }
  function weaponBonus(G) { return G.player.weapon ? G.player.weapon.bonus : 0; }
  function armorBonus(G) { return G.player.armor ? G.player.armor.bonus : 0; }

  function line(x0, y0, x1, y1) {
    const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    return pts;
  }
  function los(G, x0, y0, x1, y1) {
    const pts = line(x0, y0, x1, y1);
    for (let i = 1; i < pts.length - 1; i++) if (tile(G, pts[i][0], pts[i][1]) === WALL) return false;
    return true;
  }

  /* ---------- Dungeon ---------- */
  function generate(G) {
    const map = new Array(W * H).fill(WALL);
    const rooms = [];
    for (let tries = 0; tries < 120 && rooms.length < 11; tries++) {
      const w = ri(G, 4, 10), h = ri(G, 4, 7);
      const x = ri(G, 1, W - w - 2), y = ri(G, 1, H - h - 2);
      if (rooms.some(r => x - 1 <= r.x + r.w && x + w + 1 >= r.x && y - 1 <= r.y + r.h && y + h + 1 >= r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) map[idx(xx, yy)] = FLOOR;
    }
    const carve = (a, b) => {
      let x = a.cx, y = a.cy;
      const horizFirst = rnd(G) < 0.5;
      const stepX = () => { while (x !== b.cx) { map[idx(x, y)] = FLOOR; x += x < b.cx ? 1 : -1; } };
      const stepY = () => { while (y !== b.cy) { map[idx(x, y)] = FLOOR; y += y < b.cy ? 1 : -1; } };
      if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
      map[idx(x, y)] = FLOOR;
    };
    rooms.sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < rooms.length; i++) carve(rooms[i - 1], rooms[i]);
    for (let k = 0; k < 3; k++) { const a = pick(G, rooms), b = pick(G, rooms); if (a !== b) carve(a, b); }
    G.map = map;
    G.rooms = rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, cx: r.cx, cy: r.cy }));
    G.explored = new Array(W * H).fill(0);
    G.monsters = []; G.items = [];
    const start = pick(G, rooms);
    G.player.x = start.cx; G.player.y = start.cy;
    // weitester Raum per BFS
    const dist = bfs(G, start.cx, start.cy, false);
    let far = start, best = -1;
    for (const r of rooms) { const d = dist[idx(r.cx, r.cy)]; if (d > best && d < 1e9) { best = d; far = r; } }
    if (G.depth < MAXDEPTH) { map[idx(far.cx, far.cy)] = STAIRS; G.stairs = { x: far.cx, y: far.cy }; }
    else G.stairs = null;
    populate(G, start, far);
  }

  function randomFloorIn(G, r) {
    for (let t = 0; t < 30; t++) {
      const x = ri(G, r.x, r.x + r.w - 1), y = ri(G, r.y, r.y + r.h - 1);
      if (G.map[idx(x, y)] === FLOOR && !monAt(G, x, y) && !itemAt(G, x, y) && !(x === G.player.x && y === G.player.y)) return [x, y];
    }
    return null;
  }
  function randomFloorFar(G, minDist) {
    for (let t = 0; t < 400; t++) {
      const x = ri(G, 1, W - 2), y = ri(G, 1, H - 2);
      if (G.map[idx(x, y)] === FLOOR && !monAt(G, x, y) && cheb(x, y, G.player.x, G.player.y) >= minDist) return [x, y];
    }
    return null;
  }

  function makeMonster(G, type, x, y) {
    const d = MON[type];
    const scale = d.boss ? 1 : 1 + 0.1 * Math.max(0, G.depth - d.min);
    const hp = Math.round(d.hp * scale);
    return { type, x, y, hp, maxHp: hp, atk: d.atk + (scale > 1.25 ? 1 : 0), def: d.def, energy: 0, awake: false, stun: 0, tick: 0 };
  }
  function pickMonsterType(G) {
    const pool = Object.keys(MON).filter(k => MON[k].min <= G.depth && MON[k].max >= G.depth && MON[k].w > 0);
    let total = pool.reduce((s, k) => s + MON[k].w, 0), r = rnd(G) * total;
    for (const k of pool) { r -= MON[k].w; if (r <= 0) return k; }
    return pool[pool.length - 1];
  }
  function makeItem(G) {
    const pool = Object.keys(ITEMS).filter(k => ITEMS[k].minD <= G.depth);
    let total = pool.reduce((s, k) => s + ITEMS[k].w, 0), r = rnd(G) * total, type = pool[0];
    for (const k of pool) { r -= ITEMS[k].w; if (r <= 0) { type = k; break; } }
    const it = { type };
    if (type === "waffe" || type === "ruestung") {
      const b = Math.max(1, Math.min(8, ri(G, 1, 1 + Math.floor(G.depth / 2)) + (chance(G, 0.15) ? 1 : 0)));
      it.bonus = b;
      it.name = (type === "waffe" ? WEAPON_NAMES : ARMOR_NAMES)[Math.min(4, b - 1)] + " +" + b;
    }
    return it;
  }
  function populate(G, startRoom, farRoom) {
    const others = G.rooms.filter(r => r !== startRoom);
    const n = Math.round(4 + G.depth * 1.4 + ri(G, 0, 3));
    for (let i = 0; i < n && others.length; i++) {
      const p = randomFloorIn(G, pick(G, others)); if (!p) continue;
      G.monsters.push(makeMonster(G, pickMonsterType(G), p[0], p[1]));
    }
    if (G.depth === MAXDEPTH) {
      const p = randomFloorIn(G, farRoom) || [farRoom.cx, farRoom.cy];
      const boss = makeMonster(G, "lich", p[0], p[1]); G.monsters.push(boss);
    }
    const ni = 3 + ri(G, 0, 3);
    for (let i = 0; i < ni; i++) { const p = randomFloorIn(G, pick(G, G.rooms)); if (p) G.items.push({ x: p[0], y: p[1], it: makeItem(G) }); }
    const ng = 3 + ri(G, 0, 2);
    for (let i = 0; i < ng; i++) { const p = randomFloorIn(G, pick(G, G.rooms)); if (p) G.items.push({ x: p[0], y: p[1], it: { type: "gold", amt: ri(G, 3, 8) * G.depth } }); }
  }

  function bfs(G, sx, sy, ignoreMonsters) {
    const dist = new Array(W * H).fill(1e9);
    const q = [[sx, sy]]; dist[idx(sx, sy)] = 0; let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++]; const d = dist[idx(x, y)];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!passable(G, nx, ny) || dist[idx(nx, ny)] <= d + 1) continue;
        dist[idx(nx, ny)] = d + 1; q.push([nx, ny]);
      }
    }
    return dist;
  }

  /* ---------- Sicht ---------- */
  function computeFov(G) {
    const p = G.player, r = p.sight;
    const vis = new Uint8Array(W * H);
    vis[idx(p.x, p.y)] = 1;
    const targets = [];
    for (let i = -r; i <= r; i++) { targets.push([p.x + i, p.y - r], [p.x + i, p.y + r], [p.x - r, p.y + i], [p.x + r, p.y + i]); }
    for (const [tx, ty] of targets) {
      const pts = line(p.x, p.y, tx, ty);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = pts[i];
        if (!inb(x, y)) break;
        if ((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) > r * r + r) break;
        vis[idx(x, y)] = 1;
        if (G.map[idx(x, y)] === WALL) break;
      }
    }
    for (let i = 0; i < vis.length; i++) if (vis[i]) G.explored[i] = 1;
    G.visible = vis;
  }
  const isVisible = (G, x, y) => !!(G.visible && inb(x, y) && G.visible[idx(x, y)]);
  function visibleMonsters(G) { return G.monsters.filter(m => isVisible(G, m.x, m.y)); }

  /* ---------- Neues Spiel ---------- */
  function newGame(cls, seed, daily) {
    const c = CLASSES[cls] || CLASSES.krieger;
    const G = {
      v: 1, seed: seed >>> 0, rs: seed >>> 0, daily: !!daily, cls, depth: 1, turn: 0, kills: 0, gold: 0,
      over: false, won: false, log: [], pendingPerks: [], cooldown: 0, lastSpawn: 0, deathBy: "",
      player: {
        x: 0, y: 0, hp: c.hp, maxHp: c.hp, atk: c.atk, def: c.def, crit: c.crit, evade: c.evade,
        lvl: 1, xp: 0, leech: 0, regen: 0, cdr: 0, thorns: 0, luck: 0, sight: 7, stun: 0, power: 0,
        weapon: null, armor: null, inv: [], perks: []
      }
    };
    if (cls === "magier") G.player.inv.push({ type: "teleport" });
    G.player.inv.push({ type: "heiltrank" });
    generate(G);
    computeFov(G);
    msg(G, "Du steigst in den Schattengrund hinab. Ebene 1 von " + MAXDEPTH + ".", "info");
    return G;
  }
  function dailySeed(dateStr) { return hashStr("schattengrund-" + dateStr); }

  /* ---------- Kampf ---------- */
  function killMonster(G, m) {
    const d = MON[m.type];
    G.monsters = G.monsters.filter(x => x !== m);
    G.kills++;
    msg(G, d.n + " ist besiegt.", "good");
    gainXp(G, d.xp);
    if (d.boss) { G.over = true; G.won = true; msg(G, "Der Lich zerfällt zu Staub. Du hast den Schattengrund bezwungen!", "good"); return; }
    const p = G.player;
    if (!itemAt(G, m.x, m.y)) {
      if (chance(G, 0.1 + 0.05 * p.luck)) G.items.push({ x: m.x, y: m.y, it: makeItem(G) });
      else if (chance(G, 0.22 + 0.05 * p.luck)) G.items.push({ x: m.x, y: m.y, it: { type: "gold", amt: ri(G, 2, 6) * G.depth } });
    }
  }
  function damageMonster(G, m, dmg) {
    m.hp -= dmg;
    const d = MON[m.type];
    if (m.hp <= 0) { killMonster(G, m); return; }
    m.awake = true;
    if (d.split && m.hp >= 4 && chance(G, 0.45)) {
      for (const [dx, dy] of DIRS) {
        const nx = m.x + dx, ny = m.y + dy;
        if (passable(G, nx, ny) && !monAt(G, nx, ny) && !(nx === G.player.x && ny === G.player.y)) {
          const half = Math.floor(m.hp / 2); m.hp -= half;
          const child = makeMonster(G, "schleim", nx, ny); child.hp = half; child.maxHp = half; child.awake = true;
          G.monsters.push(child); msg(G, "Der Schleim teilt sich!", "warn"); break;
        }
      }
    }
  }
  function playerHit(G, m, mult, sure) {
    const p = G.player, d = MON[m.type];
    if (!sure && !chance(G, 0.88)) { msg(G, "Du verfehlst " + art(d) + ".", ""); return; }
    let dmg = Math.max(1, p.atk + weaponBonus(G) + ri(G, -1, 2) - m.def);
    dmg = Math.max(1, Math.round(dmg * (mult || 1)));
    const crit = chance(G, p.crit);
    if (crit) dmg *= 2;
    msg(G, (crit ? "Kritisch! " : "") + "Du triffst " + art(d) + " (" + dmg + ").", crit ? "good" : "");
    if (p.leech) p.hp = Math.min(p.maxHp, p.hp + p.leech);
    if (p.stun && chance(G, p.stun) && !d.boss) m.stun = 1;
    damageMonster(G, m, dmg);
  }
  function art(d) { return "den " + d.n; }
  function hurtPlayer(G, dmg, by) {
    const p = G.player;
    p.hp -= dmg;
    if (p.hp <= 0) { p.hp = 0; G.over = true; G.won = false; G.deathBy = by; msg(G, "Du bist gefallen. " + by + " war stärker.", "bad"); }
  }
  function monsterMelee(G, m) {
    const p = G.player, d = MON[m.type];
    if (chance(G, Math.min(0.6, p.evade))) { msg(G, "Du weichst " + d.n + " aus.", ""); return; }
    const dmg = Math.max(1, m.atk + ri(G, -1, 1) - (p.def + armorBonus(G)));
    msg(G, d.n + " trifft dich (" + dmg + ").", "bad");
    hurtPlayer(G, dmg, d.n);
    if (p.thorns && !G.over) { msg(G, "Dornen verletzen " + d.n + ".", ""); damageMonster(G, m, p.thorns); }
  }
  function monsterRanged(G, m, base, verb) {
    const p = G.player, d = MON[m.type];
    if (chance(G, Math.min(0.6, p.evade + 0.1))) { msg(G, d.n + " " + verb + ", verfehlt aber.", ""); return; }
    const dmg = Math.max(1, base + ri(G, -1, 1) - Math.floor((p.def + armorBonus(G)) / 2));
    msg(G, d.n + " " + verb + " (" + dmg + ").", "bad");
    hurtPlayer(G, dmg, d.n);
  }
  function gainXp(G, n) {
    const p = G.player; p.xp += n;
    while (p.xp >= xpNext(p.lvl)) {
      p.xp -= xpNext(p.lvl); p.lvl++;
      p.maxHp += 3; p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.3));
      const ids = Object.keys(PERKS), choice = [];
      while (choice.length < 3) { const k = pick(G, ids); if (!choice.includes(k)) choice.push(k); }
      G.pendingPerks.push(choice);
      msg(G, "Stufe " + p.lvl + " erreicht! Wähle eine Gabe.", "good");
    }
  }
  function choosePerk(G, id) {
    const ch = G.pendingPerks[0];
    if (!ch || !ch.includes(id)) return false;
    PERKS[id].apply(G.player); G.player.perks.push(id); G.pendingPerks.shift();
    msg(G, "Gabe erhalten: " + PERKS[id].n + ".", "good");
    return true;
  }

  /* ---------- Spieleraktionen ---------- */
  function canAct(G) { return !G.over && G.pendingPerks.length === 0; }

  function move(G, dx, dy) {
    if (!canAct(G)) return false;
    const p = G.player, nx = p.x + dx, ny = p.y + dy;
    const m = monAt(G, nx, ny);
    if (m) { playerHit(G, m, 1, false); return endTurn(G); }
    if (!passable(G, nx, ny)) return false;
    p.x = nx; p.y = ny;
    pickup(G);
    if (tile(G, nx, ny) === STAIRS) msg(G, "Eine Treppe führt tiefer hinab.", "info");
    return endTurn(G);
  }
  function wait(G) { if (!canAct(G)) return false; return endTurn(G); }

  function pickup(G) {
    const p = G.player, f = itemAt(G, p.x, p.y);
    if (!f) return;
    if (f.it.type === "gold") { G.gold += f.it.amt; msg(G, f.it.amt + " Gold aufgesammelt.", "gold"); G.items = G.items.filter(x => x !== f); return; }
    if (p.inv.length >= 10) { msg(G, "Deine Taschen sind voll.", "warn"); return; }
    p.inv.push(f.it); G.items = G.items.filter(x => x !== f);
    msg(G, itemName(f.it) + " aufgehoben.", "info");
  }
  function itemName(it) { if (it.name) return it.name; return it.type === "gold" ? "Gold" : ITEMS[it.type].n; }

  function descend(G) {
    if (!canAct(G)) return false;
    const p = G.player;
    if (tile(G, p.x, p.y) !== STAIRS) { msg(G, "Hier ist keine Treppe.", ""); return false; }
    G.depth++;
    generate(G);
    computeFov(G);
    G.lastSpawn = G.turn;
    msg(G, G.depth === MAXDEPTH ? "Ebene " + MAXDEPTH + ". Kälte kriecht dir entgegen. Irgendwo wartet der Lich." : "Ebene " + G.depth + " von " + MAXDEPTH + ".", "info");
    return true;
  }

  function nearestVisible(G, maxR) {
    const p = G.player; let best = null, bd = 1e9;
    for (const m of visibleMonsters(G)) {
      const d = cheb(p.x, p.y, m.x, m.y);
      if (d <= maxR && d < bd && los(G, p.x, p.y, m.x, m.y)) { bd = d; best = m; }
    }
    return best;
  }
  function useAbility(G) {
    if (!canAct(G)) return false;
    const p = G.player, ab = CLASSES[G.cls].ability;
    if (G.cooldown > 0) { msg(G, ABILITIES[ab].name + " ist erst in " + G.cooldown + " Zügen bereit.", ""); return false; }
    const pw = 1 + p.power;
    if (ab === "wirbel") {
      const adj = G.monsters.filter(m => cheb(p.x, p.y, m.x, m.y) === 1);
      if (!adj.length) { msg(G, "Kein Gegner in Reichweite.", ""); return false; }
      msg(G, "Wirbelschlag!", "good");
      for (const m of adj) if (G.monsters.includes(m)) playerHit(G, m, 1.2 * pw, true);
    } else if (ab === "dolch") {
      const t = nearestVisible(G, 7);
      if (!t) { msg(G, "Kein Ziel in Sicht.", ""); return false; }
      msg(G, "Du wirfst einen Dolch.", "good");
      playerHit(G, t, 1.6 * pw, true);
    } else if (ab === "feuer") {
      const t = nearestVisible(G, 8);
      if (!t) { msg(G, "Kein Ziel in Sicht.", ""); return false; }
      const base = Math.round((6 + p.lvl * 2) * pw);
      msg(G, "Feuerball auf " + MON[t.type].n + "!", "good");
      const splash = G.monsters.filter(m => m !== t && cheb(m.x, m.y, t.x, t.y) === 1);
      const dmg = Math.max(1, base - Math.floor(t.def / 2));
      msg(G, MON[t.type].n + " brennt (" + dmg + ").", "");
      damageMonster(G, t, dmg);
      for (const m of splash) if (G.monsters.includes(m)) { const sd = Math.max(1, Math.round(base / 2)); msg(G, MON[m.type].n + " wird erfasst (" + sd + ").", ""); damageMonster(G, m, sd); }
    }
    G.cooldown = Math.max(1, ABILITIES[ab].cd - p.cdr);
    return endTurn(G, true);
  }

  function useItem(G, i) {
    if (!canAct(G)) return false;
    const p = G.player, it = p.inv[i];
    if (!it) return false;
    const remove = () => p.inv.splice(i, 1);
    switch (it.type) {
      case "heiltrank": { const h = Math.round(p.maxHp * 0.35) + 4; p.hp = Math.min(p.maxHp, p.hp + h); msg(G, "Du trinkst den Heiltrank (+" + h + ").", "good"); remove(); break; }
      case "grosstrank": { const h = Math.round(p.maxHp * 0.75); p.hp = Math.min(p.maxHp, p.hp + h); msg(G, "Wärme durchströmt dich (+" + h + ").", "good"); remove(); break; }
      case "kraft": p.atk += 1; msg(G, "Du fühlst dich stärker. Angriff +1.", "good"); remove(); break;
      case "teleport": { const pos = randomFloorFar(G, 8); if (pos) { p.x = pos[0]; p.y = pos[1]; } msg(G, "Die Welt verschwimmt. Du stehst woanders.", "info"); remove(); break; }
      case "feuer": {
        const vm = visibleMonsters(G);
        if (!vm.length) { msg(G, "Kein Gegner in Sicht. Die Rolle bleibt verschlossen.", ""); return false; }
        msg(G, "Flammen fegen durch den Raum!", "good"); remove();
        const dmg = 8 + G.depth * 2;
        for (const m of vm) if (G.monsters.includes(m)) damageMonster(G, m, dmg);
        break;
      }
      case "karte":
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (G.map[idx(x, y)] !== WALL) { G.explored[idx(x, y)] = 1; for (const [dx, dy] of DIRS) if (inb(x + dx, y + dy)) G.explored[idx(x + dx, y + dy)] = 1; }
        }
        msg(G, "Die Karte der Ebene brennt sich in dein Gedächtnis.", "info"); remove(); break;
      case "waffe": { const old = p.weapon; p.weapon = it; remove(); if (old) p.inv.push(old); msg(G, it.name + " angelegt.", "info"); break; }
      case "ruestung": { const old = p.armor; p.armor = it; remove(); if (old) p.inv.push(old); msg(G, it.name + " angelegt.", "info"); break; }
      default: return false;
    }
    return endTurn(G);
  }
  function dropItem(G, i) {
    const p = G.player, it = p.inv[i];
    if (!it || !canAct(G)) return false;
    if (itemAt(G, p.x, p.y)) { msg(G, "Hier liegt schon etwas.", ""); return false; }
    p.inv.splice(i, 1); G.items.push({ x: p.x, y: p.y, it }); msg(G, itemName(it) + " abgelegt.", "");
    return endTurn(G);
  }

  /* ---------- Zugende & Monster ---------- */
  function endTurn(G, usedAbility) {
    const p = G.player;
    G.turn++;
    if (G.cooldown > 0 && !usedAbility) G.cooldown--;
    const every = Math.max(2, 10 - p.regen * 3);
    if (G.turn % every === 0 && p.hp < p.maxHp && !G.over) p.hp++;
    computeFov(G);
    if (!G.over) monstersAct(G);
    computeFov(G);
    if (!G.over && G.turn - G.lastSpawn > 90) {
      G.lastSpawn = G.turn;
      const pos = randomFloorFar(G, 12);
      if (pos) { const m = makeMonster(G, pickMonsterType(G), pos[0], pos[1]); m.awake = true; G.monsters.push(m); }
    }
    return true;
  }

  function stepToward(G, m, dist, away) {
    let best = null, bd = dist[idx(m.x, m.y)];
    const p = G.player;
    for (const [dx, dy] of DIRS) {
      const nx = m.x + dx, ny = m.y + dy;
      if (!passable(G, nx, ny) || monAt(G, nx, ny) || (nx === p.x && ny === p.y)) continue;
      const d = dist[idx(nx, ny)];
      if (away ? d > bd : d < bd) { bd = d; best = [nx, ny]; }
    }
    if (best) { m.x = best[0]; m.y = best[1]; return true; }
    return false;
  }
  function randomStep(G, m) {
    const d = pick(G, DIRS), nx = m.x + d[0], ny = m.y + d[1], p = G.player;
    if (passable(G, nx, ny) && !monAt(G, nx, ny) && !(nx === p.x && ny === p.y)) { m.x = nx; m.y = ny; }
  }

  function monsterTurn(G, m, dist) {
    const p = G.player, d = MON[m.type];
    if (m.stun > 0) { m.stun--; return; }
    if (d.regen && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + d.regen);
    const seen = isVisible(G, m.x, m.y);
    if (seen) m.awake = true;
    if (!m.awake) { if (chance(G, 0.3)) randomStep(G, m); return; }
    const dd = cheb(m.x, m.y, p.x, p.y);
    if (d.erratic && chance(G, 0.4)) { randomStep(G, m); return; }

    if (d.boss) {
      m.tick++;
      if (m.tick % 6 === 0) {
        let n = 0;
        for (const [dx, dy] of DIRS) {
          if (n >= 2) break;
          const nx = m.x + dx, ny = m.y + dy;
          if (passable(G, nx, ny) && !monAt(G, nx, ny) && !(nx === p.x && ny === p.y)) { const s = makeMonster(G, "skelett", nx, ny); s.awake = true; G.monsters.push(s); n++; }
        }
        if (n) { msg(G, "Der Lich ruft Skelette aus dem Boden!", "warn"); return; }
      }
    }
    if (d.caster && dd > 1 && dd <= d.caster && seen && los(G, m.x, m.y, p.x, p.y)) {
      if (!d.boss) {
        const hurt = G.monsters.find(o => o !== m && o.hp < o.maxHp * 0.6 && cheb(o.x, o.y, m.x, m.y) <= 5);
        if (hurt && chance(G, 0.4)) { hurt.hp = Math.min(hurt.maxHp, hurt.hp + 6); msg(G, "Der Schamane heilt " + MON[hurt.type].n + ".", "warn"); return; }
      }
      if (chance(G, 0.6)) { monsterRanged(G, m, d.boss ? 8 + 0 : 3 + Math.floor(G.depth / 2), d.boss ? "schleudert einen Todesblitz" : "wirft einen Blitz"); return; }
    }
    if (d.ranged && dd > 1 && dd <= d.ranged && seen && los(G, m.x, m.y, p.x, p.y)) {
      if (dd <= 2 && chance(G, 0.5) && stepToward(G, m, dist, true)) return;
      monsterRanged(G, m, m.atk, "schießt einen Pfeil"); return;
    }
    if (dd === 1) { monsterMelee(G, m); return; }
    if (d.phase) {
      const sx = Math.sign(p.x - m.x), sy = Math.sign(p.y - m.y), nx = m.x + sx, ny = m.y + sy;
      if (inb(nx, ny) && nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && !monAt(G, nx, ny) && !(nx === p.x && ny === p.y)) { m.x = nx; m.y = ny; }
      return;
    }
    if (!stepToward(G, m, dist, false)) { if (chance(G, 0.3)) randomStep(G, m); }
  }

  function monstersAct(G) {
    const dist = bfs(G, G.player.x, G.player.y, true);
    for (const m of G.monsters.slice()) {
      if (!G.monsters.includes(m)) continue;
      m.energy += MON[m.type].spd;
      let guard = 0;
      while (m.energy >= 100 && guard++ < 3) {
        m.energy -= 100;
        monsterTurn(G, m, dist);
        if (G.over || !G.monsters.includes(m)) break;
      }
      if (G.over) return;
    }
  }

  /* ---------- Pfad (für Antippen) ---------- */
  function pathTo(G, tx, ty) {
    if (!inb(tx, ty) || !G.explored[idx(tx, ty)] || !passable(G, tx, ty)) return null;
    const dist = new Array(W * H).fill(1e9), prev = new Array(W * H).fill(-1);
    const p = G.player; const q = [[p.x, p.y]]; dist[idx(p.x, p.y)] = 0; let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++];
      if (x === tx && y === ty) break;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny) || !G.explored[idx(nx, ny)] || !passable(G, nx, ny)) continue;
        if (dist[idx(nx, ny)] <= dist[idx(x, y)] + 1) continue;
        dist[idx(nx, ny)] = dist[idx(x, y)] + 1; prev[idx(nx, ny)] = idx(x, y); q.push([nx, ny]);
      }
    }
    if (dist[idx(tx, ty)] >= 1e9) return null;
    const path = []; let cur = idx(tx, ty);
    while (cur !== idx(p.x, p.y)) { path.push([cur % W, Math.floor(cur / W)]); cur = prev[cur]; if (cur < 0) return null; }
    return path.reverse();
  }

  function score(G) { return G.depth * 100 + G.gold + G.kills * 5 + G.player.lvl * 20 + (G.won ? 1000 : 0); }

  /* Funktionen in PERKS können nicht gespeichert werden; der Zustand enthält nur Daten */
  function serialize(G) { const c = Object.assign({}, G); delete c.visible; return JSON.stringify(c); }
  function deserialize(s) { const G = JSON.parse(s); if (!G || G.v !== 1) return null; computeFov(G); return G; }

  root.SG = {
    W, H, MAXDEPTH, WALL, FLOOR, STAIRS, CLASSES, ABILITIES, MON, ITEMS, PERKS,
    newGame, dailySeed, move, wait, descend, useAbility, useItem, dropItem, choosePerk, canAct,
    pathTo, isVisible, visibleMonsters, monAt, itemAt, itemName, tile, xpNext, weaponBonus, armorBonus,
    score, serialize, deserialize, bfs, idx
  };
})(typeof window !== "undefined" ? window : globalThis);
