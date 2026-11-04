const assert=require('node:assert/strict');
const {SHAPES,LEVELS,Game,overlaps}=require('./core.js');
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function invariant(g){
  assert.equal(new Set(g.pieces.map(p=>p.id)).size,g.pieces.length);
  const occupied=new Set();for(const p of g.framePieces())for(const [x,y]of SHAPES[p.type].cells){const k=[p.fx+x,p.fy+y].join(',');assert(!occupied.has(k));occupied.add(k);assert(p.fx+x>=0&&p.fy+y>=0&&p.fx+x<g.frame.w&&p.fy+y<g.frame.h);}
  const tray=g.pieces.filter(p=>p.loc==='tray');assert(tray.length<=g.level.capacity);assert.equal(new Set(tray.map(p=>p.slot)).size,tray.length);
}
LEVELS.forEach((l,i)=>test(`关卡 ${i+1}：整局取块、暂存、填框路径`,()=>{
  assert.equal(l.pieces.reduce((n,p)=>n+SHAPES[p.type].cells.length,0),l.frames.reduce((n,f)=>n+f.w*f.h,0));
  for(const a of l.pieces)for(const b of l.pieces)if(a.id<b.id&&a.z===b.z)assert(!overlaps(a,b),'same-layer overlap');
  const g=new Game(l);for(const [op,id,a,b]of l.route){const result=op==='s'?g.stash(id,a):g.place(id,a,b);assert(result.ok,JSON.stringify({op,id,a,b,result}));invariant(g);}
  assert(g.won);assert(g.pieces.every(p=>p.loc==='done'));assert(g.completed.every(f=>f.pieces.length<=6));
}));
test('遮挡时拒绝取块且状态不变；拿走上层立即解锁下层',()=>{const g=new Game(LEVELS[0]);const before=JSON.stringify(g);assert(!g.place(1,0,0).ok);assert(!g.stash(1,0).ok);assert.equal(JSON.stringify(g),before);assert(g.stash(3,0).ok);assert(g.canTake(1));});
test('方向固定：方块不能进入一格高的框；没有旋转或撤销接口',()=>{const g=new Game(LEVELS[0]);assert(!g.place(3,0,0).ok);assert.equal(g.rotate,undefined);assert.equal(g.undo,undefined);});
test('重叠、越界和非整数落点均原子拒绝；同框可调整',()=>{const g=new Game(LEVELS[0]);g.stash(3,0);g.stash(4,1);g.place(1,0,0);let before=JSON.stringify(g);assert(!g.place(2,1,0).ok);assert(!g.place(2,3,0).ok);assert(!g.place(2,.5,0).ok);assert.equal(JSON.stringify(g),before);assert(g.place(1,1,0).ok);assert(g.stash(1,2).ok);assert(g.place(1,0,0).ok);assert(g.place(2,2,0).completed);});
test('暂存满不是失败；不能挤占别人的槽；从暂存入框释放容量',()=>{const g=new Game(LEVELS[2]);g.stash(7,0);g.stash(8,1);g.stash(11,2);const before=JSON.stringify(g);assert(!g.stash(4).ok);assert(!g.stash(4,1).ok);assert.equal(JSON.stringify(g),before);assert(!g.won);assert(g.place(1,0,0).ok);assert(g.place(7,0,1).ok);assert.equal(g.tray().filter(Boolean).length,2);});
test('已交付的块不能再次使用或重复结算',()=>{const g=new Game(LEVELS[0]);for(const [op,id,a,b]of LEVELS[0].route)op==='s'?g.stash(id,a):g.place(id,a,b);const before=JSON.stringify(g);assert(!g.place(1,0,0).ok);assert(!g.stash(1,0).ok);assert.equal(JSON.stringify(g),before);});
console.log(`${checks} verification groups passed.`);
