// ============================================================
// 主题贴纸库（Sticker Catalog）
// stickerId -> { name, themeId, shapeId, art }
// - 不同贴纸可共用同一 shapeId（美术不同、占位相同）。
// - art 指向 ui/art.js 中的像素画定义（M1 全部为程序内像素画样本）。
// - 关卡实例通过 stickerId 引用这里，不为每关新建形状/素材。
// ============================================================
const STICKERS = {
  spring_berry_01: {
    name: "小草莓",
    themeId: "spring",
    shapeId: "single",
    art: "berry",
  },
  spring_leaf_01: {
    name: "叶子",
    themeId: "spring",
    shapeId: "domino_h",
    art: "leaf",
  },
  spring_macaron_01: {
    name: "马卡龙",
    themeId: "spring",
    shapeId: "domino_v",
    art: "macaron",
  },
  spring_flower_01: {
    name: "小雏菊",
    themeId: "spring",
    shapeId: "tromino_l",
    art: "flower",
  },
  spring_cookie_01: {
    name: "圆饼干",
    themeId: "spring",
    shapeId: "square2",
    art: "cookie",
  },
  spring_cupcake_01: {
    name: "纸杯蛋糕",
    themeId: "spring",
    shapeId: "tetromino_t",
    art: "cupcake",
  },
  spring_coffee_01: {
    name: "咖啡杯",
    themeId: "spring",
    shapeId: "pento_p",
    art: "coffee",
  },
};

window.PS = window.PS || {};
PS.STICKERS = STICKERS;
