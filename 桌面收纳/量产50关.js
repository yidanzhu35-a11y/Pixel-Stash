// 桌面收纳 M3 量产规格 + 驱动（规划 §5.2 难度曲线的可执行版本，2026-11-13 校准定稿）。
// 用法：在 关卡生成器.html 页面里注入本文件（动态 <script src="量产50关.js">），然后
//   await PRODUCTION.produceSlot(n, opts)   // 逐槽位生产，结果存 window.__PROD[n]（断点续跑自动跳过）
//   PRODUCTION.report()                     // 全部槽位的一览表
//   PRODUCTION.fmtAll()                     // 导出 core.js LEVELS 风格的 50 关源码
// opts: { maxNodes, preNodes, timeBudgetMs, count, seedBase }
// 确定性：同种子同结果（mulberry32）；槽位 seed = seedBase + slot + bump*1000（bump = 重试档位）。
// 校准记录（相对 §5.2 初稿的调整，已回写文档）：
//   L11 件数 5 → 3–4（日用品池最小件 3 格，5 件 ×3 + 余量 > 6×3=18 格，原参数结构性不可行）
//   L19 抽屉 4×4+4×3+3×3 → 4×4+5×4+3×3（原配置 37 格放不下发绳 12 + 8 件 ×3 + 固定物 + 余量）
//   L41 不再引入甜甜圈（6×3/4×3 抽屉高 3 放不下 4×4 环），甜甜圈移至 L42 引入
(function (root) {
  'use strict';

  var NAMES = [
    '桌面第一课', '转个方向', '先把文具收进来', '长条的去向', '圆的和大件的', '刚刚好', '钉住的直尺', '被切开的抽屉', '大抽屉练习', '文具总动员',
    '随身小物', '发绳登场', '套圈圈', '梳子与缺口', '角落里的引导', '圈里圈外', '三个抽屉', '紧凑收纳', '发绳的伙伴们', '日用品总动员',
    '大板砖登场', '大小配', '一分为三', '线的拥抱', '钉住的小角落', '连锁去向', '紧凑数码', '接近满格', '精确填满', '数码总动员',
    '梳妆台开箱', 'T 与 S', '角落固定', '边角利用', '精确预演', '满满当当', '空间切割', '精确梳妆', '满格练习', '梳妆总动员',
    '零食开箱', '甜甜圈来了', '固定与异形', '坚果袋的凹角', '镂空精确', '满格零食', '双固定挑战', '连续规划', '精确大考', '零食总动员'
  ];

  // 四个试玩验证过的文具样本（原 core.LEVELS[0..3]），内嵌于此使量产与 core.js 现状解耦
  var SAMPLES = {
    1: { drawers: [{ w: 6, h: 4 }],
         pieces: [{ item: 'eraser' }, { item: 'note' }, { item: 'stapler' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }] },
    3: { drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
         pieces: [{ item: 'eraser' }, { item: 'eraser' }, { item: 'hl' }, { item: 'hl' }, { item: 'pencil' }, { item: 'corr' }] },
    5: { drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
         pieces: [{ item: 'tape' }, { item: 'note' }, { item: 'ruler' }, { item: 'eraser' }, { item: 'eraser' }, { item: 'corr' }, { item: 'corr' }] },
    6: { drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
         pieces: [{ item: 'pencil' }, { item: 'pencil' }, { item: 'ruler' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }, { item: 'tri' }, { item: 'stapler' }] },
    7: { drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
         fixed: [{ item: 'ruler', drawer: 0, x: 0, y: 1 }],
         pieces: [{ item: 'pencil' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }, { item: 'note' }] }
  };

  // [槽位, 主题, 抽屉[[w,h]..], 件数[lo,hi], 余量[lo,hi], 固定[lo,hi], 解数带lo, 解数带hi, 必含|null]
  var SLOTS = [
    [1,  'stationery', null,                         null,    null,   null,   100, 999, null], // 六件、五形状、余量2格的教学样本
    [2,  'stationery', [[6, 3]],                     [5, 5],  [4, 6], [0, 0], 100, 999, null],
    [3,  'stationery', null,                         null,    null,   null,   100, 999, null], // 样本
    [4,  'stationery', [[6, 3], [3, 3]],             [6, 6],  [4, 6], [0, 0], 30,  100, ['ruler']],
    [5,  'stationery', null,                         null,    null,   null,   30,  100, null], // 样本
    [6,  'stationery', null,                         null,    null,   null,   30,  100, null], // 样本
    [7,  'stationery', null,                         null,    null,   null,   30,  100, null], // 样本
    [8,  'stationery', [[6, 3], [4, 4]],             [8, 8],  [2, 4], [1, 1], 10,  30,  null],
    [9,  'stationery', [[7, 4]],                     [8, 8],  [3, 5], [0, 0], 10,  30,  null],
    [10, 'stationery', [[6, 3], [4, 4]],             [9, 9],  [1, 3], [1, 1], 10,  30,  null],
    [11, 'daily',      [[6, 3]],                     [3, 4],  [3, 7], [0, 0], 100, 999, ['key', 'comb']],
    [12, 'daily',      [[6, 3], [4, 4]],             [6, 6],  [4, 6], [0, 0], 30,  100, ['hairTie']],
    [13, 'daily',      [[6, 4], [4, 3]],             [7, 7],  [3, 5], [0, 0], 30,  100, ['hairTie', 'key']],
    [14, 'daily',      [[6, 3], [4, 4]],             [7, 7],  [3, 5], [0, 0], 30,  100, ['comb']],
    [15, 'daily',      [[6, 3], [4, 4]],             [7, 7],  [3, 4], [1, 1], 10,  30,  null],
    [16, 'daily',      [[5, 5], [4, 4]],             [8, 8],  [2, 4], [1, 1], 10,  30,  ['hairTie']],
    [17, 'daily',      [[4, 3], [4, 3], [3, 3]],     [8, 8],  [3, 5], [0, 0], 10,  30,  null],
    [18, 'daily',      [[6, 4], [4, 4]],             [9, 9],  [2, 3], [1, 1], 10,  30,  null],
    [19, 'daily',      [[4, 4], [5, 4], [3, 3]],     [9, 9],  [2, 3], [1, 1], 3,   10,  ['hairTie']],
    [20, 'daily',      [[5, 5], [5, 4]],             [9, 9],  [1, 2], [1, 1], 3,   10,  null],
    [21, 'digital',    [[6, 3], [3, 3]],             [6, 6],  [5, 7], [0, 0], 100, 999, ['powerbank']],
    [22, 'digital',    [[6, 3], [4, 4]],             [7, 7],  [4, 6], [0, 0], 30,  100, ['powerbank']],
    [23, 'digital',    [[4, 3], [4, 3], [3, 3]],     [7, 7],  [4, 6], [0, 0], 30,  100, null],
    [24, 'digital',    [[4, 4], [4, 3], [3, 3]],     [8, 8],  [3, 5], [0, 0], 10,  30,  ['cable']],
    [25, 'digital',    [[4, 4], [4, 3], [3, 3]],     [8, 8],  [2, 4], [1, 1], 10,  30,  null],
    [26, 'digital',    [[5, 4], [4, 3], [3, 3]],     [9, 9],  [2, 3], [1, 1], 10,  30,  null],
    [27, 'digital',    [[5, 4], [4, 4], [3, 3]],     [9, 9],  [2, 3], [0, 0], 10,  30,  null],
    [28, 'digital',    [[6, 4], [5, 4]],             [9, 9],  [1, 2], [1, 1], 3,   10,  null],
    [29, 'digital',    [[5, 4], [4, 4], [3, 3]],     [10, 10],[0, 2], [1, 1], 3,   10,  null],
    [30, 'digital',    [[5, 4], [4, 4], [4, 3]],     [10, 10],[0, 1], [2, 2], 3,   10,  null],
    [31, 'beauty',     [[6, 3], [3, 3]],             [7, 7],  [4, 6], [0, 0], 30,  100, ['perfume', 'clip']],
    [32, 'beauty',     [[6, 3], [4, 3]],             [8, 8],  [3, 5], [0, 0], 10,  30,  ['perfume', 'clip']],
    [33, 'beauty',     [[4, 3], [4, 3], [3, 3]],     [8, 8],  [2, 4], [1, 1], 10,  30,  null],
    [34, 'beauty',     [[6, 4], [4, 4]],             [9, 9],  [1, 3], [1, 1], 10,  30,  null],
    [35, 'beauty',     [[5, 4], [4, 4]],             [9, 9],  [1, 2], [0, 0], 3,   10,  null],
    [36, 'beauty',     [[5, 4], [4, 4]],             [8, 8],  [0, 0], [0, 0], 3,   10,  null],
    [37, 'beauty',     [[4, 4], [4, 3], [3, 3]],     [9, 9],  [0, 1], [2, 2], 3,   10,  null],
    [38, 'beauty',     [[5, 4], [4, 4], [3, 3]],     [10, 10],[0, 1], [1, 1], 3,   10,  null],
    [39, 'beauty',     [[6, 4], [5, 4]],             [10, 10],[0, 0], [1, 1], 3,   10,  null],
    [40, 'beauty',     [[5, 4], [4, 4], [4, 3]],     [10, 10],[0, 0], [2, 2], 3,   10,  null],
    [41, 'snack',      [[6, 3], [4, 3]],             [8, 8],  [3, 5], [0, 0], 30,  100, ['nuts']],
    [42, 'snack',      [[5, 5], [4, 4]],             [8, 8],  [2, 4], [0, 0], 10,  30,  ['donut', 'candy']],
    [43, 'snack',      [[4, 4], [4, 3], [3, 3]],     [9, 9],  [2, 3], [1, 1], 10,  30,  null],
    [44, 'snack',      [[5, 4], [4, 4], [3, 3]],     [9, 9],  [1, 2], [1, 1], 3,   10,  ['nuts']],
    [45, 'snack',      [[5, 4], [4, 4], [3, 3]],     [10, 10],[0, 2], [1, 1], 3,   10,  ['donut']],
    [46, 'snack',      [[6, 4], [5, 4]],             [10, 10],[0, 0], [1, 1], 3,   10,  null],
    [47, 'snack',      [[5, 4], [4, 4], [4, 3]],     [10, 10],[0, 1], [2, 2], 3,   10,  null],
    [48, 'snack',      [[5, 4], [4, 4], [4, 4]],     [11, 11],[0, 1], [1, 1], 3,   10,  null],
    [49, 'snack',      [[5, 5], [4, 4], [4, 3]],     [11, 11],[0, 0], [2, 2], 3,   10,  null],
    [50, 'snack',      [[6, 4], [4, 4], [4, 4]],     [12, 12],[0, 0], [2, 2], 3,   10,  null]
  ];

  function specOf(slot) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i][0] === slot) return SLOTS[i];
    return null;
  }
  // 解数带贴合度：0 = 在带内；越大越偏（只用于候选间排序，软目标不作硬门槛）
  function bandFit(count, capped, band) {
    if (band[1] >= 999) return (capped || count >= band[0]) ? 0 : 1;
    if (!capped && count >= band[0] && count <= band[1]) return 0;
    return 1 + (count < band[0] ? band[0] - count : count - band[1]) / 100;
  }

  function produceSlot(slot, opts) {
    opts = opts || {};
    var G = root.StationeryGenerator, S = root.StationerySolver;
    root.__PROD = root.__PROD || {};
    if (root.__PROD[slot]) return Object.assign({ skipped: true }, root.__PROD[slot].report);
    var spec = specOf(slot);
    if (!spec) throw new Error('无此槽位 ' + slot);
    // 去重签名按已完成槽位升序重建（与一次性连跑等价，支持断点续跑）
    var chosen = Object.keys(root.__PROD).map(Number).sort(function (a, b) { return a - b; })
      .map(function (s) { return G.signature(root.__PROD[s].level); });
    var name = NAMES[slot - 1];
    var band = [spec[6], spec[7]];

    if (SAMPLES[slot]) { // 样本关：直接采用（试玩验证过），仍过一遍求解/回放确认数据完好
      var lv = JSON.parse(JSON.stringify(SAMPLES[slot]));
      lv.name = name;
      var sr0 = S.solve(lv, 200);
      var rp0 = G.replay(lv, sr0.first);
      root.__PROD[slot] = { level: lv, report: { slot: slot, name: name, source: 'sample',
        solutions: sr0.count + (sr0.capped ? '+' : ''), nodes: sr0.nodes, replayOk: rp0.ok } };
      return root.__PROD[slot].report;
    }

    var sets = [spec[2].map(function (d) { return { w: d[0], h: d[1] }; })];
    var picked = null, attempts = 0;
    var t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    for (var bump = 0; bump < 4 && !picked; bump++) {
      var r = G.generate({
        seed: (opts.seedBase || 20261130) + slot + bump * 1000,
        count: opts.count || 6, theme: spec[1],
        drawerSets: sets, pieces: spec[3], slack: spec[4], fixed: spec[5],
        require: spec[8] || undefined, cap: 200,
        preNodes: opts.preNodes, maxNodes: opts.maxNodes,
        timeBudgetMs: opts.timeBudgetMs || 30000
      });
      attempts += r.attempts;
      var cands = r.candidates.filter(function (c) { return chosen.indexOf(G.signature(c.level)) < 0; })
        .sort(function (a, b) {
          return (bandFit(a.metrics.solutions, a.metrics.capped, band) -
                  bandFit(b.metrics.solutions, b.metrics.capped, band)) || (a.score - b.score);
        });
      if (cands.length && (bandFit(cands[0].metrics.solutions, cands[0].metrics.capped, band) === 0 || bump === 3))
        picked = cands[0];
    }
    var elapsed = Math.round(((typeof performance !== 'undefined' ? performance : Date).now()) - t0);
    if (!picked) return { slot: slot, error: 'NO_CANDIDATE', attempts: attempts, elapsedMs: elapsed };

    picked.level.name = name;
    var m = picked.metrics;
    root.__PROD[slot] = { level: picked.level, report: { slot: slot, name: name, source: 'generated',
      solutions: m.solutions + (m.capped ? '+' : ''),
      bandOk: bandFit(m.solutions, m.capped, band) === 0,
      slack: m.slack, fixed: m.fixed, pieces: m.pieces, hollow: m.hollow, exact: m.exact,
      attempts: attempts, elapsedMs: elapsed } };
    return root.__PROD[slot].report;
  }

  function report() {
    return Object.keys(root.__PROD || {}).map(Number).sort(function (a, b) { return a - b; })
      .map(function (s) { return root.__PROD[s].report; });
  }

  // core.js LEVELS 房屋风格源码（与既有条目排版一致；fixed 的 rot=0 省略）
  function fmt(level) {
    var d = level.drawers.map(function (x) { return '{ w: ' + x.w + ', h: ' + x.h + ' }'; }).join(', ');
    var p = level.pieces.map(function (x) {
      var it = typeof x === 'string' ? x : x.item;
      return "{ item: '" + it + "'" + (x.rot ? ', rot: ' + x.rot : '') + ' }';
    }).join(', ');
    var lines = "    { name: '" + level.name + "',\n      drawers: [" + d + "],\n";
    if (level.fixed && level.fixed.length) {
      var f = level.fixed.map(function (x) {
        return "{ item: '" + x.item + "', drawer: " + x.drawer + ', x: ' + x.x + ', y: ' + x.y +
               (x.rot ? ', rot: ' + x.rot : '') + ' }';
      }).join(', ');
      lines += '      fixed: [' + f + '],\n';
    }
    return lines + '      pieces: [' + p + '] }';
  }
  function fmtAll() {
    var out = [];
    for (var s = 1; s <= 50; s++) {
      if (!root.__PROD || !root.__PROD[s]) return '缺槽位 ' + s;
      out.push(fmt(root.__PROD[s].level));
    }
    return out.join(',\n');
  }

  root.PRODUCTION = { NAMES: NAMES, SLOTS: SLOTS, SAMPLES: SAMPLES,
                      bandFit: bandFit, produceSlot: produceSlot, report: report,
                      fmt: fmt, fmtAll: fmtAll };
})(typeof globalThis !== 'undefined' ? globalThis : this);
