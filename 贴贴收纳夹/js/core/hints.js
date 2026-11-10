// ============================================================
// HintManager（提示系统 · M2，需求 §5）
// 三种提示随机出现，全部基于求解器条件搜索（initialPlacements），
// 不依赖唯一标准答案。
// - Hint 1：为一张未放置贴纸找一个"属于完整可行解"的位置，
//   已放置的贴纸全部保留（锁定）。
// - Hint 2：逐一检查已放置贴纸——只保留它、其余全部可动时，
//   是否仍存在完整解；找到第一张可行的就提示玩家保留它。
// - Hint 3：锁定全部已放置贴纸，检查剩余贴纸可完成性（死局检测）。
//
// 正确性关键点：搜索时每张贴纸的"允许方向集合"必须与玩家
// 实际能力一致——有旋转能力 → 4 方向；没有 → 只能维持当前方向。
// 这样提示给出的摆法玩家真的能照做。
//
// 提示去重（补丁五）：同一布局下，已展示过的提示不再重复出现。
// - 调用方（main.js）维护"布局签名 + 已展示 key 列表"，布局变化即作废；
//   传参约定：opts.seen 仅在布局未变时才传（本类不自行校验）。
// - hint 的"内容 key"（contentKey）按用户可见内容生成：
//   Hint1 = 贴纸 + 占位格；Hint2 = 贴纸；Hint3 = 结果；
//   Hint1 死局与 Hint3 失败的文案/红脉冲相同，统一记作 layout:dead。
// - 超时/错误不参与去重（点重试是自然操作）。
// ============================================================
const HintManager = {
  // ---- 类型随机（需求：三种提示随机出现）----
  // 没有任何已放置贴纸时，Hint 2/3 无从检查，只出 Hint 1。
  pickType(game, rand) {
    var rnd = rand || Math.random;
    var hasPlaced = game.pieces.some(function (p) { return p.placed; });
    var types = hasPlaced ? [1, 2, 3] : [1];
    return types[Math.floor(rnd() * types.length)];
  },

  // 随机选一种提示；若结果与已展示过的重复（同布局），
  // 顺延尝试下一个类型；全部只能重复 → exhausted。
  getHint(game, opts) {
    var seen = (opts && opts.seen) || [];
    var rand = this._rand(opts);
    var hasPlaced = game.pieces.some(function (p) { return p.placed; });
    var types = hasPlaced ? [1, 2, 3] : [1];
    var order = this._shuffle(types, rand);
    for (var k = 0; k < order.length; k++) {
      var h = order[k] === 1 ? this.hint1(game, opts)
        : order[k] === 2 ? this.hint2(game, opts)
        : this.hint3(game, opts);
      var key = this.contentKey(h);
      if (key == null) return h; // 超时/异常：直接返回（重试是自然操作）
      if (seen.indexOf(key) === -1) return h;
    }
    return { type: 0, reason: "exhausted" };
  },

  // ---- 提示内容 key（去重依据）----
  contentKey(h) {
    if (!h) return null;
    if (!h.ok) {
      if (h.reason === "timeout" || h.reason === "error") return null; // 可重试
      if (h.type === 1) return "layout:dead"; // dead_end：文案/红脉冲与 Hint3 失败一致
      if (h.type === 2) return "2:failed";
      if (h.type === 3) return "layout:dead";
      return null;
    }
    if (h.type === 1) {
      var abs = Geometry.absolute(
        Geometry.cellsAtRotation(h.piece.shapeCells, h.rotation), h.x, h.y
      );
      return "1:" + h.piece.id + ":" + Geometry.cellsKey(abs);
    }
    if (h.type === 2) return "2:" + h.piece.id;
    if (h.type === 3) return "3:ok";
    return null;
  },

  // ---- 求解器输入 ----
  // allowUnlockRotation（仅 Hint 1 Pass B）：
  // 假设未放置且未解锁的贴纸消耗一个旋转名额解锁后能转，
  // 此时提示会注明"需要先解锁旋转能力"。
  solverPieces(game, allowUnlockRotation) {
    return game.pieces.map(function (p) {
      var canRotate = p.rotationAbility ||
        (allowUnlockRotation && !p.placed && game.rotationTokensLeft > 0);
      return {
        id: p.id,
        stickerId: p.stickerId,
        cells: p.shapeCells,
        rotations: canRotate ? [0, 90, 180, 270] : [p.rotation],
      };
    });
  },

  // 已放置贴纸 → 求解器的锁定摆放（条件搜索的"保留"部分）
  placedLocks(game, filter) {
    return game.pieces
      .filter(function (p) { return p.placed && (!filter || filter(p)); })
      .map(function (p) {
        return { id: p.id, x: p.x, y: p.y, rotation: p.rotation };
      });
  },

  _budgetMs(opts) { return (opts && opts.budgetMs) || 3000; },
  _rand(opts) { return (opts && opts.rand) || Math.random; },
  _shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  },
  _refKey(piece, ref) {
    var abs = Geometry.absolute(
      Geometry.cellsAtRotation(piece.shapeCells, ref.rotation), ref.x, ref.y
    );
    return "1:" + piece.id + ":" + Geometry.cellsKey(abs);
  },

  // ---- Hint 1：展示一个可行摆放位置 ----
  // Pass A：所有贴纸按真实能力搜索（已放置的锁定）。
  // Pass B：Pass A 无解且还有旋转名额时，允许未放置的未解锁贴纸
  //   "假设解锁旋转后"再搜一次；找到的摆法需要玩家消耗名额解锁。
  //   （注：Pass B 可能同时旋转多张贴纸，而名额未必够——提示只对
  //   被点名的那张贴纸负责，文案会说清"需要先解锁旋转"。）
  // 去重：优先挑没展示过的贴纸/摆法；参考解全看过时，为贴纸枚举
  //   其他合法位置（锁定后仍可完成才算数）。
  hint1(game, opts) {
    var unplaced = game.pieces.filter(function (p) { return !p.placed; });
    if (!unplaced.length) return { type: 1, ok: false, reason: "no_unplaced" };
    var seen = (opts && opts.seen) || [];
    var rand = this._rand(opts);
    var budget = this._budgetMs(opts);
    var deadline = Date.now() + budget;
    var locks = this.placedLocks(game);

    var res = Solver.solve(game.board, this.solverPieces(game, false), {
      maxSolutions: 1,
      timeLimitMs: budget,
      initialPlacements: locks,
    });
    if (res.timedOut) return { type: 1, ok: false, reason: "timeout" };
    if (res.solvable && res.reference) {
      var candidates = unplaced.filter(function (p) {
        return seen.indexOf(this._refKey(p, res.reference[p.id])) === -1;
      }, this);
      if (candidates.length) {
        var target = candidates[Math.floor(rand() * candidates.length)];
        var ref = res.reference[target.id];
        return {
          type: 1, ok: true, piece: target,
          x: ref.x, y: ref.y, rotation: ref.rotation,
          needsRotate: ref.rotation !== target.rotation, // 有能力的贴纸：托盘里先转个方向
        };
      }
      // 参考解的建议都看过了 → 找没看过的替代位置（仍属完整解）
      var alt = this._freshPlacement(game, unplaced, locks, seen, rand, deadline, false);
      if (alt) return alt;
      // 无新内容：返回一个已展示过的建议，由 getHint 换类型
      var t0 = unplaced[Math.floor(rand() * unplaced.length)];
      var r0 = res.reference[t0.id];
      return {
        type: 1, ok: true, piece: t0,
        x: r0.x, y: r0.y, rotation: r0.rotation,
        needsRotate: r0.rotation !== t0.rotation,
      };
    }
    if (game.rotationTokensLeft > 0 &&
        unplaced.some(function (p) { return !p.rotationAbility; })) {
      var res2 = Solver.solve(game.board, this.solverPieces(game, true), {
        maxSolutions: 1,
        timeLimitMs: Math.max(1, deadline - Date.now()),
        initialPlacements: locks,
      });
      if (res2.timedOut) return { type: 1, ok: false, reason: "timeout" };
      if (res2.solvable && res2.reference) {
        // Pass A 失败而 Pass B 成功 ⇒ 必有贴纸需要旋转才能完成
        var needers = unplaced.filter(function (p) {
          return !p.rotationAbility &&
            res2.reference[p.id].rotation !== p.rotation;
        });
        var pool = needers.length
          ? needers
          : unplaced.filter(function (p) { return !p.rotationAbility; });
        var fresh = pool.filter(function (p) {
          return seen.indexOf(this._refKey(p, res2.reference[p.id])) === -1;
        }, this);
        if (fresh.length) {
          var t2 = fresh[Math.floor(rand() * fresh.length)];
          var rr = res2.reference[t2.id];
          return {
            type: 1, ok: true, piece: t2,
            x: rr.x, y: rr.y, rotation: rr.rotation,
            needsRotationUnlock: true,
          };
        }
        var alt2 = this._freshPlacement(game, pool, locks, seen, rand, deadline, true);
        if (alt2) return alt2;
        var t3 = pool[Math.floor(rand() * pool.length)];
        var r3 = res2.reference[t3.id];
        return {
          type: 1, ok: true, piece: t3,
          x: r3.x, y: r3.y, rotation: r3.rotation,
          needsRotationUnlock: true,
        };
      }
    }
    return { type: 1, ok: false, reason: "dead_end" };
  },

  // 为 pieces（随机顺序）枚举"没展示过的合法位置"，
  // 锁定后仍可完成（= 属于完整可行解）才返回。
  // allowUnlock：Pass B 语境（未解锁贴纸假设解锁后可转）。
  _freshPlacement(game, pieces, locks, seen, rand, deadline, allowUnlock) {
    var order = this._shuffle(pieces, rand);
    for (var k = 0; k < order.length; k++) {
      var p = order[k];
      var rotations = (p.rotationAbility || allowUnlock)
        ? [0, 90, 180, 270]
        : [p.rotation];
      var prefix = "1:" + p.id + ":";
      var seenCells = {};
      for (var s = 0; s < seen.length; s++) {
        if (seen[s].indexOf(prefix) === 0) seenCells[seen[s].slice(prefix.length)] = true;
      }
      // 枚举合法位置（越界/障碍/重叠/留白全过），按占位格去重 + 排除已展示
      var cands = [];
      var dedup = {};
      for (var ri = 0; ri < rotations.length; ri++) {
        var cells = Geometry.cellsAtRotation(p.shapeCells, rotations[ri]);
        var bb = Geometry.boundingBox(cells);
        for (var y = 0; y + bb.h <= game.board.height; y++) {
          for (var x = 0; x + bb.w <= game.board.width; x++) {
            var abs = Geometry.absolute(cells, x, y);
            var ck = Geometry.cellsKey(abs);
            if (dedup[ck] || seenCells[ck]) continue;
            if (!Validator.checkCells(game.board, game.grid, abs, p.idx).ok) continue;
            dedup[ck] = true;
            cands.push({ x: x, y: y, rotation: rotations[ri] });
          }
        }
      }
      cands = this._shuffle(cands, rand);
      for (var m = 0; m < cands.length; m++) {
        if (Date.now() > deadline) return null;
        var cand = cands[m];
        var res = Solver.solve(game.board, this.solverPieces(game, false), {
          maxSolutions: 1,
          timeLimitMs: Math.max(1, deadline - Date.now()),
          initialPlacements: locks.concat([
            { id: p.id, x: cand.x, y: cand.y, rotation: cand.rotation },
          ]),
        });
        if (res.timedOut) return null;
        if (res.solvable) {
          return {
            type: 1, ok: true, piece: p,
            x: cand.x, y: cand.y, rotation: cand.rotation,
            needsRotate: p.rotationAbility && cand.rotation !== p.rotation,
            needsRotationUnlock: allowUnlock && !p.rotationAbility,
          };
        }
      }
    }
    return null;
  },

  // ---- Hint 2：检查已放置贴纸 ----
  // 逐一检查（顺序随机），找到一张"保留它能完成"的就返回；
  // 去重：已展示过的贴纸先跳过（布局未变 ⇒ 它仍可行，无需重算）；
  // 只剩已展示过的可行贴纸时返回它（contentKey 命中 seen，getHint 换类型）。
  // 全部不可行 → ok:false（UI 显示需求给定文案）。
  // 注意：seen 必须只在布局未变时传入（本方法信任该约定）。
  hint2(game, opts) {
    var placed = game.pieces.filter(function (p) { return p.placed; });
    if (!placed.length) return { type: 2, ok: false, reason: "no_placed" };
    var seen = (opts && opts.seen) || [];
    var rand = this._rand(opts);
    var order = this._shuffle(placed, rand);
    var deadline = Date.now() + this._budgetMs(opts);
    for (var k = 0; k < order.length; k++) {
      var p = order[k];
      if (seen.indexOf("2:" + p.id) !== -1) continue;
      var left = deadline - Date.now();
      if (left <= 0) return { type: 2, ok: false, reason: "timeout" };
      var res = Solver.solve(game.board, this.solverPieces(game, false), {
        maxSolutions: 1,
        timeLimitMs: left,
        initialPlacements: [{ id: p.id, x: p.x, y: p.y, rotation: p.rotation }],
      });
      if (res.solvable) return { type: 2, ok: true, piece: p };
      if (res.timedOut) return { type: 2, ok: false, reason: "timeout" };
    }
    for (var m = 0; m < order.length; m++) {
      if (seen.indexOf("2:" + order[m].id) !== -1) {
        return { type: 2, ok: true, piece: order[m] };
      }
    }
    return { type: 2, ok: false }; // 「当前贴纸的位置没有一个是合适的。」
  },

  // ---- Hint 3：检查整体布局 ----
  hint3(game, opts) {
    var res = Solver.solve(game.board, this.solverPieces(game, false), {
      maxSolutions: 1,
      timeLimitMs: this._budgetMs(opts),
      initialPlacements: this.placedLocks(game),
    });
    if (res.timedOut) return { type: 3, ok: false, reason: "timeout" };
    return { type: 3, ok: res.solvable };
  },
};

window.PS = window.PS || {};
PS.HintManager = HintManager;
