(function (root) {
  'use strict';
  const SHAPES = {
    H: { name: '短条', w: 2, h: 1, color: '#e7b958' },
    O: { name: '方块', w: 2, h: 2, color: '#df947c' }
  };
  function level(name, note, frames, types) {
    return { name, note, frames: frames.map(([w,h]) => ({w,h})),
      pieces: types.map((type,i) => ({id:i+1,type})) };
  }
  const LEVELS = [
    level('两个框，随意分', '先试试：两种形状，两个木框。放进去的积木也能随时拿出来。',
      [[4,2],[4,2]], ['O','O','H','H','H','H']),
    level('再加一个小木框', '木框都开放着。可以先放小框，也可以先整理大框。',
      [[4,2],[4,2],[2,2]], ['O','O','O','H','H','H','H']),
    level('多收一点点', '这次有十块积木。边放边调整，把它们都收进三个框里。',
      [[4,3],[4,2],[2,2]], ['O','O','H','H','H','H','H','H','H','H'])
  ];
  function cellsOf(piece) {
    const s = SHAPES[piece.type], cells = [];
    for (let y=0;y<s.h;y++) for (let x=0;x<s.w;x++) cells.push([x,y]);
    return cells;
  }
  class Game {
    constructor(level) {
      this.level = level;
      this.pieces = level.pieces.map(p => ({...p,frame:null,x:0,y:0}));
      this.moves = 0;
    }
    piece(id) { return this.pieces.find(p => p.id === id); }
    inFrame(frame) { return this.pieces.filter(p => p.frame === frame); }
    loose() { return this.pieces.filter(p => p.frame === null); }
    filled(frame) {
      const f = this.level.frames[frame];
      return this.inFrame(frame).reduce((n,p) => n + cellsOf(p).length,0) === f.w*f.h;
    }
    get completeCount() { return this.level.frames.filter((_,i) => this.filled(i)).length; }
    get won() { return this.loose().length === 0 && this.completeCount === this.level.frames.length; }
    check(id,frame,x,y) {
      const p = this.piece(id), f = this.level.frames[frame];
      if (!p || !Number.isInteger(frame) || !f || !Number.isInteger(x) || !Number.isInteger(y))
        return {ok:false,reason:'请选择木框里的格子。'};
      const s = SHAPES[p.type];
      if (x<0 || y<0 || x+s.w>f.w || y+s.h>f.h)
        return {ok:false,reason:'这里放不下，换个位置试试。'};
      const occupied = new Set(this.inFrame(frame).filter(q => q.id !== id)
        .flatMap(q => cellsOf(q).map(([dx,dy]) => `${q.x+dx},${q.y+dy}`)));
      if (cellsOf(p).some(([dx,dy]) => occupied.has(`${x+dx},${y+dy}`)))
        return {ok:false,reason:'这里已经有积木了，可以先把它移开。'};
      return {ok:true};
    }
    place(id,frame,x,y) {
      const result = this.check(id,frame,x,y);
      if (!result.ok) return result;
      const p = this.piece(id);
      if (p.frame === frame && p.x === x && p.y === y) return {ok:true,completed:[],won:this.won};
      const before = this.level.frames.map((_,i) => this.filled(i));
      Object.assign(p,{frame,x,y});
      this.moves++;
      return {ok:true,completed:this.level.frames.flatMap((_,i) => !before[i] && this.filled(i) ? [i] : []),won:this.won};
    }
    returnPiece(id) {
      const p = this.piece(id);
      if (!p) return {ok:false,reason:'请先选一块积木。'};
      if (p.frame !== null) { Object.assign(p,{frame:null,x:0,y:0}); this.moves++; }
      return {ok:true,completed:[],won:this.won};
    }
  }
  const api = {SHAPES,LEVELS,Game,cellsOf};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FreePacking = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
