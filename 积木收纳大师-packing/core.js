(function (root) {
  'use strict';
  const SHAPES = {
    H: { name: '短条', cells: [[0,0],[1,0]], color: '#e7b958' },
    V: { name: '竖条', cells: [[0,0],[0,1]], color: '#91b6a0' },
    O: { name: '方块', cells: [[0,0],[1,0],[0,1],[1,1]], color: '#df947c' },
    I: { name: '长条', cells: [[0,0],[1,0],[2,0]], color: '#9aabd2' },
    L: { name: '拐角', cells: [[0,0],[1,0],[1,1]], color: '#b2a0c6' }
  };
  function makeLevel(name, note, frames, types, pairs, route) {
    const pieces = types.map((type, i) => ({ id: i+1, type }));
    const bayW = Math.max(...pieces.map(p => Math.max(...SHAPES[p.type].cells.map(c=>c[0]))+1))+1;
    const bayH = Math.max(...pieces.map(p => Math.max(...SHAPES[p.type].cells.map(c=>c[1]))+1))+1;
    const cols = Math.min(3,pairs.length);
    pairs.forEach(([top,bottom],i) => {
      Object.assign(pieces[bottom-1],{x:(i%cols)*bayW,y:Math.floor(i/cols)*bayH,z:0});
      Object.assign(pieces[top-1],{x:(i%cols)*bayW,y:Math.floor(i/cols)*bayH,z:1});
    });
    return {name,note,frames:frames.map(([w,h])=>({w,h})),pieces,route,capacity:3,
      pile:{w:cols*bayW,h:Math.ceil(pairs.length/cols)*bayH}};
  }
  // Explicit routes validate the complete sequence, including occlusion and limited storage.
  // Piece numbers are identities, not prescribed frame assignments.
  const LEVELS = [
    makeLevel('先取下面的短条','第一框只有一格高。先把压着短条的方块放进暂存位。',
      [[4,1],[4,2]], ['H','H','O','O'], [[3,1],[4,2]],
      [['s',3,0],['p',1,0,0],['s',4,1],['p',2,2,0],['p',3,0,0],['p',4,2,0]]),
    makeLevel('给下一框留个位置','三个木框，共用这堆积木。看一眼后面的框，再决定拿哪一块。',
      [[3,3],[3,2],[3,2]], ['L','V','V','H','O','V','I','I'],
      [[5,1],[2,6],[3,8],[7,4]],
      [['s',5,0],['p',1,0,0],['p',2,2,0],['p',3,0,1],['s',7,1],['p',4,1,2],
       ['p',5,0,0],['p',6,2,0],['p',7,0,0],['p',8,0,1]]),
    makeLevel('六块也能装得下','第一框需要六块短条。暂存位只有三个，后面的框也要一起考虑。',
      [[4,3],[4,3],[3,3]], ['H','H','H','H','H','H','O','O','H','H','L','V','V','H'],
      [[7,1],[8,2],[11,3],[4,9],[5,12],[6,13],[14,10]],
      [['s',7,0],['s',8,1],['s',11,2],['p',1,0,0],['p',2,2,0],['p',3,0,1],
       ['p',4,2,1],['p',5,0,2],['p',6,2,2],['p',7,0,0],['p',8,2,0],['p',9,0,2],
       ['s',14,0],['p',10,2,2],['p',11,0,0],['p',12,2,0],['p',13,0,1],['p',14,1,2]])
  ];
  const cellsOf=(p)=>SHAPES[p.type].cells;
  function overlaps(a,b) {
    return cellsOf(a).some(([x,y])=>cellsOf(b).some(([u,v])=>a.x+x===b.x+u && a.y+y===b.y+v));
  }
  class Game {
    constructor(level) {
      this.level=level; this.frameIndex=0; this.moves=0; this.completed=[];
      this.pieces=level.pieces.map(p=>({...p,loc:'pile',slot:null,fx:0,fy:0}));
    }
    get frame(){return this.level.frames[this.frameIndex] || null;}
    get won(){return this.frameIndex===this.level.frames.length && this.pieces.every(p=>p.loc==='done');}
    piece(id){return this.pieces.find(p=>p.id===id);}
    blockers(id){const p=this.piece(id);return p && p.loc==='pile' ? this.pieces.filter(q=>q.loc==='pile' && q.z>p.z && overlaps(p,q)) : [];}
    canTake(id){const p=this.piece(id);return !!p && p.loc!=='done' && (p.loc!=='pile'||this.blockers(id).length===0);}
    framePieces(){return this.pieces.filter(p=>p.loc==='frame');}
    tray(){return Array.from({length:this.level.capacity},(_,i)=>this.pieces.find(p=>p.loc==='tray'&&p.slot===i)||null);}
    check(id,x,y){
      const p=this.piece(id);
      if(!this.frame || !p || p.loc==='done')return {ok:false,reason:'这块已经收好了。'};
      if(!this.canTake(id))return {ok:false,reason:`先拿走压着它的 ${this.blockers(id).map(q=>String(q.id).padStart(2,'0')).join('、')} 号积木。`};
      if(!Number.isInteger(x)||!Number.isInteger(y))return {ok:false,reason:'请对准木框的格子。'};
      const cells=cellsOf(p).map(([u,v])=>[x+u,y+v]);
      if(cells.some(([u,v])=>u<0||v<0||u>=this.frame.w||v>=this.frame.h))return {ok:false,reason:'这个位置会超出木框。积木方向固定。'};
      if(this.framePieces().some(q=>q.id!==id && cells.some(([u,v])=>cellsOf(q).some(([a,b])=>q.fx+a===u&&q.fy+b===v))))return {ok:false,reason:'这里已经有积木了。'};
      return {ok:true};
    }
    place(id,x,y){
      const result=this.check(id,x,y);if(!result.ok)return result;
      const p=this.piece(id);if(p.loc==='frame'&&p.fx===x&&p.fy===y)return {ok:true};
      Object.assign(p,{loc:'frame',slot:null,fx:x,fy:y});this.moves++;
      if(this.framePieces().reduce((n,q)=>n+cellsOf(q).length,0)===this.frame.w*this.frame.h){
        const snapshot={...this.frame,pieces:this.framePieces().map(q=>({...q}))};
        this.completed.push(snapshot);this.framePieces().forEach(q=>q.loc='done');this.frameIndex++;
        return {ok:true,completed:snapshot,won:this.won};
      }
      return {ok:true};
    }
    stash(id,slot){
      const p=this.piece(id);
      if(!this.frame || !this.canTake(id))return {ok:false,reason:'这块现在还不能取。先移走上面的积木。'};
      if(slot==null)slot=this.tray().findIndex(q=>!q);
      if(!Number.isInteger(slot)||slot<0||slot>=this.level.capacity)return {ok:false,reason:'暂存位满了。先把暂存的积木放进木框。'};
      const occupant=this.tray()[slot];
      if(occupant && occupant.id!==id)return {ok:false,reason:'这个暂存位已经有积木了。'};
      if(p.loc==='tray'&&p.slot===slot)return {ok:true};
      Object.assign(p,{loc:'tray',slot});this.moves++;return {ok:true};
    }
  }
  const api={SHAPES,LEVELS,Game,cellsOf,overlaps};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Packing=api;
})(typeof window==='undefined'?globalThis:window);
