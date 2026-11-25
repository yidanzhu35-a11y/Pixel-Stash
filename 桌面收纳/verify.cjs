// node 桌面收纳/verify.cjs：真实规则回放，避免关卡与生成配置漂移。
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const env = vm.createContext({performance,console,setTimeout,clearTimeout});
for (const file of ['core.js','solver.js','量产50关.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),env,{filename:file});
}
const core = env.StationeryCore, solver = env.StationerySolver;
const intro = core.LEVELS[0], game = new core.Game(intro);
assert.equal(game.pieces.length,6);
assert.equal(new Set(game.pieces.map(p=>core.ITEMS[p.item].shape)).size,5);
assert.equal(game.slackCells(),2);
assert.equal(JSON.stringify(env.PRODUCTION.SAMPLES[1].pieces),JSON.stringify(intro.pieces));
assert.equal(JSON.stringify(env.PRODUCTION.SAMPLES[1].drawers),JSON.stringify(intro.drawers));
assert(solver.solve(intro,2,null,600000).count>=2,'教学关保持多解');
for (const [index,level] of core.LEVELS.entries()) {
  const result = solver.solve(level,1,null,600000);
  assert(!result.timeout && result.solvable,`L${index+1} 必须在预算内可解`);
  const g = new core.Game(level);
  for (const step of result.first) {
    const p = g.loose().find(p=>p.item===step.item);
    p.rot=step.rot;
    assert(g.place(p.id,step.drawer,step.x,step.y).ok,`L${index+1} 参考解回放`);
  }
  assert(g.won(),`L${index+1} 全部真实放入才通关`);
  const first=g.pieces[0];
  g.returnPiece(first.id);
  assert(!g.won(),`L${index+1} 取回后不再完成`);
}
game.place(1,0,0,0);
const before=JSON.stringify(game.serialize());
assert(!game.place(2,0,0,0).ok);
assert.equal(JSON.stringify(game.serialize()),before,'非法放置保留原状态');
// 截图回归：3×3 抽屉右侧占满 2×3，左边余 1×3；横向 U 盘应能就近转入，仍留一格。
const snapGame=new core.Game({drawers:[{w:3,h:3}],pieces:[{item:'usb'}],fixed:[{item:'mouse',drawer:0,x:1,y:0}]});
const snapBefore=JSON.stringify(snapGame.serialize());
const lower=snapGame.snapPlacement(1,0,-.5,1.12), upper=snapGame.snapPlacement(1,0,-.5,.3);
assert.equal(lower.rot,90); assert.equal(lower.x,0); assert.equal(lower.y,1,'偏下就吸附下方两格');
assert.equal(upper.rot,90); assert.equal(upper.y,0,'偏上就吸附上方两格');
assert.equal(snapGame.snapPlacement(1,0,1,1),null,'不会越过已占物品去吸远处的空位');
assert.equal(snapGame.snapPlacement(1,0,-2,1),null,'远离空位不吸附');
assert.equal(JSON.stringify(snapGame.serialize()),snapBefore,'预览不能提前改变真实位置或方向');
assert(snapGame.place(1,lower.drawer,lower.x,lower.y,lower.rot).ok);
assert.equal(snapGame.piece(1).rot,90); assert.equal(snapGame.slackCells(),1);
const free=new core.Game({drawers:[{w:6,h:4}],pieces:[{item:'usb'}]});
assert.equal(free.snapPlacement(1,0,1.1,1.2).rot,0,'本来放得下就保留玩家方向');
assert(free.place(1,0,1,1).ok);
const moved=free.place(1,0,1,1,90);
assert(moved.ok && !moved.wasNoop,'同抽屉同锚点的转向仍计为有效操作');
assert.equal(free.moves,2);
const stable=JSON.stringify(free.serialize());
assert(!free.place(1,0,5,3,90).ok);
assert(!free.place(1,0,1,1,45).ok);
assert.equal(JSON.stringify(free.serialize()),stable,'无效自动转向和非法角度不破坏原状态');
console.log('PASS: 教学关、多解与生成配置；50关真实规则回放；窄空位自动旋转、就近吸附和非法操作保持原状态。');
