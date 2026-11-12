(function (root) {
  'use strict';
  // —— 数据分层（50 关项目规划 §8.1）——
  // SHAPES：纯逻辑形状（占格与允许朝向），可被多个物品复用。
  // ITEMS ：物品（名称、主题、引用形状）；正式生图素材接入时在这里绑定图片。
  // 关卡通过 item 引用物品、物品通过 shape 引用形状；实例（pieces/fixed）再引用物品。
  // 铁律不变：视觉占格 = 逻辑占格，art.js 按同一份 cells 绘制并自检。
  var SHAPES = {
    eraser:  { w: 2, h: 2, cells: [[0,0],[1,0],[0,1],[1,1]], rots: [0] },
    corr:    { w: 2, h: 1, cells: [[0,0],[1,0]], rots: [0,90] },
    hl:      { w: 3, h: 1, cells: [[0,0],[1,0],[2,0]], rots: [0,90] },
    pencil:  { w: 5, h: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0]], rots: [0,90] },
    ruler:   { w: 6, h: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]], rots: [0,90] },
    note:    { w: 2, h: 3, cells: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], rots: [0,90] },
    tri:     { w: 3, h: 3, cells: [[0,0],[0,1],[1,1],[0,2],[1,2],[2,2]], rots: [0,90,180,270] },
    tape:    { w: 3, h: 3, cells: [[1,0],[0,1],[1,1],[2,1],[1,2]], rots: [0] },
    stapler: { w: 2, h: 3, cells: [[0,0],[1,0],[0,1],[1,1],[0,2]], rots: [0,90,180,270] },
    // 镂空验证形状：4×4 环，中间 2×2 不占格（真孔，可放小件）。
    ring:    { w: 4, h: 4, cells: [[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[0,3],[1,3],[2,3],[3,3]], rots: [0] }
  };

  var ITEMS = {
    eraser:  { name: '橡皮',     theme: 'stationery', shape: 'eraser' },
    corr:    { name: '修正带',   theme: 'stationery', shape: 'corr' },
    hl:      { name: '荧光笔',   theme: 'stationery', shape: 'hl' },
    pencil:  { name: '铅笔',     theme: 'stationery', shape: 'pencil' },
    ruler:   { name: '直尺',     theme: 'stationery', shape: 'ruler' },
    note:    { name: '笔记本',   theme: 'stationery', shape: 'note' },
    tri:     { name: '三角尺',   theme: 'stationery', shape: 'tri' },
    tape:    { name: '圆形胶带', theme: 'stationery', shape: 'tape' },
    stapler: { name: '订书机',   theme: 'stationery', shape: 'stapler' },
    // M1 镂空机制占位物品：正式版在日用品主题转正（规划 §7.2 空心发绳）。
    hairTie: { name: '空心发绳', theme: 'daily', shape: 'ring', placeholder: true }
  };

  function rotatedCells(shape, deg) {
    if (deg === 0) return shape.cells.slice();
    if (deg === 90) return shape.cells.map(function (c) { return [shape.h - 1 - c[1], c[0]]; });
    if (deg === 180) return shape.cells.map(function (c) { return [shape.w - 1 - c[0], shape.h - 1 - c[1]]; });
    return shape.cells.map(function (c) { return [c[1], shape.w - 1 - c[0]]; });
  }
  function rotatedDims(shape, deg) {
    if (deg === 90 || deg === 270) return { w: shape.h, h: shape.w };
    return { w: shape.w, h: shape.h };
  }
  function shapeOfItem(item) { return SHAPES[ITEMS[item].shape]; }
  function cellsOfItem(item, rot) { return rotatedCells(shapeOfItem(item), rot || 0); }
  function cellsOf(piece) { return cellsOfItem(piece.item, piece.rot); }
  function itemOf(pc) { return typeof pc === 'string' ? pc : pc.item; }
  function mulberry32(a) { // 确定性随机：桌面散乱摆放在重开后保持一致
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // —— 关卡 ——
  // drawers：1–3 个抽屉（w 列 × h 行）。
  // pieces：待收纳实例清单（同款可多件；对象形式可带初始 rot）。
  // 待收纳物品 drawer === null 时在「桌面」自由摊放：(x,y) 为格单位的小数坐标（左上锚点）；
  // 桌面只是摊放区，不参与任何合法性判定（A Little to the Left 式的随手摆放）。
  // fixed：固定物品（开局已在抽屉里、位置朝向固定、不可移动取回；
  //         占格参与碰撞/旋转/求解，但不计入待收纳任务）。
  // 通关 = 全部待收纳物品都在抽屉里；允许空隙（精确填满关除外）。
  // 注：不做逐关文字教学（note 字段已移除）——规则统一放页脚，反馈交给状态栏与即时预览。
  var LEVELS = [
    { name: '先把文具收进来',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'eraser' }, { item: 'eraser' }, { item: 'hl' }, { item: 'hl' }, { item: 'pencil' }, { item: 'corr' }] },
    { name: '圆的和大件的',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      pieces: [{ item: 'tape' }, { item: 'note' }, { item: 'ruler' }, { item: 'eraser' }, { item: 'eraser' }, { item: 'corr' }, { item: 'corr' }] },
    { name: '刚刚好',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      pieces: [{ item: 'pencil' }, { item: 'pencil' }, { item: 'ruler' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }, { item: 'tri' }, { item: 'stapler' }] },
    { name: '钉住的直尺',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'ruler', drawer: 0, x: 0, y: 1 }],
      pieces: [{ item: 'pencil' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }, { item: 'note' }] },
    { name: '套圈圈',
      drawers: [{ w: 6, h: 2 }, { w: 5, h: 5 }],
      pieces: [{ item: 'hairTie' }, { item: 'eraser' }, { item: 'ruler' }, { item: 'pencil' }, { item: 'hl' }] },
    { name: '三个抽屉',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      pieces: [{ item: 'hairTie' }, { item: 'eraser' }, { item: 'ruler' }, { item: 'pencil' }, { item: 'pencil' }, { item: 'tri' }, { item: 'corr' }] }
  ];

  function Game(level) {
    this.level = level;
    this.pieces = level.pieces.map(function (pc, i) {
      return { id: i + 1, item: itemOf(pc), rot: (pc && pc.rot) || 0, drawer: null, x: 0, y: 0 };
    });
    this.fixed = (level.fixed || []).map(function (f) {
      return { item: f.item, rot: f.rot || 0, drawer: f.drawer, x: f.x, y: f.y };
    });
    this.moves = 0;
    this.pop = { id: 0, t: 0 }; // 放置成功的小回弹动画
  }
  Game.prototype.piece = function (id) {
    return this.pieces.find(function (p) { return p.id === id; }) || null;
  };
  // 可移动物品（固定物不在 pieces 里，永远不上桌面、不计入待收纳）
  Game.prototype.inDrawer = function (d) {
    return this.pieces.filter(function (p) { return p.drawer === d; });
  };
  Game.prototype.fixedIn = function (d) {
    return this.fixed.filter(function (f) { return f.drawer === d; });
  };
  Game.prototype.fixedAt = function (drawer, x, y) {
    return this.fixed.find(function (f) {
      return f.drawer === drawer && cellsOfItem(f.item, f.rot).some(function (c) {
        return f.x + c[0] === x && f.y + c[1] === y;
      });
    }) || null;
  };
  // —— 桌面自由摊放 ——
  // scatterTray：开局散乱摆放（带缝隙和抖动，种子确定，重开一致）。
  Game.prototype.scatterTray = function (w, h, seed) {
    this.tray = { w: w, h: h };
    var rnd = mulberry32(seed >>> 0);
    var cx = 0, cy = 0, rowH = 0;
    this.pieces.forEach(function (p) {
      var rd = rotatedDims(shapeOfItem(p.item), p.rot || 0);
      if (cx > 0 && cx + rd.w > w) { cy += rowH + .5; cx = 0; rowH = 0; }
      p.drawer = null;
      p.x = Math.max(0, cx + (rnd() - .5) * .3);
      p.y = Math.max(0, cy + (rnd() - .5) * .25);
      cx += rd.w + .3 + rnd() * .5;
      rowH = Math.max(rowH, rd.h);
    });
  };
  // traySpot：回桌面时找与现有物品重叠最少的位置（实在挤就允许堆着）。
  Game.prototype.traySpot = function (piece) {
    var t = this.tray || { w: 12, h: 9 };
    var rd = rotatedDims(shapeOfItem(piece.item), piece.rot || 0);
    var others = this.pieces.filter(function (p) { return p.drawer === null && p.id !== piece.id; });
    var best = { x: 0, y: 0 }, bestScore = Infinity;
    for (var y = 0; y + rd.h <= t.h + 1e-9; y += .5) {
      for (var x = 0; x + rd.w <= t.w + 1e-9; x += .5) {
        var score = 0;
        for (var i = 0; i < others.length; i++) {
          var q = others[i], qd = rotatedDims(shapeOfItem(q.item), q.rot || 0);
          score += Math.max(0, Math.min(x + rd.w, q.x + qd.w) - Math.max(x, q.x)) *
                   Math.max(0, Math.min(y + rd.h, q.y + qd.h) - Math.max(y, q.y));
        }
        score += x * .02 + y * .1; // 轻微偏好上方、左侧
        if (score < bestScore) { bestScore = score; best = { x: x, y: y }; }
      }
    }
    return best;
  };
  Game.prototype.bringTop = function (id) { // 拿起时置顶（桌面堆放的视觉层级）
    var i = this.pieces.findIndex(function (p) { return p.id === id; });
    if (i >= 0 && i < this.pieces.length - 1) this.pieces.push(this.pieces.splice(i, 1)[0]);
  };
  Game.prototype.loose = function () {
    return this.pieces.filter(function (p) { return p.drawer === null; });
  };
  Game.prototype.won = function () {
    return this.loose().length === 0;
  };
  // 余量（规划 §5.1）：抽屉总格数 − 固定物占格 − 待收纳物品总占格
  Game.prototype.slackCells = function () {
    var total = this.level.drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
    var used = this.fixed.reduce(function (n, f) { return n + cellsOfItem(f.item, f.rot).length; }, 0);
    used += this.pieces.reduce(function (n, p) { return n + cellsOf(p).length; }, 0);
    return total - used;
  };
  Game.prototype.check = function (id, drawer, x, y) {
    var p = this.piece(id);
    if (!p || !Number.isInteger(drawer) || !this.level.drawers[drawer] ||
        !Number.isInteger(x) || !Number.isInteger(y))
      return { ok: false, reason: '请选择抽屉里的格子。' };
    var d = this.level.drawers[drawer];
    var cells = cellsOf(p);
    for (var i = 0; i < cells.length; i++) {
      var cx = x + cells[i][0], cy = y + cells[i][1];
      if (cx < 0 || cy < 0 || cx >= d.w || cy >= d.h)
        return { ok: false, reason: '这里放不下，换个位置试试。' };
    }
    var occupied = {};
    this.inDrawer(drawer).forEach(function (q) {
      if (q.id === id) return;
      cellsOf(q).forEach(function (c) { occupied[(q.x + c[0]) + ',' + (q.y + c[1])] = 1; });
    });
    // 固定物永远占格，任何物品都不能重叠
    this.fixedIn(drawer).forEach(function (f) {
      cellsOfItem(f.item, f.rot).forEach(function (c) { occupied[(f.x + c[0]) + ',' + (f.y + c[1])] = 1; });
    });
    for (var j = 0; j < cells.length; j++) {
      if (occupied[(x + cells[j][0]) + ',' + (y + cells[j][1])])
        return { ok: false, reason: '这里已经有物品了，可以先把它移开。' };
    }
    return { ok: true };
  };
  Game.prototype.fitRemaining = function (id, drawer) { // 仅当整片剩余空格恰好等于这件物品时自动选朝向和落点
    var p = this.piece(id), d = this.level.drawers[drawer];
    if (!p || !d || p.drawer === drawer) return null;
    var occupied = {};
    this.inDrawer(drawer).concat(this.fixedIn(drawer)).forEach(function (q) {
      cellsOf(q).forEach(function (c) { occupied[(q.x + c[0]) + ',' + (q.y + c[1])] = true; });
    });
    var empty = [];
    for (var y = 0; y < d.h; y++) for (var x = 0; x < d.w; x++) {
      if (!occupied[x + ',' + y]) empty.push([x, y]);
    }
    var shape = shapeOfItem(p.item);
    if (empty.length !== shape.cells.length) return null;
    var minX = Math.min.apply(null, empty.map(function (c) { return c[0]; }));
    var minY = Math.min.apply(null, empty.map(function (c) { return c[1]; }));
    var emptyKeys = {};
    empty.forEach(function (c) { emptyKeys[c[0] + ',' + c[1]] = true; });
    var rots = [p.rot || 0].concat(shape.rots.filter(function (r) { return r !== (p.rot || 0); }));
    for (var i = 0; i < rots.length; i++) {
      var cells = rotatedCells(shape, rots[i]);
      if (cells.every(function (c) { return emptyKeys[(minX + c[0]) + ',' + (minY + c[1])]; }))
        return { drawer: drawer, x: minX, y: minY, rot: rots[i] };
    }
    return null;
  };
  Game.prototype.place = function (id, drawer, x, y) {
    var result = this.check(id, drawer, x, y);
    if (!result.ok) return result;
    var p = this.piece(id);
    if (p.drawer === drawer && p.x === x && p.y === y) return { ok: true, wasNoop: true };
    Object.assign(p, { drawer: drawer, x: x, y: y });
    this.moves++;
    this.pop = { id: id, t: performance.now() };
    return { ok: true, won: this.won() };
  };
  Game.prototype.returnPiece = function (id) {
    var p = this.piece(id);
    if (!p) return { ok: false, reason: '请先选一件物品。' };
    if (p.drawer !== null) {
      p.drawer = null;
      var spot = this.traySpot(p);
      p.x = spot.x; p.y = spot.y;
      this.moves++;
    }
    return { ok: true };
  };
  Game.prototype.rotatePiece = function (id) {
    var p = this.piece(id);
    if (!p) return { ok: false, reason: '请先选一件物品。' };
    var sh = shapeOfItem(p.item);
    if (sh.rots.length < 2) return { ok: false, reason: ITEMS[p.item].name + '转不转都一样～' };
    var idx = sh.rots.indexOf(p.rot || 0);
    var next = sh.rots[(idx + 1) % sh.rots.length];
    if (p.drawer === null) { // 桌面上：围绕视觉中心换方向
      var rd0 = rotatedDims(sh, p.rot || 0);
      var tcx = p.x + rd0.w / 2, tcy = p.y + rd0.h / 2;
      p.rot = next;
      var rd1 = rotatedDims(sh, next);
      var maxX = this.tray ? Math.max(0, this.tray.w - rd1.w) : Infinity;
      p.x = Math.max(0, Math.min(tcx - rd1.w / 2, maxX));
      p.y = Math.max(0, tcy - rd1.h / 2);
      return { ok: true, rotated: true };
    }
    // 已放置：任何时候点一下都换方向。原位置放不下时，就近找合法位置；整个抽屉都放不下时带着新方向回桌面。
    var oldRd = rotatedDims(sh, p.rot || 0);
    var cx = p.x + oldRd.w / 2, cy = p.y + oldRd.h / 2;
    p.rot = next;
    if (this.check(id, p.drawer, p.x, p.y).ok) {
      this.moves++;
      this.pop = { id: id, t: performance.now() };
      return { ok: true, rotated: true };
    }
    var spot = this.findNearestSpot(id, p.drawer, cx, cy);
    if (spot) {
      p.x = spot.x; p.y = spot.y;
      this.moves++;
      this.pop = { id: id, t: performance.now() };
      return { ok: true, rotated: true, shifted: true };
    }
    p.drawer = null;
    var spot2 = this.traySpot(p);
    p.x = spot2.x; p.y = spot2.y;
    this.moves++;
    return { ok: true, rotated: true, returned: true };
  };
  // 在 drawer 内为当前朝向找离 (cx,cy) 最近的合法锚点（固定物占格自然被 check 排除）
  Game.prototype.findNearestSpot = function (id, drawer, cx, cy) {
    var p = this.piece(id);
    var sh = shapeOfItem(p.item);
    var rd = rotatedDims(sh, p.rot || 0);
    var d = this.level.drawers[drawer];
    var best = null, bestD = Infinity;
    for (var y = 0; y + rd.h <= d.h; y++) {
      for (var x = 0; x + rd.w <= d.w; x++) {
        if (!this.check(id, drawer, x, y).ok) continue;
        var dx = x + rd.w / 2 - cx, dy = y + rd.h / 2 - cy;
        var dist = dx * dx + dy * dy;
        if (dist < bestD) { bestD = dist; best = { x: x, y: y }; }
      }
    }
    return best;
  };
  Game.prototype.serialize = function () {
    return {
      drawers: this.level.drawers,
      pieces: this.pieces.map(function (p) {
        return { id: p.id, item: p.item, rot: p.rot, drawer: p.drawer, x: p.x, y: p.y };
      }),
      fixed: this.fixed
    };
  };

  var api = { SHAPES: SHAPES, ITEMS: ITEMS, LEVELS: LEVELS, Game: Game, cellsOf: cellsOf,
              cellsOfItem: cellsOfItem, shapeOfItem: shapeOfItem, itemOf: itemOf,
              rotatedCells: rotatedCells, rotatedDims: rotatedDims };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StationeryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
