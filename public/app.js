const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const L=s=>String(s).toLowerCase();
const J={"content-type":"application/json"};
const api=async(p,b)=>{const r=await fetch("api/"+p,b===undefined?{}:{method:"POST",headers:J,body:JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Something went wrong.");return j};
const up=async(p,f)=>{const r=await fetch("api/"+p,{method:"POST",headers:{"content-type":"application/octet-stream"},body:f});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Upload failed.");return j};
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const BADGES={chatify_admin:["🛡️","Chatify Admin","You are a admin for chatify"],cook_ranger:["🎓","Cook Ranger","You go to my school!"],known:["⭐","Known","The owner knows you"]};
const IMG=/\.(png|jpe?g|webp)$/i;
let me=null,servers=[],curS=null,curC=null,people=[],cfg={},signup=false,es=null,lastT=0,sending=false;
const cs=()=>servers.find(s=>s.id==curS)||{channels:[],roles:[]};
const pinfo=n=>people.find(p=>L(p.user)==L(n))||{user:n,display:n,badges:[],desc:""};
const icons=p=>(p.badges||[]).map(b=>BADGES[b]?BADGES[b][0]:"").join("");

api("me").then(u=>enter(u.name),showLoginAnn);
$("#swap").onclick=()=>{signup=!signup;$("#go").textContent=signup?"Sign up":"Log in";$("#swap").textContent=signup?"I already have an account":"Create an account";$("#amode").textContent=signup?"Create your account":"Log in to continue";$("#aerr").textContent="";chkAdmin()};
const chkAdmin=()=>$("#ac").classList.toggle("hide",!(signup&&L($("#u").value.trim())=="admin"));
$("#u").addEventListener("input",chkAdmin);
$("#go").onclick=async()=>{try{$("#aerr").textContent="";const u=await api(signup?"signup":"login",{username:$("#u").value,password:$("#p").value,code:$("#ac").value});$("#p").value="";$("#ac").value="";enter(u.name)}catch(e){$("#aerr").textContent=e.message}};
$("#p").addEventListener("keydown",e=>{if(e.key==="Enter")$("#go").click()});

async function enter(name){
 me=name;$("#auth").classList.add("hide");$("#app").classList.remove("hide");$("#who").textContent="Logged in as "+name;
 const sp=$("#splash");sp.style.opacity=1;sp.classList.remove("hide");setTimeout(()=>{sp.style.opacity=0;setTimeout(()=>sp.classList.add("hide"),600)},2000);
 people=await api("people");await loadServers();loadCfg();
 es=new EventSource("api/events");
 es.addEventListener("msg",e=>{const d=JSON.parse(e.data);if(d.ch==curC)addMsg(d.msg)});
 es.addEventListener("del",e=>{const d=JSON.parse(e.data);if(d.ch==curC){const n=document.querySelector('.m[data-id="'+d.id+'"]');if(n)n.remove()}});
 es.addEventListener("servers",loadServers);es.addEventListener("config",loadCfg);
 es.addEventListener("presence",e=>{people=JSON.parse(e.data);if(view()=="lb")drawLb()});
}
const view=()=>$("#modal").classList.contains("hide")?"":$("#mc").dataset.v;
async function loadServers(){
 servers=await api("servers");if(!servers.find(s=>s.id==curS))curS=servers[0]&&servers[0].id;
 drawServers();const s=cs();
 if(!s.channels.find(c=>c.id==curC))openCh(s.channels[0]&&s.channels[0].id);else drawChans();
 $("#gear").classList.toggle("hide",!s.own);
 if(view()=="set")settingsView();
}
async function loadCfg(){cfg=await api("config");drawAnn()}
function drawServers(){const l=$("#svl");l.replaceChildren();servers.forEach(s=>{const b=el("button","sv"+(s.id==curS?" on":""),s.name);b.onclick=()=>{curS=s.id;curC=null;$("#gear").classList.toggle("hide",!s.own);drawServers();openCh(s.channels[0]&&s.channels[0].id)};l.append(b)})}
function drawChans(){const l=$("#chl");l.replaceChildren();cs().channels.forEach(c=>{const b=el("button","ch"+(c.id==curC?" on":""),(c.private?"🔒 ":"# ")+c.name);b.onclick=()=>{openCh(c.id);$("#side").classList.remove("open")};l.append(b)})}
function avatar(p,big){
 if(p.avatar){const i=el("img","av"+(big?" big":""));i.src="api/avatar/"+L(p.user)+"?v="+p.av;i.alt="";return i}
 return el("span","av"+(big?" big":""),(p.display||p.user||"?").slice(0,1).toUpperCase());
}
function addMsg(m){
 const box=$("#msgs"),stick=box.scrollHeight-box.scrollTop-box.clientHeight<80,p=pinfo(m.user);
 const d=el("div","m"+(m.user==me?" me":"")),h=el("div","mh"),n=el("b",null,p.display+" "+icons(p));
 n.onclick=()=>profileView(m.user);d.dataset.id=m.id;
 h.append(avatar(p),n);if(p.tag)h.append(el("span","tg",p.tag));h.append(el("time",null,new Date(m.t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})));d.append(h);
 if(m.file){
  const a=el("a"),i=el("img","pic");i.src="api/file/"+m.file.id;i.alt=m.file.name;i.loading="lazy";a.href="api/file/"+m.file.id;a.target="_blank";a.rel="noopener";a.append(i);
  const row=el("div","fl"),dl=el("a",null,"⬇ Download");dl.href="api/file/"+m.file.id+"?dl=1";dl.download=m.file.name;
  row.append(el("span",null,"📎 "+m.file.name+" ("+Math.max(1,Math.round(m.file.size/1024))+" KB)"),dl);d.append(a,row);
 }else d.append(el("div",null,m.text));
 if(m.user==me){let tp;d.oncontextmenu=e=>{e.preventDefault();showMenu(e.clientX,e.clientY,m)};
  d.ontouchstart=e=>{const t=e.touches[0];tp=setTimeout(()=>showMenu(t.clientX,t.clientY,m),550)};d.ontouchend=d.ontouchmove=()=>clearTimeout(tp)}
 box.append(d);if(stick||m.user==me)box.scrollTop=box.scrollHeight;
}
async function openCh(id){
 curC=id||null;const c=cs().channels.find(x=>x.id==id);$("#chname").textContent=c?(c.private?"🔒 ":"# ")+c.name:"No channels";drawChans();$("#msgs").replaceChildren();
 if(!id)return;try{const ms=await api("messages?ch="+id);if(curC==id){ms.forEach(addMsg);$("#msgs").scrollTop=1e9}}catch(e){}
}
async function sendMsg(){
 const t=$("#mi").value.trim(),e=$("#serr");e.textContent="";if(!t||!curC||sending)return;
 sending=true;$("#mi").value="";
 try{await api("messages",{ch:curC,text:t})}catch(x){e.textContent=x.message;$("#mi").value=t}
 sending=false;$("#mi").focus();
}
$("#send").addEventListener("submit",e=>{e.preventDefault();sendMsg()});
$("#mi").addEventListener("input",()=>{const n=Date.now();if(curC&&n-lastT>2500){lastT=n;api("typing",{ch:curC}).catch(()=>{})}});
$("#att").onclick=()=>$("#fi").click();
$("#fi").onchange=async()=>{
 const f=$("#fi").files[0],e=$("#serr");$("#fi").value="";e.textContent="";if(!f||!curC)return;
 if(!IMG.test(f.name)){e.textContent="Only .png, .jpg and .webp files can be sent.";return}
 if(f.size>5e6){e.textContent="Files can be up to 5 MB.";return}
 e.textContent="Uploading…";try{await up("upload?ch="+curC+"&name="+encodeURIComponent(f.name),f);e.textContent=""}catch(x){e.textContent=x.message}
};
function drawAnn(){const a=cfg.ann,b=$("#ann");if(a&&a.text&&ls.get("chatify_ann")!=String(a.t)){$("#antx").textContent=a.text;b.classList.remove("hide")}else b.classList.add("hide")}
$("#andx").onclick=()=>{ls.set("chatify_ann",String(cfg.ann.t));drawAnn()};
$("#menu").onclick=()=>$("#side").classList.toggle("open");
$("#out").onclick=async()=>{await api("logout",{}).catch(()=>{});location.reload()};

// right-click delete
function closeMenu(){document.querySelectorAll(".cm").forEach(n=>n.remove())}
function showMenu(x,y,m){
 closeMenu();const c=el("div","cm"),b=el("button",null,"🗑 Delete message");
 b.onclick=async()=>{closeMenu();try{await api("messages/delete",{ch:curC,id:m.id})}catch(e){$("#serr").textContent=e.message}};
 c.append(b);c.style.left=Math.max(4,Math.min(x,innerWidth-180))+"px";c.style.top=Math.max(4,Math.min(y,innerHeight-60))+"px";document.body.append(c);
}
document.addEventListener("click",closeMenu);addEventListener("scroll",closeMenu,true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

// modals
const modal=(h,v)=>{$("#mc").replaceChildren(...h);$("#mc").dataset.v=v||"";$("#modal").classList.remove("hide")};
const closeM=()=>{$("#modal").classList.add("hide");$("#mc").dataset.v=""};
$("#modal").onclick=e=>{if(e.target.id=="modal")closeM()};
const field=(ph,max)=>{const i=el("input");i.placeholder=ph;if(max)i.maxLength=max;return i};
const btns=(...b)=>{const r=el("div","row");r.append(...b);return r};

$("#mk").onclick=()=>{const n=field("Server name",30),err=el("div","err"),go=el("button","btn","Create"),cx=el("button","btn g","Cancel");cx.onclick=closeM;
 go.onclick=async()=>{try{const r=await api("servers",{name:n.value});curS=r.id;curC=null;closeM();await loadServers()}catch(e){err.textContent=e.message}};
 modal([el("div","logo","Create a server"),n,err,btns(go,cx)]);n.focus()};
$("#jn").onclick=()=>{const n=field("Join code",12),err=el("div","err"),go=el("button","btn","Join"),cx=el("button","btn g","Cancel");cx.onclick=closeM;
 go.onclick=async()=>{try{const r=await api("servers/join",{code:n.value});curS=r.id;curC=null;closeM();await loadServers()}catch(e){err.textContent=e.message}};
 n.onkeydown=e=>{if(e.key=="Enter")go.click()};
 modal([el("div","logo","Join a server"),el("div","mu","Enter the code the server owner gave you."),n,err,btns(go,cx)]);n.focus()};

// server settings (owner): join code, roles, members, channels
$("#gear").onclick=settingsView;
function settingsView(){
 const s=cs();if(!s.own)return closeM();const err=el("div","err"),run=(p,b)=>api(p,b).then(()=>{err.textContent=""},e=>{err.textContent=e.message});
 const nm=field("Server name",30),tg=field("Server tag (2–5 letters or numbers)",5),sv2=el("button","btn","Save name & tag");nm.value=s.name;tg.value=s.tag;
 sv2.onclick=()=>run("servers/edit",{server:s.id,name:nm.value,tag:tg.value});
 const out=[el("div","logo","⚙ "+s.name),el("div","mu","Join code (share it so people can join):"),el("b","code",s.code),el("b",null,"Name & tag"),nm,tg,sv2,el("b",null,"Roles")];
 const rl=el("div");s.roles.forEach(r=>{const c=el("span","chip",r.name),x=el("button",null,"✕");c.style.background=r.color;c.style.color="#fff";x.style.color="#fff";x.onclick=()=>run("servers/role/delete",{server:s.id,role:r.id});c.append(x);rl.append(c)});
 if(!s.roles.length)rl.append(el("div","mu","No roles yet."));
 const rn=field("New role name",20),rc=el("input");rc.type="color";rc.value="#6c4cf5";rc.style.width="56px";rc.style.padding="2px";
 const ra=el("button","btn","Add");ra.onclick=()=>run("servers/role",{server:s.id,name:rn.value,color:rc.value});
 out.push(rl,btns(rn,rc,ra),el("b",null,"Members"));
 (s.members||[]).forEach(m=>{const row=el("div","pr"),w=el("div","grow"),mp=pinfo(m.user);row.append(avatar(mp),el("span",null,mp.display));
  s.roles.forEach(r=>{const on=m.roles.includes(r.id),c=el("button","chip"+(on?" on":""),r.name);c.style.cursor="pointer";c.onclick=()=>run("servers/assign",{server:s.id,user:m.user,role:r.id,on:!on});w.append(c)});
  row.append(w);out.push(row)});
 const cn=field("New channel name",30),pv=el("input");pv.type="checkbox";const lab=el("label","row");lab.append(pv,el("span",null,"Private (only chosen roles can see and type)"));
 const rr=el("div"),picks={};s.roles.forEach(r=>{const l2=el("label","chip"),c=el("input");c.type="checkbox";picks[r.id]=c;l2.append(c,el("span",null,r.name));rr.append(l2)});
 const ca=el("button","btn","Create channel");ca.onclick=()=>run("servers/channel",{server:s.id,name:cn.value,private:pv.checked,roles:Object.keys(picks).filter(k=>picks[k].checked)});
 const cx=el("button","btn g","Close");cx.onclick=closeM;
 out.push(el("b",null,"New channel"),cn,lab,rr,err,btns(ca,cx));
 if(s.id!="chatify"){const dz=el("button","btn r","Delete server");let sure=0;dz.onclick=async()=>{if(!sure){sure=1;dz.textContent="Click again to delete this server forever";return}try{await api("servers/delete",{server:s.id});closeM()}catch(e){err.textContent=e.message}};out.push(dz)}
 modal(out,"set");
}

// profile
function profileView(name){
 const p=pinfo(name),mine=L(name)==L(me),out=[],err=el("div","err");
 out.push(el("div","row"));out[0].append(avatar(p,true));const t=el("div");t.append(el("div","logo",p.display+" "+icons(p)),el("div","mu","@"+p.user));if(p.tag)t.append(el("span","tg",p.tag));out[0].append(t);
 if(mine){
  const dn=field("Display name",24),ds=el("textarea"),fi=el("input"),sv=el("button","btn","Save"),cx=el("button","btn g","Close");
  dn.value=p.display;ds.rows=3;ds.maxLength=200;ds.placeholder="About you";ds.value=p.desc||"";fi.type="file";fi.accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
  const sel=el("select");sel.append(new Option("No server tag",""));servers.forEach(x=>sel.append(new Option(x.tag+" — "+x.name,x.id)));sel.value=p.tagServer||"";
  fi.onchange=async()=>{const f=fi.files[0];if(!f)return;if(!IMG.test(f.name)||f.size>1e6){err.textContent="Profile picture: .png, .jpg or .webp, up to 1 MB.";return}
   try{await up("profile/avatar?name="+encodeURIComponent(f.name),f);err.textContent="Picture updated.";people=await api("people");profileView(name)}catch(e){err.textContent=e.message}};
  sv.onclick=async()=>{try{await api("profile",{display:dn.value,desc:ds.value,tagServer:sel.value});people=await api("people");profileView(name)}catch(e){err.textContent=e.message}};
  cx.onclick=closeM;out.push(el("div","mu","Profile picture (.png, .jpg, .webp)"),fi,el("div","mu","Display name (must be unique)"),dn,el("div","mu","Description"),ds,el("div","mu","Server tag (shown next to your name)"),sel,err,btns(sv,cx));
 }else{if(p.desc)out.push(el("div",null,p.desc));
  (p.badges||[]).forEach(b=>{if(BADGES[b]){const r=el("div","bd");r.append(el("span",null,BADGES[b][0]),el("div",null,BADGES[b][1]+" — "+BADGES[b][2]));out.push(r)}});
  const cx=el("button","btn g","Close");cx.onclick=closeM;out.push(cx);
 }
 if(mine)(p.badges||[]).forEach(b=>{if(BADGES[b]){const r=el("div","bd");r.append(el("span",null,BADGES[b][0]),el("div",null,BADGES[b][1]+" — "+BADGES[b][2]));out.splice(out.length-1,0,r)}});
 if(L(me)=="admin"){out.splice(out.length-1,0,el("b",null,"Give badges (admin)"));
  Object.keys(BADGES).forEach(b=>{const on=(p.badges||[]).includes(b),c=el("button","btn "+(on?"r":"g"),(on?"Remove ":"Give ")+BADGES[b][1]);
   c.onclick=async()=>{try{await api("badges",{user:p.user,badge:b,on:!on});people=await api("people");profileView(name)}catch(e){err.textContent=e.message}};out.splice(out.length-1,0,c)})}
 modal(out,"profile");
}
$("#pf").onclick=()=>profileView(me);

// leaderboard
function drawLb(){
 const list=[...people].sort((a,b)=>b.msgs-a.msgs||a.display.localeCompare(b.display)),box=el("div"),on=people.filter(p=>p.online).length;
 list.forEach((p,i)=>{const r=el("div","pr"),w=el("div","grow"),n=el("b",null,p.display+" "+icons(p));n.style.cursor="pointer";n.onclick=()=>profileView(p.user);
  w.append(n,...(p.tag?[" ",el("span","tg",p.tag)]:[]),el("div","tx",(p.typing?"✍️ typing…":p.online?"Online":"Offline")+" · @"+p.user+" · "+p.msgs+" msgs"));
  const d=el("span","dot"+(p.online?" on":""));r.append(el("span","mu","#"+(i+1)),avatar(p),w,d);box.append(r)});
 const cx=el("button","btn g","Close");cx.onclick=closeM;
 modal([el("div","logo","🏆 Leaderboard"),el("div","mu",on+" online · "+people.length+" people"),box,cx],"lb");
}
$("#lb").onclick=drawLb;

// admin panel
$("#adm").onclick=async()=>{
 try{if((await api("me")).admin)return adminView()}catch(e){}
 const c=el("input"),err=el("div","err"),go=el("button","btn","Unlock"),cx=el("button","btn g","Cancel");
 c.type="password";c.placeholder="Admin code";cx.onclick=closeM;
 go.onclick=async()=>{try{await api("admin/unlock",{code:c.value});adminView()}catch(e){err.textContent=e.message}};
 c.onkeydown=e=>{if(e.key=="Enter")go.click()};
 modal([el("div","logo","🔒 Admin locked"),el("div","mu","Enter the admin code to continue."),c,err,go,cx]);c.focus();
};
async function adminView(){
 let banned=[];try{banned=(await api("admin/state")).banned}catch(e){return closeM()}
 const a=el("textarea");a.rows=3;a.placeholder="Write an announcement…";a.maxLength=300;
 const post=el("button","btn","📢 Make announcement"),clr=el("button","btn g","Clear announcement");
 post.onclick=async()=>{if(a.value.trim()){await api("admin/announce",{text:a.value});a.value=""}};
 clr.onclick=()=>api("admin/announce",{text:""});
 const w=el("input");w.placeholder="Add banned word";const add=el("button","btn","Add");
 const list=el("div"),draw=()=>{list.replaceChildren();banned.forEach(x=>{const c=el("span","chip",x),r=el("button",null,"✕");r.onclick=async()=>{banned=(await api("admin/banned",{word:x,remove:1})).banned;draw()};c.append(r);list.append(c)});if(!banned.length)list.append(el("div","mu","No banned words yet."))};
 add.onclick=async()=>{if(w.value.trim()){banned=(await api("admin/banned",{word:w.value})).banned;w.value="";draw()}};
 draw();
 const lock=el("button","btn g","Close");lock.onclick=closeM;
 modal([el("div","logo","Admin panel"),el("b",null,"Announcement"),a,btns(post,clr),el("b",null,"Banned words"),btns(w,add),list,lock]);
}
async function showLoginAnn(){
 try{const c=await api("config"),a=c.ann;if(!a||!a.text)return;
  const ok=el("button","btn","Got it");ok.onclick=closeM;
  modal([el("div","logo","📢 Announcement"),el("div",null,a.text),el("div","mu","Posted by "+a.by+" · "+new Date(a.t).toLocaleString()),ok]);ok.focus()}catch(e){}
}
