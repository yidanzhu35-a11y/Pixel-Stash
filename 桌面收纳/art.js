(function (root) {
  'use strict';
  // 物品美术：按物品引用形状（ITEMS[item].shape）的同一份 cells 绘制（视觉占格 = 逻辑占格）。ART 以 itemId 为键。
  // 基准格 44px，内部 2x 渲染；drawPiece 可缩放到任意格宽。
  var C = 44, S = 2, R = 7;
  var core = root.StationeryCore;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function dot(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function face(ctx, cx, cy, sc) {
    sc = sc || 1;
    ctx.fillStyle = '#3a3230'; dot(ctx, cx - 8 * sc, cy - 2 * sc, 2.6 * sc); dot(ctx, cx + 8 * sc, cy - 2 * sc, 2.6 * sc);
    ctx.strokeStyle = '#3a3230'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(cx, cy + 3 * sc, 5 * sc, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(240,130,150,.38)'; dot(ctx, cx - 14 * sc, cy + 5 * sc, 4.5 * sc); dot(ctx, cx + 14 * sc, cy + 5 * sc, 4.5 * sc);
  }

  // —— 每款文具的颜色与细节（细节被裁剪在占格内，坐标基于 44px 基准格）——
  var ART = {
    eraser: { color: '#f7a6bc', detail: function (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,.5)'; roundRect(ctx, 10, 9, 26, 11, 5); ctx.fill();
      face(ctx, 44, 34);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; roundRect(ctx, 8, 60, 72, 22, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(219,148,166,.7)'; ctx.lineWidth = 1.5; roundRect(ctx, 8, 60, 72, 22, 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(219,148,166,.5)'; line(ctx, 20, 65, 20, 77); line(ctx, 68, 65, 68, 77);
    } },
    corr: { color: '#dfe7f0', detail: function (ctx) {
      ctx.strokeStyle = '#a9b8cc'; ctx.lineWidth = 2; line(ctx, 14, 17, 38, 17); line(ctx, 14, 27, 38, 27);
      ctx.fillStyle = '#9db8d9'; roundRect(ctx, 48, 7, 32, 30, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; roundRect(ctx, 52, 10, 10, 24, 3); ctx.fill();
    } },
    hl: { color: '#b5e07f', detail: function (ctx) {
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; line(ctx, 12, 14, 84, 14); line(ctx, 12, 30, 84, 30);
      ctx.fillStyle = '#8fbe54'; roundRect(ctx, 96, 6, 28, 32, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; roundRect(ctx, 100, 10, 8, 24, 3); ctx.fill();
      face(ctx, 26, 22, .7);
    } },
    pencil: { color: '#f6cf5f', detail: function (ctx) {
      ctx.fillStyle = '#eac88f'; ctx.beginPath(); ctx.moveTo(5, 22); ctx.lineTo(36, 7); ctx.lineTo(36, 37); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a5751'; ctx.beginPath(); ctx.moveTo(5, 22); ctx.lineTo(16, 15); ctx.lineTo(16, 29); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(214,178,66,.9)'; ctx.lineWidth = 1.5; line(ctx, 44, 13, 186, 13); line(ctx, 44, 31, 186, 31);
      ctx.fillStyle = '#d3d6db'; ctx.fillRect(188, 6, 6, 32);
      ctx.fillStyle = '#f29bb4'; roundRect(ctx, 196, 8, 16, 28, 4); ctx.fill();
      face(ctx, 112, 21);
    } },
    ruler: { color: '#a9e2cf', holes: [{ x: 44, y: 22, r: 5 }], detail: function (ctx) {
      ctx.strokeStyle = '#6fb9a2'; ctx.lineWidth = 1.6;
      for (var k = 0; k < 6; k++) { line(ctx, 9 + 44 * k, 9, 9 + 44 * k, 21); line(ctx, 27 + 44 * k, 9, 27 + 44 * k, 15); }
      ctx.fillStyle = 'rgba(255,255,255,.55)'; roundRect(ctx, 158, 26, 58, 9, 4); ctx.fill();
    } },
    note: { color: '#c3b1ec', detail: function (ctx) {
      ctx.strokeStyle = '#9f89c9'; ctx.lineWidth = 3.5;
      var ys = [20, 44, 68, 92, 116];
      for (var i = 0; i < ys.length; i++) { ctx.beginPath(); ctx.arc(1, ys[i], 7, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#fffdf8'; roundRect(ctx, 16, 44, 56, 44, 6); ctx.fill();
      ctx.strokeStyle = '#cbb8ee'; ctx.lineWidth = 1.5; roundRect(ctx, 16, 44, 56, 44, 6); ctx.stroke();
      face(ctx, 44, 64, .85);
      ctx.fillStyle = '#f6c453'; dot(ctx, 68, 52, 2.2);
    } },
    tri: { color: '#a8d4f2', alpha: .62, holes: [{ x: 44, y: 88, r: 10 }], detail: function (ctx) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      var pts = [[44, 0], [44, 44], [88, 44], [88, 88], [132, 88], [132, 132]];
      for (var i = 0; i < pts.length; i++) {
        var x = pts[i][0] + (66 - pts[i][0]) * .07, y = pts[i][1] + (66 - pts[i][1]) * .07;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#7fb3d6'; ctx.lineWidth = 2;
      for (var k = 0; k < 3; k++) line(ctx, 7, 44 * k + 13, 15, 44 * k + 13);
    } },
    tape: { color: '#ffb45e', detail: function (ctx) {
      ctx.strokeStyle = '#e69a3c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(66, 66, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(66, 66, 21, 0, Math.PI * 2); ctx.stroke();
      face(ctx, 66, 62);
    } },
    stapler: { color: '#82c9c2', detail: function (ctx) {
      ctx.fillStyle = '#b2e0da'; roundRect(ctx, 5, 6, 78, 26, 7); ctx.fill();
      face(ctx, 44, 19, .75);
      ctx.fillStyle = '#4e8f8c'; dot(ctx, 44, 42, 4.5);
      ctx.strokeStyle = '#4e8f8c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; line(ctx, 12, 108, 40, 108);
    } },
    // 占位发绳（M1 镂空验证）：4×4 环，中心 2×2 保持透明 = 真孔。
    hairTie: { color: '#ef9d8f', detail: function (ctx) {
      ctx.strokeStyle = '#c97a63'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(88, 88, 66, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(88, 88, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(88, 88, 56, -.7, .4); ctx.stroke();
      face(ctx, 88, 24, .8);
      ctx.fillStyle = '#f6c453';
      dot(ctx, 78, 152, 5.5); dot(ctx, 98, 152, 5.5); dot(ctx, 88, 152, 3.5);
    } }
  };
  function cellSet(cells) { var s = {}; cells.forEach(function (c) { s[c[0] + ',' + c[1]] = 1; }); return s; }
  function cellPath(cells) { var p = new Path2D(); cells.forEach(function (c) { p.rect(c[0] * C, c[1] * C, C, C); }); return p; }
  function nbr(set, i, j, w, h) {
    var n = 0, ds = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
    for (var d = 0; d < 4; d++) {
      var x = i + ds[d][0], y = j + ds[d][1];
      if (x >= 0 && y >= 0 && x < w && y < h && set[x + ',' + y]) n++;
    }
    return n;
  }
  var cache = {};
  function getPieceCanvas(key) { // 基础朝向（0°）的整件贴图，44px/格；key = itemId
    if (cache[key]) return cache[key];
    var sh = core.SHAPES[core.ITEMS[key].shape], art = ART[key];
    var cv = document.createElement('canvas');
    cv.width = sh.w * C * S; cv.height = sh.h * C * S;
    var ctx = cv.getContext('2d'); ctx.scale(S, S);
    var set = cellSet(sh.cells);
    // 底色：占格 + 凹角圆一次填充（半透明件无叠影）
    var base = new Path2D();
    sh.cells.forEach(function (c) { base.rect(c[0] * C, c[1] * C, C, C); });
    for (var i = 0; i <= sh.w; i++) for (var j = 0; j <= sh.h; j++) {
      if (nbr(set, i, j, sh.w, sh.h) === 3) { base.moveTo(i * C + R, j * C); base.arc(i * C, j * C, R, 0, Math.PI * 2); }
    }
    ctx.fillStyle = art.color;
    if (art.alpha) ctx.globalAlpha = art.alpha;
    ctx.fill(base);
    ctx.globalAlpha = 1;
    // 凸角圆角：擦除
    ctx.globalCompositeOperation = 'destination-out';
    for (var i2 = 0; i2 <= sh.w; i2++) for (var j2 = 0; j2 <= sh.h; j2++) {
      if (nbr(set, i2, j2, sh.w, sh.h) === 1) { ctx.beginPath(); ctx.arc(i2 * C, j2 * C, R, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // 细节（裁剪在占格内）
    ctx.save(); ctx.clip(cellPath(sh.cells));
    art.detail(ctx);
    ctx.restore();
    // 打孔（直尺/三角尺的挂孔）
    if (art.holes) {
      ctx.globalCompositeOperation = 'destination-out';
      art.holes.forEach(function (h) { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalCompositeOperation = 'source-over';
    }
    cache[key] = cv;
    return cv;
  }
  // 在 (ox,oy) 以 cell 像素/格 画出旋转 deg 的整件物品；key = itemId
  function drawPiece(ctx, key, deg, ox, oy, cell) {
    var sh = core.SHAPES[core.ITEMS[key].shape], pc = getPieceCanvas(key);
    var k = cell / C;
    ctx.save();
    if (deg === 0) {
      ctx.drawImage(pc, ox, oy, sh.w * cell, sh.h * cell);
    } else {
      var rd = core.rotatedDims(sh, deg);
      ctx.translate(ox + rd.w * cell / 2, oy + rd.h * cell / 2);
      ctx.rotate(deg * Math.PI / 180);
      ctx.drawImage(pc, -sh.w * cell / 2, -sh.h * cell / 2, sh.w * cell, sh.h * cell);
    }
    ctx.restore();
  }
  // 对齐自检：每款每朝向画出来，逐格采样中心像素（占格必须有颜色、空格必须透明）
  function verifyAlignment() {
    var results = [], all = true;
    Object.keys(core.ITEMS).forEach(function (key) {
      var sh = core.shapeOfItem(key);
      sh.rots.forEach(function (deg) {
        var rc = core.rotatedCells(sh, deg);
        var rd = core.rotatedDims(sh, deg);
        var cv = document.createElement('canvas');
        cv.width = rd.w * C; cv.height = rd.h * C;
        var ctx = cv.getContext('2d', { willReadFrequently: true });
        drawPiece(ctx, key, deg, 0, 0, C);
        var occ = cellSet(rc);
        var pass = true;
        var fs = [[.5, .5], [.2, .5], [.8, .5], [.5, .2], [.5, .8]];
        for (var y = 0; y < rd.h; y++) for (var x = 0; x < rd.w; x++) {
          var want = !!occ[x + ',' + y];
          for (var f = 0; f < fs.length; f++) {
            var a = ctx.getImageData(Math.round((x + fs[f][0]) * C), Math.round((y + fs[f][1]) * C), 1, 1).data[3];
            if (want && a < 50) pass = false;
            if (!want && a > 50) pass = false;
          }
        }
        results.push({ key: key, deg: deg, pass: pass });
        if (!pass) all = false;
      });
    });
    return { all: all, results: results };
  }

  root.StationeryArt = { drawPiece: drawPiece, verifyAlignment: verifyAlignment, ART: ART };
})(typeof globalThis !== 'undefined' ? globalThis : this);
