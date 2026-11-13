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
console.log('PASS: 教学关6件/5形状/2空格，多解，生成配置一致；50关参考解回放、取回与非法放置。');
