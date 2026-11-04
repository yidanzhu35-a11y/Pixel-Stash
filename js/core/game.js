// ============================================================
// Game（游戏状态管理：Board / Piece / 通关判定 / 旋转能力）
// UI 只通过这里的方法改变状态，然后监听 change/win 事件重绘。
// 网格占用表 grid 维护"已放置"贴纸；拖动中的贴纸临时移出。
// ============================================================
class Game {
  constructor(level) {
    this.level = level;
    this.board = {
      width: level.board.width,
      height: level.board.height,
      blockedCells: level.board.blockedCells || [],
      blockedSet: new Set(
        (level.board.blockedCells || []).map((c) => c[0] + "," + c[1])
      ),
    };
    this._buildPieces(level);
    this.listeners = { change: [], win: [] };
  }

  _buildPieces(level) {
    this.pieces = level.pieces.map((p, idx) => {
      const sticker = STICKERS[p.stickerId];
      if (!sticker) throw new Error("未知贴纸: " + p.stickerId);
      const shape = getShape(sticker.shapeId);
      return {
        idx,
        id: p.id,
        stickerId: p.stickerId,
        sticker,
        shapeId: sticker.shapeId,
        shapeCells: shape.cells,
        initialRotation: p.initialRotation || 0,
        rotation: p.initialRotation || 0,
        rotationAbility: false, // 旋转能力按实例记录
        placed: false,
        x: 0,
        y: 0,
      };
    });
    this.rotationTokensLeft = level.rotationTokens || 0;
    this.grid = Validator.buildGrid(this.board);
    this.selectedIdx = null;
    this.win = false;
  }

  // ---------- 事件 ----------
  onChange(cb) { this.listeners.change.push(cb); }
  onWin(cb) { this.listeners.win.push(cb); }
  emitChange() { this.listeners.change.forEach((cb) => cb(this)); }
  emitWin() { this.listeners.win.forEach((cb) => cb(this)); }

  // ---------- 查询 ----------
  getPiece(idx) { return this.pieces[idx]; }
  getSelected() {
    return this.selectedIdx == null ? null : this.pieces[this.selectedIdx];
  }
  select(idx) {
    this.selectedIdx = idx;
    this.emitChange();
  }
  getPlacedCount() { return this.pieces.filter((p) => p.placed).length; }

  cellsAt(piece, x, y, rotation) {
    const cells = Geometry.cellsAtRotation(piece.shapeCells, rotation);
    return Geometry.absolute(cells, x, y);
  }

  // ---------- 网格维护 ----------
  _clearFromGrid(piece) {
    if (!piece.placed) return;
    for (const [cx, cy] of this.cellsAt(piece, piece.x, piece.y, piece.rotation)) {
      this.grid[cy][cx] = -1;
    }
  }
  _writeToGrid(piece) {
    for (const [cx, cy] of this.cellsAt(piece, piece.x, piece.y, piece.rotation)) {
      this.grid[cy][cx] = piece.idx;
    }
  }

  // ---------- 判定 ----------
  canPlace(piece, x, y, rotation) {
    const wasPlaced = piece.placed;
    if (wasPlaced) this._clearFromGrid(piece);
    const absCells = this.cellsAt(piece, x, y, rotation);
    const res = Validator.checkCells(this.board, this.grid, absCells, piece.idx);
    if (wasPlaced) this._writeToGrid(piece);
    return res;
  }

  // ---------- 操作（由输入控制器调用） ----------
  // 拖起已放置的贴纸：临时移出网格，记录原位置
  pickup(piece) {
    this._origin = piece.placed
      ? { x: piece.x, y: piece.y, rotation: piece.rotation }
      : null;
    this._clearFromGrid(piece);
    piece.placed = false;
  }

  // 放回原位（取消拖动 / 非法落点）
  restore(piece) {
    if (this._origin) {
      piece.x = this._origin.x;
      piece.y = this._origin.y;
      piece.rotation = this._origin.rotation;
      piece.placed = true;
      this._writeToGrid(piece);
    } else {
      piece.placed = false; // 回到待收纳区
    }
    this._origin = null;
    this.emitChange();
  }

  // 尝试放置到 (x, y)，使用贴纸当前方向；成功返回 {ok:true}
  tryPlace(piece, x, y) {
    const res = this.canPlace(piece, x, y, piece.rotation);
    if (!res.ok) return res;
    piece.x = x;
    piece.y = y;
    piece.placed = true;
    this._writeToGrid(piece);
    this._origin = null;
    this.emitChange();
    this._checkWin();
    return res;
  }

  // 放回待收纳区（放弃当前摆放）
  sendToTray(piece) {
    this._clearFromGrid(piece);
    piece.placed = false;
    this._origin = null;
    this.emitChange();
  }

  // 旋转 90°（顺时针）。需要实例拥有旋转能力。
  tryRotate(piece) {
    if (!piece.rotationAbility) {
      return { ok: false, reason: "no_ability" };
    }
    const newRot = (piece.rotation + 90) % 360;
    if (piece.placed) {
      const res = this.canPlace(piece, piece.x, piece.y, newRot);
      if (!res.ok) return res; // 旋转不能导致越界/重叠/违反留白
    }
    piece.rotation = newRot;
    if (piece.placed) this._writeToGrid(piece);
    this.emitChange();
    return { ok: true };
  }

  // 授予旋转能力（消耗本关旋转名额，按实例计）
  grantRotationAbility(piece) {
    if (this.win) return { ok: false, reason: "finished" };
    if (piece.rotationAbility) return { ok: false, reason: "already" };
    if (this.rotationTokensLeft <= 0) return { ok: false, reason: "no_tokens" };
    piece.rotationAbility = true;
    this.rotationTokensLeft--;
    this.emitChange();
    return { ok: true };
  }

  _checkWin() {
    if (this.win) return;
    if (this.pieces.every((p) => p.placed)) {
      this.win = true;
      this.emitWin();
    }
  }

  // ---------- 重置 / 持久化 ----------
  reset() {
    this._buildPieces(this.level);
    this.emitChange();
  }

  serialize() {
    return {
      pieces: this.pieces.map((p) => ({
        id: p.id,
        placed: p.placed,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        rotationAbility: p.rotationAbility,
      })),
      rotationTokensLeft: this.rotationTokensLeft,
      win: this.win,
    };
  }

  restoreLayout(data) {
    if (!data || !data.pieces) return false;
    const byId = new Map(this.pieces.map((p) => [p.id, p]));
    let ok = true;
    for (const s of data.pieces) {
      const p = byId.get(s.id);
      if (!p) { ok = false; continue; }
      p.rotation = s.rotation || 0;
      p.rotationAbility = !!s.rotationAbility;
      p.placed = false;
      p.x = 0;
      p.y = 0;
    }
    this.rotationTokensLeft =
      typeof data.rotationTokensLeft === "number"
        ? data.rotationTokensLeft
        : this.level.rotationTokens || 0;
    // 只在全部合法时才接受已放置状态
    for (const s of data.pieces) {
      if (!s.placed) continue;
      const p = byId.get(s.id);
      if (!p) continue;
      const res = this.canPlace(p, s.x, s.y, p.rotation);
      if (res.ok) this.tryPlace(p, s.x, s.y);
      else ok = false;
    }
    if (data.win && this.win) {
      // 恢复到已通关状态
    }
    this.emitChange();
    return ok;
  }
}

// 形状查找的小包装（避免拼写错误静默失败）
function getShape(shapeId) {
  const s = SHAPES[shapeId];
  if (!s) throw new Error("未知形状: " + shapeId);
  return s;
}

window.PS = window.PS || {};
PS.Game = Game;
