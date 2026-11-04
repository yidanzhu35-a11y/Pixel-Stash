// ============================================================
// Art（像素贴纸美术：M1 样本）
// 每张贴纸 = 字符画 + 全局色板，1 个字符 = 1 个美术像素，
// 1 个格子 = 8×8 美术像素。白色描边直接画进字符画（Die-cut 风格）。
// 旋转通过旋转字符画实现，与逻辑占位旋转一一对应。
// M4 接入正式 PNG 素材时，仅需替换 getSprite 的来源。
// ============================================================
const PALETTE = {
  ".": null,          // 透明
  W: "#ffffff",       // 白色描边
  K: "#5b4a44",       // 深棕（眼睛）
  R: "#ff7d9c",       // 草莓红
  S: "#fff3c4",       // 草莓籽（浅黄）
  Y: "#ffd166",       // 黄（花心 / 糖粒）
  G: "#6fbf73",       // 绿
  L: "#a8e6a1",       // 浅绿（叶脉）
  P: "#ffb6c9",       // 粉（花瓣 / 糖霜 / 腮红 / 嘴）
  C: "#fff6e9",       // 奶油白（杯身 / 马卡龙壳）
  M: "#f2d8a0",       // 饼干浅棕
  D: "#a9714b",       // 咖啡液
  B: "#9c6644",       // 巧克力豆
  V: "#c68b59",       // 蛋糕托（棕）
};

// artKey -> 字符画（行等宽，宽度 = 形状包围盒宽 × 8，高度 = 高 × 8）
const PIXEL_ART = {
  // 小草莓（single 1×1 → 8×8）
  berry: [
    "..WGGW..",
    ".WGGGGW.",
    ".WRRRRW.",
    "WRRRRRRW",
    "WRSRRSRW",
    "WRRRRRRW",
    ".WRRRRW.",
    "..WWWW..",
  ],
  // 叶子（domino_h 1×2 → 16×8）
  leaf: [
    "................",
    ".....WWWWWW.....",
    "...WWGGGGGGWW...",
    "..WGGGGLLGGGGW..",
    "..WGGGGLLGGGGW..",
    "...WWGGGGGGWW...",
    ".....WWWWWW.....",
    "................",
  ],
  // 马卡龙（domino_v 2×1 → 8×16）
  macaron: [
    "..WWWW..",
    ".WCCCCW.",
    "WCCCCCCW",
    "WCCCCCCW",
    "WCCCCCCW",
    ".WCCCCW.",
    "WPPPPPPW",
    "WPPPPPPW",
    "WPPPPPPW",
    ".WCCCCW.",
    "WCCCCCCW",
    "WCCCCCCW",
    "WCCCCCCW",
    "WCCCCCCW",
    ".WCCCCW.",
    "..WWWW..",
  ],
  // 小雏菊（tromino_l 2×2 → 16×16）
  // 大花盘铺满上两格，带叶脉的叶子填满左下格（空格为右下）。
  // 像素覆盖尽量贴近逻辑占位：die-cut 像素画若不满格，
  // 玩家看到的"占格"会和判定用的"占格"错位（曾造成误解）。
  flower: [
    "....WWWWWWWW....",
    "..WWPPPPPPPPWW..",
    ".WPPPYYYYYYPPPW.",
    "WPPPYYYYYYYYPPPW",
    "WPPPYYYYYYYYPPPW",
    "WPPPYYYYYYYYPPPW",
    ".WPPPYYYYYYPPPW.",
    ".WPPPPPPPPPPPPW.",
    "..WGGW..........",
    ".WGGLGW.........",
    "WGGLLGGW........",
    "WGGLLGGW........",
    "WGGLLGGW........",
    ".WGGLGW.........",
    "..WGGW..........",
    "..WWWW..........",
  ],
  // 圆饼干（square2 2×2 → 16×16）
  cookie: [
    "....WWWWWWWW....",
    "..WWMMMMMMMMWW..",
    ".WMMMMMMMMMMMMW.",
    "WMMBMMMMMMMMBMMW",
    "WMMMMMMMMMMMMMMW",
    "WMMBMMMMMMMBMMMW",
    "WMMKKMMMMMKKMMMW",
    "WMMKKMMMMMKKMMMW",
    "WMMMMMPPPPMMMMMW",
    "WMMBMMMBBMMMMBMW",
    "WMMMMMMMMMMMMMMW",
    "WMMBMMMMMMMMBMMW",
    ".WMMMMMMMMMMMMW.",
    "..WWMMMMMMMMWW..",
    "....WWWWWWWW....",
    "................",
  ],
  // 纸杯蛋糕（tetromino_t 3×2 → 24×16）
  cupcake: [
    "......WWWWWWWWWWWW......",
    "....WWPPPPPPPPPPPPWW....",
    "...WPPPPPPPPPPPPPPPPW...",
    "..WPPPPPPPPPPPPPPPPPPW..",
    "..WPYPPPPYPPPPPPYPPPPW..",
    "..WPPPPPPPPPPPPPPPPPPW..",
    "...WPPPPPPPPPPPPPPPPW...",
    "....WWWWWWWWWWWWWWWW....",
    "........WWWWWWWW........",
    "........WVVWWVVW........",
    "........WVVWWVVW........",
    "........WVVWWVVW........",
    "........WVVWWVVW........",
    "........WVVWWVVW........",
    ".........WWWWWW.........",
    "........................",
  ],
  // 咖啡杯（pento_p 3×2 → 24×16，杯把在右上格）
  coffee: [
    ".WWWWWWWWWWWWWW.........",
    "WDDDDDDDDDDDDDDW........",
    "WCCCCCCCCCCCCCCWWWWWWW..",
    "WCCCCCCCCCCCCCCWWCCCCW..",
    "WCCCCCCCCCCCCCCWWC..CW..",
    "WCCCCCCCCCCCCCCWWC..CW..",
    "WCPCKKCCCKKCCPCWWC..CW..",
    "WCPCKKCCCKKCCPCWWWWWWW..",
    "WCCCCCPPPPCCCCCW........",
    "WCCCCCCCCCCCCCCW........",
    "WCCCCCCCCCCCCCCW........",
    "WCCCCCCCCCCCCCCW........",
    "WCCCCCCCCCCCCCCW........",
    "WCCCCCCCCCCCCCCW........",
    ".WCCCCCCCCCCCCW.........",
    "..WWWWWWWWWWWW..........",
  ],
};

const ART_PX_PER_CELL = 8; // 每格 8×8 美术像素
const SPRITE_PX = 8; // 精灵缓存里 1 美术像素 = 8 设备像素（64px/格）

const Art = {
  _cache: {},

  // 顺时针旋转字符画 90°
  _rotateRows(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const out = [];
    for (let y = 0; y < w; y++) {
      let line = "";
      for (let x = 0; x < h; x++) {
        line += rows[h - 1 - x][y];
      }
      out.push(line);
    }
    return out;
  },

  rowsFor(artKey, rotation) {
    let rows = PIXEL_ART[artKey];
    if (!rows) return null;
    const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
    for (let i = 0; i < steps; i++) rows = Art._rotateRows(rows);
    return rows;
  },

  // 获取精灵（画好白底? 否——保持透明，白描边在画内）
  // rotation 必须真正参与绘制：按 rowsFor(artKey, rotation) 生成旋转后的字符画。
  // （曾因写死 rowsFor(artKey, 0) 导致所有旋转贴纸渲染成未旋转形态、
  //   视觉占格与逻辑占格错位——用户实测发现。）
  getSprite(artKey, rotation) {
    const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
    const key = artKey + "|" + steps;
    if (Art._cache[key]) return Art._cache[key];
    const rows = Art.rowsFor(artKey, rotation);
    if (!rows) return null;

    const canvas = document.createElement("canvas");
    canvas.width = rows[0].length * SPRITE_PX;
    canvas.height = rows.length * SPRITE_PX;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const color = PALETTE[rows[y][x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * SPRITE_PX, y * SPRITE_PX, SPRITE_PX, SPRITE_PX);
      }
    }
    Art._cache[key] = canvas;
    return canvas;
  },

  // 着色变体（非法位置红色 / 提示绿色半透明）
  getTinted(artKey, rotation, tint) {
    const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
    const key = artKey + "|" + steps + "|tint:" + tint;
    if (Art._cache[key]) return Art._cache[key];
    const sprite = Art.getSprite(artKey, rotation);
    if (!sprite) return null;
    const canvas = document.createElement("canvas");
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(sprite, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    Art._cache[key] = canvas;
    return canvas;
  },

  // 供验证脚本调用的尺寸检查（无 DOM 依赖）
  artSize(artKey) {
    const rows = PIXEL_ART[artKey];
    if (!rows) return null;
    return { w: rows[0].length, h: rows.length };
  },

  // 无素材时的占位渲染（按形状画圆角块）
  drawPlaceholder(ctx, cells, cellPx, color) {
    ctx.fillStyle = color || "#d8c7e8";
    for (const [x, y] of cells) {
      ctx.fillRect(x * cellPx + 1, y * cellPx + 1, cellPx - 2, cellPx - 2);
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (const [x, y] of cells) {
      ctx.strokeRect(x * cellPx + 1.5, y * cellPx + 1.5, cellPx - 3, cellPx - 3);
    }
  },
};

window.PS = window.PS || {};
PS.PALETTE = PALETTE;
PS.PIXEL_ART = PIXEL_ART;
PS.Art = Art;
PS.ART_PX_PER_CELL = ART_PX_PER_CELL;
