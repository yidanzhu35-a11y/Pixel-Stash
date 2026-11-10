(function (root) {
  'use strict';
  // 数“本质不同解”：同款文具互换不算新解（枚举时强制同款件按位置序递增）。
  // 到 cap 为止即停止（capped=true 表示“至少这么多”）。
  // 面积恰好相等的关卡会启用精确填满剪枝，速度大幅提升。
  function solve(level, cap) {
    var core = root.StationeryCore;
    cap = cap || 200;
    var types = level.items.slice().sort(function (a, b) {
      var A = core.SHAPES[a].cells.length, B = core.SHAPES[b].cells.length;
      return B - A || (a < b ? -1 : 1); // 面积降序，同款相邻
    });
    var N = types.length;
    var drawers = level.drawers;
    var totalCells = drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
    var totalArea = types.reduce(function (n, t) { return n + core.SHAPES[t].cells.length; }, 0);
    var exact = totalArea === totalCells;

    // 每款每旋转的占格与尺寸
    var variants = {};
    types.forEach(function (t) {
      if (variants[t]) return;
      var sh = core.SHAPES[t];
      variants[t] = sh.rots.map(function (deg) {
        return { deg: deg, cells: core.rotatedCells(sh, deg), dims: core.rotatedDims(sh, deg) };
      });
    });

    // 后缀面积（剪枝用）
    var suffixArea = new Array(N + 1).fill(0);
    for (var i = N - 1; i >= 0; i--) suffixArea[i] = suffixArea[i + 1] + core.SHAPES[types[i]].cells.length;

    var grids = drawers.map(function (d) { return new Uint8Array(d.w * d.h); });
    var placedArea = 0;
    var count = 0, capped = false, first = null;
    var stack = [];
    var lastKey = new Array(N).fill(null);

    function cmp(a, b) { // 字典序：旋转序号、抽屉、x、y
      for (var k = 0; k < 4; k++) { if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1; }
      return 0;
    }
    function tryCells(d, v, x, y) {
      var dw = drawers[d].w, grid = grids[d];
      for (var c = 0; c < v.cells.length; c++) {
        if (grid[(y + v.cells[c][1]) * dw + (x + v.cells[c][0])]) return false;
      }
      return true;
    }
    function setCells(d, v, x, y, val) {
      var dw = drawers[d].w, grid = grids[d];
      for (var c = 0; c < v.cells.length; c++) {
        grid[(y + v.cells[c][1]) * dw + (x + v.cells[c][0])] = val;
      }
    }

    function dfs(i) {
      if (count >= cap) { capped = true; return; }
      if (i === N) {
        count++;
        if (!first) first = stack.map(function (s) {
          return { type: s[1], rot: s[2], drawer: s[3], x: s[4], y: s[5] };
        });
        return;
      }
      var free = totalCells - placedArea;
      if (suffixArea[i] > free) return;             // 剩余文具放不下剩余空格
      if (exact && suffixArea[i] !== free) return;  // 精确填满关：必须逐步填满
      var t = types[i];
      var vs = variants[t];
      for (var ri = 0; ri < vs.length; ri++) {
        var v = vs[ri];
        for (var d = 0; d < drawers.length; d++) {
          var dw = drawers[d];
          if (v.dims.w > dw.w || v.dims.h > dw.h) continue;
          for (var y = 0; y + v.dims.h <= dw.h; y++) {
            for (var x = 0; x + v.dims.w <= dw.w; x++) {
              var cur = [ri, d, x, y];
              if (i > 0 && types[i - 1] === t && cmp(cur, lastKey[i - 1]) <= 0) continue; // 同款去重
              if (!tryCells(d, v, x, y)) continue;
              setCells(d, v, x, y, 1);
              placedArea += v.cells.length;
              lastKey[i] = cur;
              stack.push([i, t, v.deg, d, x, y]);
              dfs(i + 1);
              stack.pop();
              placedArea -= v.cells.length;
              setCells(d, v, x, y, 0);
              if (capped) return;
            }
          }
        }
      }
    }
    dfs(0);
    return { solvable: count > 0, count: count, capped: capped, exact: exact,
             totalCells: totalCells, totalArea: totalArea, first: first };
  }

  var api = { solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StationerySolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
