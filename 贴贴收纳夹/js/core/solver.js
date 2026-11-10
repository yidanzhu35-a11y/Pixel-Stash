// ============================================================
// Solver（求解器）
// 用途：
//   1. 关卡生成与验证：确认关卡至少存在一个完整解，统计解法数量。
//   2. 为参考解提供数据（data/solutions.js）。
//   3. M2 提示系统将复用这里的搜索（条件搜索）。
// 算法：回溯搜索 + MRV（可选位置最少的贴纸优先）。
// 可互换实例去重：同 stickerId 且允许方向集合相同的实例视为
// 可互换，按"放置索引严格递增"枚举，交换实例身份不计为新解。
// ============================================================
const Solver = {
  // board: { width, height, blockedCells }
  // pieces: [{ id, stickerId, cells, rotations }]
  //   cells: 基础形状格子；rotations: 该实例允许的方向数组（度）。
  // opts: { maxSolutions, timeLimitMs, initialPlacements }
  //   initialPlacements: [{ id, x, y, rotation }] 预先固定的摆放
  //   （M2 Hint 2/3 的条件搜索会用到，M1 传空即可）。
  solve(board, pieces, opts) {
    const maxSolutions = (opts && opts.maxSolutions) || 1000;
    const timeLimitMs = (opts && opts.timeLimitMs) || 10000;
    const initialPlacements = (opts && opts.initialPlacements) || [];
    const startTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const blockedSet = new Set(
      (board.blockedCells || []).map((c) => c[0] + "," + c[1])
    );
    const boardWithSet = { width: board.width, height: board.height, blockedSet };
    const grid = Validator.buildGrid(board);

    // ---- 1. 为每张贴纸枚举所有候选摆放（只检查越界与障碍） ----
    const placements = pieces.map((p) => {
      const list = [];
      const seen = new Set(); // 对称形状不同旋转产生相同占位时去重
      for (const rot of p.rotations) {
        const cells = Geometry.cellsAtRotation(p.cells, rot);
        const bb = Geometry.boundingBox(cells);
        for (let y = 0; y + bb.h <= board.height; y++) {
          for (let x = 0; x + bb.w <= board.width; x++) {
            const absCells = Geometry.absolute(cells, x, y);
            const key = Geometry.cellsKey(absCells);
            if (seen.has(key)) continue;
            let fits = true;
            for (const [cx, cy] of absCells) {
              if (blockedSet.has(cx + "," + cy)) {
                fits = false;
                break;
              }
            }
            if (fits) {
              seen.add(key);
              list.push({ rotation: rot, x, y, absCells });
            }
          }
        }
      }
      // 规范排序，保证可互换实例去重的索引稳定
      list.sort((a, b) => a.rotation - b.rotation || a.y - b.y || a.x - b.x);
      return list;
    });

    const legalPositionCounts = {};
    pieces.forEach((p, i) => {
      legalPositionCounts[p.id] = placements[i].length;
    });

    // ---- 2. 预放置锁定贴纸（条件搜索用） ----
    const locked = new Set();
    for (const ip of initialPlacements) {
      const idx = pieces.findIndex((p) => p.id === ip.id);
      if (idx === -1) continue;
      const cells = Geometry.cellsAtRotation(pieces[idx].cells, ip.rotation);
      const absCells = Geometry.absolute(cells, ip.x, ip.y);
      const res = Validator.checkCells(boardWithSet, grid, absCells, -1);
      if (!res.ok) {
        return {
          solvable: false,
          solutionCount: 0,
          capped: false,
          timedOut: false,
          reference: null,
          legalPositionCounts,
          failReason: "initial_placements_invalid",
        };
      }
      for (const [cx, cy] of absCells) grid[cy][cx] = idx;
      locked.add(idx);
    }

    // ---- 3. 可互换分组 ----
    const groupKeyOf = (p) => p.stickerId + "|" + p.rotations.join(",");
    const groupMap = new Map();
    pieces.forEach((p, i) => {
      if (locked.has(i)) return;
      const key = groupKeyOf(p);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(i);
    });
    const groups = Array.from(groupMap.values()).map((members) => ({
      members, // 实例下标列表（关卡配置顺序）
      remaining: members.length,
      minIdx: 0, // 去重用：本组已选的最大放置索引 + 1
    }));

    // ---- 4. 回溯搜索 ----
    let solutionCount = 0;
    let capped = false;
    let timedOut = false;
    let reference = null;
    let nodes = 0;

    // 计算某组当前合法的放置下标列表
    const validIndices = (g) => {
      const protoIdx = g.members[0];
      const out = [];
      for (let i = g.minIdx; i < placements[protoIdx].length; i++) {
        const pl = placements[protoIdx][i];
        if (Validator.checkCells(boardWithSet, grid, pl.absCells, -1).ok) {
          out.push(i);
        }
      }
      return out;
    };

    const dfs = () => {
      if (timedOut) return;
      if (++nodes % 500 === 0 && now() - startTime > timeLimitMs) {
        timedOut = true;
        return;
      }
      const open = groups.filter((g) => g.remaining > 0);
      if (open.length === 0) {
        solutionCount++;
        if (!reference) {
          reference = {};
          for (const g of groups) {
            for (const m of g.members) {
              const chosen = g.solutionRecord[m];
              reference[pieces[m].id] = {
                x: chosen.x,
                y: chosen.y,
                rotation: chosen.rotation,
              };
            }
          }
          for (const ip of initialPlacements) {
            reference[ip.id] = { x: ip.x, y: ip.y, rotation: ip.rotation };
          }
        }
        if (solutionCount >= maxSolutions) capped = true;
        return;
      }

      // MRV：当前合法摆放最少的组先搜索
      let best = null;
      let bestIndices = null;
      for (const g of open) {
        const idxs = validIndices(g);
        if (idxs.length < g.remaining) return; // 剪枝：放不下
        if (!best || idxs.length < bestIndices.length) {
          best = g;
          bestIndices = idxs;
        }
      }

      const protoIdx = best.members[0];
      const member = best.members[best.members.length - best.remaining]; // 本组下一个实例
      const savedMinIdx = best.minIdx;
      for (const pi of bestIndices) {
        const pl = placements[protoIdx][pi];
        for (const [cx, cy] of pl.absCells) grid[cy][cx] = member;
        best.solutionRecord = best.solutionRecord || {};
        best.solutionRecord[member] = pl;
        best.remaining--;
        best.minIdx = pi + 1;
        dfs();
        best.minIdx = savedMinIdx;
        best.remaining++;
        delete best.solutionRecord[member];
        for (const [cx, cy] of pl.absCells) grid[cy][cx] = -1;
        if (capped || timedOut) return;
      }
    };

    dfs();

    return {
      solvable: solutionCount > 0,
      solutionCount,
      capped,
      timedOut,
      reference,
      legalPositionCounts,
      elapsedMs: Math.round(now() - startTime),
    };
  },
};

window.PS = window.PS || {};
PS.Solver = Solver;
