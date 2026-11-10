// 由 tools/verify.html 生成，请勿手改
// 结构：SOLUTIONS[levelId] = { reference, solutionCount, capped, pieceCount, elapsedMs, generatedAt }
// 验证记录（M1，2026-11-02）：4 关全部可解，参考解均通过独立复核
//（越界/障碍/重叠/留白逐项检查）。解法数为统计下限（计数上限 20000）。
const SOLUTIONS = {
  "1": {
    "reference": {
      "berry_01": { "x": 2, "y": 2, "rotation": 0 },
      "berry_02": { "x": 0, "y": 3, "rotation": 0 },
      "berry_03": { "x": 3, "y": 3, "rotation": 0 },
      "leaf_01": { "x": 4, "y": 2, "rotation": 0 },
      "cookie_01": { "x": 0, "y": 0, "rotation": 0 },
      "flower_01": { "x": 3, "y": 0, "rotation": 0 }
    },
    "solutionCount": 20000,
    "capped": true,
    "pieceCount": 6,
    "elapsedMs": 62,
    "generatedAt": "2026-11-02T10:16:31.405Z"
  },
  "2": {
    "reference": {
      "berry_01": { "x": 4, "y": 4, "rotation": 0 },
      "berry_02": { "x": 3, "y": 5, "rotation": 0 },
      "leaf_01": { "x": 0, "y": 2, "rotation": 90 },
      "macaron_01": { "x": 1, "y": 4, "rotation": 0 },
      "cookie_01": { "x": 2, "y": 2, "rotation": 0 },
      "flower_01": { "x": 5, "y": 3, "rotation": 90 },
      "cupcake_01": { "x": 0, "y": 0, "rotation": 0 },
      "coffee_01": { "x": 4, "y": 0, "rotation": 0 }
    },
    "solutionCount": 20000,
    "capped": true,
    "pieceCount": 8,
    "elapsedMs": 102,
    "generatedAt": "2026-11-02T10:16:31.508Z"
  },
  "3": {
    "reference": {
      "berry_01": { "x": 0, "y": 2, "rotation": 0 },
      "berry_02": { "x": 5, "y": 7, "rotation": 0 },
      "leaf_01": { "x": 7, "y": 0, "rotation": 90 },
      "macaron_01": { "x": 2, "y": 6, "rotation": 0 },
      "macaron_02": { "x": 7, "y": 6, "rotation": 0 },
      "cookie_01": { "x": 6, "y": 3, "rotation": 0 },
      "flower_01": { "x": 0, "y": 5, "rotation": 0 },
      "flower_02": { "x": 3, "y": 5, "rotation": 90 },
      "cupcake_01": { "x": 0, "y": 0, "rotation": 0 },
      "cupcake_02": { "x": 1, "y": 2, "rotation": 180 },
      "coffee_01": { "x": 4, "y": 0, "rotation": 90 }
    },
    "solutionCount": 20000,
    "capped": true,
    "pieceCount": 11,
    "elapsedMs": 549,
    "generatedAt": "2026-11-02T10:16:32.057Z"
  },
  "4": {
    "reference": {
      "coffee_01": { "x": 0, "y": 0, "rotation": 0 },
      "coffee_02": { "x": 4, "y": 0, "rotation": 0 },
      "coffee_03": { "x": 0, "y": 3, "rotation": 0 },
      "berry_01": { "x": 7, "y": 1, "rotation": 0 },
      "berry_02": { "x": 3, "y": 2, "rotation": 0 }
    },
    "solutionCount": 20000,
    "capped": true,
    "pieceCount": 5,
    "elapsedMs": 17,
    "generatedAt": "2026-11-02T10:16:32.074Z"
  }
};

window.PS = window.PS || {};
PS.SOLUTIONS = SOLUTIONS;
