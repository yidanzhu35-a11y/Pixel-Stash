// ============================================================
// Renderer（画布渲染）
// 单个 canvas 上绘制：纸页棋盘 + 障碍格 + 已放置贴纸 +
// 待收纳托盘 + 选中高亮 + 拖拽精灵 + 吸附幽灵（合法绿/非法红）。
// 所有尺寸基于设备像素，格子取 8 的倍数保证像素画锐利。
// ============================================================
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.game = null;
    this.drag = null; // 由 InputController 维护
    this.flash = null; // 非法落点的红色反馈 {piece, x, y, expires}
    this.hint = null; // 提示闪烁 {piece, x, y, rotation, start, expires}
    this.boardPulse = null; // Hint 3 的棋盘外框脉冲 {color, start, expires}
    this._hintLoop = null; // 闪烁重绘定时器
  }

  setGame(game) {
    this.game = game;
    this.layout();
  }

  layout() {
    if (!this.game) return;
    const dpr = (this.dpr = window.devicePixelRatio || 1);
    const cssW = this.canvas.clientWidth || 320;
    const w = Math.floor(cssW * dpr);
    this.canvas.width = w;
    const b = this.game.board;
    const pad = Math.round(12 * dpr);
    let cell = Math.floor((w - pad * 2) / b.width / 8) * 8;
    cell = Math.max(16, cell);
    this.cellPx = cell;
    this.boardPixW = cell * b.width;
    this.boardPixH = cell * b.height;
    this.boardX = Math.round((w - this.boardPixW) / 2);
    this.boardY = pad;
    this.trayY = this.boardY + this.boardPixH + Math.round(24 * dpr);
    this.trayCell = Math.max(12, Math.floor((cell * 0.6) / 4) * 4);
    this.pad = pad;
    this._layoutTray();
    const contentH = this.trayY + this.trayH + Math.round(14 * dpr);
    this.canvas.height = contentH;
    this.canvas.style.height = Math.round(contentH / dpr) + "px";
  }

  _layoutTray() {
    const dpr = this.dpr;
    const w = this.canvas.width;
    const pad = this.pad;
    const gap = Math.round(10 * dpr);
    this.trayItems = [];
    const unplaced = this.game.pieces.filter((p) => !p.placed);
    let x = pad;
    let rowH = 0;
    let rows = 1;
    const labelH = Math.round(22 * dpr);
    let ty = this.trayY + labelH;
    for (const p of unplaced) {
      const cells = Geometry.cellsAtRotation(p.shapeCells, p.rotation);
      const bb = Geometry.boundingBox(cells);
      const iw = bb.w * this.trayCell;
      const ih = bb.h * this.trayCell;
      if (x + iw > w - pad && x > pad) {
        x = pad;
        ty += rowH + gap;
        rowH = 0;
        rows++;
      }
      this.trayItems.push({ pieceIdx: p.idx, x, y: ty, w: iw, h: ih });
      x += iw + gap;
      rowH = Math.max(rowH, ih);
    }
    this.trayH = labelH + rows * rowH + (rows > 1 ? (rows - 1) * gap : 0);
    this.trayRect = { x: 0, y: this.trayY - Math.round(6 * dpr), w, h: this.trayH + Math.round(6 * dpr) };
  }

  // ---------- 坐标换算 ----------
  cellToPx(cx, cy) {
    return [this.boardX + cx * this.cellPx, this.boardY + cy * this.cellPx];
  }
  pxToCell(px, py) {
    const cx = Math.floor((px - this.boardX) / this.cellPx);
    const cy = Math.floor((py - this.boardY) / this.cellPx);
    if (cx < 0 || cy < 0 || cx >= this.game.board.width || cy >= this.game.board.height)
      return null;
    return { x: cx, y: cy };
  }
  pointInBoard(px, py) {
    return (
      px >= this.boardX - this.cellPx * 0.5 &&
      px <= this.boardX + this.boardPixW + this.cellPx * 0.5 &&
      py >= this.boardY - this.cellPx * 0.5 &&
      py <= this.boardY + this.boardPixH + this.cellPx * 0.5
    );
  }
  pointInTray(px, py) {
    const r = this.trayRect;
    return r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // 命中测试：已放置贴纸（按占位格子）优先，其次托盘
  pieceAt(px, py) {
    const cell = this.pxToCell(px, py);
    if (cell) {
      for (const p of this.game.pieces) {
        if (!p.placed) continue;
        const abs = this.game.cellsAt(p, p.x, p.y, p.rotation);
        if (abs.some(([cx, cy]) => cx === cell.x && cy === cell.y)) return p;
      }
      return null;
    }
    for (const item of this.trayItems) {
      if (px >= item.x && px <= item.x + item.w && py >= item.y - 4 && py <= item.y + item.h + 4) {
        return this.game.pieces[item.pieceIdx];
      }
    }
    return null;
  }

  // 逻辑占位格可视化：为 piece 在 (x, y) 的每个占位格画半透明圆角色块。
  // 判定按整格算，但 die-cut 像素画不必填满格子——画出占位格，
  // 让"看起来占据"与"实际占据"一致（拖拽预览 / 非法反馈 / 选中都用它）。
  // rotation 可选：提示闪烁按"建议方向"画占位格。
  _drawCellFootprint(ctx, piece, x, y, color, alpha, rotation) {
    const cells = Geometry.cellsAtRotation(
      piece.shapeCells, rotation != null ? rotation : piece.rotation
    );
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (const [cx, cy] of cells) {
      const [px, py] = this.cellToPx(x + cx, y + cy);
      this._roundedRect(
        ctx,
        px + 2 * this.dpr,
        py + 2 * this.dpr,
        this.cellPx - 4 * this.dpr,
        this.cellPx - 4 * this.dpr,
        4 * this.dpr
      );
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 绘制 ----------
  render() {
    if (!this.game) return;
    this._layoutTray();
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;

    this._drawBoard(ctx, dpr);
    for (const p of this.game.pieces) {
      if (p.placed && !(this.drag && this.drag.piece === p)) this._drawPlacedPiece(ctx, p);
    }
    this._drawSelection(ctx, dpr);
    this._drawTray(ctx, dpr);
    if (this.drag) this._drawDrag(ctx, dpr);
    this._drawFlash(ctx);
    this._drawHint(ctx);
    this._drawBoardPulse(ctx, dpr);
    if (this.game.win) this._drawWinFrame(ctx, dpr);
  }

  _roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _drawBoard(ctx, dpr) {
    const b = this.game.board;
    // 纸页底色
    ctx.fillStyle = "#fffdf7";
    this._roundedRect(ctx, this.boardX, this.boardY, this.boardPixW, this.boardPixH, 8 * dpr);
    ctx.fill();
    // 网格（手帐格）
    ctx.strokeStyle = "#f0dcd6";
    ctx.lineWidth = 1 * dpr;
    ctx.save();
    this._roundedRect(ctx, this.boardX, this.boardY, this.boardPixW, this.boardPixH, 8 * dpr);
    ctx.clip();
    for (let x = 1; x < b.width; x++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX + x * this.cellPx + 0.5, this.boardY);
      ctx.lineTo(this.boardX + x * this.cellPx + 0.5, this.boardY + this.boardPixH);
      ctx.stroke();
    }
    for (let y = 1; y < b.height; y++) {
      ctx.beginPath();
      ctx.moveTo(this.boardX, this.boardY + y * this.cellPx + 0.5);
      ctx.lineTo(this.boardX + this.boardPixW, this.boardY + y * this.cellPx + 0.5);
      ctx.stroke();
    }
    // 障碍格（胶带 / 邮票占位样式，M1 关卡未使用）
    for (const [bx, by] of b.blockedCells) {
      const [px, py] = this.cellToPx(bx, by);
      ctx.fillStyle = "#e7d2c0";
      ctx.fillRect(px + 2 * dpr, py + 2 * dpr, this.cellPx - 4 * dpr, this.cellPx - 4 * dpr);
      ctx.strokeStyle = "#c9a68c";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(px + 8 * dpr, py + 8 * dpr);
      ctx.lineTo(px + this.cellPx - 8 * dpr, py + this.cellPx - 8 * dpr);
      ctx.moveTo(px + this.cellPx - 8 * dpr, py + 8 * dpr);
      ctx.lineTo(px + 8 * dpr, py + this.cellPx - 8 * dpr);
      ctx.stroke();
    }
    ctx.restore();
    // 外框
    ctx.strokeStyle = "#e8b4c8";
    ctx.lineWidth = 2 * dpr;
    this._roundedRect(ctx, this.boardX, this.boardY, this.boardPixW, this.boardPixH, 8 * dpr);
    ctx.stroke();
  }

  _drawSprite(ctx, piece, px, py, cellPx, opts) {
    // opts.rotation：提示闪烁需要按"建议方向"而非贴纸当前方向绘制
    const rotation = opts && opts.rotation != null ? opts.rotation : piece.rotation;
    const sprite = opts && opts.tint
      ? Art.getTinted(piece.sticker.art, rotation, opts.tint)
      : Art.getSprite(piece.sticker.art, rotation);
    if (!sprite) {
      // 无美术素材时的占位渲染
      ctx.save();
      ctx.translate(px, py);
      Art.drawPlaceholder(ctx, Geometry.cellsAtRotation(piece.shapeCells, rotation), cellPx, "#e4d4f2");
      ctx.restore();
      return;
    }
    const cols = sprite.width / (ART_PX_PER_CELL * SPRITE_PX);
    const rows = sprite.height / (ART_PX_PER_CELL * SPRITE_PX);
    if (opts && opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(sprite, px, py, cols * cellPx, rows * cellPx);
    if (opts && opts.alpha != null) ctx.globalAlpha = 1;
  }

  _drawPlacedPiece(ctx, p) {
    const [px, py] = this.cellToPx(p.x, p.y);
    ctx.save();
    ctx.shadowColor = "rgba(120, 90, 110, 0.18)";
    ctx.shadowBlur = 4 * this.dpr;
    ctx.shadowOffsetY = 2 * this.dpr;
    this._drawSprite(ctx, p, px, py, this.cellPx);
    ctx.restore();
  }

  _drawSelection(ctx, dpr) {
    const p = this.game.getSelected();
    if (!p) return;
    ctx.strokeStyle = "#ffb6c9";
    ctx.lineWidth = 2.5 * dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    if (p.placed) {
      // 选中即显示逻辑占位格：点一下就知道这张贴纸实际占了哪些格子
      this._drawCellFootprint(ctx, p, p.x, p.y, "#ffb6c9", 0.16);
      const cells = this.game.cellsAt(p, p.x, p.y, p.rotation);
      const bb = Geometry.boundingBox(cells);
      const [px, py] = this.cellToPx(bb.minX, bb.minY);
      this._roundedRect(ctx, px - 3 * dpr, py - 3 * dpr, bb.w * this.cellPx + 6 * dpr, bb.h * this.cellPx + 6 * dpr, 6 * dpr);
      ctx.stroke();
    } else {
      const item = this.trayItems.find((it) => it.pieceIdx === p.idx);
      if (item) {
        this._roundedRect(ctx, item.x - 4 * dpr, item.y - 4 * dpr, item.w + 8 * dpr, item.h + 8 * dpr, 6 * dpr);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    if (p.rotationAbility) {
      // 有旋转能力的贴纸加一个小角标
      const bx = p.placed ? this.cellToPx(p.x, p.y)[0] : (this.trayItems.find((it) => it.pieceIdx === p.idx) || {}).x;
      const by = p.placed ? this.cellToPx(p.x, p.y)[1] : (this.trayItems.find((it) => it.pieceIdx === p.idx) || {}).y;
      if (bx != null) {
        ctx.setLineDash([]);
        ctx.fillStyle = "#7ec8e3";
        ctx.beginPath();
        ctx.arc(bx + 6 * dpr, by + 6 * dpr, 5 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawTray(ctx, dpr) {
    ctx.fillStyle = "#b693a5";
    ctx.font = "bold " + Math.round(13 * dpr) + "px sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("待收纳 · " + this.game.pieces.filter((p) => !p.placed).length + " 张", this.pad, this.trayY);
    for (const item of this.trayItems) {
      const p = this.game.pieces[item.pieceIdx];
      if (this.drag && this.drag.piece === p) continue;
      // 托盘里也画出逻辑占位格（浅色小块），拿起前就能看清这张贴纸占几个格
      const cells = Geometry.cellsAtRotation(p.shapeCells, p.rotation);
      ctx.save();
      ctx.fillStyle = "#f6e7ee";
      ctx.strokeStyle = "#eccbd8";
      ctx.lineWidth = 1 * dpr;
      for (const [cx, cy] of cells) {
        const bx = item.x + cx * this.trayCell;
        const by = item.y + cy * this.trayCell;
        this._roundedRect(ctx, bx + 1 * dpr, by + 1 * dpr, this.trayCell - 2 * dpr, this.trayCell - 2 * dpr, 3 * dpr);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      this._drawSprite(ctx, p, item.x, item.y, this.trayCell);
    }
  }

  _drawDrag(ctx, dpr) {
    const d = this.drag;
    const p = d.piece;
    const px = d.pointerX - d.grabDX;
    const py = d.pointerY - d.grabDY;

    // 吸附幽灵预览：先画逻辑占位格（绿/红半透明块），再叠贴纸本体
    if (d.target && d.showGhost) {
      const [gx, gy] = this.cellToPx(d.target.x, d.target.y);
      const tint = d.valid ? "#4caf50" : "#ff5252";
      this._drawCellFootprint(ctx, p, d.target.x, d.target.y, tint, d.valid ? 0.25 : 0.34);
      this._drawSprite(ctx, p, gx, gy, this.cellPx, { tint, alpha: d.valid ? 0.45 : 0.55 });
      // 悬停即提示：红色幽灵时高亮挡路的贴纸，让玩家立刻看懂被谁挡住
      if (!d.valid && d.res && d.res.occupant != null) {
        this._drawConflictHighlight(ctx, this.game.pieces[d.res.occupant]);
      }
    }
    // 跟随手指的贴纸本体
    ctx.save();
    ctx.shadowColor = "rgba(120, 90, 110, 0.3)";
    ctx.shadowBlur = 8 * dpr;
    ctx.shadowOffsetY = 3 * dpr;
    this._drawSprite(ctx, p, px, py, this.cellPx);
    ctx.restore();
  }

  _drawFlash(ctx) {
    if (!this.flash) return;
    if (Date.now() > this.flash.expires) {
      this.flash = null;
      return;
    }
    const f = this.flash;
    const [px, py] = this.cellToPx(f.x, f.y);
    // 红色块标出"想占的格子"，再叠红色贴纸
    this._drawCellFootprint(ctx, f.piece, f.x, f.y, "#ff5252", 0.38);
    this._drawSprite(ctx, f.piece, px, py, this.cellPx, { tint: "#ff5252", alpha: 0.6 });
    // 落点非法时高亮挡路贴纸（gap / overlap 时有 occupant）
    if (f.res && f.res.occupant != null) {
      this._drawConflictHighlight(ctx, this.game.pieces[f.res.occupant]);
    }
  }

  // 红色标注挡路的已放置贴纸：占位格色块 + 整体染红 + 虚线红框
  _drawConflictHighlight(ctx, piece) {
    if (!piece || !piece.placed) return;
    this._drawCellFootprint(ctx, piece, piece.x, piece.y, "#ff5252", 0.3);
    const [px, py] = this.cellToPx(piece.x, piece.y);
    this._drawSprite(ctx, piece, px, py, this.cellPx, { tint: "#ff5252", alpha: 0.6 });
    const cells = this.game.cellsAt(piece, piece.x, piece.y, piece.rotation);
    const bb = Geometry.boundingBox(cells);
    const [bx, by] = this.cellToPx(bb.minX, bb.minY);
    ctx.save();
    ctx.strokeStyle = "#ff5252";
    ctx.lineWidth = 2.5 * this.dpr;
    ctx.setLineDash([5 * this.dpr, 3 * this.dpr]);
    this._roundedRect(
      ctx,
      bx - 2 * this.dpr,
      by - 2 * this.dpr,
      bb.w * this.cellPx + 4 * this.dpr,
      bb.h * this.cellPx + 4 * this.dpr,
      6 * this.dpr
    );
    ctx.stroke();
    ctx.restore();
  }

  showInvalidFlash(piece, x, y, res) {
    this.flash = { piece, x, y, res: res || null, expires: Date.now() + 400 };
    this.render();
    setTimeout(() => this.render(), 420);
  }

  // ---------- 提示反馈（M2） ----------
  // 在棋盘 (x, y) 按 rotation 闪烁半透明绿色贴纸轮廓（Hint 1 / Hint 2）
  showHintFlash(piece, x, y, rotation, duration) {
    this.hint = {
      piece, x, y, rotation,
      start: Date.now(),
      expires: Date.now() + (duration || 2000),
    };
    this.render();
    this._ensureHintLoop();
  }

  // Hint 3：棋盘外框脉冲（可完成 = 绿 / 死局 = 红）
  showBoardPulse(ok, duration) {
    this.boardPulse = {
      color: ok ? "#38c172" : "#ff5252",
      start: Date.now(),
      expires: Date.now() + (duration || 1400),
    };
    this.render();
    this._ensureHintLoop();
  }

  clearHint() {
    this.hint = null;
    this.boardPulse = null;
    if (this._hintLoop) {
      clearTimeout(this._hintLoop);
      this._hintLoop = null;
    }
  }

  _ensureHintLoop() {
    if (this._hintLoop) return;
    const self = this;
    const tick = () => {
      self._hintLoop = null;
      const active =
        (self.hint && Date.now() < self.hint.expires) ||
        (self.boardPulse && Date.now() < self.boardPulse.expires);
      if (!active) {
        self.hint = null;
        self.boardPulse = null;
        self.render();
        return;
      }
      self.render();
      self._hintLoop = setTimeout(tick, 110);
    };
    this._hintLoop = setTimeout(tick, 110);
  }

  // 闪烁的半透明贴纸轮廓（需求 §4.2：可行提示位置）：
  // 320ms 亮 / 320ms 暗，亮相画绿色占位格 + 绿色半透明贴纸本体
  _drawHint(ctx) {
    const h = this.hint;
    if (!h) return;
    if (Date.now() > h.expires) { this.hint = null; return; }
    const on = Math.floor((Date.now() - h.start) / 320) % 2 === 0;
    if (!on) return;
    this._drawCellFootprint(ctx, h.piece, h.x, h.y, "#38c172", 0.25, h.rotation);
    const [px, py] = this.cellToPx(h.x, h.y);
    this._drawSprite(ctx, h.piece, px, py, this.cellPx, {
      rotation: h.rotation, tint: "#38c172", alpha: 0.6,
    });
  }

  _drawBoardPulse(ctx, dpr) {
    const bp = this.boardPulse;
    if (!bp) return;
    if (Date.now() > bp.expires) { this.boardPulse = null; return; }
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = bp.color;
    ctx.lineWidth = 4 * dpr;
    this._roundedRect(
      ctx,
      this.boardX - 4 * dpr, this.boardY - 4 * dpr,
      this.boardPixW + 8 * dpr, this.boardPixH + 8 * dpr,
      10 * dpr
    );
    ctx.stroke();
    ctx.restore();
  }

  _drawWinFrame(ctx, dpr) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 4 * dpr;
    this._roundedRect(ctx, this.boardX - 4 * dpr, this.boardY - 4 * dpr, this.boardPixW + 8 * dpr, this.boardPixH + 8 * dpr, 10 * dpr);
    ctx.stroke();
  }
}

window.PS = window.PS || {};
PS.Renderer = Renderer;
