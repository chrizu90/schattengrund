/* Schattengrund – Oberfläche, Darstellung, Steuerung */
(function () {
  "use strict";
  const SG = window.SG;
  const $ = id => document.getElementById(id);
  const cv = $("cv"), ctx = cv.getContext("2d");
  const SAVE_KEY = "schattengrund-save", SCORE_KEY = "schattengrund-scores", LAST_KEY = "schattengrund-last";
  let G = null, ts = 28, dpr = 1, vw = 0, vh = 0, walkTimer = null, lastHp = null, overlayMode = null;

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const FONT = '"Plex Mono", ui-monospace, Menlo, Consolas, monospace';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const ITEM_DESC = {
    heiltrank: "Heilt etwa ein Drittel deiner Lebenspunkte.",
    grosstrank: "Heilt drei Viertel deiner Lebenspunkte.",
    kraft: "Dauerhaft +1 Angriff.",
    teleport: "Versetzt dich an einen zufälligen Ort dieser Ebene.",
    feuer: "Verbrennt alle Gegner in Sicht.",
    karte: "Enthüllt den Grundriss der ganzen Ebene."
  };

  /* ---------- Darstellung ---------- */
  function resize() {
    const r = $("stage").getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + "px"; cv.style.height = vh + "px";
    ts = Math.max(20, Math.min(36, Math.floor(Math.min(vw / 15, vh / 11))));
    render();
  }
  function camera() {
    const cols = vw / ts, rows = vh / ts, p = G.player;
    let cx = p.x + 0.5 - cols / 2, cy = p.y + 0.5 - rows / 2;
    cx = SG.W <= cols ? (SG.W - cols) / 2 : Math.max(0, Math.min(SG.W - cols, cx));
    cy = SG.H <= rows ? (SG.H - rows) / 2 : Math.max(0, Math.min(SG.H - rows, cy));
    return { cx, cy, cols, rows };
  }
  function glyph(g, color, px, py, scale) {
    ctx.font = "700 " + Math.round(ts * (scale || 0.78)) + "px " + FONT;
    ctx.fillStyle = color;
    ctx.fillText(g, px + ts / 2, py + ts / 2 + ts * 0.04);
  }
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0c10"; ctx.fillRect(0, 0, vw, vh);
    if (!G) return;
    const { cx, cy, cols, rows } = camera();
    const x0 = Math.max(0, Math.floor(cx)), x1 = Math.min(SG.W - 1, Math.ceil(cx + cols));
    const y0 = Math.max(0, Math.floor(cy)), y1 = Math.min(SG.H - 1, Math.ceil(cy + rows));
    const P = (x, y) => [Math.round((x - cx) * ts), Math.round((y - cy) * ts)];
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = SG.idx(x, y);
      if (!G.explored[i]) continue;
      const vis = G.visible[i], t = G.map[i], [px, py] = P(x, y);
      if (t === SG.WALL) {
        ctx.fillStyle = vis ? "#3e4352" : "#20232b"; ctx.fillRect(px, py, ts, ts);
        if (SG.tile(G, x, y + 1) !== SG.WALL) { ctx.fillStyle = vis ? "#2a2e3a" : "#17191f"; ctx.fillRect(px, py + Math.round(ts * 0.7), ts, ts - Math.round(ts * 0.7)); }
        if (vis && SG.tile(G, x, y - 1) !== SG.WALL) { ctx.fillStyle = "#4f5568"; ctx.fillRect(px, py, ts, 2); }
      } else {
        ctx.fillStyle = vis ? "#171a21" : "#0f1115"; ctx.fillRect(px, py, ts, ts);
        if (t === SG.STAIRS) glyph(">", vis ? "#ffd76a" : "#6b5c33", px, py, 0.85);
        else { ctx.fillStyle = vis ? "#363b49" : "#1d2028"; const s = Math.max(2, Math.round(ts * 0.09)); ctx.fillRect(px + (ts - s) / 2, py + (ts - s) / 2, s, s); }
      }
    }
    // Licht
    const p = G.player, [ppx, ppy] = P(p.x, p.y);
    const grd = ctx.createRadialGradient(ppx + ts / 2, ppy + ts / 2, ts * 1.5, ppx + ts / 2, ppy + ts / 2, ts * (p.sight + 1));
    grd.addColorStop(0, "rgba(255,200,120,0.06)"); grd.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, vw, vh);
    ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 4;
    for (const f of G.items) {
      if (!SG.isVisible(G, f.x, f.y)) continue;
      const [px, py] = P(f.x, f.y);
      if (f.it.type === "gold") glyph("$", "#e8c46a", px, py, 0.72);
      else { const d = SG.ITEMS[f.it.type]; glyph(d.g, d.c, px, py, 0.8); }
    }
    for (const m of G.monsters) {
      if (!SG.isVisible(G, m.x, m.y)) continue;
      const d = SG.MON[m.type], [px, py] = P(m.x, m.y);
      if (d.boss) { ctx.fillStyle = "rgba(255,80,80,0.14)"; ctx.beginPath(); ctx.arc(px + ts / 2, py + ts / 2, ts * 0.62, 0, 7); ctx.fill(); }
      glyph(d.g, d.c, px, py, d.boss ? 0.95 : 0.82);
      if (m.hp < m.maxHp) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000"; ctx.fillRect(px + 3, py + ts - 4, ts - 6, 3);
        ctx.fillStyle = "#e2645f"; ctx.fillRect(px + 3, py + ts - 4, Math.max(1, (ts - 6) * m.hp / m.maxHp), 3);
        ctx.shadowBlur = 4;
      }
      if (m.stun) glyph("*", "#ffd76a", px + ts * 0.3, py - ts * 0.3, 0.45);
    }
    ctx.fillStyle = "rgba(232,196,106,0.13)"; ctx.beginPath(); ctx.arc(ppx + ts / 2, ppy + ts / 2, ts * 0.6, 0, 7); ctx.fill();
    glyph("@", SG.CLASSES[G.cls].color, ppx, ppy, 0.88);
    ctx.shadowBlur = 0;
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    if (!G) return;
    const p = G.player, c = SG.CLASSES[G.cls], ab = SG.ABILITIES[c.ability];
    $("hName").textContent = c.name + " · Stufe " + p.lvl;
    $("hDepth").textContent = "Ebene " + G.depth + "/" + SG.MAXDEPTH;
    $("hGold").textContent = G.gold + " Gold";
    $("hpFill").style.width = (100 * p.hp / p.maxHp) + "%";
    $("hpText").textContent = p.hp + " / " + p.maxHp + " LP";
    $("xpFill").style.width = Math.min(100, 100 * p.xp / SG.xpNext(p.lvl)) + "%";
    $("abName").textContent = ab.name;
    $("abCd").textContent = G.cooldown > 0 ? "lädt: " + G.cooldown : "bereit";
    $("btnAbility").classList.toggle("ready", G.cooldown === 0);
    $("invCount").textContent = p.inv.length + "/10";
    const onStairs = SG.tile(G, p.x, p.y) === SG.STAIRS;
    $("btnStairs").disabled = !onStairs;
    $("btnStairs").classList.toggle("on", onStairs);
    $("stairsHint").textContent = onStairs ? "zur nächsten Ebene" : (G.depth === SG.MAXDEPTH ? "letzte Ebene" : "keine Treppe");
    const lines = G.log.slice(-4);
    $("log").innerHTML = lines.map(l => '<div class="' + (l.turn >= G.turn - 1 ? "now " : "") + esc(l.k) + '">' + esc(l.t) + "</div>").join("");
  }

  function afterAction() {
    if (!G) return;
    if (lastHp != null && G.player.hp < lastHp) {
      const st = $("stage"); st.classList.remove("hurt"); void st.offsetWidth; st.classList.add("hurt");
      setTimeout(() => st.classList.remove("hurt"), 200);
      try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) {}
    }
    lastHp = G.player.hp;
    render(); updateHud();
    if (G.over) { stopWalk(); finishRun(); return; }
    ls.set(SAVE_KEY, SG.serialize(G));
    if (G.pendingPerks.length) { stopWalk(); showPerks(); }
  }

  /* ---------- Eingabe ---------- */
  function act(fn) { if (!G || overlayMode) return false; const ok = fn(); if (ok) afterAction(); else updateHud(); return ok; }
  function doMove(dx, dy) { stopWalk(); if (dx === 0 && dy === 0) act(() => SG.wait(G)); else act(() => SG.move(G, dx, dy)); }
  function stopWalk() { if (walkTimer) { clearInterval(walkTimer); walkTimer = null; } }
  function autoWalk(path) {
    stopWalk();
    let i = 0;
    const seen0 = SG.visibleMonsters(G).length, hp0 = G.player.hp;
    walkTimer = setInterval(() => {
      if (!G || overlayMode || i >= path.length || !SG.canAct(G)) { stopWalk(); return; }
      const [nx, ny] = path[i++], p = G.player;
      if (Math.max(Math.abs(nx - p.x), Math.abs(ny - p.y)) !== 1 || SG.monAt(G, nx, ny)) { stopWalk(); return; }
      const ok = act(() => SG.move(G, nx - p.x, ny - p.y));
      if (!ok || !G || G.player.hp < hp0 || SG.visibleMonsters(G).length > seen0) stopWalk();
    }, 75);
  }
  function tapStage(ev) {
    if (!G || overlayMode) return;
    const r = cv.getBoundingClientRect(), { cx, cy } = camera();
    const tx = Math.floor((ev.clientX - r.left) / ts + cx), ty = Math.floor((ev.clientY - r.top) / ts + cy);
    const p = G.player, dx = tx - p.x, dy = ty - p.y;
    if (dx === 0 && dy === 0) { if (SG.tile(G, p.x, p.y) === SG.STAIRS) act(() => SG.descend(G)); else doMove(0, 0); return; }
    const m = SG.monAt(G, tx, ty);
    if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) { doMove(dx, dy); return; }
    if (m && SG.isVisible(G, tx, ty)) {
      const d = SG.MON[m.type];
      G.log.push({ t: d.n + ": " + m.hp + "/" + m.maxHp + " LP, Angriff " + m.atk + ", Rüstung " + m.def + ".", k: "info", turn: G.turn });
      updateHud(); return;
    }
    const path = SG.pathTo(G, tx, ty);
    if (path && path.length) autoWalk(path);
  }
  cv.addEventListener("pointerup", tapStage);
  $("pad").addEventListener("click", e => {
    const b = e.target.closest("button[data-d]"); if (!b) return;
    const [dx, dy] = b.dataset.d.split(",").map(Number); doMove(dx, dy);
  });
  $("btnAbility").addEventListener("click", () => { stopWalk(); act(() => SG.useAbility(G)); });
  $("btnStairs").addEventListener("click", () => { stopWalk(); act(() => SG.descend(G)); });
  $("btnInv").addEventListener("click", () => { stopWalk(); if (G) showInventory(); });
  $("btnMap").addEventListener("click", () => { stopWalk(); if (G) showMap(); });
  $("btnMenu").addEventListener("click", () => { stopWalk(); showTitle(); });

  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0],
    y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
    "7": [-1, -1], "8": [0, -1], "9": [1, -1], "4": [-1, 0], "6": [1, 0], "1": [-1, 1], "2": [0, 1], "3": [1, 1],
    "5": [0, 0], ".": [0, 0], " ": [0, 0]
  };
  document.addEventListener("keydown", e => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.key === "Escape") { if (overlayMode === "inv" || overlayMode === "map") { closeOverlay(); e.preventDefault(); } return; }
    if (overlayMode) return;
    if (!G) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYS[k]) { e.preventDefault(); doMove(KEYS[k][0], KEYS[k][1]); return; }
    if (k === "f") { e.preventDefault(); stopWalk(); act(() => SG.useAbility(G)); }
    else if (k === "i") { e.preventDefault(); showInventory(); }
    else if (k === "m") { e.preventDefault(); showMap(); }
    else if (k === ">" || k === "Enter") { e.preventDefault(); stopWalk(); act(() => SG.descend(G)); }
  });

  /* ---------- Overlays ---------- */
  function openOverlay(mode, html, cls) {
    overlayMode = mode;
    const panel = $("panel");
    panel.className = "panel" + (cls ? " " + cls : "");
    panel.innerHTML = html;
    $("overlay").hidden = false;
    $("overlay").scrollTop = 0;
    const f = panel.querySelector("button"); if (f && mode !== "title") f.focus({ preventScroll: true });
  }
  function closeOverlay() { $("overlay").hidden = true; overlayMode = null; if (G) { render(); updateHud(); if (G.pendingPerks.length) showPerks(); } }
  $("overlay").addEventListener("click", e => {
    if (e.target === $("overlay") && (overlayMode === "inv" || overlayMode === "map" || overlayMode === "scores" || overlayMode === "help")) {
      if (overlayMode === "scores" || overlayMode === "help") showTitle(); else closeOverlay();
    }
  });

  function showTitle() {
    const save = ls.get(SAVE_KEY);
    let resume = "";
    if (save) { try { const s = JSON.parse(save); if (s && !s.over) resume = '<button class="btn primary wide" data-a="resume">Weiterspielen <small style="font-weight:400">· ' + esc(SG.CLASSES[s.cls].name) + ", Ebene " + s.depth + "</small></button>"; } catch (e) {} }
    openOverlay("title",
      '<div class="glyphline">· · <em>@</em> · · g · ></div>' +
      "<h1>Schattengrund</h1>" +
      '<p class="sub">Zehn Ebenen. Drei Klassen. Jeder Abstieg ist anders.</p>' +
      '<div class="menu">' + resume +
      '<button class="btn ' + (resume ? "" : "primary ") + 'wide" data-a="new">Neuer Lauf</button>' +
      '<button class="btn wide" data-a="daily">Tageslauf · ' + esc(today()) + "</button>" +
      '<button class="btn wide" data-a="scores">Bestenliste</button>' +
      '<button class="btn wide" data-a="help">So spielst du</button>' +
      (G && !G.over && overlayMode !== null ? "" : "") +
      "</div>", "title-screen");
    $("panel").onclick = e => {
      const b = e.target.closest("button[data-a]"); if (!b) return;
      const a = b.dataset.a;
      if (a === "resume") { const s = ls.get(SAVE_KEY); const g = s && SG.deserialize(s); if (g) { G = g; lastHp = G.player.hp; closeOverlay(); } }
      else if (a === "new") showClassSelect(false);
      else if (a === "daily") showClassSelect(true);
      else if (a === "scores") showScores();
      else if (a === "help") showHelp();
    };
  }

  function showClassSelect(daily) {
    const cards = Object.keys(SG.CLASSES).map(k => {
      const c = SG.CLASSES[k];
      return '<button class="cls" data-c="' + k + '"><span class="g" style="color:' + c.color + '">@</span><b>' + esc(c.name) + "</b><span>" + esc(c.desc) + '</span><span class="st">' + c.hp + " LP · Angriff " + c.atk + " · Rüstung " + c.def + " · Krit " + Math.round(c.crit * 100) + " %</span></button>";
    }).join("");
    openOverlay("title",
      "<h2>" + (daily ? "Tageslauf" : "Wähle deine Klasse") + "</h2>" +
      (daily ? "<p>Heute bekommt jeder dieselbe Welt. Vergleich deine Punkte mit Freunden, die auch den Tageslauf spielen.</p>" : "") +
      '<div class="classes">' + cards + "</div>" +
      (daily ? "" : '<div class="seed-row"><input id="seedIn" inputmode="numeric" placeholder="Seed (optional, für dieselbe Welt)" aria-label="Seed"></div>') +
      '<button class="btn" data-a="back">Zurück</button>');
    $("panel").onclick = e => {
      if (e.target.closest('[data-a="back"]')) { showTitle(); return; }
      const b = e.target.closest("button[data-c]"); if (!b) return;
      let seed, isDaily = daily;
      if (daily) seed = SG.dailySeed(today());
      else {
        const v = ($("seedIn") && $("seedIn").value || "").replace(/\D/g, "");
        seed = v ? (parseInt(v.slice(0, 9), 10) >>> 0) : randomSeed();
      }
      startRun(b.dataset.c, seed, isDaily);
    };
  }
  function randomSeed() { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % 1000000000; } catch (e) { return Math.floor(Math.random() * 1e9); } }
  function startRun(cls, seed, daily) {
    G = SG.newGame(cls, seed, daily);
    G.dailyDate = daily ? today() : "";
    lastHp = G.player.hp;
    ls.set(LAST_KEY, JSON.stringify({ cls }));
    closeOverlay(); afterAction();
  }

  function showHelp() {
    openOverlay("help",
      "<h2>So spielst du</h2>" +
      '<ul class="help">' +
      "<li>Ziel: Steig zehn Ebenen hinab und besiege den Lich. Stirbst du, ist der Lauf vorbei.</li>" +
      "<li>Jede Aktion ist ein Zug. Danach handeln die Monster. Nimm dir Zeit.</li>" +
      "<li>Bewegen mit dem Steuerkreuz oder durch Antippen eines Feldes, dann läufst du automatisch dorthin. Läufst du in ein Monster, greifst du an.</li>" +
      "<li>Tippe auf ein entferntes Monster, um seine Werte zu sehen.</li>" +
      "<li>Deine Fähigkeit trifft automatisch das nächste Ziel und lädt danach einige Züge.</li>" +
      "<li>Mit jeder Stufe wählst du eine von drei Gaben. So wird jeder Lauf anders.</li>" +
      "<li>Auf der Treppe <b>&gt;</b> geht es mit „Hinab“ tiefer. Wer zu lange trödelt, lockt neue Monster an.</li>" +
      '<li>Tastatur: Pfeile, WASD oder Ziffernblock, <span class="kbd">F</span> Fähigkeit, <span class="kbd">I</span> Taschen, <span class="kbd">M</span> Karte, <span class="kbd">Enter</span> hinab, <span class="kbd">.</span> warten.</li>' +
      "</ul>" +
      '<button class="btn primary" data-a="back">Verstanden</button>');
    $("panel").onclick = e => { if (e.target.closest('[data-a="back"]')) showTitle(); };
  }

  function getScores() { try { return JSON.parse(ls.get(SCORE_KEY) || "[]") || []; } catch (e) { return []; } }
  function showScores() {
    const s = getScores();
    const rows = s.length ? s.map((r, i) =>
      "<tr><td>" + r.score + "</td><td>" + esc(SG.CLASSES[r.cls] ? SG.CLASSES[r.cls].name : r.cls) + "</td><td>" + (r.won ? "Sieg" : "Ebene " + r.depth) + "</td><td>" + esc(r.date) + (r.daily ? " · Tag" : "") + "</td></tr>").join("")
      : '<tr><td colspan="4" style="color:var(--muted);font-weight:400">Noch keine Läufe.</td></tr>';
    openOverlay("scores", "<h2>Bestenliste</h2><table class=\"scores\"><thead><tr><th>Punkte</th><th>Klasse</th><th>Ergebnis</th><th>Datum</th></tr></thead><tbody>" + rows + '</tbody></table><button class="btn" data-a="back">Zurück</button>');
    $("panel").onclick = e => { if (e.target.closest('[data-a="back"]')) showTitle(); };
  }

  function showPerks() {
    const ch = G.pendingPerks[0]; if (!ch) return;
    openOverlay("perk",
      "<h2>Stufe " + (G.player.lvl - G.pendingPerks.length + 1) + "</h2><p>Wähle eine Gabe.</p>" +
      '<div class="perks">' + ch.map(id => '<button class="perk" data-p="' + id + '"><b>' + esc(SG.PERKS[id].n) + "</b><span>" + esc(SG.PERKS[id].d) + "</span></button>").join("") + "</div>");
    $("panel").onclick = e => {
      const b = e.target.closest("button[data-p]"); if (!b) return;
      if (SG.choosePerk(G, b.dataset.p)) { overlayMode = null; $("overlay").hidden = true; afterAction(); }
    };
  }

  function itemInfo(it) {
    const p = G.player;
    if (it.type === "waffe") return "+" + it.bonus + " Angriff (angelegt: +" + SG.weaponBonus(G) + ")";
    if (it.type === "ruestung") return "+" + it.bonus + " Rüstung (angelegt: +" + SG.armorBonus(G) + ")";
    return ITEM_DESC[it.type] || "";
  }
  function showInventory() {
    const p = G.player, c = SG.CLASSES[G.cls];
    const perkCount = {}; p.perks.forEach(id => perkCount[id] = (perkCount[id] || 0) + 1);
    const items = p.inv.length ? p.inv.map((it, i) => {
      const d = SG.ITEMS[it.type], equip = it.type === "waffe" || it.type === "ruestung";
      return '<div class="inv-item"><span class="g" style="color:' + d.c + '">' + esc(d.g) + "</span><div>" + esc(SG.itemName(it)) + "<small>" + esc(itemInfo(it)) + '</small></div><div class="b"><button data-use="' + i + '">' + (equip ? "Anlegen" : "Benutzen") + '</button><button data-drop="' + i + '" aria-label="Ablegen">Ablegen</button></div></div>';
    }).join("") : '<p style="color:var(--muted)">Deine Taschen sind leer.</p>';
    openOverlay("inv",
      "<h2>" + esc(c.name) + " · Stufe " + p.lvl + "</h2>" +
      '<div class="stats">' +
      '<div class="stat"><small>Leben</small><b>' + p.hp + "/" + p.maxHp + "</b></div>" +
      '<div class="stat"><small>Angriff</small><b>' + (p.atk + SG.weaponBonus(G)) + "</b></div>" +
      '<div class="stat"><small>Rüstung</small><b>' + (p.def + SG.armorBonus(G)) + "</b></div>" +
      '<div class="stat"><small>Kritisch</small><b>' + Math.round(p.crit * 100) + " %</b></div>" +
      '<div class="stat"><small>Ausweichen</small><b>' + Math.round(Math.min(0.6, p.evade) * 100) + " %</b></div>" +
      '<div class="stat"><small>Erfahrung</small><b>' + p.xp + "/" + SG.xpNext(p.lvl) + "</b></div></div>" +
      "<h3>Ausrüstung</h3><p>Waffe: " + esc(p.weapon ? p.weapon.name : "keine") + "<br>Rüstung: " + esc(p.armor ? p.armor.name : "keine") + "</p>" +
      (p.perks.length ? '<h3>Gaben</h3><div class="tags">' + Object.keys(perkCount).map(id => "<span>" + esc(SG.PERKS[id].n) + (perkCount[id] > 1 ? " ×" + perkCount[id] : "") + "</span>").join("") + "</div>" : "") +
      "<h3>Taschen " + p.inv.length + "/10</h3><div class=\"inv\">" + items + "</div>" +
      '<button class="btn" data-a="close">Schließen</button>');
    $("panel").onclick = e => {
      if (e.target.closest('[data-a="close"]')) { closeOverlay(); return; }
      const u = e.target.closest("button[data-use]"), d = e.target.closest("button[data-drop]");
      if (u) { const ok = SG.useItem(G, +u.dataset.use); overlayMode = null; $("overlay").hidden = true; if (ok) afterAction(); else updateHud(); }
      else if (d) { const ok = SG.dropItem(G, +d.dataset.drop); overlayMode = null; $("overlay").hidden = true; if (ok) afterAction(); else updateHud(); }
    };
  }

  function showMap() {
    openOverlay("map", "<h2>Ebene " + G.depth + "</h2><canvas class=\"mapcv\" id=\"mapcv\"></canvas><p>Gold: Treppe, Rot: Gegner in Sicht.</p><button class=\"btn\" data-a=\"close\">Schließen</button>");
    const mc = $("mapcv"), s = 8;
    mc.width = SG.W * s; mc.height = SG.H * s;
    const c = mc.getContext("2d");
    for (let y = 0; y < SG.H; y++) for (let x = 0; x < SG.W; x++) {
      const i = SG.idx(x, y); if (!G.explored[i]) continue;
      const t = G.map[i];
      c.fillStyle = t === SG.WALL ? "#3a3f4c" : t === SG.STAIRS ? "#ffd76a" : (G.visible[i] ? "#23262f" : "#16181e");
      c.fillRect(x * s, y * s, s, s);
    }
    for (const m of SG.visibleMonsters(G)) { c.fillStyle = "#ff6b6b"; c.fillRect(m.x * s + 1, m.y * s + 1, s - 2, s - 2); }
    c.fillStyle = SG.CLASSES[G.cls].color; c.beginPath(); c.arc(G.player.x * s + s / 2, G.player.y * s + s / 2, s * 0.7, 0, 7); c.fill();
    $("panel").onclick = e => { if (e.target.closest('[data-a="close"]')) closeOverlay(); };
  }

  function finishRun() {
    const sc = SG.score(G);
    if (!G.recorded) {
      G.recorded = true;
      const s = getScores();
      s.push({ score: sc, cls: G.cls, depth: G.depth, won: G.won, date: today(), daily: G.daily, seed: G.seed, lvl: G.player.lvl, kills: G.kills });
      s.sort((a, b) => b.score - a.score);
      ls.set(SCORE_KEY, JSON.stringify(s.slice(0, 15)));
      ls.del(SAVE_KEY);
    }
    const p = G.player, cls = G.cls;
    setTimeout(() => {
      openOverlay("end",
        "<h2>" + (G.won ? "Sieg!" : "Gefallen auf Ebene " + G.depth) + "</h2>" +
        "<p>" + (G.won ? "Der Lich ist besiegt. Der Schattengrund gehört dir." : esc(G.deathBy) + " hat deinen Lauf beendet.") + "</p>" +
        '<div class="stats">' +
        '<div class="stat"><small>Punkte</small><b>' + sc + "</b></div>" +
        '<div class="stat"><small>Stufe</small><b>' + p.lvl + "</b></div>" +
        '<div class="stat"><small>Besiegt</small><b>' + G.kills + "</b></div>" +
        '<div class="stat"><small>Gold</small><b>' + G.gold + "</b></div>" +
        '<div class="stat"><small>Züge</small><b>' + G.turn + "</b></div>" +
        '<div class="stat"><small>Ebene</small><b>' + G.depth + "</b></div></div>" +
        "<p>" + (G.daily ? "Tageslauf vom " + esc(G.dailyDate || today()) + "." : "Seed " + G.seed + ". Gib ihn einem Freund, dann spielt er dieselbe Welt.") + "</p>" +
        '<div class="row-btns"><button class="btn primary" data-a="again">Neuer Lauf als ' + esc(SG.CLASSES[cls].name) + '</button><button class="btn" data-a="menu">Hauptmenü</button></div>');
      $("panel").onclick = e => {
        if (e.target.closest('[data-a="again"]')) startRun(cls, randomSeed(), false);
        else if (e.target.closest('[data-a="menu"]')) { G = null; render(); showTitle(); }
      };
    }, 450);
  }

  /* ---------- Start ---------- */
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  resize();
  showTitle();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  // Für Tests
  window.__sg = { get G() { return G; }, startRun, render };
})();
