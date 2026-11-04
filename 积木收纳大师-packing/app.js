(function(){
  'use strict';
  const {SHAPES,LEVELS,Game,cellsOf}=Packing;
  const $=id=>document.getElementById(id), board=$('board'),pile=$('pile');
  let game,levelIndex=0,selected=null,drag=null,hover=null,celebration=null,timer=null,boardGeo,pileGeo;
  let cursor={x:0,y:0};
  const label=id=>String(id).padStart(2,'0');
  const levelSelect=$('level');
  LEVELS.forEach((l,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i+1}. ${l.name}`;levelSelect.append(o);});
  function message(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
  function svg(p){const s=SHAPES[p.type],w=Math.max(...s.cells.map(c=>c[0]))+1,h=Math.max(...s.cells.map(c=>c[1]))+1;
    return `<svg viewBox="-1 -1 ${w*20+2} ${h*20+2}" aria-hidden="true">${s.cells.map(([x,y])=>`<rect x="${x*20}" y="${y*20}" width="20" height="20" fill="${s.color}" stroke="#fff8" stroke-width=".8"/>`).join('')}<text x="10" y="14" text-anchor="middle" font-size="13" fill="#344438">↑</text></svg>`;}
  function setup(canvas,w,h){const dpr=window.devicePixelRatio||1;canvas.style.width=w+'px';canvas.style.height=h+'px';canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return ctx;}
  function block(ctx,p,x,y,s,alpha=1,outline=false){
    ctx.save();ctx.globalAlpha=alpha;const shape=SHAPES[p.type],keys=new Set(shape.cells.map(c=>c.join(',')));
    for(const [u,v] of shape.cells){ctx.fillStyle=shape.color;ctx.fillRect(x+u*s,y+v*s,s,s);ctx.strokeStyle='#ffffff44';ctx.lineWidth=1;ctx.strokeRect(x+u*s+.5,y+v*s+.5,s-1,s-1);}
    ctx.strokeStyle=outline?'#264b36':'#51483988';ctx.lineWidth=outline?3:1.2;ctx.beginPath();
    for(const [u,v] of shape.cells){let a=x+u*s,b=y+v*s;
      if(!keys.has([u,v-1].join(','))){ctx.moveTo(a,b);ctx.lineTo(a+s,b);}
      if(!keys.has([u+1,v].join(','))){ctx.moveTo(a+s,b);ctx.lineTo(a+s,b+s);}
      if(!keys.has([u,v+1].join(','))){ctx.moveTo(a+s,b+s);ctx.lineTo(a,b+s);}
      if(!keys.has([u-1,v].join(','))){ctx.moveTo(a,b+s);ctx.lineTo(a,b);}}
    ctx.stroke();ctx.fillStyle='#334538';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`600 ${Math.max(10,s*.28)}px system-ui`;ctx.fillText('↑',x+s/2,y+s*.29);
    ctx.font=`600 ${Math.max(9,s*.28)}px system-ui`;ctx.fillText(label(p.id),x+s/2,y+s*.68);ctx.restore();
  }
  function drawBoard(){
    const f=celebration || game.frame || game.completed.at(-1);if(!f)return;
    const available=board.parentElement.clientWidth-22;
    const s=Math.min(window.innerWidth<700?48:58,(available-24)/f.w),pad=12;
    const w=f.w*s+pad*2,h=f.h*s+pad*2,ctx=setup(board,w,h);boardGeo={s,pad,w,h};
    ctx.fillStyle='#b3875c';ctx.fillRect(0,0,w,h);ctx.fillStyle='#f0e6d5';ctx.fillRect(pad,pad,s*f.w,s*f.h);
    ctx.strokeStyle='#b5a48c55';ctx.lineWidth=1;
    for(let x=0;x<=f.w;x++){ctx.beginPath();ctx.moveTo(pad+x*s,pad);ctx.lineTo(pad+x*s,pad+f.h*s);ctx.stroke();}
    for(let y=0;y<=f.h;y++){ctx.beginPath();ctx.moveTo(pad,pad+y*s);ctx.lineTo(pad+f.w*s,pad+y*s);ctx.stroke();}
    const pieces=celebration?celebration.pieces:game.frame?game.framePieces():f.pieces;
    pieces.forEach(p=>block(ctx,p,pad+p.fx*s,pad+p.fy*s,s,drag && drag.id===p.id ? .45 : 1,selected===p.id));
    if(hover && selected && !celebration && game.frame){const p=game.piece(selected),ok=game.check(p.id,hover.x,hover.y).ok;
      block(ctx,p,pad+hover.x*s,pad+hover.y*s,s,.5,true);
      ctx.fillStyle=ok?'#2b98594d':'#ce4d394d';for(const [a,b]of cellsOf(p))ctx.fillRect(pad+(hover.x+a)*s,pad+(hover.y+b)*s,s,s);
    }
  }
  function drawPile(){
    const w=pile.parentElement.clientWidth-(window.innerWidth<700?30:42),s=Math.min(window.innerWidth<700?30:43,(w-20)/game.level.pile.w),pad=10;
    const h=game.level.pile.h*s+pad*2,ctx=setup(pile,w,h);pileGeo={s,pad,w,h};
    ctx.fillStyle='#f6f7f2';ctx.fillRect(0,0,w,h);
    game.pieces.filter(p=>p.loc==='pile').sort((a,b)=>a.z-b.z).forEach(p=>{
      const blocked=game.blockers(p.id).length>0;
      ctx.save();ctx.shadowColor=p.z?'#33442c30':'transparent';ctx.shadowBlur=4;ctx.shadowOffsetY=3;
      block(ctx,p,pad+p.x*s,pad+p.y*s,s,blocked?.45:1,selected===p.id);ctx.restore();
    });
    if(!game.pieces.some(p=>p.loc==='pile')){ctx.fillStyle='#83907d';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('料堆已经清空',w/2,h/2);}
  }
  function render(){
    $('progress').textContent=`${game.completed.length} / ${game.level.frames.length} 框已收好`;
    $('remaining').textContent=`料堆剩余 ${game.pieces.filter(p=>p.loc==='pile').length} 块`;
    $('trayCount').textContent=`${game.tray().filter(Boolean).length} / ${game.level.capacity}`;
    $('queue').innerHTML=game.level.frames.map((f,i)=>`<div class="queue-item ${i<game.frameIndex?'done':i===game.frameIndex?'active':''}"><svg viewBox="0 0 ${f.w*10+2} ${f.h*10+2}" aria-hidden="true">${Array.from({length:f.w*f.h},(_,j)=>`<rect x="${j%f.w*10+1}" y="${Math.floor(j/f.w)*10+1}" width="10" height="10" fill="${i<game.frameIndex?'#cbdcc8':'#eee4d3'}" stroke="#aa9270" stroke-width=".5"/>`).join('')}</svg><span>${i<game.frameIndex?'✓ 已收好':i===game.frameIndex?'当前':'后面'}<br>${f.w}×${f.h}</span></div>`).join('');
    $('tray').innerHTML=game.tray().map((p,i)=>`<button class="tray-slot ${p&&selected===p.id?'selected':''}" data-slot="${i}" aria-label="暂存位 ${i+1}${p?'，积木 '+label(p.id):'，空'}">${p?svg(p)+`<span>${label(p.id)} · ${SHAPES[p.type].name}</span>`:''}</button>`).join('');
    $('underlay').innerHTML=game.pieces.filter(p=>p.z===0).map(p=>{
      const blockers=game.blockers(p.id),taken=p.loc!=='pile';
      return `<button class="map-piece ${taken?'taken':blockers.length?'blocked':'available'} ${selected===p.id?'selected':''}" data-piece="${p.id}" ${taken?'disabled':''} aria-label="下层积木 ${label(p.id)}，${SHAPES[p.type].name}，${taken?'已取出':blockers.length?'被 '+blockers.map(q=>label(q.id)).join('、')+' 压住':'可以取出'}">${svg(p)}<span class="caption">${label(p.id)} · ${SHAPES[p.type].name}<br>${taken?'已取出':blockers.length?'上方：'+blockers.map(q=>label(q.id)).join('、'):'现在可拿'}</span></button>`;
    }).join('');
    drawBoard();drawPile();
  }
  function load(i){clearTimeout(timer);levelIndex=i;levelSelect.value=i;game=new Game(LEVELS[i]);selected=null;drag=null;hover=null;celebration=null;cursor={x:0,y:0};$('win').hidden=true;$('celebrate').hidden=true;$('note').textContent=game.level.note;message(game.level.note);render();}
  function select(id){if(celebration||game.won)return false;if(!game.canTake(id)){message(`这块被 ${game.blockers(id).map(p=>label(p.id)).join('、')} 号压着，先拿走上面的积木。`,true);return false;}
    selected=id;message(`已选 ${label(id)} 号${SHAPES[game.piece(id).type].name}。点击木框格子放置，或点击空暂存位。`);render();return true;}
  function apply(result){hover=null;if(!result.ok){message(result.reason,true);drawBoard();return;}
    selected=null;drag=null;
    if(result.completed){celebration=result.completed;$('celebrate').textContent='这一框，收好了 ✓';$('celebrate').hidden=false;message(`已完成第 ${game.completed.length} 框。`);render();
      timer=setTimeout(()=>{celebration=null;$('celebrate').hidden=true;render();if(game.won){$('winText').textContent=`${game.level.frames.length} 个木框、${game.pieces.length} 块积木全部收好。共进行了 ${game.moves} 次有效放置。`;$('next').textContent=levelIndex===LEVELS.length-1?'回到第一关':'下一关 →';$('win').hidden=false;}else message('新木框到了。暂存区的积木也可以继续使用。');},800);
    }else {message('放好了。看看有没有新的积木露出来。');render();}
  }
  function local(e,c){const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*parseFloat(c.style.width)/r.width,y:(e.clientY-r.top)*parseFloat(c.style.height)/r.height};}
  function hitPile(e){const q=local(e,pile),{s,pad}=pileGeo;return game.pieces.filter(p=>p.loc==='pile').sort((a,b)=>b.z-a.z).find(p=>cellsOf(p).some(([x,y])=>q.x>=pad+(p.x+x)*s&&q.x<pad+(p.x+x+1)*s&&q.y>=pad+(p.y+y)*s&&q.y<pad+(p.y+y+1)*s));}
  function boardCell(e){const q=local(e,board);return {x:Math.floor((q.x-boardGeo.pad)/boardGeo.s),y:Math.floor((q.y-boardGeo.pad)/boardGeo.s)};}
  function start(e,p,origin){if(!p||!select(p.id))return;e.preventDefault();let offset={x:0,y:0};
    if(origin==='pile'){const q=local(e,pile);offset={x:Math.floor((q.x-pileGeo.pad)/pileGeo.s)-p.x,y:Math.floor((q.y-pileGeo.pad)/pileGeo.s)-p.y};}
    if(origin==='frame'){const q=boardCell(e);offset={x:q.x-p.fx,y:q.y-p.fy};}
    drag={id:p.id,x:e.clientX,y:e.clientY,moved:false,offset};
  }
  pile.addEventListener('pointerdown',e=>{if(celebration||game.won||e.button!==0)return;start(e,hitPile(e),'pile');});
  board.addEventListener('pointerdown',e=>{if(celebration||!game.frame||e.button!==0)return;const c=boardCell(e);
    const p=game.framePieces().find(q=>cellsOf(q).some(([x,y])=>q.fx+x===c.x&&q.fy+y===c.y));
    if(p){start(e,p,'frame');return;}
    if(selected){e.preventDefault();apply(game.place(selected,c.x,c.y));}});
  $('tray').addEventListener('pointerdown',e=>{const slot=e.target.closest('[data-slot]');if(!slot||celebration||game.won||e.button!==0)return;const i=Number(slot.dataset.slot),p=game.tray()[i];if(p)start(e,p,'tray');else if(selected){e.preventDefault();apply(game.stash(selected,i));}});
  $('underlay').addEventListener('click',e=>{const b=e.target.closest('[data-piece]');if(b)select(Number(b.dataset.piece));});
  // Keyboard activation for native tray buttons. Pointer activation is handled above.
  $('tray').addEventListener('click',e=>{if(e.detail!==0||celebration||game.won)return;const b=e.target.closest('[data-slot]');if(!b)return;const i=Number(b.dataset.slot),p=game.tray()[i];if(p)select(p.id);else if(selected)apply(game.stash(selected,i));});
  document.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>5)drag.moved=true;if(!drag.moved)return;const r=board.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom){const c=boardCell(e);hover={x:c.x-drag.offset.x,y:c.y-drag.offset.y};}else hover=null;drawBoard();});
  document.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(!d.moved){drawBoard();return;}const r=board.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom){const c=boardCell(e);apply(game.place(d.id,c.x-d.offset.x,c.y-d.offset.y));return;}const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-slot]');if(slot){apply(game.stash(d.id,Number(slot.dataset.slot)));return;}hover=null;message('尚未放置。点木框或空暂存位即可继续。');drawBoard();});
  document.addEventListener('pointercancel',()=>{drag=null;hover=null;drawBoard();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!celebration){selected=null;hover=null;drag=null;message('已取消选中。');render();}});
  board.addEventListener('keydown',e=>{if(!selected||!game.frame||celebration)return;const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(directions[e.key]){e.preventDefault();const [dx,dy]=directions[e.key];cursor.x=Math.max(0,Math.min(game.frame.w-1,cursor.x+dx));cursor.y=Math.max(0,Math.min(game.frame.h-1,cursor.y+dy));hover={...cursor};drawBoard();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();apply(game.place(selected,cursor.x,cursor.y));}});
  $('restart').onclick=()=>load(levelIndex);$('again').onclick=()=>load(levelIndex);$('next').onclick=()=>load((levelIndex+1)%LEVELS.length);levelSelect.onchange=()=>load(Number(levelSelect.value));
  window.addEventListener('resize',()=>{drag=null;hover=null;render();});
  // Read-only inspection supports verification without a separate gameplay path.
  window.packingDebug={get game(){return game;},get selected(){return selected;},get boardGeo(){return boardGeo;},get pileGeo(){return pileGeo;}};
  load(0);
})();
