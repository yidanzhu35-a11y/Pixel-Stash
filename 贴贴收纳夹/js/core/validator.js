// ============================================================
// Placement Validator（合法性判定）
// 规则（对应需求文档 2.3）：
//   A 不越界：所有格子必须在 Board 范围内。
//   B 不重叠：不能与其他贴纸占据相同格子。
//   C 留白：不同贴纸占位格子的曼哈顿距离 >= 2
//     （上下左右相邻即距离 1，非法；斜角接触距离 2，允许）。
//   D 障碍格：不可放入、不可覆盖。
//   说明：障碍格不是贴纸，贴纸与障碍格直接相邻是允许的
//   （留白规则只约束"不同贴纸之间"）。
// ============================================================
const Validator = {
  inBounds(board, x, y) {
    return x >= 0 && y >= 0 && x < board.width && y < board.height;
  },

  isBlocked(board, x, y) {
    if (board.blockedSet) return board.blockedSet.has(x + "," + y);
    if (board.blockedCells) {
      return board.blockedCells.some((c) => c[0] === x && c[1] === y);
    }
    return false;
  },

  // grid: 二维数组，值 = 已放置贴纸的实例下标，-1 = 空
  buildGrid(board) {
    const grid = [];
    for (let y = 0; y < board.height; y++) {
      grid.push(new Array(board.width).fill(-1));
    }
    return grid;
  },

  // 检查一组绝对坐标能否放置。
  // ignoreIdx：正在移动/放置的贴纸自身下标（其原占位被忽略）。
  // 返回 { ok, reason, cell, occupant }：
  //   reason  —— 失败原因（out_of_bounds / blocked / overlap / gap）
  //   cell    —— 首个出问题的格子（gap 时为挡路贴纸占据的那格）
  //   occupant—— 挡路贴纸的实例下标（越界/障碍时为 null）
  // 用于反馈文案与"高亮挡路贴纸"，让玩家看懂为什么放不下。
  checkCells(board, grid, absCells, ignoreIdx) {
    for (const [x, y] of absCells) {
      // A. 越界
      if (!Validator.inBounds(board, x, y)) {
        return { ok: false, reason: "out_of_bounds", cell: [x, y], occupant: null };
      }
      // D. 障碍格
      if (Validator.isBlocked(board, x, y)) {
        return { ok: false, reason: "blocked", cell: [x, y], occupant: null };
      }
      // B. 重叠
      const occupant = grid[y][x];
      if (occupant !== -1 && occupant !== ignoreIdx) {
        return { ok: false, reason: "overlap", cell: [x, y], occupant };
      }
    }
    // C. 留白：正交相邻格属于其他贴纸则非法（斜角允许）
    for (const [x, y] of absCells) {
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (!Validator.inBounds(board, nx, ny)) continue;
        const occupant = grid[ny][nx];
        if (occupant !== -1 && occupant !== ignoreIdx) {
          return { ok: false, reason: "gap", cell: [nx, ny], occupant };
        }
      }
    }
    return { ok: true, reason: null, cell: null, occupant: null };
  },
};

window.PS = window.PS || {};
PS.Validator = Validator;
