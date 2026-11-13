(function (root) {
  'use strict';
  // 关卡生成器（M2 生产工具，规划 §6）：选件 → 生成候选 → 求解验证 → 去重 → 参考解回放。
  // 硬约束：主题一致；1–3 个抽屉；余量在范围内；可解；参考解中无「单物抽屉」（一个抽屉只放一件）；
  //         与既有 LEVELS 及本批候选按签名去重（忽略实例 id / 颜色 / 简单镜像）。
  var core = root.StationeryCore, solver = root.StationerySolver;

  function mulberry32(a) { // 与 core 同一种子随机：同种子同结果，便于复现
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function themeItems(theme) {
    return Object.keys(core.ITEMS).filter(function (k) { return core.ITEMS[k].theme === theme; });
  }
  function areaOf(item) { return core.cellsOfItem(item, 0).length; }

  // 固定物预检：不越界、互不重叠（与待收纳件的关系交给求解器判定）
  function fixedFits(level) {
    var used = {};
    for (var i = 0; i < (level.fixed || []).length; i++) {
      var f = level.fixed[i];
      var d = level.drawers[f.drawer];
      if (!d) return false;
      var cells = core.cellsOfItem(f.item, f.rot || 0);
      for (var j = 0; j < cells.length; j++) {
        var x = f.x + cells[j][0], y = f.y + cells[j][1];
        if (x < 0 || y < 0 || x >= d.w || y >= d.h) return false;
        var key = f.drawer + ':' + x + ',' + y;
        if (used[key]) return false;
        used[key] = 1;
      }
    }
    return true;
  }

  // 去重签名：抽屉尺寸 + 待收纳件多重集 + 固定件多重集（§6.2：同款互换/换色/简单镜像视为重复）
  function signature(level) {
    var ds = level.drawers.map(function (d) { return d.w + 'x' + d.h; }).sort().join('+');
    var ps = level.pieces.map(core.itemOf).sort().join('+');
    var fs = (level.fixed || []).map(function (f) { return f.item; }).sort().join('+');
    return ds + '|' + ps + '|' + fs;
  }

  // 参考解逐步回放（§6.3：通过游戏规则验证，而非只看求解器输出）
  function replay(level, solution) {
    var g = new core.Game(level);
    for (var i = 0; i < solution.length; i++) {
      var s = solution[i];
      var p = g.pieces.find(function (q) { return q.item === s.item && q.drawer === null; });
      if (!p) return { ok: false, reason: '回放找不到待放实例：' + s.item };
      p.rot = s.rot;
      var r = g.place(p.id, s.drawer, s.x, s.y);
      if (!r.ok) return { ok: false, reason: '回放被拒：' + JSON.stringify(s) + ' → ' + r.reason };
    }
    return { ok: g.won(), moves: g.moves };
  }

  // 难度指标（§5.1 的可计算部分）
  function metrics(level, sr) {
    var total = level.drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
    var fixedArea = (level.fixed || []).reduce(function (n, f) { return n + core.cellsOfItem(f.item, f.rot || 0).length; }, 0);
    var area = level.pieces.reduce(function (n, p) { return n + areaOf(core.itemOf(p)); }, 0);
    var rot4 = level.pieces.filter(function (p) {
      return core.SHAPES[core.ITEMS[core.itemOf(p)].shape].rots.length >= 4;
    }).length;
    var isHollow = function (k) { return !!core.ITEMS[k].hollow; };
    var hollow = level.pieces.some(function (p) { return isHollow(core.itemOf(p)); }) ||
                 (level.fixed || []).some(function (f) { return isHollow(f.item); });
    var perDrawer = level.drawers.map(function () { return 0; });
    (sr.first || []).forEach(function (s) { perDrawer[s.drawer]++; });
    return {
      cells: total, area: area, slack: total - fixedArea - area,
      pieces: level.pieces.length, drawers: level.drawers.length, fixed: (level.fixed || []).length,
      rot4: rot4, hollow: hollow, exact: (total - fixedArea - area) === 0,
      solutions: sr.count, capped: sr.capped, perDrawer: perDrawer,
      singleItemDrawer: level.drawers.length > 1 && perDrawer.some(function (n) { return n === 1; })
    };
  }

  // 粗糙难度排序分（仅作批次内排序参考，不作硬门槛；数值越大越难）
  function difficulty(m) {
    var s = 0;
    s += Math.min(30, m.pieces * 3);                 // 物品数量
    s += Math.max(0, 20 - m.slack * 2);              // 空间余量
    s += m.exact ? 10 : 0;                           // 精确填满
    s += m.fixed * 4;                                // 固定物
    s += m.hollow ? 8 : 0;                           // 镂空利用
    s += m.rot4 * 2;                                 // 四向件
    s += Math.max(0, 12 - Math.min(12, m.solutions)); // 解越少越苛刻
    return s;
  }

  // 单关检查报告（§6.3 的程序化部分）
  function validate(level, opts, sr, rp, m) {
    var theme = opts.theme || 'stationery';
    function ck(name, ok, info) { return { name: name, ok: !!ok, info: info || '' }; }
    return [
      ck('主题一致', level.pieces.concat(level.fixed || []).every(function (p) {
        var it = core.ITEMS[core.itemOf(p)]; return it && it.theme === theme;
      })),
      ck('抽屉 1–3 个', level.drawers.length >= 1 && level.drawers.length <= 3),
      ck('至少 2 件待收纳', level.pieces.length >= 2),
      ck('余量在范围 ' + opts.slack[0] + '–' + opts.slack[1], m.slack >= opts.slack[0] && m.slack <= opts.slack[1], '实际 ' + m.slack),
      ck('固定物数量在范围 ' + opts.fixed[0] + '–' + opts.fixed[1], m.fixed >= opts.fixed[0] && m.fixed <= opts.fixed[1], '实际 ' + m.fixed),
      ck('固定物不越界不重叠', fixedFits(level)),
      ck('可解', sr.solvable, '解数 ' + sr.count + (sr.capped ? '+' : '')),
      ck('参考解回放通过', rp.ok, rp.ok ? rp.moves + ' 步' : rp.reason),
      ck('无单物抽屉', !m.singleItemDrawer, m.perDrawer.join('/'))
    ];
  }

  // 主入口：generate(opts) → { candidates, attempts, seed, elapsedMs }
  // opts: { count, seed, theme, drawers:[min,max], w:[min,max], h:[min,max], pieces:[min,max],
  //         slack:[min,max], fixed:[min,max], hollow:bool, cap, prefix, timeBudgetMs,
  //         drawerSets:[[{w,h},...], ...]（指定后忽略 drawers/w/h，按难度曲线精确配置抽屉）,
  //         require:[itemId]（必含物品，先占位再补足面积，用于形状引入关）,
  //         preNodes（先快速证存在性：cap=1 的节点预算，超预算直接拒绝，防无解组合吃光时间）,
  //         maxNodes（完整计数的节点预算，超时同样拒绝——解数计数必须可信） }
  function generate(opts) {
    opts = opts || {};
    var seed = (opts.seed >>> 0) || 1;
    var rnd = mulberry32(seed);
    var ri = function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); };
    var pool = themeItems(opts.theme || 'stationery');
    if (opts.hollow === false) pool = pool.filter(function (k) { return !core.ITEMS[k].hollow; });
    var require = (opts.require || []).filter(function (k) { return pool.indexOf(k) >= 0; });
    var dRange = opts.drawers || [1, 3], wRange = opts.w || [3, 8], hRange = opts.h || [2, 5];
    var pRange = opts.pieces || [4, 9], sRange = opts.slack || [2, 10], fRange = opts.fixed || [0, 0];
    var cap = opts.cap || 200, want = opts.count || 10, timeBudget = opts.timeBudgetMs || 8000;
    var t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    var now = function () { return (typeof performance !== 'undefined' ? performance : Date).now() - t0; };

    var seen = {};
    core.LEVELS.forEach(function (l) { seen[signature(l)] = 1; });
    var out = [], attempts = 0, maxAttempts = want * 120;
    var rejects = { area: 0, pieces: 0, fixed: 0, fixedFit: 0, dup: 0, preSolve: 0, unsolvable: 0, timeout: 0, soloDrawer: 0, replay: 0 }; // 卡点统计：诊断 NO_CANDIDATE 时看哪一环在拒绝
    while (out.length < want && attempts++ < maxAttempts && now() < timeBudget) {
      var nd, drawers;
      if (opts.drawerSets && opts.drawerSets.length) { // 曲线精确配置
        var set = opts.drawerSets[Math.floor(rnd() * opts.drawerSets.length)];
        drawers = set.map(function (d) { return { w: d.w, h: d.h }; });
        nd = drawers.length;
      } else {
        nd = ri(dRange[0], dRange[1]);
        drawers = [];
        for (var i = 0; i < nd; i++) drawers.push({ w: ri(wRange[0], wRange[1]), h: ri(hRange[0], hRange[1]) });
      }
      var total = drawers.reduce(function (n, d) { return n + d.w * d.h; }, 0);
      var slack = ri(sRange[0], sRange[1]);
      var nf = ri(fRange[0], fRange[1]);
      var fixedKeys = []; // 先定固定物清单（只占面积，位置后定），否则余量会被固定物吃掉
      for (var f0 = 0; f0 < nf; f0++) fixedKeys.push(pool[Math.floor(rnd() * pool.length)]);
      var fixedArea = fixedKeys.reduce(function (n, k) { return n + areaOf(k); }, 0);
      var target = total - slack - fixedArea;
      // 计件填充（2026-11-13 重构）：先定目标件数，再按「每步剩余件数框定可取面积范围」选件，
      // 保证恰好 wantPieces 件、面积恰好 target——旧的「随机堆到面积相等」在件数要求严格时几乎必失败
      // （卡点统计：slot 13/16/19 一半耗在面积凑不齐、一半耗在件数不对）。
      var requireArea = require.reduce(function (n, k) { return n + areaOf(k); }, 0);
      if (requireArea > target || target < 4) { rejects.area++; continue; } // 必含物品都超面积，整关重来
      var wantPieces = ri(pRange[0], pRange[1]);
      var need = wantPieces - require.length;
      if (need < 0) { rejects.pieces++; continue; }
      var poolAreas = pool.map(areaOf);
      var minA = Math.min.apply(null, poolAreas), maxA = Math.max.apply(null, poolAreas);
      var rest = target - requireArea;
      var pieces = require.map(function (k) { return { item: k }; });
      var fillOk = rest >= need * minA && rest <= need * maxA;
      for (var fi = 0; fi < need && fillOk; fi++) {
        var left = need - fi - 1; // 本件之后还要选的件数
        var lo = Math.max(minA, rest - left * maxA), hi = Math.min(maxA, rest - left * minA);
        var choices = [];
        for (var ci = 0; ci < pool.length; ci++) {
          if (poolAreas[ci] >= lo && poolAreas[ci] <= hi) choices.push(pool[ci]);
        }
        if (!choices.length) { fillOk = false; break; }
        var ck = choices[Math.floor(rnd() * choices.length)];
        pieces.push({ item: ck }); rest -= areaOf(ck);
      }
      if (!fillOk || rest !== 0) { rejects.area++; continue; }
      if (pieces.length < pRange[0] || pieces.length > pRange[1]) { rejects.pieces++; continue; } // 构造上必然在范围内，留作断言
      var level = { name: (opts.prefix || '候选关') + ' ' + (out.length + 1), drawers: drawers, pieces: pieces };
      for (var f = 0; f < fixedKeys.length; f++) { // 固定物摆位：随机落位，预检不过就换
        var fk = fixedKeys[f];
        var sh = core.SHAPES[core.ITEMS[fk].shape];
        var ok = false;
        for (var t = 0; t < 40 && !ok; t++) {
          var rot = sh.rots[Math.floor(rnd() * sh.rots.length)];
          var rd = core.rotatedDims(sh, rot);
          var di = Math.floor(rnd() * nd);
          var fx = ri(0, Math.max(0, drawers[di].w - rd.w)), fy = ri(0, Math.max(0, drawers[di].h - rd.h));
          var cand = (level.fixed || []).concat([{ item: fk, drawer: di, x: fx, y: fy, rot: rot }]);
          var probe = { drawers: drawers, pieces: [], fixed: cand };
          if (fixedFits(probe)) { level.fixed = cand; ok = true; }
        }
      }
      if ((level.fixed || []).length !== fixedKeys.length) { rejects.fixed++; continue; } // 固定物数量必须落在请求范围内（放不进就整关重来）
      if (!fixedFits(level)) { rejects.fixedFit++; continue; }
      var sig = signature(level);
      if (seen[sig]) { rejects.dup++; continue; }
      if (opts.preNodes) { // 廉价存在性预检：无可行解/病态组合在烧光计数预算前就被丢弃
        var q = solver.solve(level, 1, null, opts.preNodes);
        if (q.timeout) { rejects.preSolve++; continue; }
        if (!q.solvable) { rejects.preSolve++; continue; }
      }
      var sr = solver.solve(level, cap, null, opts.maxNodes);
      if (sr.timeout) { rejects.timeout++; continue; } // 计数不完整 = 无法定级，拒绝（与无解同等处理）
      if (!sr.solvable) { rejects.unsolvable++; continue; }
      var m = metrics(level, sr);
      if (m.singleItemDrawer) { rejects.soloDrawer++; continue; } // 硬约束：避免单物抽屉
      var rp = replay(level, sr.first);
      if (!rp.ok) { rejects.replay++; continue; } // 参考解必须能被游戏规则逐步回放
      seen[sig] = 1;
      out.push({ level: level, metrics: m, score: difficulty(m), replay: rp,
                 checks: validate(level, { theme: opts.theme || 'stationery', slack: sRange, fixed: fRange }, sr, rp, m) });
    }
    out.sort(function (a, b) { return a.score - b.score; });
    return { candidates: out, attempts: attempts, seed: seed, elapsedMs: Math.round(now()), rejects: rejects };
  }

  var api = { generate: generate, signature: signature, replay: replay, metrics: metrics, difficulty: difficulty, fixedFits: fixedFits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StationeryGenerator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
