(function (root) {
  'use strict';
  // 输入：关卡（抽屉、待收纳物品、固定物品）＋可选 preset（当前已放置并锁定的实例）。
  // 输出：是否可完成、完整参考解、本质不同解数量（到 cap 为止，capped=true 表示至少这么多）。
  // 数「本质不同解」：同款物品互换不算新解（枚举时强制同款按位置序递增）。
  // 面积恰好相等（余量=0）时启用精确填满剪枝；固定物与镂空（孔=普通空格）天然参与搜索。
  // maxNodes：搜索节点预算（默认无限）。超预算提前中止并标记 timeout=true——此时 count/solvable
  // 都只是部分结果，调用方必须把 timeout 当「未知」处理（生成器拒绝、提示系统答「再试」），不能当无解。
  // 节点数对同一份输入是确定的（与机器速度无关），适合作为可复现的预算单位。
  function solve(level, cap, preset, maxNodes) {
    var core = root.StationeryCore;
    cap = cap || 200;
    var SHAPES = core.SHAPES, ITEMS = core.ITEMS;
    function shapeOf(t) { return SHAPES[ITEMS[t].shape]; }
    var drawers = level.drawers;

    // 待收纳池（preset 中已放置的实例从池中扣除，保持原样不枚举）
    var pool = level.pieces.map(core.itemOf);
    preset = preset || [];
    for (var pi = 0; pi < preset.length; pi++) {
      var idx = pool.indexOf(preset[pi].item);
      if (idx < 0) return { solvable: false, presetIllegal: true, reason: 'preset 引用了关卡之外的物品：' + preset[pi].item };
      pool.splice(idx, 1);
    }

    var types = pool.slice().sort(function (a, b) {
      var A = shapeOf(a).cells.length, B = shapeOf(b).cells.length;
      return B - A || (a < b ? -1 : 1); // 面积降序，同款相邻
    });
    var N = types.length;
    var totalCells = drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
    var totalArea = types.reduce(function (n, t) { return n + shapeOf(t).cells.length; }, 0);

    var variants = {};
    types.forEach(function (t) {
      if (variants[t]) return;
      var sh = shapeOf(t);
      variants[t] = sh.rots.map(function (deg) {
        return { deg: deg, cells: core.rotatedCells(sh, deg), dims: core.rotatedDims(sh, deg) };
      });
    });
    var suffixArea = new Array(N + 1).fill(0);
    for (var i = N - 1; i >= 0; i--) suffixArea[i] = suffixArea[i + 1] + shapeOf(types[i]).cells.length;

    var grids = drawers.map(function (d) { return new Uint8Array(d.w * d.h); });

    function stamp(cells, d, x, y) { // 越界或冲突返回 false
      var dw = drawers[d].w, dh = drawers[d].h, grid = grids[d];
      for (var c = 0; c < cells.length; c++) {
        var gx = x + cells[c][0], gy = y + cells[c][1];
        if (gx < 0 || gy < 0 || gx >= dw || gy >= dh) return false;
        if (grid[gy * dw + gx]) return false;
      }
      for (var c2 = 0; c2 < cells.length; c2++) grid[(y + cells[c2][1]) * dw + (x + cells[c2][0])] = 1;
      return true;
    }

    // 固定物预占格（关卡数据问题单独标记，与「无解」区分）
    var fixedArea = 0, fixedInvalid = false;
    (level.fixed || []).forEach(function (f) {
      var sh = shapeOf(f.item);
      if (!stamp(core.rotatedCells(sh, f.rot || 0), f.drawer, f.x, f.y)) fixedInvalid = true;
      else fixedArea += sh.cells.length;
    });
    if (fixedInvalid) return { solvable: false, fixedInvalid: true, reason: '固定物越界或互相重叠' };

    // preset 预占格（条件求解：从当前局面继续）
    var presetArea = 0, presetIllegal = false;
    preset.forEach(function (s) {
      var sh = shapeOf(s.item);
      if (!stamp(core.rotatedCells(sh, s.rot || 0), s.drawer, s.x, s.y)) presetIllegal = true;
      else presetArea += sh.cells.length;
    });
    if (presetIllegal) return { solvable: false, presetIllegal: true, reason: 'preset 布局非法（重叠或越界）' };

    var exact = totalArea === (totalCells - fixedArea - presetArea);
    var placedArea = fixedArea + presetArea;
    var count = 0, capped = false, first = null;
    var nodes = 0, timedOut = false;
    var nodeLimit = (typeof maxNodes === 'number' && maxNodes > 0) ? maxNodes : Infinity;
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
      if (++nodes > nodeLimit) { timedOut = true; return; }
      if (i === N) {
        count++;
        if (!first) first = stack.map(function (s) {
          return { item: s[1], rot: s[2], drawer: s[3], x: s[4], y: s[5] };
        });
        return;
      }
      var free = totalCells - placedArea;
      if (suffixArea[i] > free) return;             // 剩余物品放不下剩余空格
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
              if (capped || timedOut) return;
            }
          }
        }
      }
    }
    dfs(0);
    return { solvable: count > 0, count: count, capped: capped, exact: exact,
             timeout: timedOut, nodes: nodes,
             totalCells: totalCells, totalArea: totalArea, fixedArea: fixedArea,
             presetArea: presetArea, first: first };
  }

  var api = { solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StationerySolver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
