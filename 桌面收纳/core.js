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
    ring:    { w: 4, h: 4, cells: [[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[0,3],[1,3],[2,3],[3,3]], rots: [0] },
    // —— M2 素材清单定稿新增（规划 §7.1）：共 17 种形状 / 上限 18，留 1 个机动位 ——
    key:     { w: 2, h: 2, cells: [[0,0],[0,1],[1,1]], rots: [0,90,180,270] },                    // L 三格：钥匙 / 充电头
    comb:    { w: 4, h: 2, cells: [[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1]], rots: [0,90,180,270] }, // 梳子：缺一角的长块
    rect42:  { w: 4, h: 2, cells: [[0,0],[1,0],[2,0],[3,0],[0,1],[1,1],[2,1],[3,1]], rots: [0,90] },   // 大板：移动电源 / 巧克力
    cableU:  { w: 3, h: 2, cells: [[0,0],[2,0],[0,1],[1,1],[2,1]], rots: [0,90,180,270] },          // U 形凹槽：束好的充电线
    bottleT: { w: 3, h: 2, cells: [[0,0],[1,0],[2,0],[1,1]], rots: [0,90,180,270] },                // T 形：香水
    clipS:   { w: 3, h: 2, cells: [[1,0],[2,0],[0,1],[1,1]], rots: [0,90] },                        // S 形：发夹
    bag:     { w: 3, h: 3, cells: [[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2]], rots: [0,90] }        // 缺两角：袋装坚果
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
    // 镂空物品以 hollow 标记（生成器识别镂空玩法）；全部素材在正式生图接入前均为代码占位。
    hairTie: { name: '空心发绳', theme: 'daily', shape: 'ring', hollow: true },
    // —— M2 素材清单定稿（规划 §7.1）：五主题共 33 款，通用矩形/长条/异形跨主题共享形状 ——
    // 日用品（11–20 关）：异形与镂空利用
    key:       { name: '钥匙',     theme: 'daily',   shape: 'key' },
    tissue:   { name: '纸巾包',   theme: 'daily',   shape: 'note' },
    comb:     { name: '梳子',     theme: 'daily',   shape: 'comb' },
    wallet:   { name: '卡包',     theme: 'daily',   shape: 'eraser' },
    mirror:   { name: '小镜',     theme: 'daily',   shape: 'tape' },
    // 数码配件（21–30 关）：大小件分配
    earbuds:  { name: '耳机盒',   theme: 'digital', shape: 'eraser' },
    usb:      { name: 'U 盘',     theme: 'digital', shape: 'corr' },
    charger:  { name: '充电头',   theme: 'digital', shape: 'key' },
    cable:    { name: '束好的充电线', theme: 'digital', shape: 'cableU' },
    powerbank:{ name: '移动电源', theme: 'digital', shape: 'rect42' },
    mouse:    { name: '鼠标',     theme: 'digital', shape: 'note' },
    // 梳妆用品（31–40 关）：精确填满与边角异形
    lipstick: { name: '口红',     theme: 'beauty',  shape: 'corr' },
    compact:  { name: '粉饼盒',   theme: 'beauty',  shape: 'tape' },
    handcream:{ name: '护手霜',   theme: 'beauty',  shape: 'note' },
    perfume:  { name: '香水',     theme: 'beauty',  shape: 'bottleT' },
    browpen:  { name: '眉笔',     theme: 'beauty',  shape: 'hl' },
    clip:     { name: '发夹',     theme: 'beauty',  shape: 'clipS' },
    // 零食（41–50 关）：综合。甜甜圈复用 ring（真孔），让镂空玩法进入收官主题
    donut:    { name: '甜甜圈',   theme: 'snack',   shape: 'ring', hollow: true },
    candy:    { name: '糖果',     theme: 'snack',   shape: 'corr' },
    choc:     { name: '巧克力',   theme: 'snack',   shape: 'rect42' },
    jelly:    { name: '果冻',     theme: 'snack',   shape: 'eraser' },
    milk:     { name: '牛奶盒',   theme: 'snack',   shape: 'note' },
    nuts:     { name: '袋装坚果', theme: 'snack',   shape: 'bag' }
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

  // —— 关卡（M3 量产 50 关：规划 §5.2 难度曲线；按 量产50关.js 规格确定性生成，逐关求解/回放/约束验证）——
  // 槽位 1–10 文具 → 11–20 日用品 → 21–30 数码配件 → 31–40 梳妆用品 → 41–50 零食（同关同主题）。
  // 每批前段引导、后段挑战；精确填满（余量 0）关从 L29 起出现；3/5/6/7 为试玩验证过的样本关。
  // drawers：1–3 个抽屉（w 列 × h 行）。pieces：待收纳实例清单（同款可多件；可带初始 rot）。
  // 待收纳物品 drawer === null 时在「桌面」自由摊放：(x,y) 为格单位的小数坐标（左上锚点）；
  // 桌面只是摊放区，不参与任何合法性判定（A Little to the Left 式的随手摆放）。
  // fixed：固定物品（开局已在抽屉里、位置朝向固定、不可移动取回；
  //         占格参与碰撞/旋转/求解，但不计入待收纳任务）。
  // 通关 = 全部待收纳物品都在抽屉里；允许空隙（精确填满关除外）。
  // 注：不做逐关文字教学（note 字段已移除）——规则统一放页脚，反馈交给状态栏与即时预览。
  var LEVELS = [
    // —— 文具（1–10）——
    { name: '桌面第一课',
      drawers: [{ w: 6, h: 3 }],
      pieces: [{ item: 'eraser' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }] },
    { name: '转个方向',
      drawers: [{ w: 6, h: 3 }],
      pieces: [{ item: 'hl' }, { item: 'corr' }, { item: 'hl' }, { item: 'corr' }, { item: 'corr' }] },
    { name: '先把文具收进来',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'eraser' }, { item: 'eraser' }, { item: 'hl' }, { item: 'hl' }, { item: 'pencil' }, { item: 'corr' }] },
    { name: '长条的去向',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'ruler' }, { item: 'hl' }, { item: 'pencil' }, { item: 'corr' }, { item: 'corr' }, { item: 'hl' }] },
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
    { name: '被切开的抽屉',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      fixed: [{ item: 'tape', drawer: 1, x: 0, y: 0 }],
      pieces: [{ item: 'hl' }, { item: 'tri' }, { item: 'tape' }, { item: 'corr' }, { item: 'eraser' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }] },
    { name: '大抽屉练习',
      drawers: [{ w: 7, h: 4 }],
      pieces: [{ item: 'tape' }, { item: 'pencil' }, { item: 'tape' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }] },
    { name: '文具总动员',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      fixed: [{ item: 'corr', drawer: 1, x: 0, y: 0, rot: 90 }],
      pieces: [{ item: 'pencil' }, { item: 'note' }, { item: 'stapler' }, { item: 'corr' }, { item: 'pencil' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }, { item: 'corr' }] },
    // —— 日用品（11–20）——
    { name: '随身小物',
      drawers: [{ w: 6, h: 3 }],
      pieces: [{ item: 'key' }, { item: 'comb' }, { item: 'key' }] },
    { name: '发绳登场',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      pieces: [{ item: 'hairTie' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'key' }, { item: 'key' }] },
    { name: '套圈圈',
      drawers: [{ w: 6, h: 4 }, { w: 4, h: 3 }],
      pieces: [{ item: 'hairTie' }, { item: 'key' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '梳子与缺口',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      pieces: [{ item: 'comb' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'comb' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '角落里的引导',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      fixed: [{ item: 'tissue', drawer: 1, x: 1, y: 1, rot: 90 }],
      pieces: [{ item: 'tissue' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '圈里圈外',
      drawers: [{ w: 5, h: 5 }, { w: 4, h: 4 }],
      fixed: [{ item: 'wallet', drawer: 0, x: 3, y: 2 }],
      pieces: [{ item: 'hairTie' }, { item: 'mirror' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '三个抽屉',
      drawers: [{ w: 4, h: 3 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'comb' }, { item: 'wallet' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '紧凑收纳',
      drawers: [{ w: 6, h: 4 }, { w: 4, h: 4 }],
      fixed: [{ item: 'comb', drawer: 1, x: 0, y: 0, rot: 270 }],
      pieces: [{ item: 'wallet' }, { item: 'mirror' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '发绳的伙伴们',
      drawers: [{ w: 4, h: 4 }, { w: 5, h: 4 }, { w: 3, h: 3 }],
      fixed: [{ item: 'key', drawer: 1, x: 0, y: 1, rot: 270 }],
      pieces: [{ item: 'hairTie' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'wallet' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }, { item: 'key' }] },
    { name: '日用品总动员',
      drawers: [{ w: 5, h: 5 }, { w: 5, h: 4 }],
      fixed: [{ item: 'wallet', drawer: 0, x: 0, y: 2 }],
      pieces: [{ item: 'tissue' }, { item: 'wallet' }, { item: 'tissue' }, { item: 'tissue' }, { item: 'key' }, { item: 'wallet' }, { item: 'mirror' }, { item: 'key' }, { item: 'key' }] },
    // —— 数码配件（21–30）——
    { name: '大板砖登场',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'powerbank' }, { item: 'cable' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }] },
    { name: '大小配',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 4 }],
      pieces: [{ item: 'powerbank' }, { item: 'cable' }, { item: 'usb' }, { item: 'usb' }, { item: 'mouse' }, { item: 'earbuds' }, { item: 'usb' }] },
    { name: '一分为三',
      drawers: [{ w: 4, h: 3 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'usb' }, { item: 'usb' }, { item: 'charger' }, { item: 'earbuds' }, { item: 'usb' }, { item: 'powerbank' }, { item: 'powerbank' }] },
    { name: '线的拥抱',
      drawers: [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'cable' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }, { item: 'cable' }, { item: 'earbuds' }, { item: 'powerbank' }, { item: 'earbuds' }] },
    { name: '钉住的小角落',
      drawers: [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'powerbank', drawer: 0, x: 0, y: 0 }],
      pieces: [{ item: 'usb' }, { item: 'earbuds' }, { item: 'charger' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }, { item: 'cable' }, { item: 'cable' }] },
    { name: '连锁去向',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'usb', drawer: 1, x: 1, y: 2 }],
      pieces: [{ item: 'powerbank' }, { item: 'cable' }, { item: 'earbuds' }, { item: 'mouse' }, { item: 'usb' }, { item: 'charger' }, { item: 'cable' }, { item: 'usb' }, { item: 'usb' }] },
    { name: '紧凑数码',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      pieces: [{ item: 'earbuds' }, { item: 'cable' }, { item: 'usb' }, { item: 'mouse' }, { item: 'usb' }, { item: 'earbuds' }, { item: 'powerbank' }, { item: 'powerbank' }, { item: 'earbuds' }] },
    { name: '接近满格',
      drawers: [{ w: 6, h: 4 }, { w: 5, h: 4 }],
      fixed: [{ item: 'cable', drawer: 0, x: 2, y: 0, rot: 180 }],
      pieces: [{ item: 'charger' }, { item: 'powerbank' }, { item: 'mouse' }, { item: 'usb' }, { item: 'powerbank' }, { item: 'usb' }, { item: 'earbuds' }, { item: 'usb' }, { item: 'usb' }] },
    { name: '精确填满',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      fixed: [{ item: 'mouse', drawer: 0, x: 0, y: 0 }],
      pieces: [{ item: 'cable' }, { item: 'charger' }, { item: 'cable' }, { item: 'powerbank' }, { item: 'powerbank' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }, { item: 'usb' }] },
    { name: '数码总动员',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 4, h: 3 }],
      fixed: [{ item: 'usb', drawer: 1, x: 3, y: 1, rot: 90 }, { item: 'charger', drawer: 2, x: 1, y: 1, rot: 180 }],
      pieces: [{ item: 'mouse' }, { item: 'charger' }, { item: 'usb' }, { item: 'earbuds' }, { item: 'mouse' }, { item: 'cable' }, { item: 'mouse' }, { item: 'mouse' }, { item: 'usb' }, { item: 'usb' }] },
    // —— 梳妆用品（31–40）——
    { name: '梳妆台开箱',
      drawers: [{ w: 6, h: 3 }, { w: 3, h: 3 }],
      pieces: [{ item: 'perfume' }, { item: 'clip' }, { item: 'perfume' }, { item: 'lipstick' }, { item: 'lipstick' }, { item: 'lipstick' }, { item: 'compact' }] },
    { name: 'T 与 S',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 3 }],
      pieces: [{ item: 'perfume' }, { item: 'clip' }, { item: 'browpen' }, { item: 'browpen' }, { item: 'compact' }, { item: 'clip' }, { item: 'lipstick' }, { item: 'lipstick' }] },
    { name: '角落固定',
      drawers: [{ w: 4, h: 3 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'handcream', drawer: 1, x: 1, y: 1, rot: 90 }],
      pieces: [{ item: 'handcream' }, { item: 'browpen' }, { item: 'compact' }, { item: 'lipstick' }, { item: 'lipstick' }, { item: 'lipstick' }, { item: 'lipstick' }, { item: 'lipstick' }] },
    { name: '边角利用',
      drawers: [{ w: 6, h: 4 }, { w: 4, h: 4 }],
      fixed: [{ item: 'lipstick', drawer: 0, x: 1, y: 2, rot: 90 }],
      pieces: [{ item: 'lipstick' }, { item: 'perfume' }, { item: 'handcream' }, { item: 'browpen' }, { item: 'clip' }, { item: 'compact' }, { item: 'handcream' }, { item: 'browpen' }, { item: 'browpen' }] },
    { name: '精确预演',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }],
      pieces: [{ item: 'clip' }, { item: 'browpen' }, { item: 'browpen' }, { item: 'clip' }, { item: 'browpen' }, { item: 'clip' }, { item: 'perfume' }, { item: 'browpen' }, { item: 'handcream' }] },
    { name: '满满当当',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }],
      pieces: [{ item: 'perfume' }, { item: 'lipstick' }, { item: 'perfume' }, { item: 'perfume' }, { item: 'perfume' }, { item: 'handcream' }, { item: 'handcream' }, { item: 'handcream' }] },
    { name: '空间切割',
      drawers: [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'browpen', drawer: 2, x: 2, y: 0, rot: 90 }, { item: 'handcream', drawer: 1, x: 0, y: 1, rot: 90 }],
      pieces: [{ item: 'browpen' }, { item: 'lipstick' }, { item: 'perfume' }, { item: 'browpen' }, { item: 'browpen' }, { item: 'compact' }, { item: 'browpen' }, { item: 'lipstick' }, { item: 'lipstick' }] },
    { name: '精确梳妆',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      fixed: [{ item: 'clip', drawer: 0, x: 0, y: 0 }],
      pieces: [{ item: 'clip' }, { item: 'perfume' }, { item: 'browpen' }, { item: 'lipstick' }, { item: 'browpen' }, { item: 'perfume' }, { item: 'perfume' }, { item: 'perfume' }, { item: 'handcream' }, { item: 'handcream' }] },
    { name: '满格练习',
      drawers: [{ w: 6, h: 4 }, { w: 5, h: 4 }],
      fixed: [{ item: 'perfume', drawer: 0, x: 0, y: 0, rot: 270 }],
      pieces: [{ item: 'compact' }, { item: 'handcream' }, { item: 'lipstick' }, { item: 'browpen' }, { item: 'perfume' }, { item: 'handcream' }, { item: 'lipstick' }, { item: 'perfume' }, { item: 'lipstick' }, { item: 'handcream' }] },
    { name: '梳妆总动员',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 4, h: 3 }],
      fixed: [{ item: 'browpen', drawer: 2, x: 1, y: 0 }, { item: 'lipstick', drawer: 1, x: 1, y: 1, rot: 90 }],
      pieces: [{ item: 'browpen' }, { item: 'handcream' }, { item: 'browpen' }, { item: 'perfume' }, { item: 'lipstick' }, { item: 'handcream' }, { item: 'browpen' }, { item: 'perfume' }, { item: 'handcream' }, { item: 'handcream' }] },
    // —— 零食（41–50）——
    { name: '零食开箱',
      drawers: [{ w: 6, h: 3 }, { w: 4, h: 3 }],
      pieces: [{ item: 'nuts' }, { item: 'candy' }, { item: 'milk' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '甜甜圈来了',
      drawers: [{ w: 5, h: 5 }, { w: 4, h: 4 }],
      pieces: [{ item: 'donut' }, { item: 'candy' }, { item: 'nuts' }, { item: 'candy' }, { item: 'jelly' }, { item: 'candy' }, { item: 'milk' }, { item: 'candy' }] },
    { name: '固定与异形',
      drawers: [{ w: 4, h: 4 }, { w: 4, h: 3 }, { w: 3, h: 3 }],
      fixed: [{ item: 'candy', drawer: 2, x: 2, y: 1, rot: 90 }],
      pieces: [{ item: 'milk' }, { item: 'candy' }, { item: 'milk' }, { item: 'choc' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '坚果袋的凹角',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      fixed: [{ item: 'candy', drawer: 2, x: 0, y: 1, rot: 90 }],
      pieces: [{ item: 'nuts' }, { item: 'choc' }, { item: 'donut' }, { item: 'candy' }, { item: 'jelly' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '镂空精确',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 3, h: 3 }],
      fixed: [{ item: 'choc', drawer: 0, x: 1, y: 2 }],
      pieces: [{ item: 'donut' }, { item: 'choc' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '满格零食',
      drawers: [{ w: 6, h: 4 }, { w: 5, h: 4 }],
      fixed: [{ item: 'choc', drawer: 0, x: 0, y: 1 }],
      pieces: [{ item: 'donut' }, { item: 'milk' }, { item: 'jelly' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '双固定挑战',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 4, h: 3 }],
      fixed: [{ item: 'donut', drawer: 0, x: 0, y: 0 }, { item: 'jelly', drawer: 2, x: 0, y: 1 }],
      pieces: [{ item: 'nuts' }, { item: 'jelly' }, { item: 'jelly' }, { item: 'jelly' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '连续规划',
      drawers: [{ w: 5, h: 4 }, { w: 4, h: 4 }, { w: 4, h: 4 }],
      fixed: [{ item: 'jelly', drawer: 1, x: 2, y: 1 }],
      pieces: [{ item: 'choc' }, { item: 'candy' }, { item: 'donut' }, { item: 'donut' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '精确大考',
      drawers: [{ w: 5, h: 5 }, { w: 4, h: 4 }, { w: 4, h: 3 }],
      fixed: [{ item: 'milk', drawer: 2, x: 1, y: 0, rot: 90 }, { item: 'candy', drawer: 0, x: 0, y: 2, rot: 90 }],
      pieces: [{ item: 'choc' }, { item: 'nuts' }, { item: 'jelly' }, { item: 'choc' }, { item: 'candy' }, { item: 'candy' }, { item: 'milk' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] },
    { name: '零食总动员',
      drawers: [{ w: 6, h: 4 }, { w: 4, h: 4 }, { w: 4, h: 4 }],
      fixed: [{ item: 'jelly', drawer: 2, x: 1, y: 1 }, { item: 'milk', drawer: 1, x: 2, y: 0 }],
      pieces: [{ item: 'candy' }, { item: 'milk' }, { item: 'candy' }, { item: 'jelly' }, { item: 'choc' }, { item: 'milk' }, { item: 'choc' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }, { item: 'candy' }] }
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
