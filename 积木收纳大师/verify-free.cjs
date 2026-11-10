const assert = require('node:assert/strict');
const {SHAPES,LEVELS,Game,cellsOf} = require('./free-core.js');
const TYPES = ['H','O'];
const countsOf = level => TYPES.map(t=>level.pieces.filter(p=>p.type===t).length);
function fillings(frame,initial) {
  const all=[], grid=Array(frame.w*frame.h).fill(false);
  function walk(counts,placed) {
    const n=grid.indexOf(false);
    if(n<0) {all.push({left:[...counts],placed:[...placed]});return;}
    const x=n%frame.w,y=Math.floor(n/frame.w);
    TYPES.forEach((type,t)=>{
      const s=SHAPES[type],cells=cellsOf({type}).map(([dx,dy])=>(y+dy)*frame.w+x+dx);
      if(!counts[t] || x+s.w>frame.w || y+s.h>frame.h || cells.some(k=>grid[k]))return;
      cells.forEach(k=>grid[k]=true);counts[t]--;
      walk(counts,[...placed,{type,x,y}]);
      counts[t]++;cells.forEach(k=>grid[k]=false);
    });
  }
  walk([...initial],[]);return all;
}
function countSolutions(frames,initial) {
  const memo=new Map();
  function walk(i,counts) {
    if(i===frames.length)return counts.every(n=>n===0)?1:0;
    const key=[i,...counts].join(',');if(memo.has(key))return memo.get(key);
    const n=fillings(frames[i],counts).reduce((sum,f)=>sum+walk(i+1,f.left),0);
    memo.set(key,n);return n;
  }
  return walk(0,initial);
}
function findSolution(level) {
  function walk(i,counts,route) {
    if(i===level.frames.length)return counts.every(n=>n===0)?route:null;
    for(const f of fillings(level.frames[i],counts)) {
      const solution=walk(i+1,f.left,[...route,...f.placed.map(p=>({...p,frame:i}))]);
      if(solution)return solution;
    }
    return null;
  }
  const route=walk(0,countsOf(level),[]),ids=TYPES.map(t=>level.pieces.filter(p=>p.type===t).map(p=>p.id));
  assert(route,'level must have a solution');
  return route.map(p=>({...p,id:ids[TYPES.indexOf(p.type)].shift()}));
}
function invariant(game) {
  const inventory=game.loose().length+game.level.frames.reduce((n,_,i)=>n+game.inFrame(i).length,0);
  assert.equal(inventory,game.level.pieces.length);
  game.level.frames.forEach((f,i)=>{
    const used=new Set();
    game.inFrame(i).forEach(p=>cellsOf(p).forEach(([dx,dy])=>{
      const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
      assert(x>=0&&x<f.w&&y>=0&&y<f.h);assert(!used.has(key));used.add(key);
    }));
  });
}
const report=[];
function run() {
  for(const [i,level] of LEVELS.entries()) {
    const counts=countsOf(level),solutions=countSolutions(level.frames,counts);
    assert(solutions>1,'must offer multiple shape layouts, not just interchangeable IDs');
    assert(level.frames.every(f=>f.w*f.h/2<=6),'at most six pieces in any frame');
    assert.equal(level.pieces.reduce((n,p)=>n+cellsOf(p).length,0),level.frames.reduce((n,f)=>n+f.w*f.h,0));
    // Every possible set of full frames can be kept. Partial frames may still need rearranging.
    const visited=new Set();
    function audit(done,left) {
      const key=[done,...left].join(',');if(visited.has(key))return;visited.add(key);
      const remaining=level.frames.filter((_,j)=>!(done&(1<<j)));
      assert(countSolutions(remaining,left)>0,`level ${i+1}: full-frame inventory trap ${key}`);
      level.frames.forEach((f,j)=>{
        if(done&(1<<j))return;
        for(const option of fillings(f,left))audit(done|(1<<j),option.left);
      });
    }
    audit(0,counts);
    const route=findSolution(level),game=new Game(level);
    for(const p of [...route].reverse()) {assert(game.place(p.id,p.frame,p.x,p.y).ok);invariant(game);}
    assert(game.won);assert.equal(game.completeCount,level.frames.length);
    // All pieces are retrievable, even after filling every frame.
    for(const p of route) {assert(game.returnPiece(p.id).ok);assert(!game.won);invariant(game);}
    assert.equal(game.completeCount,0);assert.equal(game.loose().length,level.pieces.length);
    report.push({level:i+1,solutions,completedFrameInventoryStates:visited.size,route});
  }
  {
    const g=new Game(LEVELS[0]);
    assert(g.place(1,0,0,0).ok);assert(g.place(2,0,2,0).ok);assert(g.filled(0));
    assert(g.place(1,1,0,0).ok);assert(!g.filled(0));assert.equal(g.piece(1).frame,1);
    assert(g.place(1,1,2,0).ok);assert(g.returnPiece(1).ok);invariant(g);
  }
  {
    const g=new Game(LEVELS[0]);g.place(1,0,0,0);g.place(2,1,0,0);
    for(const [frame,x,y] of [[1,0,0],[1,3,0],[1,-1,0],[1,.5,0],[4,0,0]]) {
      const before=JSON.stringify(g);assert(!g.place(1,frame,x,y).ok);assert.equal(JSON.stringify(g),before);
    }
    invariant(g);
  }
  {
    assert.deepEqual(Object.keys(SHAPES).sort(),['H','O']);
    const g=new Game(LEVELS[2]);assert(g.place(10,2,0,0).ok);assert(g.place(1,1,0,0).ok);
    assert(!('tray' in g));assert(!('rotate' in g));invariant(g);
  }
  console.log('6 groups passed. All full-frame combinations preserve a solution for the rest.');
  console.log(JSON.stringify(report.map(({route,...r})=>r),null,2));
}
if(require.main===module)run();
module.exports={findSolution,countSolutions,fillings,countsOf,run,report};
