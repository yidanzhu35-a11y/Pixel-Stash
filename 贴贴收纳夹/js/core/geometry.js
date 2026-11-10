// ============================================================
// 几何工具：形状旋转与坐标处理
// 旋转以 90° 为单位，顺时针。cells 归一化到原点并排序，
// 保证同一形态只有唯一表示（用于形状去重与缓存）。
// ============================================================
const Geometry = {
  normalize(cells) {
    const seen = new Set();
    const out = [];
    for (const [x, y] of cells) {
      const key = x + "," + y;
      if (!seen.has(key)) {
        seen.add(key);
        out.push([x, y]);
      }
    }
    out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return out;
  },

  // 顺时针旋转 90°：(x, y) -> (-y, x)，再平移回原点
  rotateCW(cells) {
    const rotated = cells.map(([x, y]) => [-y, x]);
    const minX = Math.min(...rotated.map((c) => c[0]));
    const minY = Math.min(...rotated.map((c) => c[1]));
    return Geometry.normalize(rotated.map(([x, y]) => [x - minX, y - minY]));
  },

  cellsKey(cells) {
    return Geometry.normalize(cells)
      .map((c) => c[0] + "," + c[1])
      .join(";");
  },

  // 基础形状 + 旋转角度 -> 占位格子（带缓存）
  cellsAtRotation(baseCells, rotation, cache) {
    const c = cache || (Geometry._cache = Geometry._cache || {});
    const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
    const baseKey = Geometry.cellsKey(baseCells);
    const key = baseKey + "|" + steps;
    if (!c[key]) {
      let cells = Geometry.normalize(baseCells);
      for (let i = 0; i < steps; i++) cells = Geometry.rotateCW(cells);
      c[key] = cells;
    }
    return c[key];
  },

  boundingBox(cells) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of cells) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { w: maxX - minX + 1, h: maxY - minY + 1, minX, minY };
  },

  // 把基础形状格子平移到绝对坐标 (ox, oy)
  absolute(cells, ox, oy) {
    return cells.map(([x, y]) => [x + ox, y + oy]);
  },
};

window.PS = window.PS || {};
PS.Geometry = Geometry;
