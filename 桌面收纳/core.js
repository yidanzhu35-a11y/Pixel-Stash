(function (root) {
  'use strict';
  // 文具形状库 v1（2026-11-09 确认：9 种全要）。
  // cells 为基础朝向（0°）的占格；rots 为该件允许的旋转角度。
  // 铁律：视觉占格 = 逻辑占格，art.js 按同一份 cells 绘制并自检。
  var SHAPES = {
    eraser:  { name: '橡皮',     w: 2, h: 2, cells: [[0,0],[1,0],[0,1],[1,1]], rots: [0] },
    corr:    { name: '修正带',   w: 2, h: 1, cells: [[0,0],[1,0]],             rots: [0,90] },
    hl:      { name: '荧光笔',   w: 3, h: 1, cells: [[0,0],[1,0],[2,0]],       rots: [0,90] },
    pencil:  { name: '铅笔',     w: 5, h: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0]], rots: [0,90] },
    ruler:   { name: '直尺',     w: 6, h: 1, cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]], rots: [0,90] },
    note:    { name: '笔记本',   w: 2, h: 3, cells: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], rots: [0,90] },
    tri:     { name: '三角尺',   w: 3, h: 3, cells: [[0,0],[0,1],[1,1],[0,2],[1,2],[2,2]], rots: [0,90,180,270] },
    tape:    { name: '圆形胶带', w: 3, h: 3, cells: [[1,0],[0,1],[1,1],[2,1],[1,2]],      rots: [0] },
    stapler: { name: '订书机',   w: 2, h: 3, cells: [[0,0],[1,0],[0,1],[1,1],[0,2]],       rots: [0,90,180,270] }
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
  function cellsOf(piece) {
    return rotatedCells(SHAPES[piece.type], piece.rot || 0);
  }

  // 关卡：drawers = 抽屉（w 列 × h 行）；items = 文具清单（同款可多件）。
  // 通关 = 全部文具都在抽屉里；不要求抽屉装满（L1/L2 留空隙，L3 面积恰好相等）。
  var LEVELS = [
    { name: '先把文具收进来',
      note: '把所有文具放进抽屉就通关，不用装满，留一点空隙没关系。点一下文具可以换方向；拖进抽屉、拖回托盘，随时都行。',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      items: ['eraser', 'eraser', 'hl', 'hl', 'pencil', 'corr'] },
    { name: '圆的和大件的',
      note: '圆形胶带放下去，四周会留出小角落，这很正常。先安排大件的位置，小件最后填缝。',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      items: ['tape', 'note', 'ruler', 'eraser', 'eraser', 'corr', 'corr'] },
    { name: '刚刚好',
      note: '这一关的文具面积和抽屉一样大：全部收进去时刚好装满，一个空位都不剩。长条文具和小形状各归各位，想想哪个抽屉装哪类。',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      items: ['pencil', 'pencil', 'ruler', 'hl', 'corr', 'corr', 'tri', 'stapler'] }
  ];

  function Game(level) {
    this.level = level;
    this.pieces = level.items.map(function (t, i) {
      return { id: i + 1, type: t, rot: 0, drawer: null, x: 0, y: 0 };
    });
    this.moves = 0;
    this.pop = { id: 0, t: 0 }; // 放置成功的小回弹动画
  }
  Game.prototype.piece = function (id) {
    return this.pieces.find(function (p) { return p.id === id; }) || null;
  };
  Game.prototype.inDrawer = function (d) {
    return this.pieces.filter(function (p) { return p.drawer === d; });
  };
  Game.prototype.loose = function () {
    return this.pieces.filter(function (p) { return p.drawer === null; });
  };
  Game.prototype.won = function () {
    return this.loose().length === 0;
  };
  Game.prototype.slackCells = function () {
    var total = this.level.drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
    var used = this.pieces.reduce(function (n, p) { return n + cellsOf(p).length; }, 0);
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
    for (var j = 0; j < cells.length; j++) {
      if (occupied[(x + cells[j][0]) + ',' + (y + cells[j][1])])
        return { ok: false, reason: '这里已经有文具了，可以先把它移开。' };
    }
    return { ok: true };
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
    if (!p) return { ok: false, reason: '请先选一件文具。' };
    if (p.drawer !== null) { p.drawer = null; p.x = 0; p.y = 0; this.moves++; }
    return { ok: true };
  };
  Game.prototype.rotatePiece = function (id) {
    var p = this.piece(id);
    if (!p) return { ok: false, reason: '请先选一件文具。' };
    var sh = SHAPES[p.type];
    if (sh.rots.length < 2) return { ok: false, reason: SHAPES[p.type].name + '转不转都一样～' };
    var idx = sh.rots.indexOf(p.rot || 0);
    var next = sh.rots[(idx + 1) % sh.rots.length];
    if (p.drawer === null) { p.rot = next; return { ok: true, rotated: true }; }
    // 已放置：任何时候点一下都换方向。原位置放不下时，就近找合法位置；整个抽屉都放不下时带着新方向回托盘。
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
    p.drawer = null; p.x = 0; p.y = 0;
    this.moves++;
    return { ok: true, rotated: true, returned: true };
  };
  // 在 drawer 内为当前朝向找离 (cx,cy) 最近的合法锚点
  Game.prototype.findNearestSpot = function (id, drawer, cx, cy) {
    var p = this.piece(id);
    var sh = SHAPES[p.type];
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
        return { id: p.id, type: p.type, rot: p.rot, drawer: p.drawer, x: p.x, y: p.y };
      })
    };
  };

  var api = { SHAPES: SHAPES, LEVELS: LEVELS, Game: Game, cellsOf: cellsOf, rotatedCells: rotatedCells, rotatedDims: rotatedDims };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StationeryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
