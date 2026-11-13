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
  var tutorial = null, winTimer = 0;
  var dragRaf = 0, landing = null;
  // 新道具登场（规划 §4 教学）：首次出现的物品逐张亮相，点按推进；介绍过的记入存档（seen），重开不再打扰
  var introSeq = null, introPulse = null, introRaf = 0;
  var INTRO_CAP = 5;   // 一关最多介绍 5 款：正常关 ≤4 款，上限防跳关测试时刷屏
  var INTRO_REDUCE = false;
  try { INTRO_REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var WIN_PRAISES = ['你太棒了！', '你真是收纳大师！', '收得真漂亮！', '这也太整齐了！', '漂亮，全部归位！',
    '小空间，大本事！', '整理高手就是你！', '这一手，真利落！', '每件都有好位置！', '又一桌清爽！'];
  var praiseBag = [], lastPraise = '';
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
    if (!p || !p.unlocked) p = { unlocked: 1, done: [], seen: [] };
    p.unlocked = LEVELS.length; // 原型测试阶段：全关卡直接开放，便于任意跳关测试（正式版恢复逐关解锁）
    return p;
  }
  function save(p) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e) {} }
  function say(msg, err) { var s = $('status'); s.textContent = msg; s.classList.toggle('error', !!err); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function nextPraise() {
    if (!praiseBag.length) {
      praiseBag = WIN_PRAISES.slice();
      for (var i = praiseBag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), temp = praiseBag[i]; praiseBag[i] = praiseBag[j]; praiseBag[j] = temp;
      }
      if (praiseBag[praiseBag.length - 1] === lastPraise) {
        var first = praiseBag[0]; praiseBag[0] = praiseBag[praiseBag.length - 1]; praiseBag[praiseBag.length - 1] = first;
      }
    }
    lastPraise = praiseBag.pop(); return lastPraise;
  }
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

  function tutorialStep() {
    if (!tutorial || game.won()) return 4;
    if (!tutorial.placed) return 0;
    if (!tutorial.rotated) return 1;
    if (!tutorial.adjusted) return 2;
    return 3;
  }
  function renderTutorial() {
    var active = tutorial && !tutorial.skipped, step = tutorialStep();
    $('tutorial').hidden = !active;
    $('tutorialShow').hidden = !tutorial || active;
    if (!active) return;
    var titles = ['先把橡皮拖进抽屉', '点一下物品，换个方向', '放进去以后，也能重新调整', '把剩下的物品都收好', '操作学会了，全部收齐！'];
    var texts = ['绿色圈出的是真实物品。按住它拖进格子，松手后右侧件数会增加。',
      '试试点一下笔记本。旋转能帮你利用空间；键盘也可以按 R。',
      '拖动抽屉里的一件物品换个位置，或拖回外面的桌面，再放进去。',
      '先安排大件，再用短条填缝。六件物品全部放入即可，最后会留下两格空位。',
      '这一关只剩两格空位。后面也可以随时旋转和重新整理。'];
    $('tutorialCount').textContent = step === 4 ? '新手引导 · 完成' : '新手引导 · ' + (step + 1) + ' / 4';
    $('tutorialTitle').textContent = titles[step]; $('tutorialText').textContent = texts[step];
    $('tutorialSkip').textContent = step === 4 ? '收起教学' : '跳过教学';
    $('tutorial').querySelectorAll('li').forEach(function (li, i) {
      li.classList.toggle('active', i === step); li.classList.toggle('done', i < step);
    });
  }
  function drawGuide(c, p, x, y, s) {
    if (!tutorial || tutorial.skipped || hint || (drag && drag.moved)) return;
    var step = tutorialStep(), target;
    if (step === 0) target = game.loose().find(function (q) { return q.item === 'eraser'; });
    if (step === 1) target = game.pieces.find(function (q) { return q.item === 'note'; });
    if (step === 2) target = game.pieces.find(function (q) { return q.drawer !== null; });
    if (!target || target.id !== p.id) return;
    var rd = dimsOf(p);
    c.save(); c.strokeStyle = '#64854d'; c.lineWidth = 2.5; c.setLineDash([5, 4]);
    rrect(c, x - 3, y - 3, rd.w * s + 6, rd.h * s + 6, 7); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(x + 9, y + 9, 10, 0, Math.PI * 2); c.fillStyle = '#64854d'; c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 12px system-ui';
    c.fillText(String(step + 1), x + 9, y + 9); c.restore();
  }
  // 建议与落点只画占格轮廓，不再复制一件看起来已经收纳的物品。
  function drawTarget(c, item, rot, x, y, s, pad, color, fill) {
    var cells = core.cellsOfItem(item, rot || 0), set = {};
    cells.forEach(function (a) { set[a[0] + ',' + a[1]] = true; });
    c.save(); c.strokeStyle = color; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.fillStyle = fill;
    cells.forEach(function (a) { c.fillRect(pad + (x + a[0]) * s, pad + (y + a[1]) * s, s, s); });
    c.beginPath();
    cells.forEach(function (a) {
      var ax = pad + (x + a[0]) * s, ay = pad + (y + a[1]) * s;
      if (!set[a[0] + ',' + (a[1] - 1)]) { c.moveTo(ax, ay); c.lineTo(ax + s, ay); }
      if (!set[(a[0] + 1) + ',' + a[1]]) { c.moveTo(ax + s, ay); c.lineTo(ax + s, ay + s); }
      if (!set[a[0] + ',' + (a[1] + 1)]) { c.moveTo(ax + s, ay + s); c.lineTo(ax, ay + s); }
      if (!set[(a[0] - 1) + ',' + a[1]]) { c.moveTo(ax, ay + s); c.lineTo(ax, ay); }
    });
    c.stroke(); c.restore();
  }
  function dragTarget(x, y, d) {
    var p = game.piece(d.id), rd = dimsOf(p), best = null, score = -1;
    geometries.forEach(function (g, i) {
      var r = $('drawer-' + i).getBoundingClientRect(), left = r.left + g.pad, top = r.top + g.pad;
      var f = game.level.drawers[i], right = left + f.w * g.s, bottom = top + f.h * g.s;
      var px = x - d.offset.x * g.s, py = y - d.offset.y * g.s;
      var overlap = Math.max(0, Math.min(px + rd.w * g.s, right) - Math.max(px, left)) *
                    Math.max(0, Math.min(py + rd.h * g.s, bottom) - Math.max(py, top));
      var ratio = overlap / (rd.w * rd.h * g.s * g.s);
      var inside = x >= left && x < right && y >= top && y < bottom;
      if (!inside && ratio < .5) return;
      var fit = game.fitRemaining(d.id, i);
      var pos = fit || { drawer: i, x: Math.round((x - left) / g.s - d.offset.x), y: Math.round((y - top) / g.s - d.offset.y), rot: p.rot || 0 };
      pos.valid = !!fit || game.check(d.id, i, pos.x, pos.y).ok;
      var priority = ratio + (inside ? 1 : 0);
      if (priority > score) { best = pos; score = priority; }
    });
    return best;
  }
  function drawDragLayer() {
    var cv = $('dragLayer'), dpr = window.devicePixelRatio || 1;
    var w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    if (!drag || !drag.moved) return;
    var p = game.piece(drag.id), x = drag.clientX - drag.offset.x * desk.s, y = drag.clientY - drag.offset.y * desk.s;
    var rot = p.rot || 0;
    // 物品持续跟手；仅在靠近合法格点时轻柔吸引，避免整段拖动逐格跳跃。
    if (hover && hover.valid && hover.rot === rot) {
      var g = geometries[hover.drawer], r = $('drawer-' + hover.drawer).getBoundingClientRect();
      var tx = r.left + g.pad + hover.x * g.s, ty = r.top + g.pad + hover.y * g.s;
      var dx = tx - x, dy = ty - y, distance = Math.hypot(dx, dy), radius = g.s * .38;
      var t = clamp(1 - distance / radius, 0, 1), strength = .7 * t * t * (3 - 2 * t);
      x += dx * strength; y += dy * strength;
    }
    drag.display = {x:x, y:y, rot:rot};
    c.shadowColor = 'rgba(96,66,28,.25)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    art.drawPiece(c, p.item, rot, x, y, desk.s);
  }
  function queueDragRender() {
    if (dragRaf) return;
    dragRaf = requestAnimationFrame(function () { dragRaf = 0; drawDesk(); drawDrawers(); });
  }
  function cancelDragRender() { cancelAnimationFrame(dragRaf); dragRaf = 0; }
  function drawLanding(c, p, px, py, s, now) {
    if (!landing || landing.id !== p.id) return;
    var t = (now - landing.t) / 360;
    if (t < 0 || t > 1) return;
    var rd = dimsOf(p), cx = px + rd.w*s/2, cy = py + rd.h*s/2;
    c.save(); c.globalAlpha = (1-t)*.85; c.lineWidth = 2;
    c.strokeStyle = '#d8aa45'; c.shadowColor = '#f5ce70'; c.shadowBlur = 8;
    rrect(c, px-2-5*t, py-2-5*t, rd.w*s+4+10*t, rd.h*s+4+10*t, 8); c.stroke();
    c.shadowBlur = 0;
    for (var i=0;i<6;i++) {
      var a=i*Math.PI/3, x=cx+Math.cos(a)*(rd.w*s/2+6+12*t), y=cy+Math.sin(a)*(rd.h*s/2+6+12*t);
      var arm=3*(1-t);
      c.beginPath(); c.moveTo(x-arm,y); c.lineTo(x+arm,y); c.moveTo(x,y-arm); c.lineTo(x,y+arm); c.stroke();
    }
    c.restore();
  }
  // 桌面物品必须留在抽屉外，避免落在底层却看起来已经放入抽屉。
  function settleOnDesk(p) {
    var rd = dimsOf(p), s = desk.s, area = $('desk').getBoundingClientRect();
    var boxes = game.level.drawers.map(function (_, i) {
      var r = $('drawer-' + i).getBoundingClientRect();
      return { x: (r.left - area.left - desk.pad - 5) / s, y: (r.top - area.top - desk.pad - 5) / s,
        w: (r.width + 10) / s, h: (r.height + 10) / s };
    });
    function overlap(x, y, b) { return x < b.x + b.w && x + rd.w > b.x && y < b.y + b.h && y + rd.h > b.y; }
    function clear(x, y, others) {
      if (x < 0 || y < 0 || x + rd.w > desk.w) return false;
      if (boxes.some(function (b) { return overlap(x, y, b); })) return false;
      return !others || !game.loose().some(function (q) {
        if (q.id === p.id) return false;
        var qd = dimsOf(q); return overlap(x, y, {x:q.x, y:q.y, w:qd.w, h:qd.h});
      });
    }
    if (clear(p.x, p.y, false)) return;
    var best = null, dist = Infinity, bottom = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
    for (var y = 0; y <= Math.max(bottom + rd.h + 6, desk.h); y += .5) {
      for (var x = 0; x + rd.w <= desk.w; x += .5) {
        if (!clear(x, y, true)) continue;
        var ds = (x-p.x)*(x-p.x) + (y-p.y)*(y-p.y);
        if (ds < dist) { dist = ds; best = {x:x,y:y}; }
      }
    }
    p.x = best ? best.x : 0; p.y = best ? best.y : bottom + .5;
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
    clearTimeout(winTimer);
    cancelDragRender(); landing = null;
    introSeq = null; introPulse = null; cancelAnimationFrame(introRaf); $('intro').hidden = true; // 登场序列不跨关残留
    index = i; game = new core.Game(LEVELS[i]);
    tutorial = i === 0 && !sandboxLevel ? {placed:false,rotated:false,adjusted:false,skipped:false} : null;
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
        if (p) {
          var pointer = locateF(e.clientX, e.clientY);
          start(e, p.id, { x: pointer.fx - p.x, y: pointer.fy - p.y });
        }
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
        if (e.key === 'r' || e.key === 'R') { e.stopPropagation(); if (selected !== null) rotate(selected); return; }
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
    var fresh = freshItems(i);
    if (fresh.length) startIntro(fresh);
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
    $('progress').textContent = '已收好 ' + (game.pieces.length - loose.length) + ' / ' + game.pieces.length + ' 件';
    renderTutorial();
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
        if (dragging) return;
        var px = pad + p.x * s, py = pad + p.y * s;
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
        drawLanding(c, p, px, py, s, now);
        drawGuide(c, p, px, py, s);
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
      if (hint && hint.drawer === i && hint.x != null) {
        drawTarget(c, hint.item, hint.rot, hint.x, hint.y, s, pad, '#c99625', 'rgba(224,169,60,.10)');
      }
      if (selected !== null && hover && hover.drawer === i) {
        var sp = game.piece(selected);
        var fit = game.fitRemaining(sp.id, i);
        var preview = fit || hover;
        var previewRot = fit ? fit.rot : (sp.rot || 0);
        var valid = !!fit || game.check(sp.id, i, hover.x, hover.y).ok;
        c.save(); c.beginPath(); c.rect(pad, pad, d.w * s, d.h * s); c.clip();
        drawTarget(c, sp.item, previewRot, preview.x, preview.y, s, pad,
          valid ? '#65844d' : '#c45c48', valid ? 'rgba(110,145,75,.08)' : 'rgba(204,87,71,.20)');
        c.restore();
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
    drawDragLayer();
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
      if (dragging) return;
      var px = pad + p.x * s, py = pad + p.y * s;
      c.save();
      c.shadowColor = 'rgba(96,66,28,.28)'; c.shadowBlur = 9; c.shadowOffsetY = 5;
      art.drawPiece(c, p.item, p.rot || 0, px, py, s);
      c.restore();
      drawGuide(c, p, px, py, s);
      if (introPulse && introPulse.ids.indexOf(p.id) >= 0) { // 新道具收尾引导：金色呼吸框（与提示的「拿这件」同语言）
        var rdp = dimsOf(p), kp = .5 + .5 * Math.sin((performance.now() - introPulse.t) / 200 * Math.PI);
        c.save(); c.strokeStyle = 'rgba(224,169,60,' + (.55 + .45 * kp) + ')'; c.lineWidth = 3;
        rrect(c, px - 4, py - 4, rdp.w * s + 8, rdp.h * s + 8, 10); c.stroke(); c.restore();
      }
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
      var busy = (game.pop && now - game.pop.t < 280) || (landing && now - landing.t < 380) || (fx.shake && now - fx.shake.t < 1500);
      drawDrawers();
      if (busy) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function place(id, pos) {
    var p = game.piece(id), fit = game.fitRemaining(id, pos.drawer);
    var fromDrawer = p.drawer;
    var oldRot = p.rot;
    if (fit) { p.rot = fit.rot; pos = fit; }
    var result = game.place(id, pos.drawer, pos.x, pos.y);
    if (!result.ok) p.rot = oldRot;
    if (result.ok) {
      selected = null; hover = null;
      if (result.wasNoop) { render(); return; }
      landing = {id:id,t:performance.now()};
      if (tutorial) tutorial.placed = true;
      if (tutorial && fromDrawer !== null) tutorial.adjusted = true;
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
    settleOnDesk(p);
    if (tutorial && fromDrawer) tutorial.adjusted = true;
    selected = null; hover = null;
    render(); checkHint();
    say(fromDrawer ? '放回桌面了，可以重新安排。' : '在桌上挪了个位置。');
  }
  function rotate(id) {
    var result = game.rotatePiece(id);
    if (result.ok) {
      var p = game.piece(id);
      if (p.drawer === null) settleOnDesk(p);
      if (tutorial) tutorial.rotated = true;
    }
    render();
    if (!result.ok) { say(result.reason, true); return; }
    kickAnim(); checkHint();
    if (result.returned) say('方向换好了，不过这个抽屉放不下，先放回桌面～');
    else if (result.shifted) say('转了个方向，挪到了旁边放得下的位置。');
    else say('转了个方向～');
  }
  function onWin() {
    say('全部 ' + game.pieces.length + ' 件都收好了！');
    var p = progress();
    if (p.done.indexOf(index) < 0) p.done.push(index);
    p.unlocked = Math.max(p.unlocked, Math.min(index + 2, LEVELS.length));
    if (!sandboxLevel) { save(p); refreshLevelOptions(); } // 沙盒试玩不写存档、不刷新解锁标记
    winTimer = setTimeout(function () {
      if (!game.won()) return;
      $('winTitle').textContent = nextPraise();
      $('winText').textContent = sandboxLevel ? '这一桌，收好啦' : '第 ' + (index + 1) + ' 关 · 全部归位';
      var colors = ['#edb83e','#ed987d','#8ab7a2','#b6a0d2','#f1cf6b'];
      var radius = Math.min(innerWidth * .42, 210);
      $('winConfetti').innerHTML = Array.from({length:22}, function (_, i) {
        var angle = i * Math.PI * 2 / 22, reach = radius * (.65 + (i % 4) * .1);
        return '<i style="--x:' + Math.round(Math.cos(angle)*reach) + 'px;--y:' + Math.round(Math.sin(angle)*reach*.75+70) +
          'px;--spin:' + (i*67) + 'deg;--delay:' + (i%5)*30 + 'ms;--confetti-color:' + colors[i%colors.length] + '"></i>';
      }).join('');
      $('next').textContent = sandboxLevel ? '再玩一次 ↻'
                                           : index === LEVELS.length - 1 ? '回到第一关 ↻' : '下一关 →';
      $('win').hidden = false;
    }, 420);
  }

  // —— 新道具登场（规划 §4 教学）：一关含首次出现的物品 → 暗化桌面逐张介绍。MDA：机制=序列卡片+seen 存档，
  //    动态=玩家自己控制节奏（点按推进/戳物品把玩），美学=新鲜感与「先认识再收纳」的胜任感。简约三件套：大物品、名字、一句话。 ——
  function freshItems(i) { // 本关首次登场的物品（pieces 优先、fixed 兜底；去重 + 截断；沙盒试玩不教学）
    if (sandboxLevel) return [];
    var seen = progress().seen || [], out = [];
    LEVELS[i].pieces.concat(LEVELS[i].fixed || []).forEach(function (pc) {
      var id = core.itemOf(pc);
      if (seen.indexOf(id) < 0 && out.indexOf(id) < 0) out.push(id);
    });
    return out.slice(0, INTRO_CAP);
  }
  function markSeen(id) {
    var p = progress(); p.seen = p.seen || [];
    if (p.seen.indexOf(id) < 0) { p.seen.push(id); save(p); }
  }
  function introDemoItem(theme) { // 镂空演示配的小件：同主题占格最小、放得进 2×2 真孔的（日用品→钥匙，零食→糖果）
    var best = null, bestArea = Infinity;
    Object.keys(core.ITEMS).forEach(function (id) {
      var it = core.ITEMS[id];
      if (it.theme !== theme || it.hollow) return;
      var sh = core.shapeOfItem(id);
      if (sh.w > 2 || sh.h > 2) return;
      if (sh.cells.length < bestArea) { bestArea = sh.cells.length; best = id; }
    });
    return best;
  }
  function startIntro(items) {
    introSeq = { items: items, i: 0, t: 0, poke: 0, adv: 0, raf: 0 };
    introShowCard();
  }
  function introShowCard() {
    var id = introSeq.items[introSeq.i], it = core.ITEMS[id];
    introSeq.t = performance.now(); introSeq.poke = 0;
    $('introKicker').textContent = '新道具 · ' + (introSeq.i + 1) + ' / ' + introSeq.items.length;
    $('introName').textContent = it.name;
    $('introText').textContent = it.intro || '';
    $('introNext').textContent = introSeq.i < introSeq.items.length - 1 ? '认识下一个' : '开始收纳';
    $('introDots').innerHTML = introSeq.items.map(function (_, k) {
      return '<i' + (k === introSeq.i ? ' class="on"' : '') + '></i>';
    }).join('');
    $('intro').hidden = false;
    $('introNext').focus();
    cancelAnimationFrame(introSeq.raf);
    var step = function (now) {
      if (!introSeq) return;
      drawIntroStage(now);
      introSeq.raf = requestAnimationFrame(step);
    };
    introSeq.raf = requestAnimationFrame(step);
  }
  function drawIntroStage(now) { // 登场画布：物品以大格宽亮相；back-out 过冲弹出 + 落定轻浮动 + 戳一下摆动
    var cv = $('introCanvas'), dpr = window.devicePixelRatio || 1;
    var W = cv.clientWidth || 296, H = cv.clientHeight || 168;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var id = introSeq.items[introSeq.i], it = core.ITEMS[id];
    var sh = core.shapeOfItem(id), s = Math.min(56, 282 / sh.w, 128 / sh.h);
    var iw = sh.w * s, ih = sh.h * s, cx = W / 2, cy = H / 2 - 8;
    var t = now - introSeq.t, k = 1, bob = 0, rot = 0;
    if (!INTRO_REDUCE) {
      if (t < 340) { // easeOutBack：从 0 弹到过冲再落定（挤压回弹手感）
        var u = t / 340;
        k = 1 + 2.70158 * Math.pow(u - 1, 3) + 1.70158 * Math.pow(u - 1, 2);
      }
      if (t >= 340) bob = Math.sin((t - 340) / 650) * 2.2; // 落定后轻微上下浮动，暗示「活着」
      var pk = now - introSeq.poke;                        // 戳一下：绕中心摆动衰减
      if (introSeq.poke && pk < 460) rot = .13 * Math.sin(pk / 62) * Math.exp(-pk / 300);
    }
    c.save(); // 地面软影：物品是「放上来」的，不是贴上去的
    c.globalAlpha = .2 * Math.max(0, Math.min(1, k));
    c.fillStyle = '#5c3f18';
    c.beginPath();
    c.ellipse(cx, cy + ih / 2 + 16, Math.min(iw / 2, 96) * (.88 + .12 * Math.max(0, Math.min(1, k))), 8.5, 0, 0, Math.PI * 2);
    c.fill(); c.restore();
    c.save();
    c.translate(cx, cy + bob); c.rotate(rot); c.scale(k, k);
    art.drawPiece(c, id, 0, -iw / 2, -ih / 2, s);
    c.restore();
    if (it.hollow && t > 420) drawHoleDemo(c, it.theme, t, cx, cy, s, now, W);
  }
  function drawHoleDemo(c, theme, t, cx, cy, s, now, W) { // 镂空教学：小件从右上飞进 2×2 真孔、落定闪金、渐隐，循环
    var hb = .5 + .5 * Math.sin(now / 460); // 孔的虚线提示（呼吸）
    c.save();
    c.strokeStyle = 'rgba(224,169,60,' + (.32 + .3 * hb) + ')';
    c.lineWidth = 2; c.setLineDash([6, 5]);
    rrect(c, cx - s + 1, cy - s + 1, 2 * s - 2, 2 * s - 2, 7); c.stroke();
    c.restore();
    var did = introDemoItem(theme);
    if (!did) return;
    var dsh = core.shapeOfItem(did), dw = dsh.w * s, dh = dsh.h * s;
    if (INTRO_REDUCE) { art.drawPiece(c, did, 0, cx - dw / 2, cy - dh / 2, s); return; } // 无动画偏好：直接演示结果
    var T = 3200, u = ((t - 420) % T) / T;
    var sx = Math.min(W - dw / 2 - 8, cx + 92), sy = Math.max(dh / 2 + 8, cy - 64);
    var ease = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var alpha = 0, px = cx, py = cy, kk = 1, landed = false;
    if (u < .05) return; // 起手停顿
    if (u < .38) { var m = ease((u - .05) / .33); alpha = Math.min(1, (u - .05) * 6); px = sx + (cx - sx) * m; py = sy + (cy - sy) * m; }
    else if (u < .6) { landed = true; px = cx; py = cy; alpha = 1; kk = 1 + .07 * Math.sin((u - .38) / .22 * Math.PI); }
    else if (u < .76) { px = cx; py = cy; alpha = 1 - (u - .6) / .16; }
    else return;
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (landed) { // 落定瞬间：孔边闪一圈金光，把视线钉在孔上
      c.strokeStyle = 'rgba(224,169,60,' + (.45 * alpha) + ')'; c.lineWidth = 3;
      rrect(c, cx - s - 4, cy - s - 4, 2 * s + 8, 2 * s + 8, 9); c.stroke();
    }
    c.translate(px, py); c.scale(kk, kk);
    art.drawPiece(c, did, 0, -dw / 2, -dh / 2, s);
    c.restore();
  }
  function introAdvance() {
    if (!introSeq) return;
    if (performance.now() - introSeq.adv < 300) return; // 一次操作只推一张卡（防 click+keydown 双触发）
    introSeq.adv = performance.now();
    markSeen(introSeq.items[introSeq.i]);
    introSeq.i++;
    if (introSeq.i >= introSeq.items.length) introFinish();
    else introShowCard();
  }
  function introFinish() { // 全部介绍完：收卡片，桌面上属于新物品的散件亮金色呼吸框 1.8 秒（与提示同一视觉语言）
    var shown = introSeq.items;
    $('intro').hidden = true;
    cancelAnimationFrame(introSeq.raf);
    introSeq = null;
    introPulse = { ids: game.loose().filter(function (p) { return shown.indexOf(p.item) >= 0; }).map(function (p) { return p.id; }),
                   t: performance.now() };
    if (!introPulse.ids.length) return;
    say('新物品来啦——亮金框的就是它们，收进抽屉吧！');
    cancelAnimationFrame(introRaf);
    var last = 0;
    var step = function (now) {
      if (!introPulse) return;
      if (now - introPulse.t > 1800) { introPulse = null; drawDesk(); return; }
      if (now - last > 50) { last = now; drawDesk(); }
      introRaf = requestAnimationFrame(step);
    };
    introRaf = requestAnimationFrame(step);
  }
  function introSkip() { // Esc：整个序列立即收起；未介绍的物品不记 seen（下次登场还会介绍）
    if (!introSeq) return;
    $('intro').hidden = true;
    cancelAnimationFrame(introSeq.raf);
    introSeq = null; introPulse = null;
    say('物品摊在桌面上，拖进抽屉收纳；点一下物品换方向。');
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
      say('提示：把桌面上的「' + name + '」' + (needRot ? '转个方向，' : '') + '放进抽屉 ' + (hint.drawer + 1) + ' 的虚线位置。虚线只是建议，松手后才算放入。');
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
      hover = dragTarget(e.clientX, e.clientY, drag);
      deskHot = inDesk(e.clientX, e.clientY) && game.piece(drag.id).drawer !== null;
      queueDragRender(); return;
    } else if (selected !== null && e.pointerType === 'mouse') {
      hover = locate(e.clientX, e.clientY);
    }
    drawDrawers();
  });
  document.addEventListener('pointerup', function (e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    cancelDragRender();
    var d = drag; drag = null; hover = null; deskHot = false;
    if (d.moved) {
      var target = dragTarget(e.clientX, e.clientY, d);
      if (target) place(d.id, target);
      else if (inDesk(e.clientX, e.clientY)) deskDrop(d, e.clientX, e.clientY);
      else { render(); say('物品留在原处，拖进抽屉或桌面即可。'); }
    } else {
      rotate(d.id); // 点一下（没拖动）= 旋转方向
    }
  });
  document.addEventListener('pointercancel', function () {
    cancelDragRender();
    drag = null; hover = null; deskHot = false;
    if (game) render();
  });
  document.addEventListener('keydown', function (e) {
    if (introSeq) { // 登场序列进行中：Enter/空格推进、Esc 跳过、Tab 焦点留在卡内，其余按键先吞掉（不打到棋盘上）
      if (e.key === 'Escape') { e.preventDefault(); introSkip(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); introAdvance(); }
      else if (e.key === 'Tab') { e.preventDefault(); $('introNext').focus(); }
      return;
    }
    if (e.key === 'Escape') { selected = null; drag = null; hover = null; hint = null; cancelAnimationFrame(hintRaf); $('win').hidden = true; if (game) render(); }
    if ((e.key === 'r' || e.key === 'R') && selected !== null && e.target.tagName !== 'SELECT') rotate(selected);
  });
  $('restart').addEventListener('click', function () { load(index); });
  $('tutorialSkip').addEventListener('click', function () { if (tutorial) { tutorial.skipped = true; render(); } });
  $('tutorialShow').addEventListener('click', function () { if (tutorial) { tutorial.skipped = false; render(); } });
  $('hint').addEventListener('click', function () { // 再点一次 = 收起提示
    if (hint) { hint = null; cancelAnimationFrame(hintRaf); render(); say('提示收起来了，再点一次可以重新拿。'); return; }
    showHint();
  });
  $('level').addEventListener('change', function () { load(Number($('level').value)); });
  $('keep').addEventListener('click', function () { $('win').hidden = true; });
  $('next').addEventListener('click', function () { load((index + 1) % LEVELS.length); });
  // 登场卡交互：点任意处 = 认识这张（含按钮/回车）；点物品本身 = 戳一下让它摆动（不推进，纯把玩）
  $('intro').addEventListener('click', function () { introAdvance(); });
  $('introCanvas').addEventListener('pointerdown', function (e) {
    e.stopPropagation();
    if (introSeq) introSeq.poke = performance.now();
  });
  $('introCanvas').addEventListener('click', function (e) { e.stopPropagation(); });
  addEventListener('resize', function () {
    drag = null; hover = null;
    if (game) { render(); scatterDesk(); drawDesk(); }
  });

  refreshLevelOptions();
  var startIdx = 0, p0 = progress();
  while (startIdx < LEVELS.length - 1 && p0.done.indexOf(startIdx) >= 0) startIdx++;
  var requestedLevel = Number(new URLSearchParams(location.search).get('level'));
  if (Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= LEVELS.length) startIdx = requestedLevel - 1;
  load(Math.min(startIdx, p0.unlocked - 1));

  // 调试 API：__PS3.game / __PS3.solve() / __PS3.solveLevel(i) / __PS3.autoSolve()
  window.__PS3 = {
    get game() { return game; },
    get fx() { return fx; },
    get desk() { return desk; },
    get drag() { return drag; },
    get hover() { return hover; },
    get hint() { return hint; },
    get tutorial() { return tutorial; },
    get sandbox() { return sandboxLevel; },
    get intro() { return introSeq; },
    get introPulse() { return introPulse; },
    get seen() { return progress().seen || []; },
    introSkip: function () { introSkip(); },
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
