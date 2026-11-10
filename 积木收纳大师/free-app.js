(() => {
  'use strict';
  const {SHAPES,LEVELS,Game,cellsOf} = FreePacking;
  const $ = id => document.getElementById(id);
  let game, index = 0, selected = null, drag = null, hover = null, geometries = [];
  let cursor = {frame:0,x:0,y:0};
  function say(message,error=false) { $('status').textContent=message; $('status').classList.toggle('error',error); }
  function icon(p) {
    const s=SHAPES[p.type], y=s.h===1?16:2, h=s.h*30;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="${y}" width="60" height="${h}" rx="2" fill="${s.color}" stroke="#7f806c"/><path d="M32 ${y}v${h}${s.h===2?'M2 32h60':''}" stroke="#fff" stroke-opacity=".3"/><text x="17" y="${y+22}" text-anchor="middle" font-size="20" fill="#435e4d">↑</text></svg>`;
  }
  function load(i) {
    index=i; game=new Game(LEVELS[i]); selected=null; drag=null; hover=null; cursor={frame:0,x:0,y:0};
    $('level').value=String(i); $('note').textContent=game.level.note; $('win').hidden=true;
    $('frames').innerHTML=game.level.frames.map((f,i)=>`<div class="frame-card" id="frame-card-${i}"><div class="frame-heading"><strong>木框 ${i+1}</strong><span id="frame-state-${i}">${f.w} × ${f.h}</span></div><div class="canvas-wrap"><canvas id="frame-${i}" data-frame="${i}" tabindex="0" aria-label="木框 ${i+1}，${f.w} 列 ${f.h} 行。点选积木后点空格放置，也可拖动；键盘方向键移动落点，回车放置。"></canvas></div></div>`).join('');
    game.level.frames.forEach((_,i)=> {
      const canvas=$(`frame-${i}`);
      canvas.addEventListener('pointerdown',e=>{
        if(e.button!==0) return;
        e.preventDefault();
        const pos=locate(e.clientX,e.clientY);
        if(!pos || pos.frame!==i) return;
        const p=at(pos);
        if(p) start(e,p.id,{x:pos.x-p.x,y:pos.y-p.y});
        else if(selected!==null) place(selected,pos);
      });
      canvas.addEventListener('keydown',e=> {
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key)) return;
        e.preventDefault();
        if(cursor.frame!==i) cursor={frame:i,x:0,y:0};
        const f=game.level.frames[i];
        if(e.key==='ArrowLeft') cursor.x=Math.max(0,cursor.x-1);
        if(e.key==='ArrowRight') cursor.x=Math.min(f.w-1,cursor.x+1);
        if(e.key==='ArrowUp') cursor.y=Math.max(0,cursor.y-1);
        if(e.key==='ArrowDown') cursor.y=Math.min(f.h-1,cursor.y+1);
        if(e.key==='Enter'||e.key===' ') {
          if(selected!==null) place(selected,cursor);
          else { const p=at(cursor); if(p) select(p.id); }
        } else { hover={...cursor}; drawFrames(); }
      });
    });
    render(); say('选一块积木，放进任意木框。');
  }
  function select(id) {
    selected=id;
    const p=game.piece(id);
    say(`已选${SHAPES[p.type].name} ${String(id).padStart(2,'0')}。${p.frame===null?'点任意木框的空格放置。':'可移动到任意空位，或放回原料盘。'}`);
    render();
  }
  function start(e,id,offset={x:0,y:0}) {
    if(e.button!==0) return;
    e.preventDefault(); select(id);
    drag={id,offset,startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId};
  }
  function render() {
    const total=game.level.frames.length, loose=game.loose();
    $('progress').textContent=`${game.completeCount} / ${total} 框已装满`;
    game.level.frames.forEach((f,i)=>{
      const full=game.filled(i);
      $(`frame-card-${i}`).classList.toggle('full',full);
      $(`frame-state-${i}`).textContent=full?'装满了 ✓':`${f.w} × ${f.h}`;
    });
    $('remaining').textContent=`还有 ${loose.length} 块`;
    $('stock').innerHTML=loose.map(p=>`<button class="piece${p.id===selected?' selected':''}" data-piece="${p.id}" aria-label="${SHAPES[p.type].name} ${p.id}，${SHAPES[p.type].w} 乘 ${SHAPES[p.type].h}" aria-pressed="${p.id===selected}">${icon(p)}<span>${String(p.id).padStart(2,'0')} · ${SHAPES[p.type].name}</span></button>`).join('');
    $('stock').querySelectorAll('[data-piece]').forEach(b=>{
      b.addEventListener('pointerdown',e=>start(e,Number(b.dataset.piece)));
      b.addEventListener('click',e=>{ if(e.detail===0) select(Number(b.dataset.piece)); });
    });
    $('emptyStock').hidden=loose.length>0;
    $('returnPiece').disabled=selected===null || game.piece(selected).frame===null;
    $('finish').disabled=!game.won;
    drawFrames();
  }
  function block(c,p,g,alpha=1,outline=false) {
    const s=SHAPES[p.type], x=g.pad+p.x*g.s, y=g.pad+p.y*g.s;
    c.save(); c.globalAlpha=alpha;
    c.fillStyle=s.color; c.fillRect(x+1.5,y+1.5,s.w*g.s-3,s.h*g.s-3);
    c.strokeStyle='#fff5'; c.lineWidth=1;
    for(let xx=1;xx<s.w;xx++){c.beginPath();c.moveTo(x+xx*g.s,y+2);c.lineTo(x+xx*g.s,y+s.h*g.s-2);c.stroke();}
    for(let yy=1;yy<s.h;yy++){c.beginPath();c.moveTo(x+2,y+yy*g.s);c.lineTo(x+s.w*g.s-2,y+yy*g.s);c.stroke();}
    c.strokeStyle=outline?'#315a40':'#8e8a7466'; c.lineWidth=outline?2.5:1;
    c.strokeRect(x+1.5,y+1.5,s.w*g.s-3,s.h*g.s-3);
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#3d5b48';
    c.font=`600 ${Math.max(11,g.s*.27)}px system-ui`;
    c.fillText('↑',x+g.s*.5,y+g.s*.33);
    c.font=`600 ${Math.max(9,g.s*.21)}px system-ui`;
    c.fillText(String(p.id).padStart(2,'0'),x+g.s*.5,y+g.s*.7);
    c.restore();
  }
  function drawFrames() {
    const dpr=window.devicePixelRatio||1;
    geometries=game.level.frames.map((f,i)=>{
      const canvas=$(`frame-${i}`), parent=canvas.parentElement;
      const pad=10, max=innerWidth<=700?32:58, s=Math.min(max,(parent.clientWidth-2*pad)/f.w);
      const w=f.w*s+pad*2, h=f.h*s+pad*2, g={s,pad,w,h};
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr); canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;
      const c=canvas.getContext('2d'); c.scale(dpr,dpr);
      c.fillStyle='#b38a5e';c.fillRect(0,0,w,h);
      c.fillStyle='#f1e7d5';c.fillRect(pad,pad,f.w*s,f.h*s);
      c.strokeStyle='#d6c8ad';c.lineWidth=.7;
      for(let x=0;x<=f.w;x++){c.beginPath();c.moveTo(pad+x*s,pad);c.lineTo(pad+x*s,pad+f.h*s);c.stroke();}
      for(let y=0;y<=f.h;y++){c.beginPath();c.moveTo(pad,pad+y*s);c.lineTo(pad+f.w*s,pad+y*s);c.stroke();}
      game.inFrame(i).forEach(p=>block(c,p,g,drag?.moved&&drag.id===p.id ? .4 : 1,p.id===selected));
      if(selected!==null && hover?.frame===i) {
        const p={...game.piece(selected),x:hover.x,y:hover.y};
        const valid=game.check(p.id,i,p.x,p.y).ok;
        c.save();c.beginPath();c.rect(pad,pad,f.w*s,f.h*s);c.clip();
        block(c,p,g,.55,true);
        if(!valid){c.fillStyle='#cc574755';cellsOf(p).forEach(([dx,dy])=>c.fillRect(pad+(p.x+dx)*s,pad+(p.y+dy)*s,s,s));}
        c.restore();
      }
      return g;
    });
  }
  function locate(x,y) {
    for(let i=0;i<geometries.length;i++) {
      const r=$(`frame-${i}`).getBoundingClientRect(),g=geometries[i];
      if(x>=r.left+g.pad && x<r.right-g.pad && y>=r.top+g.pad && y<r.bottom-g.pad)
        return {frame:i,x:Math.floor((x-r.left-g.pad)/g.s),y:Math.floor((y-r.top-g.pad)/g.s)};
    }
    return null;
  }
  function at(pos) { return game.inFrame(pos.frame).find(p=>cellsOf(p).some(([x,y])=>p.x+x===pos.x && p.y+y===pos.y)); }
  function inStock(x,y) { const r=$('stockPanel').getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom; }
  function place(id,pos) {
    const result=game.place(id,pos.frame,pos.x,pos.y);
    if(result.ok) {
      selected=null;hover=null;render();
      say(result.won?'都装好了！可以完成收纳，也可以继续调整。':result.completed.length?'这一框装满了 ✓，随时还可以调整。':'放好了。继续放，也可以挪到别处。');
    } else { render(); say(result.reason,true); }
  }
  function returnSelected(id) {
    game.returnPiece(id);selected=null;hover=null;render();say('放回原料盘了，可以重新安排。');
  }
  document.addEventListener('pointermove',e=> {
    if(!game) return;
    if(drag) {
      if(e.pointerId!==drag.pointerId) return;
      if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5) drag.moved=true;
      if(!drag.moved) return;
      const pos=locate(e.clientX,e.clientY);
      hover=pos?{...pos,x:pos.x-drag.offset.x,y:pos.y-drag.offset.y}:null;
      $('stockPanel').classList.toggle('drop-ready',inStock(e.clientX,e.clientY)&&game.piece(drag.id).frame!==null);
    } else hover=selected!==null?locate(e.clientX,e.clientY):null;
    drawFrames();
  });
  document.addEventListener('pointerup',e=> {
    if(!drag || drag.pointerId!==e.pointerId) return;
    const d=drag;drag=null;hover=null;$('stockPanel').classList.remove('drop-ready');
    if(d.moved) {
      const pos=locate(e.clientX,e.clientY);
      if(pos) place(d.id,{...pos,x:pos.x-d.offset.x,y:pos.y-d.offset.y});
      else if(inStock(e.clientX,e.clientY)) returnSelected(d.id);
      else { drawFrames();say('积木留在原处，拖进木框或原料盘即可。'); }
    } else drawFrames();
  });
  document.addEventListener('pointercancel',()=>{drag=null;hover=null;$('stockPanel').classList.remove('drop-ready');if(game)drawFrames();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;drag=null;hover=null;$('win').hidden=true;render();}});
  $('returnPiece').addEventListener('click',()=>{if(selected!==null)returnSelected(selected);});
  $('restart').addEventListener('click',()=>load(index));
  $('level').innerHTML=LEVELS.map((l,i)=>`<option value="${i}">${i+1}. ${l.name}</option>`).join('');
  $('level').addEventListener('change',()=>load(Number($('level').value)));
  $('finish').addEventListener('click',()=>{
    if(!game.won)return;
    $('winText').textContent=`${game.pieces.length} 块积木，${game.level.frames.length} 个木框，刚好收齐。没有步数限制，按自己的节奏就好。`;
    $('next').textContent=index===LEVELS.length-1?'回到第一关 ↻':'下一关 →';
    $('win').hidden=false;
  });
  $('keep').addEventListener('click',()=>{$('win').hidden=true;});
  $('next').addEventListener('click',()=>load((index+1)%LEVELS.length));
  addEventListener('resize',()=>{drag=null;hover=null;if(game)drawFrames();});
  window.freePackingDebug={get game(){return game;},get selected(){return selected;},get geometries(){return geometries;}};
  load(0);
})();
