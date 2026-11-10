// ============================================================
// InputController（交互：拖动 / 点选 / 吸附 / 非法反馈）
// Pointer Events 统一处理触屏与鼠标。
// - 按下并移动超过阈值 → 拖拽（贴纸临时移出网格跟随指针）
// - 松开在纸页上 → 吸附到目标格；合法则放置，非法则弹回 + 红色闪烁
// - 松开在托盘上 → 放回待收纳区
// - 原地轻点 → 选中 / 取消选中（供旋转面板使用）
// ============================================================
class InputController {
  constructor(canvas, renderer, game, hooks) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.game = game;
    this.hooks = hooks || {};
    this.drag = null;
    this.press = null;

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this._down(e));
    canvas.addEventListener("pointermove", (e) => this._move(e));
    canvas.addEventListener("pointerup", (e) => this._up(e));
    canvas.addEventListener("pointercancel", (e) => this._up(e, true));
  }

  setGame(game) {
    if (this.drag) this._cancelDrag();
    this.game = game;
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / r.width;
    const sy = this.canvas.height / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
  }

  _down(e) {
    if (this.game.win) return;
    e.preventDefault();
    const [px, py] = this._pos(e);
    const piece = this.renderer.pieceAt(px, py);
    if (!piece) {
      // 点空白处：取消选中
      if (this.game.selectedIdx != null) {
        this.game.select(null);
        if (this.hooks.onSelectionChange) this.hooks.onSelectionChange(null);
      }
      this.renderer.render();
      return;
    }
    this.press = {
      piece,
      startX: px,
      startY: py,
      time: Date.now(),
      grabDX: px,
      grabDY: py,
    };
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  _move(e) {
    if (!this.press) return;
    const [px, py] = this._pos(e);
    const dpr = this.renderer.dpr || 1;
    if (!this.drag) {
      const dx = px - this.press.startX;
      const dy = py - this.press.startY;
      if (Math.hypot(dx, dy) < 8 * dpr) return;
      this._startDrag(px, py);
    }
    const d = this.drag;
    d.pointerX = px;
    d.pointerY = py;
    this._updateTarget();
    this.renderer.render();
  }

  _startDrag(px, py) {
    const piece = this.press.piece;
    const cells = Geometry.cellsAtRotation(piece.shapeCells, piece.rotation);
    const bb = Geometry.boundingBox(cells);
    let grabDX, grabDY;
    if (piece.placed) {
      // 以按下位置为抓取点，保证贴纸不因事件稀疏而漂移
      const [ox, oy] = this.renderer.cellToPx(piece.x, piece.y);
      grabDX = this.press.startX - ox;
      grabDY = this.press.startY - oy;
    } else {
      grabDX = (bb.w * this.renderer.cellPx) / 2; // 从托盘拿起：居中跟随
      grabDY = (bb.h * this.renderer.cellPx) / 2;
    }
    this.game.pickup(piece);
    this.game.select(null);
    if (this.hooks.onSelectionChange) this.hooks.onSelectionChange(null);
    this.drag = {
      piece,
      fromBoard: false,
      pointerX: px,
      pointerY: py,
      grabDX,
      grabDY,
      target: null,
      valid: false,
      showGhost: false,
      res: null, // 最近一次 canPlace 的完整结果（含挡路贴纸，供红色提示高亮）
    };
    this.renderer.drag = this.drag;
  }

  _updateTarget() {
    const d = this.drag;
    if (!d) return;
    const r = this.renderer;
    const piece = d.piece;
    const cells = Geometry.cellsAtRotation(piece.shapeCells, piece.rotation);
    const bb = Geometry.boundingBox(cells);
    const tlx = d.pointerX - d.grabDX;
    const tly = d.pointerY - d.grabDY;
    const centerX = tlx + (bb.w * r.cellPx) / 2;
    const centerY = tly + (bb.h * r.cellPx) / 2;
    d.showGhost = r.pointInBoard(centerX, centerY);
    const b = this.game.board;
    const rawX = Math.round((tlx - r.boardX) / r.cellPx);
    const rawY = Math.round((tly - r.boardY) / r.cellPx);
    d.target = {
      x: Math.max(-1, Math.min(b.width - 1, rawX)),
      y: Math.max(-1, Math.min(b.height - 1, rawY)),
    };
    d.res = this.game.canPlace(piece, d.target.x, d.target.y, piece.rotation);
    d.valid = d.showGhost && d.res.ok;
  }

  _up(e, cancelled) {
    if (this.drag) {
      this._finishDrag(cancelled);
      return;
    }
    if (!this.press) return;
    const [px, py] = this._pos(e);
    const piece = this.renderer.pieceAt(px, py);
    if (piece && !cancelled) {
      const already = this.game.selectedIdx === piece.idx;
      this.game.select(already ? null : piece.idx);
      if (this.hooks.onSelectionChange)
        this.hooks.onSelectionChange(already ? null : piece);
    }
    this.press = null;
    this.renderer.render();
  }

  _finishDrag(cancelled) {
    const d = this.drag;
    const r = this.renderer;
    const piece = d.piece;
    this._updateTarget();

    if (!cancelled && d.showGhost && d.target) {
      const res = this.game.canPlace(piece, d.target.x, d.target.y, piece.rotation);
      if (res.ok) {
        this.game.tryPlace(piece, d.target.x, d.target.y);
      } else {
        this.game.restore(piece);
        r.showInvalidFlash(piece, d.target.x, d.target.y, res);
        if (this.hooks.onInvalidDrop) this.hooks.onInvalidDrop(piece, res);
      }
    } else if (!cancelled && r.pointInTray(d.pointerX, d.pointerY)) {
      this.game.sendToTray(piece); // 拖回托盘 = 放回待收纳
    } else {
      this.game.restore(piece); // 其他区域：弹回原位
    }

    this.drag = null;
    this.press = null;
    r.drag = null;
    r.render();
  }

  _cancelDrag() {
    if (this.drag) {
      this.game.restore(this.drag.piece);
      this.drag = null;
      this.renderer.drag = null;
      this.renderer.render();
    }
    this.press = null;
  }
}

window.PS = window.PS || {};
PS.InputController = InputController;
