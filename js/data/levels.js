// ============================================================
// 关卡配置（Level Definitions）
// - 每关通过 stickerId 引用主题贴纸库，实例 id 在本关内唯一。
// - 同款贴纸可重复出现（多实例），实例各自独立移动 / 判定。
// - initialRotation: 本关初始方向（0/90/180/270）。
// - rotationTokens: 本关可解锁旋转的贴纸数量（上限 3）。
// - 关卡 1-3 为 M1 正式关卡；关卡 4 为旋转机制测试关（isTest，
//   不计入主线进度，从页脚入口进入）。
// - 参考解与解法统计由 tools/verify.html 生成到 data/solutions.js。
// ============================================================
const LEVELS = [
  {
    levelId: 1,
    name: "初次收纳",
    themeId: "spring",
    board: { width: 6, height: 6, blockedCells: [] },
    rotationTokens: 0,
    pieces: [
      { id: "berry_01", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "berry_02", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "berry_03", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "leaf_01", stickerId: "spring_leaf_01", initialRotation: 0 },
      { id: "cookie_01", stickerId: "spring_cookie_01", initialRotation: 0 },
      { id: "flower_01", stickerId: "spring_flower_01", initialRotation: 0 },
    ],
    stackRules: [],
    goal: "place_all_pieces",
  },
  {
    levelId: 2,
    name: "小小花坛",
    themeId: "spring",
    board: { width: 7, height: 7, blockedCells: [] },
    rotationTokens: 0,
    pieces: [
      { id: "berry_01", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "berry_02", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "leaf_01", stickerId: "spring_leaf_01", initialRotation: 90 },
      { id: "macaron_01", stickerId: "spring_macaron_01", initialRotation: 0 },
      { id: "cookie_01", stickerId: "spring_cookie_01", initialRotation: 0 },
      { id: "flower_01", stickerId: "spring_flower_01", initialRotation: 90 },
      { id: "cupcake_01", stickerId: "spring_cupcake_01", initialRotation: 0 },
      { id: "coffee_01", stickerId: "spring_coffee_01", initialRotation: 0 },
    ],
    stackRules: [],
    goal: "place_all_pieces",
  },
  {
    levelId: 3,
    name: "下午茶准备",
    themeId: "spring",
    board: { width: 8, height: 8, blockedCells: [] },
    rotationTokens: 0,
    pieces: [
      { id: "berry_01", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "berry_02", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "leaf_01", stickerId: "spring_leaf_01", initialRotation: 90 },
      { id: "macaron_01", stickerId: "spring_macaron_01", initialRotation: 0 },
      { id: "macaron_02", stickerId: "spring_macaron_01", initialRotation: 0 },
      { id: "cookie_01", stickerId: "spring_cookie_01", initialRotation: 0 },
      { id: "flower_01", stickerId: "spring_flower_01", initialRotation: 0 },
      { id: "flower_02", stickerId: "spring_flower_01", initialRotation: 90 },
      { id: "cupcake_01", stickerId: "spring_cupcake_01", initialRotation: 0 },
      { id: "cupcake_02", stickerId: "spring_cupcake_01", initialRotation: 180 },
      { id: "coffee_01", stickerId: "spring_coffee_01", initialRotation: 90 },
    ],
    stackRules: [],
    goal: "place_all_pieces",
  },
  {
    levelId: 4,
    name: "旋转测试（沙盒）",
    themeId: "spring",
    isTest: true,
    board: { width: 8, height: 8, blockedCells: [] },
    rotationTokens: 2,
    pieces: [
      { id: "coffee_01", stickerId: "spring_coffee_01", initialRotation: 0 },
      { id: "coffee_02", stickerId: "spring_coffee_01", initialRotation: 0 },
      { id: "coffee_03", stickerId: "spring_coffee_01", initialRotation: 0 },
      { id: "berry_01", stickerId: "spring_berry_01", initialRotation: 0 },
      { id: "berry_02", stickerId: "spring_berry_01", initialRotation: 0 },
    ],
    stackRules: [],
    goal: "place_all_pieces",
  },
];

window.PS = window.PS || {};
PS.LEVELS = LEVELS;
