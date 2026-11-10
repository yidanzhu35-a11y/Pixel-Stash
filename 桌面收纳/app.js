(function () {
  'use strict';
  var core = window.StationeryCore, art = window.StationeryArt, solver = window.StationerySolver;
  var $ = function (id) { return document.getElementById(id); };
  var game, index = 0, selected = null, drag = null, hover = null, geometries = [], raf = 0;
  var cursor = { drawer: 0, x: 0, y: 0 };
  var SAVE = 'stationery.v1';

  function progress() {
    try { var p = JSON.parse(localStorage.getItem(SAVE)); if (p && p.unlocked) return p; } catch (e) {}
    return { unlocked: 1, done: [] };
  }
  function save(p) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e) {} }
  function say(msg, err) { var s = $('status'); s.textContent = msg; s.classList.toggle('error', !!err); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function refreshLevelOptions() {
    var p = progress();
    $('level').innerHTML = core.LEVELS.map(function (l, i) {
      var locked = i > p.unlocked - 1;
      return '<option value="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        (i + 1) + '. ' + l.name + (locked ? ' 🔒' : '') + (p.done.indexOf(i) >= 0 ? ' ✓' : '') + '</option>';
    }).join('');
    $('level').value = String(index);
  }

  function load(i) {
    index = i; game = new core.Game(core.LEVELS[i]);
    selected = null; drag = null; hover = null; cursor = { drawer: 0, x: 0, y: 0 };
    $('level').value = String(i); $('note').textContent = game.level.note; $('win').hidden = true;
    $('frames').innerHTML = game.level.drawers.map(function (d, i) {
      return '<div class="drawer-card" id="drawer-card-' + i + '">' +
        '<div class="drawer-heading"><strong>抽屉 ' + (i + 1) + '</strong><span id="drawer-state-' + i + '">' + d.w + ' × ' + d.h + '</span></div>' +
        '<div class="canvas-wrap"><canvas id="drawer-' + i + '" data-drawer="' + i + '" tabindex="0" aria-label="抽屉 ' + (i + 1) + '，' + d.w + ' 列 ' + d.h + ' 行。可拖放文具，方向键移动光标后回车放置。"></canvas></div></div>';
    }).join('');
    game.level.drawers.forEach(function (_, i) {
      var canvas = $('drawer-' + i);
      canvas.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        var pos = locate(e.clientX, e.clientY);
        if (!pos || pos.drawer !== i) return;
        var p = at(pos);
        if (p) start(e, p.id, { x: pos.x - p.x, y: pos.y - p.y });
        else if (selected !== null) place(selected, pos);
      });
      canvas.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'r', 'R'].indexOf(e.key) < 0) return;
        e.preventDefault();
        if (e.key === 'r' || e.key === 'R') { if (selected !== null) rotate(selected); return; }
        if (cursor.drawer !== i) cursor = { drawer: i, x: 0, y: 0 };
        var d = game.level.drawers[i];
        if (e.key === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1);
        if (e.key === 'ArrowRight') cursor.x = Math.min(d.w - 1, cursor.x + 1);
        if (e.key === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1);
        if (e.key === 'ArrowDown') cursor.y = Math.min(d.h - 1, cursor.y + 1);
        if (e.key === 'Enter' || e.key === ' ') {
          if (selected !== null) place(selected, cursor);
          else { var p = at(cursor); if (p) select(p.id); }
        } else { hover = { drawer: cursor.drawer, x: cursor.x, y: cursor.y }; drawDrawers(); }
      });
    });
    render();
    say('选一件文具，放进任意抽屉。');
  }

  function select(id) {
    selected = id;
    var p = game.piece(id);
    say('已选' + core.SHAPES[p.type].name + '。' + (p.drawer === null ? '点抽屉里的空格放置，点它一下可以旋转。' : '可以拖到别的位置，或放回托盘。'));
    render();
  }
  function start(e, id, offset) {
    if (e.button !== 0) return;
    e.preventDefault(); select(id);
    drag = { id: id, offset: offset || { x: 0, y: 0 }, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
  }

  function drawTrayIcon(cv, p) {
    var sh = core.SHAPES[p.type], rd = core.rotatedDims(sh, p.rot || 0);
    var cell = 18, dpr = window.devicePixelRatio || 1;
    cv.width = rd.w * cell * dpr; cv.height = rd.h * cell * dpr;
    cv.style.width = rd.w * cell + 'px'; cv.style.height = rd.h * cell + 'px';
    cv.style.maxWidth = '100%'; cv.style.height = 'auto';
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    art.drawPiece(ctx, p.type, p.rot || 0, 0, 0, cell);
  }

  function render() {
    var loose = game.loose();
    $('progress').textContent = '已收 ' + (game.pieces.length - loose.length) + ' / ' + game.pieces.length + ' 件';
    game.level.drawers.forEach(function (d, i) {
      var used = game.inDrawer(i).reduce(function (n, p) { return n + core.cellsOf(p).length; }, 0);
      var full = used === d.w * d.h;
      $('drawer-card-' + i).classList.toggle('full', full);
      $('drawer-state-' + i).textContent = full ? '装满了 ✓' : d.w + ' × ' + d.h;
    });
    $('remaining').textContent = '还有 ' + loose.length + ' 件';
    $('stock').innerHTML = loose.map(function (p) {
      var sh = core.SHAPES[p.type];
      return '<button class="piece' + (p.id === selected ? ' selected' : '') + '" data-piece="' + p.id +
        '" aria-label="' + sh.name + '，点按旋转，拖动放入抽屉"><canvas data-icon="' + p.id + '"></canvas><span>' + sh.name + '</span></button>';
    }).join('');
    $('stock').querySelectorAll('[data-piece]').forEach(function (b) {
      var id = Number(b.dataset.piece), p = game.piece(id);
      drawTrayIcon(b.querySelector('canvas'), p);
      b.addEventListener('pointerdown', function (e) { start(e, id); });
      b.addEventListener('click', function (e) { if (e.detail === 0) select(id); });
    });
    $('emptyStock').hidden = loose.length > 0;
    $('rotate').disabled = selected === null;
    drawDrawers();
  }

  function drawDrawers() {
    var dpr = window.devicePixelRatio || 1;
    geometries = game.level.drawers.map(function (d, i) {
      var canvas = $('drawer-' + i), parent = canvas.parentElement;
      var pad = 10, max = innerWidth <= 700 ? 34 : 56;
      var s = Math.min(max, (parent.clientWidth - 2 * pad) / d.w);
      var w = d.w * s + pad * 2, h = d.h * s + pad * 2, g = { s: s, pad: pad, w: w, h: h };
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      var c = canvas.getContext('2d'); c.scale(dpr, dpr);
      c.fillStyle = '#e8d9b8'; rrect(c, 0, 0, w, h, 14); c.fill();
      c.fillStyle = '#fbf4e2'; rrect(c, pad - 3, pad - 3, d.w * s + 6, d.h * s + 6, 8); c.fill();
      c.strokeStyle = '#eadfc8'; c.lineWidth = 1;
      for (var x = 1; x < d.w; x++) { c.beginPath(); c.moveTo(pad + x * s, pad); c.lineTo(pad + x * s, pad + d.h * s); c.stroke(); }
      for (var y = 1; y < d.h; y++) { c.beginPath(); c.moveTo(pad, pad + y * s); c.lineTo(pad + d.w * s, pad + y * s); c.stroke(); }
      game.inDrawer(i).forEach(function (p) {
        var dragging = drag && drag.moved && drag.id === p.id;
        var px = pad + p.x * g.s, py = pad + p.y * g.s;
        if (dragging) c.globalAlpha = .35;
        var k = 1;
        if (game.pop.id === p.id) {
          var age = performance.now() - game.pop.t;
          if (age < 240) k = 1 + .12 * Math.sin(Math.PI * age / 240);
        }
        if (k !== 1) {
          var sh = core.SHAPES[p.type], rd = core.rotatedDims(sh, p.rot || 0);
          var cx = px + rd.w * g.s / 2, cy = py + rd.h * g.s / 2;
          c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
          art.drawPiece(c, p.type, p.rot || 0, px, py, g.s);
          c.restore();
        } else {
          art.drawPiece(c, p.type, p.rot || 0, px, py, g.s);
        }
        c.globalAlpha = 1;
        if (p.id === selected && !dragging) {
          var sh2 = core.SHAPES[p.type], rd2 = core.rotatedDims(sh2, p.rot || 0);
          c.save(); c.strokeStyle = '#c9a15f'; c.lineWidth = 2.5; c.setLineDash([6, 4]);
          rrect(c, px - 2, py - 2, rd2.w * g.s + 4, rd2.h * g.s + 4, 8); c.stroke(); c.restore();
        }
      });
      if (selected !== null && hover && hover.drawer === i) {
        var sp = game.piece(selected);
        var valid = game.check(sp.id, i, hover.x, hover.y).ok;
        c.save(); c.beginPath(); c.rect(pad, pad, d.w * s, d.h * s); c.clip();
        c.globalAlpha = .55;
        art.drawPiece(c, sp.type, sp.rot || 0, pad + hover.x * g.s, pad + hover.y * g.s, g.s);
        c.globalAlpha = 1;
        if (!valid) {
          c.fillStyle = 'rgba(204,87,71,.35)';
          core.cellsOf(sp).forEach(function (cd) {
            c.fillRect(pad + (hover.x + cd[0]) * g.s, pad + (hover.y + cd[1]) * g.s, g.s, g.s);
          });
        }
        c.restore();
      }
      return g;
    });
  }
  function locate(x, y) {
    for (var i = 0; i < geometries.length; i++) {
      var r = $('drawer-' + i).getBoundingClientRect(), g = geometries[i];
      if (x >= r.left + g.pad && x < r.right - g.pad && y >= r.top + g.pad && y < r.bottom - g.pad)
        return { drawer: i, x: Math.floor((x - r.left - g.pad) / g.s), y: Math.floor((y - r.top - g.pad) / g.s) };
    }
    return null;
  }
  function at(pos) {
    return game.inDrawer(pos.drawer).find(function (p) {
      return core.cellsOf(p).some(function (c) { return p.x + c[0] === pos.x && p.y + c[1] === pos.y; });
    });
  }
  function inStock(x, y) {
    var r = $('stockPanel').getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function kickPop() {
    cancelAnimationFrame(raf);
    var step = function () { drawDrawers(); if (performance.now() - game.pop.t < 260) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  }
  function place(id, pos) {
    var result = game.place(id, pos.drawer, pos.x, pos.y);
    if (result.ok) {
      selected = null; hover = null;
      if (result.wasNoop) { render(); return; }
      render(); kickPop();
      if (result.won) onWin();
      else say(pick(['放好了～继续收下一件。', '又收进一件，越来越整齐了。', '不错，就这样放。', '位置不错！']));
    } else { render(); say(result.reason, true); }
  }
  function returnSelected(id) {
    game.returnPiece(id); selected = null; hover = null;
    render(); say('放回托盘了，可以重新安排。');
  }
  function rotate(id) {
    var result = game.rotatePiece(id);
    render();
    if (!result.ok) { say(result.reason, true); return; }
    kickPop();
    if (result.returned) say('方向换好了，不过这个抽屉放不下，先放回托盘～');
    else if (result.shifted) say('转了个方向，挪到了旁边放得下的位置。');
    else say('转了个方向～');
  }
  function onWin() {
    var p = progress();
    if (p.done.indexOf(index) < 0) p.done.push(index);
    p.unlocked = Math.max(p.unlocked, Math.min(index + 2, core.LEVELS.length));
    save(p);
    refreshLevelOptions();
    setTimeout(function () {
      var slack = game.slackCells();
      $('winText').innerHTML = game.pieces.length + ' 件文具，' + game.moves + ' 步，全部收进 ' +
        game.level.drawers.length + ' 个抽屉。' +
        (slack === 0 ? '抽屉刚好装满，一个空位都不剩，太厉害了！'
                     : '抽屉里还剩 ' + slack + ' 格空位——没关系，这关本来就不用装满。');
      $('next').textContent = index === core.LEVELS.length - 1 ? '回到第一关 ↻' : '下一关 →';
      $('win').hidden = false;
    }, 420);
  }

  document.addEventListener('pointermove', function (e) {
    if (!game) return;
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) drag.moved = true;
      if (!drag.moved) return;
      var pos = locate(e.clientX, e.clientY);
      hover = pos ? { drawer: pos.drawer, x: pos.x - drag.offset.x, y: pos.y - drag.offset.y } : null;
      $('stockPanel').classList.toggle('drop-ready', inStock(e.clientX, e.clientY) && game.piece(drag.id).drawer !== null);
    } else if (selected !== null && e.pointerType === 'mouse') {
      hover = locate(e.clientX, e.clientY);
    }
    drawDrawers();
  });
  document.addEventListener('pointerup', function (e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    var d = drag; drag = null; hover = null; $('stockPanel').classList.remove('drop-ready');
    if (d.moved) {
      var pos = locate(e.clientX, e.clientY);
      if (pos) place(d.id, { drawer: pos.drawer, x: pos.x - d.offset.x, y: pos.y - d.offset.y });
      else if (inStock(e.clientX, e.clientY)) returnSelected(d.id);
      else { drawDrawers(); say('文具留在原处，拖进抽屉或托盘即可。'); }
    } else {
      rotate(d.id); // 点一下（没拖动）= 旋转方向
    }
  });
  document.addEventListener('pointercancel', function () {
    drag = null; hover = null; $('stockPanel').classList.remove('drop-ready');
    if (game) drawDrawers();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { selected = null; drag = null; hover = null; $('win').hidden = true; if (game) render(); }
    if ((e.key === 'r' || e.key === 'R') && selected !== null && e.target.tagName !== 'SELECT') rotate(selected);
  });
  $('rotate').addEventListener('click', function () { if (selected !== null) rotate(selected); });
  $('restart').addEventListener('click', function () { load(index); });
  $('level').addEventListener('change', function () { load(Number($('level').value)); });
  $('keep').addEventListener('click', function () { $('win').hidden = true; });
  $('next').addEventListener('click', function () { load((index + 1) % core.LEVELS.length); });
  addEventListener('resize', function () { drag = null; hover = null; if (game) drawDrawers(); });

  refreshLevelOptions();
  var startIdx = 0, p0 = progress();
  while (startIdx < core.LEVELS.length - 1 && p0.done.indexOf(startIdx) >= 0) startIdx++;
  load(Math.min(startIdx, p0.unlocked - 1));

  // 调试 API：__PS3.game / __PS3.solve() / __PS3.solveLevel(i) / __PS3.autoSolve()
  window.__PS3 = {
    get game() { return game; },
    load: function (i) { load(i); },
    solve: function (cap) { return solver.solve(game.level, cap || 200); },
    solveLevel: function (i, cap) { return solver.solve(core.LEVELS[i], cap || 200); },
    autoSolve: function () { // 用求解器第一个解走完整流程：验证规则与求解器一致
      var r = solver.solve(game.level, 1);
      if (!r.solvable) return { ok: false, reason: '无解' };
      load(index);
      for (var i = 0; i < r.first.length; i++) {
        var s = r.first[i];
        var p = game.pieces.find(function (q) { return q.type === s.type && q.drawer === null; });
        if (!p) return { ok: false, reason: '找不到待放的 ' + s.type };
        p.rot = s.rot;
        var res = game.place(p.id, s.drawer, s.x, s.y);
        if (!res.ok) return { ok: false, reason: '放置被拒：' + JSON.stringify(s) };
      }
      return { ok: game.won(), won: game.won(), moves: game.moves, slack: game.slackCells() };
    }
  };
  window.__PS3.artCheck = art.verifyAlignment();
  console.log('[文具收纳] 美术对齐自检：' + (window.__PS3.artCheck.all
    ? '全部通过（' + window.__PS3.artCheck.results.length + ' 个朝向）' : '有失败项！'),
    window.__PS3.artCheck.results);
})(window);
