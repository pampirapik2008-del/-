// ===== 41_helpers.js =====
// ===== ХЕЛПЕРЫ БОЯ: разбиение длинных функций для выполнения DoD (<=80 строк) =====
// Логика не менялась — исходный код 40_fight.js разрезан на именованные куски.
// Каждая функция <=60 строк, одна ответственность, покрыта golden-тестом.

function unitTickCooldowns(u,h,hr,A){
  u.atkT=Math.max(0,u.atkT-hr); u.hitT=Math.max(0,u.hitT-hr); u.mv=0;
  if(u.inv>0) u.inv-=h;
  if(u.shT>0 && (u.shT-=h)<=0) u.sh=0;
  if(u.spw>0){ u.spw-=hr; return true; }
  if(u.an){ u.an.t+=hr; if(u.an.t>=u.an.d) u.an=null; }
  for(const k in u.st){
    const q=u.st[k]; q.t-=h;
    if(k==="burn"||k==="poison"){ q.tk+=h; if(q.tk>=0.5){ q.tk-=0.5; hurt(null,u,q.v*0.5,{pure:1,dot:1,el:k==="burn"?"fire":"poison"}); } }
    if(q.t<=0) delete u.st[k];
  }
  return false;
}
function unitHazards(u,h,A){
  u.hz=(u.hz||0)+h;
  if(u.hz>=0.5){
    u.hz=0;
    const P=surfAt(A,u.x,u.y);
    if(P && P.haz && !u.z){ hurt(null,u,u.max*(u.boss?0.004:0.015),{pure:1,dot:1,el:P.haz}); addSt(u,P.haz==="fire"?"burn":"poison",2,u.max*0.006); }
    if(!u.team) for(const p of A.pools) if(Math.hypot(u.x-p.x,(u.y-p.y)*1.6)<p.r){ hurt(p.src,u,p.src.atk*0.3,{dot:1,el:p.el}); if(p.el==="ice") addSt(u,"chill",1.5); }
  }
}
function unitKnockTick(u,h,A){
  if(u.kx||u.ky){ u.x+=u.kx*h; u.y+=u.ky*h; const k=Math.exp(-h*9); u.kx*=k; u.ky*=k; if(Math.abs(u.kx)+Math.abs(u.ky)<8) u.kx=u.ky=0; navPush(A,u,u.rad); }
}
function unitJumpTick(u,h,A){
  if(!u.jump) return false;
  const j=u.jump; j.t+=h; const k=Math.min(1,j.t/j.d),q=ez.io(k);
  u.x=lerp(j.x0,j.x1,q); u.y=lerp(j.y0,j.y1,q); u.z=Math.sin(Math.PI*k)*j.h;
  if(k>=1){ u.z=0; u.jump=null; navPush(A,u,u.rad*0.5); j.fn(); }
  return true;
}
function unitHealTick(u,h){
  if(!u.heal) return;
  u.hc-=h;
  if(u.hc<=0){
    u.hc=2;
    const al=liv(F.pl).filter(a=>a.hp<a.max).sort((p,q)=>p.hp/p.max-q.hp/q.max);
    if(al.length){ heal(al[0],u.heal*Math.max(1,u.atk/50),u); Fx.add({k:"beam",x0:u.x+u.face*14,y0:u.y-60,x1:al[0].x,y1:al[0].y-30,c:"#8be06a",d:0.25,w:3}); sfx("heal"); }
  }
}
function unitUltTick(u,h,foes){
  if(!u.ulc) return false;
  const c=u.ulc; c.t-=h;
  if(c.t<=0){
    const tg=pick(foes);
    if(!tg||c.n<=0) u.ulc=null;
    else{ c.n--; c.t=0.2; Fx.add({k:"ghost",u,x:u.x,y:u.y,f:u.face,d:0.3}); const sd=Rand.next()<0.5?1:-1; [u.x,u.y]=placeFree(F.A,tg.x+sd*(22+tg.rad),tg.y+rr(-8,8)); u.face=-sd; anim(u,"atk",0.2,false); hurt(u,tg,eAtk(u)*0.9,{abil:1}); Fx.add({k:"slash",x:tg.x,y:tg.y-30,f:-sd,r:56,c:"#e9d0ff",d:0.16,w:8,rot:rr(-0.8,0.8)}); }
  }
  return true;
}
function unitDashTick(u,h){
  if(!u.dash) return false;
  const d=u.dash; d.t-=h; u.x+=d.dx*560*h; u.y+=d.dy*560*h; u.mv=1;
  if(Rand.next()<0.6) Parts.add({x:u.x,y:u.y-4,vx:-d.dx*40,vy:-20,life:0.4,c:"rgba(220,210,190,.6)",s:6,k:5,e:2,l:0});
  for(const p of liv(F.pl)) if(!d.hit.has(p)&&dist(p,u)<34+p.rad){ d.hit.add(p); hurt(u,p,eAtk(u)*1.4,{stc:0.4}); knock(p,u.x-d.dx*20,u.y-d.dy*20,80); }
  let stop=d.t<=0||u.x<=FLD.x0+2||u.x>=FLD.x1-2||u.y<=F.A.y0+1||u.y>=FLD.y1-1;
  for(const o of F.A.obs) if(!o.dead&&Math.abs(o.x-u.x)<o.rx+14&&Math.abs(o.y-u.y)<o.ry+10){ if(o.hp) breakProp(F.A,o); else{ stop=true; addSt(u,"stun",1.2); Fx.num(u,"бум!","txt","#ffe27a"); burst(u.x,u.y-20,8,{c:["#ffe27a","#ffffff"],sp:160,s:4,life:0.4}); shake(0.15); sfx("hit"); } }
  if(stop){ u.dash=null; navPush(F.A,u,u.rad); }
  return true;
}
function unitAbilityTick(u,h,foes){
  if(!u.team){
    const K=KIT[u.k];
    if(K){
      u.en=Math.min(100,u.en+2.2*h*wxm("chg")*(1+F.rb.chg));
      if(u.en>=100&&(CFG.autoUlt!==false||u.ultQ)&&CAST[u.k].ult(u)){ u.en=0; u.ultQ=0; return true; }
      u.acd-=h;
      if(u.acd<=0){ if(CAST[u.k].ab(u)){ u.acd=K.ab.cd*(1-F.rb.cdr); return true; } u.acd=0.4; }
    }
  } else if(!u.boss&&(u.slot==="m"||u.slot==="b")){
    u.acd-=h; const d=dist(u,u.tg);
    if(u.acd<=0){
      if(u.slot==="m"&&d<520){ u.acd=rr(4.5,6.5); anim(u,"cast",0.4); shoot(u,pick(foes),eAtk(u)*0.8,{sp:380,stc:0.5,big:1}); sfx("spit"); return true; }
      if(u.slot==="b"&&d>110&&d<460){ u.acd=rr(6.5,9); const a=Math.atan2(u.tg.y-u.y,u.tg.x-u.x); anim(u,"cast",0.7); tele({shape:"line",x:u.x,y:u.y,a,len:Math.min(430,d+90),d:0.7,c:"#ff5a4a",wd:34,fn(){ if(u.hp>0&&!u.st.stun){ u.dash={dx:Math.cos(a),dy:Math.sin(a),t:Math.min(430,d+90)/560,hit:new Set()}; sfx("dash"); }}}); return true; }
      u.acd=0.5;
    }
  }
  return false;
}
function unitMoveAttack(u,h,foes){
  const d=dist(u,u.tg), reach=eRng(u)*0.6+(u.tg.rad>30?u.tg.rad-14:0)+(u.rad>30?u.rad-14:0);
  if(Math.abs(u.tg.x-u.x)>6) u.face=u.tg.x<u.x?-1:1;
  if(d>reach){
    u.mv=1; const dir=navDir(F.A,u.x,u.y,u.tg.x,u.tg.y),k=1-Math.exp(-h*14);
    u.vx+=(dir[0]-u.vx)*k; u.vy+=(dir[1]-u.vy)*k;
    let v=eSpd(u)*14;
    if(u.set&&!u.boss){ u.hop=(u.hop+h*(1.9+u.spd*0.1))%1; v*=u.hop<0.62?1.6:0.02; u.z=u.hop<0.62?Math.sin((u.hop/0.62)*Math.PI)*15:0; }
    else if(u.k==="bandit") v*=0.8+0.5*Math.abs(Math.sin(F.time*5+u.ph));
    u.x+=u.vx*v*h; u.y+=u.vy*v*h; navPush(F.A,u,u.rad);
  } else {
    u.z=u.set?Math.max(0,(u.z||0)-h*90):0; u.cd-=h;
    if(u.cd<=0){ const as=eAspd(u),dur=Math.min(0.38,0.72/as); u.cd=1/as; u.atkT=u.atkD=dur; u.ax=(u.tg.x-u.x)/(d||1); u.ay=(u.tg.y-u.y)/(d||1);
      if(u.rng>=140) Seq.at(dur*0.4,()=>State.is("fight")&&u.hp>0&&u.tg.hp>0&&(shoot(u,u.tg,eAtk(u),{el:KIT[u.k]?KIT[u.k].el:u.el}),sfx("zap",0.7)));
      else u.sw={tg:u.tg,t:dur*0.42*SPDX,dmg:eAtk(u)}; }
  }
}
