(function () {
  'use strict';
  var core = window.StationeryCore, art = window.StationeryArt, solver = window.StationerySolver;
  var $ = function (id) { return document.getElementById(id); };
  var game, index = 0, selected = null, drag = null, hover = null, geometries = [], raf = 0;
  var cursor = { drawer: 0, x: 0, y: 0 };
  // 抽屉分行：一行内抽屉格数之和 ≤ CELL_BUDGET（调研：猫咪数独/经典数独手机竖屏一行 9 格为可读上限），超出换行
  var CELL_BUDGET = 9, CARD_OVER = 12, ROW_GAP = 12, lastRowKey = ''; // CARD_OVER = 抽屉画布左右边距 6×2（抽屉卡无内边距无边框）
  var desk = { s: 34, pad: 12, w: 10, h: 3 }; // 桌面摊放区（格单位；与抽屉共用同一格宽）
  var fx = { shake: null };                   // 固定物点按反馈：抖动 + 「钉住了」气泡
  var deskHot = false;                        // 拖回桌面的落区提示（画在桌面上，替代旧的高亮卡片）
  var hint = null, hintRaf = 0;               // 提示：{kind:'place'|'move',…} 高亮建议；{kind:'retry'|'reset'} 仅文字
  var SAVE = 'stationery.v1';
  // 生成器候选关试玩（关卡生成器.html → index.html#custom=<urlencoded json>）：不占存档、不参与解锁
  var sandboxLevel = null;
  try {
    var hm = location.hash.match(/custom=([^&]+)/);
    if (hm) sandboxLevel = JSON.parse(decodeURIComponent(hm[1]));
  } catch (e) { sandboxLevel = null; }
  var LEVELS = core.LEVELS;
  if (sandboxLevel && sandboxLevel.drawers && sandboxLevel.pieces &&
      sandboxLevel.pieces.concat(sandboxLevel.fixed || []).every(function (p) { return core.ITEMS[p.item || p]; })) {
    LEVELS = [sandboxLevel];
  } else { sandboxLevel = null; }

  function progress() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(SAVE)); } catch (e) {}
    if (!p || !p.unlocked) p = { unlocked: 1, done: [] };
    p.unlocked = LEVELS.length; // 原型测试阶段：全关卡直接开放，便于任意跳关测试（正式版恢复逐关解锁）
    return p;
  }
  function save(p) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e) {} }
  function say(msg, err) { var s = $('status'); s.textContent = msg; s.classList.toggle('error', !!err); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function dimsOf(p) { return core.rotatedDims(core.shapeOfItem(p.item), p.rot || 0); }
  function drawFixedBadge(c, px, py, rd, s) { // 固定物标识：四角金色铆钉（白描边 + 高光）
    c.save();
    [[px + 7, py + 7], [px + rd.w * s - 7, py + 7], [px + 7, py + rd.h * s - 7], [px + rd.w * s - 7, py + rd.h * s - 7]].forEach(function (pt) {
      c.beginPath(); c.arc(pt[0], pt[1], 4.6, 0, Math.PI * 2);
      c.fillStyle = '#b98a3e'; c.fill();
      c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,248,220,.95)'; c.stroke();
      c.beginPath(); c.arc(pt[0] - 1.3, pt[1] - 1.3, 1.3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,252,240,.95)'; c.fill();
    });
    c.restore();
  }

  function refreshLevelOptions() {
    var p = progress();
    $('level').innerHTML = LEVELS.map(function (l, i) {
      var locked = i > p.unlocked - 1;
      var label = sandboxLevel ? '🛠️ 试玩候选关（不存档）' : (i + 1) + '. ' + l.name;
      return '<option value="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        label + (locked ? ' 🔒' : '') + (!sandboxLevel && p.done.indexOf(i) >= 0 ? ' ✓' : '') + '</option>';
    }).join('');
    $('level').value = String(index);
  }

  // —— 抽屉分行与格宽（§3.1 修订：多抽屉同屏，一行最多 9 格，超出换行）——
  function packRows(budget) { // 贪心分行：抽屉依次填入当前行，格数超预算换行
    var rows = [], cur = [], cells = 0;
    game.level.drawers.forEach(function (d, i) {
      if (cur.length && cells + d.w > budget) { rows.push(cur); cur = []; cells = 0; }
      cur.push(i); cells += d.w;
    });
    if (cur.length) rows.push(cur);
    return rows;
  }
  function layoutRows() { // 返回同页统一格宽 s，并按预算分行插入换行锚点（flex 自然换行只按像素、不管格数预算）
    var avail = $('frames').clientWidth || 600;
    var budget = CELL_BUDGET, rows, sRow;
    for (;;) {
      rows = packRows(budget);
      sRow = Infinity;
      rows.forEach(function (row) {
        var cells = 0;
        row.forEach(function (i) { cells += game.level.drawers[i].w; });
        var over = CARD_OVER * row.length + ROW_GAP * (row.length - 1);
        sRow = Math.min(sRow, (avail - over) / cells);
      });
      var allSingle = true;
      for (var r0 = 0; r0 < rows.length; r0++) if (rows[r0].length > 1) { allSingle = false; break; }
      if (sRow >= 32 || allSingle) break; // 32 = 手机格宽目标下限；每行只剩一个抽屉就只能接受
      budget--;
    }
    var s = Math.max(24, Math.min(48, Math.floor(sRow))); // 宽屏封顶 48px，避免格子过大
    var key = rows.map(function (r) { return r.join(','); }).join('|');
    if (key !== lastRowKey) { // 分行结构变化才改 DOM（拖拽中每帧重绘，不能反复插节点）
      lastRowKey = key;
      var frames = $('frames');
      var old = frames.querySelectorAll('.row-break');
      for (var b = 0; b < old.length; b++) frames.removeChild(old[b]);
      for (var r = 0; r < rows.length - 1; r++) {
        var lastCard = $('drawer-card-' + rows[r][rows[r].length - 1]);
        var br = document.createElement('div');
        br.className = 'row-break';
        lastCard.parentNode.insertBefore(br, lastCard.nextSibling);
      }
    }
    return s;
  }

  function load(i) {
    index = i; game = new core.Game(LEVELS[i]);
    selected = null; drag = null; hover = null; fx.shake = null; hint = null; cancelAnimationFrame(hintRaf); cursor = { drawer: 0, x: 0, y: 0 };
    lastRowKey = '';
    $('level').value = String(i); $('win').hidden = true;
    $('frames').innerHTML = game.level.drawers.map(function (d, i) {
      return '<div class="drawer-card" id="drawer-card-' + i + '">' +
        '<div class="drawer-heading"><strong>抽屉 ' + (i + 1) + '</strong></div>' +
        '<div class="canvas-wrap"><canvas id="drawer-' + i + '" data-drawer="' + i + '" tabindex="0" aria-label="抽屉 ' + (i + 1) + '，' + d.w + ' 列 ' + d.h + ' 行。可拖放物品，方向键移动光标后回车放置。"></canvas></div></div>';
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
        else {
          var f = game.fixedAt(pos.drawer, pos.x, pos.y);
          if (f) { // 点/拖固定物：文字 + 抖动 + 气泡，明确「动不了」
            say('这个' + core.ITEMS[f.item].name + '被钉住了，不能移动～');
            fx.shake = { drawer: i, x: f.x, y: f.y, t: performance.now() };
            kickAnim();
          }
          else if (selected !== null) place(selected, pos);
        }
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
    render(); // 先量出抽屉与格宽，再把物品排进周围的可用桌面
    scatterDesk();
    drawDesk();
    say('物品摊在桌面上，拖进抽屉收纳；点一下物品换方向。');
  }

  function select(id) {
    selected = id;
    var p = game.piece(id);
    say('已选' + core.ITEMS[p.item].name + '。' + (p.drawer === null ? '拖进抽屉收纳，点一下它换方向。' : '可以拖到别的位置，或放回桌面。'));
    render();
  }
  function start(e, id, offset) {
    if (e.button !== 0) return;
    e.preventDefault(); select(id);
    drag = { id: id, offset: offset || { x: 0, y: 0 }, startX: e.clientX, startY: e.clientY,
             clientX: e.clientX, clientY: e.clientY, moved: false, pointerId: e.pointerId };
  }

  function render() {
    var loose = game.loose();
    $('emptyStock').hidden = loose.length > 0;
    drawDrawers();
    drawDesk();
  }

  function frameArea() { // 抽屉占用的整体矩形，作为开局散放时的避让区
    var board = $('playfield').getBoundingClientRect();
    var cards = $('frames').querySelectorAll('.drawer-card');
    var left = Infinity, right = -Infinity, bottom = 0;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      left = Math.min(left, r.left - board.left);
      right = Math.max(right, r.right - board.left);
      bottom = Math.max(bottom, r.bottom - board.top);
    }
    return { left: left, right: right, bottom: bottom };
  }

  function scatterDesk() { // 宽屏先用左右两侧；两侧放不下的物品接到抽屉下方
    var area = frameArea(), s = desk.s, pad = desk.pad;
    var below = Math.ceil((area.bottom + 16 - pad) / s);
    var zones = [
      { x0: 0, x1: Math.floor((area.left - pad - 14) / s), y0: 0, y1: below },
      { x0: Math.ceil((area.right - pad + 14) / s), x1: Math.floor(desk.w), y0: 0, y1: below },
      { x0: 0, x1: desk.w, y0: below, y1: Infinity }
    ];
    zones.forEach(function (z) { z.x = z.x0; z.y = z.y0; z.rowH = 0; });
    game.tray = { w: desk.w, h: Math.max(9, below + 6) };
    game.loose().forEach(function (p) {
      var rd = dimsOf(p);
      for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        if (rd.w > z.x1 - z.x0) continue;
        if (z.x + rd.w > z.x1) { z.x = z.x0; z.y += z.rowH + .35; z.rowH = 0; }
        if (z.y + rd.h > z.y1) continue;
        p.x = z.x; p.y = z.y;
        z.x += rd.w + .35; z.rowH = Math.max(z.rowH, rd.h);
        break;
      }
    });
  }

  function drawDrawers() {
    var dpr = window.devicePixelRatio || 1;
    // 统一格宽：同页所有抽屉（和桌面）共用一个格宽，按「一行最多 9 格」分行后由最宽行约束
    var pad = 6, s = layoutRows(); // pad 6：凹槽与画布边缘留白，宽度尽量让给格子
    if (!isFinite(s) || s <= 0) s = 40;
    desk.s = s;
    var now = performance.now();
    if (fx.shake && now - fx.shake.t > 1600) fx.shake = null; // 旧动画状态清掉
    geometries = game.level.drawers.map(function (d, i) {
      var canvas = $('drawer-' + i);
      var w = d.w * s + pad * 2, h = d.h * s + pad * 2, g = { s: s, pad: pad, w: w, h: h };
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      var c = canvas.getContext('2d'); c.scale(dpr, dpr);
      // 抽屉 = 桌面上的凹槽：略深的底色 + 内阴影（上暗下亮），不再画外框卡片；物品嵌在槽内即「已收纳」
      var cw = d.w * s, ch = d.h * s;
      c.fillStyle = 'rgba(140,105,55,.10)';
      rrect(c, pad, pad, cw, ch, 9); c.fill();
      c.save(); rrect(c, pad, pad, cw, ch, 9); c.clip();
      var gT = c.createLinearGradient(0, pad, 0, pad + 11);
      gT.addColorStop(0, 'rgba(101,74,33,.20)'); gT.addColorStop(1, 'rgba(101,74,33,0)');
      c.fillStyle = gT; c.fillRect(pad, pad, cw, 11);
      var gL = c.createLinearGradient(pad, 0, pad + 9, 0);
      gL.addColorStop(0, 'rgba(101,74,33,.12)'); gL.addColorStop(1, 'rgba(101,74,33,0)');
      c.fillStyle = gL; c.fillRect(pad, pad, 9, ch);
      var gB = c.createLinearGradient(0, pad + ch - 9, 0, pad + ch);
      gB.addColorStop(0, 'rgba(255,248,224,0)'); gB.addColorStop(1, 'rgba(255,248,224,.5)');
      c.fillStyle = gB; c.fillRect(pad, pad + ch - 9, cw, 9);
      c.restore();
      c.strokeStyle = 'rgba(122,92,48,.30)'; c.lineWidth = 1.5;
      rrect(c, pad, pad, cw, ch, 9); c.stroke();
      c.strokeStyle = 'rgba(122,92,48,.10)'; c.lineWidth = 1; // 网格是放置对齐的功能参考：保留但调淡
      for (var x = 1; x < d.w; x++) { c.beginPath(); c.moveTo(pad + x * s, pad); c.lineTo(pad + x * s, pad + ch); c.stroke(); }
      for (var y = 1; y < d.h; y++) { c.beginPath(); c.moveTo(pad, pad + y * s); c.lineTo(pad + cw, pad + y * s); c.stroke(); }
      var shakePiece = null;
      game.fixedIn(i).forEach(function (f) { // 固定物：下层 + 金色铆钉；点按时抖动
        var off = 0;
        if (fx.shake && fx.shake.drawer === i && fx.shake.x === f.x && fx.shake.y === f.y) {
          shakePiece = f;
          var age = now - fx.shake.t;
          if (age < 420) off = Math.sin(age / 55) * 3.2 * (1 - age / 420);
        }
        var fpx = pad + f.x * s + off, fpy = pad + f.y * s;
        art.drawPiece(c, f.item, f.rot || 0, fpx, fpy, s);
        drawFixedBadge(c, fpx, fpy, dimsOf(f), s);
      });
      game.inDrawer(i).forEach(function (p) {
        var dragging = drag && drag.moved && drag.id === p.id;
        var px = pad + p.x * s, py = pad + p.y * s;
        if (dragging) c.globalAlpha = .3;
        var k = 1;
        if (game.pop.id === p.id) {
          var age = performance.now() - game.pop.t;
          if (age < 240) k = 1 + .12 * Math.sin(Math.PI * age / 240);
        }
        if (k !== 1) {
          var rd = dimsOf(p);
          var cx = px + rd.w * s / 2, cy = py + rd.h * s / 2;
          c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
          art.drawPiece(c, p.item, p.rot || 0, px, py, s);
          c.restore();
        } else {
          art.drawPiece(c, p.item, p.rot || 0, px, py, s);
        }
        c.globalAlpha = 1;
        if (p.id === selected && !dragging) {
          var rd2 = dimsOf(p);
          c.save(); c.strokeStyle = '#c9a15f'; c.lineWidth = 2.5; c.setLineDash([6, 4]);
          rrect(c, px - 2, py - 2, rd2.w * s + 4, rd2.h * s + 4, 8); c.stroke(); c.restore();
        }
        if (hint && hint.kind === 'move' && p.id === hint.pieceId) { // 需要调整的那件：呼吸红框
          var rdm = dimsOf(p), hm = .5 + .5 * Math.sin((now - hint.t) / 200 * Math.PI);
          c.save(); c.strokeStyle = 'rgba(192,91,74,' + (.6 + .4 * hm) + ')'; c.lineWidth = 2.5;
          rrect(c, px - 2, py - 2, rdm.w * s + 4, rdm.h * s + 4, 8); c.stroke(); c.restore();
        }
      });
      if (hint && hint.drawer === i && hint.x != null) { // 提示目标：金色呼吸框 + 半透明虚影（虚影即建议朝向）
        var hp = .5 + .5 * Math.sin((now - hint.t) / 200 * Math.PI);
        c.save(); c.globalAlpha = .25 + .10 * hp;
        art.drawPiece(c, hint.item, hint.rot || 0, pad + hint.x * s, pad + hint.y * s, s);
        c.restore();
        var hd = core.rotatedDims(core.shapeOfItem(hint.item), hint.rot || 0);
        c.save(); c.strokeStyle = 'rgba(224,169,60,' + (.55 + .45 * hp) + ')'; c.lineWidth = 2.5;
        rrect(c, pad + hint.x * s - 2, pad + hint.y * s - 2, hd.w * s + 4, hd.h * s + 4, 8); c.stroke(); c.restore();
      }
      if (selected !== null && hover && hover.drawer === i) { // 吸附预览（合法半透明 / 非法红块）
        var sp = game.piece(selected);
        var fit = game.fitRemaining(sp.id, i);
        var preview = fit || hover;
        var previewRot = fit ? fit.rot : (sp.rot || 0);
        var valid = !!fit || game.check(sp.id, i, hover.x, hover.y).ok;
        c.save(); c.beginPath(); c.rect(pad, pad, d.w * s, d.h * s); c.clip();
        c.globalAlpha = fit ? .72 : .32;
        art.drawPiece(c, sp.item, previewRot, pad + preview.x * s, pad + preview.y * s, s);
        c.globalAlpha = 1;
        if (!valid) {
          c.fillStyle = 'rgba(204,87,71,.35)';
          core.cellsOf(sp).forEach(function (cd) {
            c.fillRect(pad + (preview.x + cd[0]) * s, pad + (preview.y + cd[1]) * s, s, s);
          });
        }
        c.restore();
      }
      if (drag && drag.moved) { // 拖动时物品跟随光标（画在光标所在的画布上）
        var rc = canvas.getBoundingClientRect();
        if (drag.clientX >= rc.left && drag.clientX <= rc.right && drag.clientY >= rc.top && drag.clientY <= rc.bottom && !game.fitRemaining(drag.id, i)) {
          var dp = game.piece(drag.id);
          c.save(); c.globalAlpha = .92;
          art.drawPiece(c, dp.item, dp.rot || 0,
            drag.clientX - rc.left - drag.offset.x * s, drag.clientY - rc.top - drag.offset.y * s, s);
          c.restore();
        }
      }
      if (shakePiece && fx.shake) { // 「钉住了」气泡（1.5 秒内渐隐）
        var ageB = now - fx.shake.t;
        if (ageB < 1500) {
          var aB = ageB < 1000 ? 1 : Math.max(0, 1 - (ageB - 1000) / 500);
          var rdB = dimsOf(shakePiece);
          var bx = clamp(pad + shakePiece.x * s + rdB.w * s / 2, 52, w - 52);
          var by = Math.max(20, pad + shakePiece.y * s - 14);
          c.save(); c.globalAlpha = aB;
          c.font = '12px system-ui,"Microsoft YaHei",sans-serif';
          var label = '🔒 钉住了', tw = c.measureText(label).width + 18;
          c.fillStyle = '#fffdf8'; c.strokeStyle = '#d9b06a'; c.lineWidth = 1.5;
          rrect(c, bx - tw / 2, by - 15, tw, 24, 12); c.fill(); c.stroke();
          c.fillStyle = '#8a6a2f'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(label, bx, by - 2.5);
          c.restore();
        }
      }
      return g;
    });
  }

  function drawDesk() {
    var cv = $('desk'), dpr = window.devicePixelRatio || 1;
    var s = desk.s, pad = desk.pad;
    var cw = $('playfield').clientWidth || 600;
    desk.w = Math.max(4, (cw - 2 * pad) / s);
    if (game.tray) game.tray.w = desk.w;
    var loose = game.loose();
    loose.forEach(function (p) { // 窗口缩放后位置越界修正（x 夹回，y 由内容撑高）
      p.x = clamp(p.x, 0, Math.max(0, desk.w - dimsOf(p).w));
    });
    var maxY = Math.max(2.6, (frameArea().bottom + pad) / s);
    loose.forEach(function (p) { maxY = Math.max(maxY, p.y + dimsOf(p).h + .3); });
    desk.h = Math.ceil(maxY);
    var w = cw, h = desk.h * s + 2 * pad;
    $('playfield').style.height = h + 'px';
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + 'px';
    }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    // 画布透明：页面背景即桌面。「未收纳」的可读性 = 桌面物品带浮起投影（抽屉里平嵌、无投影）
    if (deskHot) { c.fillStyle = 'rgba(217,176,106,.10)'; c.fillRect(0, 0, w, h); }
    loose.forEach(function (p) {
      var dragging = drag && drag.moved && drag.id === p.id;
      var px = pad + p.x * s, py = pad + p.y * s;
      c.save();
      if (dragging) c.globalAlpha = .3;
      c.shadowColor = 'rgba(96,66,28,.28)'; c.shadowBlur = 9; c.shadowOffsetY = 5;
      art.drawPiece(c, p.item, p.rot || 0, px, py, s);
      c.restore();
      if (p.id === selected && !dragging) {
        var rd = dimsOf(p);
        c.save(); c.strokeStyle = '#c9a15f'; c.lineWidth = 2.5; c.setLineDash([6, 4]);
        rrect(c, px - 2, py - 2, rd.w * s + 4, rd.h * s + 4, 8); c.stroke(); c.restore();
      }
      if (hint && hint.kind === 'place' && p.id === hint.pieceId) { // 建议拿这件：金色呼吸框
        var rdh = dimsOf(p), hh = .5 + .5 * Math.sin((performance.now() - hint.t) / 200 * Math.PI);
        c.save(); c.strokeStyle = 'rgba(224,169,60,' + (.55 + .45 * hh) + ')'; c.lineWidth = 3;
        rrect(c, px - 4, py - 4, rdh.w * s + 8, rdh.h * s + 8, 10); c.stroke(); c.restore();
      }
    });
    if (drag && drag.moved) { // 拖回桌面时物品跟随光标（同样带投影，保持「未收纳」的视觉语言）
      var r = cv.getBoundingClientRect();
      if (drag.clientX >= r.left && drag.clientX <= r.right && drag.clientY >= r.top && drag.clientY <= r.bottom) {
        var p = game.piece(drag.id);
        c.save(); c.globalAlpha = .92;
        c.shadowColor = 'rgba(96,66,28,.30)'; c.shadowBlur = 12; c.shadowOffsetY = 7;
        art.drawPiece(c, p.item, p.rot || 0,
          drag.clientX - r.left - drag.offset.x * s, drag.clientY - r.top - drag.offset.y * s, s);
        c.restore();
      }
    }
  }

  function locate(x, y) {
    for (var i = 0; i < geometries.length; i++) {
      var r = $('drawer-' + i).getBoundingClientRect(), g = geometries[i];
      if (x >= r.left + g.pad && x < r.right - g.pad && y >= r.top + g.pad && y < r.bottom - g.pad)
        return { drawer: i, x: Math.floor((x - r.left - g.pad) / g.s), y: Math.floor((y - r.top - g.pad) / g.s) };
    }
    return null;
  }
  function locateF(x, y) { // 同 locate，但返回格单位小数坐标——拖拽吸附用（跟随物品的位置是小数，取整会引入最多一格的误差）
    for (var i = 0; i < geometries.length; i++) {
      var r = $('drawer-' + i).getBoundingClientRect(), g = geometries[i];
      if (x >= r.left + g.pad && x < r.right - g.pad && y >= r.top + g.pad && y < r.bottom - g.pad)
        return { drawer: i, fx: (x - r.left - g.pad) / g.s, fy: (y - r.top - g.pad) / g.s };
    }
    return null;
  }
  function at(pos) {
    return game.inDrawer(pos.drawer).find(function (p) {
      return core.cellsOf(p).some(function (c) { return p.x + c[0] === pos.x && p.y + c[1] === pos.y; });
    });
  }
  function deskAt(x, y) { // 桌面命中：从上层往下，按实际占格（孔就是孔）
    var r = $('desk').getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    var lx = (x - r.left - desk.pad) / desk.s, ly = (y - r.top - desk.pad) / desk.s;
    var loose = game.loose();
    for (var i = loose.length - 1; i >= 0; i--) {
      var p = loose[i], fx2 = Math.floor(lx - p.x), fy2 = Math.floor(ly - p.y);
      if (core.cellsOf(p).some(function (c) { return c[0] === fx2 && c[1] === fy2; })) return p;
    }
    return null;
  }
  function inDesk(x, y) {
    var r = $('desk').getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function kickAnim() {
    cancelAnimationFrame(raf);
    var step = function () {
      var now = performance.now();
      if (fx.shake && now - fx.shake.t > 1600) fx.shake = null;
      var busy = (game.pop && now - game.pop.t < 280) || (fx.shake && now - fx.shake.t < 1500);
      drawDrawers();
      if (busy) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function place(id, pos) {
    var p = game.piece(id), fit = game.fitRemaining(id, pos.drawer);
    var oldRot = p.rot;
    if (fit) { p.rot = fit.rot; pos = fit; }
    var result = game.place(id, pos.drawer, pos.x, pos.y);
    if (!result.ok) p.rot = oldRot;
    if (result.ok) {
      selected = null; hover = null;
      if (result.wasNoop) { render(); return; }
      render(); kickAnim(); checkHint();
      if (result.won) onWin();
      else say(fit && fit.rot !== oldRot ? '自动转好方向，嵌进去了。' : pick(['放好了～继续收下一件。', '又收进一件，越来越整齐了。', '不错，就这样放。', '位置不错！']));
    } else { render(); say(result.reason, true); }
  }
  function deskDrop(d, cx, cy) { // 拖到桌面上：自由摆放（从抽屉回来也算一步取回）
    var p = game.piece(d.id);
    var fromDrawer = p.drawer !== null;
    if (fromDrawer) game.returnPiece(d.id);
    game.bringTop(d.id);
    var r = $('desk').getBoundingClientRect();
    var rd = dimsOf(p);
    p.x = clamp((cx - r.left - desk.pad) / desk.s - d.offset.x, 0, Math.max(0, desk.w - rd.w));
    p.y = Math.max(0, (cy - r.top - desk.pad) / desk.s - d.offset.y);
    selected = null; hover = null;
    render(); checkHint();
    say(fromDrawer ? '放回桌面了，可以重新安排。' : '在桌上挪了个位置。');
  }
  function rotate(id) {
    var result = game.rotatePiece(id);
    render();
    if (!result.ok) { say(result.reason, true); return; }
    kickAnim(); checkHint();
    if (result.returned) say('方向换好了，不过这个抽屉放不下，先放回桌面～');
    else if (result.shifted) say('转了个方向，挪到了旁边放得下的位置。');
    else say('转了个方向～');
  }
  function onWin() {
    var p = progress();
    if (p.done.indexOf(index) < 0) p.done.push(index);
    p.unlocked = Math.max(p.unlocked, Math.min(index + 2, LEVELS.length));
    if (!sandboxLevel) { save(p); refreshLevelOptions(); } // 沙盒试玩不写存档、不刷新解锁标记
    setTimeout(function () {
      var slack = game.slackCells();
      $('winText').innerHTML = game.pieces.length + ' 件物品，' + game.moves + ' 步，全部收进 ' +
        game.level.drawers.length + ' 个抽屉。' +
        (sandboxLevel ? '候选关试玩通过 ✓（本次不写入存档）'
                      : slack === 0 ? '抽屉刚好装满，一个空位都不剩，太厉害了！'
                                    : '抽屉里还剩 ' + slack + ' 格空位——没关系，这关本来就不用装满。');
      $('next').textContent = sandboxLevel ? '再玩一次 ↻'
                                           : index === LEVELS.length - 1 ? '回到第一关 ↻' : '下一关 →';
      $('win').hidden = false;
    }, 420);
  }

  // —— 提示系统（规划 §4）：求解器根据当前布局生成；建议都属于至少一种完整解法；超时（节点预算 HINT_NODES 或 >1.2s）返回重试，与无解区分 ——
  var HINT_NODES = 600000; // 单次求解的节点预算：保证 50 关（含精确填满关）上每次调用有界，不卡死 UI
  function computeHint() {
    if (game.loose().length === 0) return null; // 已收完（通关流程接管）
    var t0 = performance.now();
    function tooSlow() { return performance.now() - t0 > 1200; }
    var preset = game.pieces.filter(function (p) { return p.drawer !== null; }).map(function (p) {
      return { item: p.item, drawer: p.drawer, x: p.x, y: p.y, rot: p.rot || 0 };
    });
    var r = solver.solve(game.level, 1, preset, HINT_NODES);
    if (r.timeout || tooSlow()) return { kind: 'retry' };
    if (r.solvable && r.first && r.first.length) {
      // first 只含待收纳物品的摆位（preset 不进栈）；第一条 = 面积最大的一件，即「先大件」的建议顺序
      var s = r.first[0];
      var p = game.loose().find(function (q) { return q.item === s.item; });
      return p ? { kind: 'place', item: s.item, pieceId: p.id, rot: s.rot, drawer: s.drawer, x: s.x, y: s.y }
               : { kind: 'retry' };
    }
    // 布局需要调整：逐个撤回已放置物品试解，找到「挪走它就有解」的那件，并给它一个经过求解验证的新位置
    var placed = game.pieces.filter(function (p) { return p.drawer !== null; });
    for (var i = 0; i < placed.length; i++) {
      if (tooSlow()) return { kind: 'retry' };
      var q = placed[i];
      var pr2 = preset.filter(function (u) { return !(u.item === q.item && u.drawer === q.drawer && u.x === q.x && u.y === q.y); });
      var r2 = solver.solve(game.level, 1, pr2, HINT_NODES);
      if (r2.timeout) continue; // 这条分支未知，换一件试
      if (r2.solvable && r2.first) {
        var s2 = r2.first.find(function (e) { return e.item === q.item; });
        return s2 ? { kind: 'move', item: q.item, pieceId: q.id, rot: s2.rot, drawer: s2.drawer, x: s2.x, y: s2.y,
                      from: { drawer: q.drawer, x: q.x, y: q.y } }
                  : { kind: 'move', item: q.item, pieceId: q.id, from: { drawer: q.drawer, x: q.x, y: q.y } };
      }
    }
    if (tooSlow()) return { kind: 'retry' };
    var r3 = solver.solve(game.level, 1, null, HINT_NODES);
    return (!r3.timeout && r3.solvable) ? { kind: 'reset' } : { kind: 'retry' }; // 只能整局重来 / 求解超时（与无解区分）
  }
  function hintAnim() { // 呼吸高亮动画：提示存在期间低频重绘
    cancelAnimationFrame(hintRaf);
    var last = 0;
    var step = function (now) {
      if (!hint) return;
      if (now - last > 66) { last = now; drawDrawers(); drawDesk(); }
      hintRaf = requestAnimationFrame(step);
    };
    hintRaf = requestAnimationFrame(step);
  }
  function checkAs(p, rot, drawer, x, y) { // 以指定朝向检查落点（game.check 用的是物品当前朝向）
    var keep = p.rot; p.rot = rot;
    var r = game.check(p.id, drawer, x, y);
    p.rot = keep;
    return r.ok;
  }
  // 一次点击只出一条（用户反馈 2026-11-12）：每次有效操作后检查——提示被采纳或被搅黄就收起，绝不自动递补下一条
  function checkHint() {
    if (!hint) return;
    var p = game.piece(hint.pieceId), gone = !p;
    if (!gone && hint.kind === 'place') {
      gone = p.drawer !== null || hint.x == null || !checkAs(p, hint.rot, hint.drawer, hint.x, hint.y);
    } else if (!gone && hint.kind === 'move') {
      gone = p.drawer !== hint.from.drawer || p.x !== hint.from.x || p.y !== hint.from.y ||
             (hint.x != null && !checkAs(p, hint.rot, hint.drawer, hint.x, hint.y));
    }
    if (gone) { hint = null; cancelAnimationFrame(hintRaf); render(); }
  }
  function showHint() {
    var h = computeHint();
    if (!h) { say('都收好了，没有可提示的。'); return; }
    if (h.kind === 'retry') { say('这关有点绕，提示暂时算不出来——先随便挪挪，再点我一次。'); return; }
    if (h.kind === 'reset') { say('现在的摆法走不通了，建议点「↺ 重开」换个思路。', true); return; }
    hint = h; hint.t = performance.now();
    var name = core.ITEMS[hint.item].name;
    if (hint.kind === 'place') {
      var p = game.piece(hint.pieceId);
      var needRot = p && hint.rot != null && (p.rot || 0) !== hint.rot;
      say('提示：试试把「' + name + '」' + (needRot ? '转个方向，' : '') + '放进抽屉 ' + (hint.drawer + 1) + ' 的高亮位置。');
    } else {
      say('现在的摆法走不通了：先把「' + name + '」（红框那件）挪出来，放到高亮位置。', true);
    }
    render(); hintAnim();
  }

  $('desk').addEventListener('pointerdown', function (e) {
    if (!game || e.button !== 0) return;
    e.preventDefault();
    var p = deskAt(e.clientX, e.clientY);
    if (!p) return;
    game.bringTop(p.id);
    var r = this.getBoundingClientRect();
    start(e, p.id, {
      x: (e.clientX - r.left - desk.pad) / desk.s - p.x,
      y: (e.clientY - r.top - desk.pad) / desk.s - p.y
    });
  });

  document.addEventListener('pointermove', function (e) {
    if (!game) return;
    if (drag) {
      if (e.pointerId !== drag.pointerId) return;
      drag.clientX = e.clientX; drag.clientY = e.clientY;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) drag.moved = true;
      if (!drag.moved) return;
      var posF = locateF(e.clientX, e.clientY); // 吸附 = 跟随物品小数位置的最近整格（保证预览与物品视觉位置差 ≤ 半格）
      hover = posF ? { drawer: posF.drawer, x: Math.round(posF.fx - drag.offset.x), y: Math.round(posF.fy - drag.offset.y) } : null;
      deskHot = inDesk(e.clientX, e.clientY) && game.piece(drag.id).drawer !== null;
      drawDesk();
    } else if (selected !== null && e.pointerType === 'mouse') {
      hover = locate(e.clientX, e.clientY);
    }
    drawDrawers();
  });
  document.addEventListener('pointerup', function (e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    var d = drag; drag = null; hover = null; deskHot = false;
    if (d.moved) {
      var posF = locateF(e.clientX, e.clientY);
      if (posF) place(d.id, { drawer: posF.drawer, x: Math.round(posF.fx - d.offset.x), y: Math.round(posF.fy - d.offset.y) });
      else if (inDesk(e.clientX, e.clientY)) deskDrop(d, e.clientX, e.clientY);
      else { render(); say('物品留在原处，拖进抽屉或桌面即可。'); }
    } else {
      rotate(d.id); // 点一下（没拖动）= 旋转方向
    }
  });
  document.addEventListener('pointercancel', function () {
    drag = null; hover = null; deskHot = false;
    if (game) render();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { selected = null; drag = null; hover = null; hint = null; cancelAnimationFrame(hintRaf); $('win').hidden = true; if (game) render(); }
    if ((e.key === 'r' || e.key === 'R') && selected !== null && e.target.tagName !== 'SELECT') rotate(selected);
  });
  $('restart').addEventListener('click', function () { load(index); });
  $('hint').addEventListener('click', function () { // 再点一次 = 收起提示
    if (hint) { hint = null; cancelAnimationFrame(hintRaf); render(); say('提示收起来了，再点一次可以重新拿。'); return; }
    showHint();
  });
  $('level').addEventListener('change', function () { load(Number($('level').value)); });
  $('keep').addEventListener('click', function () { $('win').hidden = true; });
  $('next').addEventListener('click', function () { load((index + 1) % LEVELS.length); });
  addEventListener('resize', function () {
    drag = null; hover = null;
    if (game) { render(); scatterDesk(); drawDesk(); }
  });

  refreshLevelOptions();
  var startIdx = 0, p0 = progress();
  while (startIdx < LEVELS.length - 1 && p0.done.indexOf(startIdx) >= 0) startIdx++;
  load(Math.min(startIdx, p0.unlocked - 1));

  // 调试 API：__PS3.game / __PS3.solve() / __PS3.solveLevel(i) / __PS3.autoSolve()
  window.__PS3 = {
    get game() { return game; },
    get fx() { return fx; },
    get desk() { return desk; },
    get drag() { return drag; },
    get hover() { return hover; },
    get hint() { return hint; },
    get sandbox() { return sandboxLevel; },
    hintNow: function () { return computeHint(); },
    load: function (i) { load(i); },
    solve: function (cap) { return solver.solve(game.level, cap || 200); },
    solveLevel: function (i, cap) { return solver.solve(LEVELS[i], cap || 200); },
    solveCurrent: function (cap) { // 条件求解（M2 提示系统的地基）：锁定当前已放置物品，从当前局面继续
      var preset = game.pieces.filter(function (p) { return p.drawer !== null; }).map(function (p) {
        return { item: p.item, drawer: p.drawer, x: p.x, y: p.y, rot: p.rot || 0 };
      });
      return solver.solve(game.level, cap || 200, preset);
    },
    autoSolve: function () { // 用求解器第一个解走完整流程：验证规则与求解器一致
      var r = solver.solve(game.level, 1);
      if (!r.solvable) return { ok: false, reason: '无解' };
      load(index);
      for (var i = 0; i < r.first.length; i++) {
        var s = r.first[i];
        var p = game.pieces.find(function (q) { return q.item === s.item && q.drawer === null; });
        if (!p) return { ok: false, reason: '找不到待放的 ' + s.item };
        p.rot = s.rot;
        var res = game.place(p.id, s.drawer, s.x, s.y);
        if (!res.ok) return { ok: false, reason: '放置被拒：' + JSON.stringify(s) };
      }
      return { ok: game.won(), won: game.won(), moves: game.moves, slack: game.slackCells() };
    }
  };
  window.__PS3.artCheck = art.verifyAlignment();
  console.log('[桌面收纳] 美术对齐自检：' + (window.__PS3.artCheck.all
    ? '全部通过（' + window.__PS3.artCheck.results.length + ' 个朝向）' : '有失败项！'),
    window.__PS3.artCheck.results);
})(window);
