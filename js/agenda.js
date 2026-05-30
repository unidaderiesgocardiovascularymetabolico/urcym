/* URCyM — Lógica del módulo Agenda */

(function(){
var DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb'];
var DIAS_FULL=['lunes','martes','miércoles','jueves','viernes','sábado'];
var MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var SLOTS=['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
var PROF_CLS={BG:'bg',OB:'ob',LA:'la',SA:'sa'};
var PROF_LBL={BG:'Guerrero',OB:'Bertani',LA:'López A.',SA:'Saracho'};
var PROF_FULL={BG:'Dra. Bárbara Guerrero',OB:'Dr. Omar Bertani',LA:'Dra. López Armaretti',SA:'Dra. Saracho Ana'};
var EST_L={confirmado:'C',pendiente:'P',cancelado:'X'};
var PAGO_L={pagado:'Pagado ✓',señado:'Con seña','sin-seña':'Sin seña'};
var NL_PROFS=['BG','OB'];
var ALL_PROFS=['BG','OB','LA','SA'];

var LS_T='urcym_ag_turnos', LS_NL='urcym_ag_nl', LS_D='urcym_ag_disp';

var DEFAULT_NL=[
  {prof:'BG',day:0,from:'09:00',to:'12:00',label:'CEQ'},
  {prof:'BG',day:0,from:'13:00',to:'16:00',label:'Salita'},
  {prof:'BG',day:0,from:'17:00',to:'19:00',label:'UCA'},
  {prof:'OB',day:1,from:'09:00',to:'13:00',label:'Turnos'},
  {prof:'OB',day:1,from:'15:00',to:'18:30',label:'Turnos'},
  {prof:'OB',day:3,from:'09:00',to:'12:00',label:'Sapiens'},
  {prof:'OB',day:3,from:'14:00',to:'17:00',label:'Turnos'},
  {prof:'BG',day:4,from:'08:00',to:'18:00',label:'UCA presencial'}
];
var DEFAULT_DISP=[
  {prof:'OB',day:1,from:'09:00',to:'13:00',label:'Turnos OB'},
  {prof:'OB',day:1,from:'15:00',to:'18:30',label:'Turnos OB'},
  {prof:'OB',day:2,from:'09:00',to:'13:00',label:'Turnos OB'},
  {prof:'OB',day:3,from:'14:00',to:'17:00',label:'Turnos OB'},
  {prof:'BG',day:1,from:'09:00',to:'18:00',label:'Turnos BG'},
  {prof:'BG',day:2,from:'09:00',to:'18:00',label:'Turnos BG'},
  {prof:'LA',day:0,from:'09:00',to:'18:00',label:'Turnos LA'},
  {prof:'LA',day:1,from:'09:00',to:'18:00',label:'Turnos LA'},
  {prof:'SA',day:0,from:'09:00',to:'18:00',label:'Turnos SA'},
  {prof:'SA',day:2,from:'09:00',to:'18:00',label:'Turnos SA'}
];

var turnos={}, nlBlocks=[], dispBlocks=[];
var nlTmp=[], dispTmp=[];
var currentMonday=getMonday(new Date());
var editKey=null, pendingDate=null, pendingTime=null;
var todayStr=kd(new Date());

function getMonday(d){var dt=new Date(d);var day=dt.getDay();dt.setDate(dt.getDate()+(day===0?-6:1-day));dt.setHours(0,0,0,0);return dt;}
function addDays(d,n){var dt=new Date(d);dt.setDate(dt.getDate()+n);return dt;}
function kd(d){return d.toISOString().slice(0,10);}
function t2m(t){var p=t.split(':');return parseInt(p[0])*60+parseInt(p[1]);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function weekLabel(m){var s=addDays(m,5);return m.getMonth()===s.getMonth()?m.getDate()+'–'+s.getDate()+' '+MONTHS[m.getMonth()]+' '+m.getFullYear():m.getDate()+' '+MONTHS[m.getMonth()]+' – '+s.getDate()+' '+MONTHS[s.getMonth()]+' '+s.getFullYear();}

function getBlocksAt(blocks,dateStr,time,profFilter){
  var dow=new Date(dateStr).getDay();
  var di=dow===0?6:dow-1;
  var tm=t2m(time);
  var src=profFilter?blocks.filter(function(b){return b.prof===profFilter;}):blocks;
  return src.filter(function(b){return b.day===di&&t2m(b.from)<=tm&&tm<t2m(b.to);});
}

function renderGrid(){
  var pf=document.getElementById('ag-prof-filter').value;
  var grid=document.getElementById('ag-grid');
  if(!grid)return;
  grid.innerHTML='';
  document.getElementById('ag-week-label').textContent=weekLabel(currentMonday);
  var days=[];for(var i=0;i<6;i++)days.push(addDays(currentMonday,i));

  grid.appendChild(mkEl('div','ag-cell-head',''));
  days.forEach(function(d,i){grid.appendChild(mkEl('div','ag-cell-head'+(kd(d)===todayStr?' ag-today':''),DIAS[i]+' '+d.getDate()));});

  SLOTS.forEach(function(time){
    var tl=document.createElement('div');
    tl.className='ag-time-label';
    tl.textContent=time.endsWith(':00')?time:'';
    grid.appendChild(tl);

    days.forEach(function(d){
      var ds=kd(d);
      var slot=document.createElement('div');
      slot.className='ag-slot'+(ds===todayStr?' ag-today-col':'');

      // 1. No laborable
      var nlHit=getBlocksAt(nlBlocks,ds,time,pf);
      if(nlHit.length){
        slot.classList.add('ag-blocked');
        var b=nlHit[0];
        var bg=document.createElement('div');
        bg.className=b.prof==='BG'?'ag-nl-lila':'ag-nl-blue';
        if(time===b.from)bg.textContent=b.label+(pf?'':' ('+PROF_LBL[b.prof]+')');
        slot.appendChild(bg);
        grid.appendChild(slot);
        return;
      }

      // 2. Disponibilidad (fondo suave)
      var dispHit=getBlocksAt(dispBlocks,ds,time,pf);

      // 3. Turno
      var key=ds+'_'+time;
      var turno=turnos[key];
      if(turno&&(!pf||turno.prof===pf)){
        slot.appendChild(makeTurnoEl(turno,key));
      } else {
        if(dispHit.length){
          dispHit.forEach(function(b,idx){
            if(idx>1)return;
            var av=document.createElement('div');
            av.className='ag-av-bg '+b.prof.toLowerCase();
            if(idx===1)av.style.left='50%';
            slot.appendChild(av);
          });
        }
        (function(ds2,t2){slot.addEventListener('click',function(){openModal(ds2,t2,null);});})(ds,time);
      }
      grid.appendChild(slot);
    });
  });
}

function makeTurnoEl(t,key){
  var el=document.createElement('div');
  var pc=PROF_CLS[t.prof]||'bg';
  el.className='ag-turno '+pc+(t.estado==='cancelado'?' cancelado':'');
  var dc=t.pago||'sin-seña';
  el.innerHTML='<div class="ag-turno-body"><strong>'+esc(t.paciente||'—')+'</strong><span style="font-size:9px;opacity:.8">'+esc(PROF_LBL[t.prof]||'')+'</span></div><div class="ag-turno-right"><span class="ag-badge">'+(EST_L[t.estado]||'P')+'</span><div class="ag-dot '+dc+'"></div></div>';
  var tt=document.getElementById('ag-tooltip');
  (function(turno){
    el.addEventListener('mouseenter',function(e){
      tt.innerHTML='<div class="ag-tt-name">'+esc(turno.paciente||'—')+'</div>'
        +'<div class="ag-tt-row"><span>Profesional</span><span>'+esc(PROF_FULL[turno.prof]||'')+'</span></div>'
        +'<div class="ag-tt-row"><span>Estado</span><span>'+esc(turno.estado||'')+'</span></div>'
        +(turno.sena?'<div class="ag-tt-row"><span>Seña</span><span>$'+Number(turno.sena).toLocaleString('es-AR')+'</span></div>':'')
        +'<div class="ag-tt-row"><span>Pago</span><span>'+(PAGO_L[turno.pago||'sin-seña']||'')+'</span></div>'
        +(turno.notas?'<div class="ag-tt-row" style="margin-top:5px;border-top:1px solid #e5e7eb;padding-top:5px;flex-direction:column;gap:2px;"><span>Notas</span><span style="font-size:11px;font-weight:400;white-space:pre-wrap">'+esc(turno.notas)+'</span></div>':'');
      tt.style.display='block';moveTT(e);
    });
    el.addEventListener('mousemove',moveTT);
    el.addEventListener('mouseleave',function(){tt.style.display='none';});
    el.addEventListener('click',function(e){e.stopPropagation();openModal(null,null,key);});
  })(t);
  return el;
}

function moveTT(e){var tt=document.getElementById('ag-tooltip');var x=e.clientX+14,y=e.clientY+14;if(x+250>window.innerWidth)x=e.clientX-254;if(y+200>window.innerHeight)y=e.clientY-210;tt.style.left=x+'px';tt.style.top=y+'px';}
function mkEl(tag,cls,txt){var e=document.createElement(tag);e.className=cls;e.textContent=txt;return e;}

function openModal(ds,time,key){
  editKey=key;
  if(key&&turnos[key]){var p=key.split('_');pendingDate=p[0];pendingTime=p[1];ds=pendingDate;time=pendingTime;}
  else{pendingDate=ds;pendingTime=time;}
  var parts=ds.split('-');var y=parts[0],m=parts[1],dd=parts[2];
  var di=new Date(ds).getDay();
  document.getElementById('ag-f-datetime').value=DIAS_FULL[di===0?6:di-1]+' '+parseInt(dd)+'/'+parseInt(m)+'/'+y+' — '+time;
  document.getElementById('ag-modal-title').textContent=key?'Editar turno':'Nuevo turno';
  document.getElementById('ag-btn-delete').style.display=key?'inline-flex':'none';
  if(key&&turnos[key]){
    var t=turnos[key];
    document.getElementById('ag-f-paciente').value=t.paciente||'';
    document.getElementById('ag-f-prof').value=t.prof||'BG';
    document.getElementById('ag-f-estado').value=t.estado||'pendiente';
    document.getElementById('ag-f-sena').value=t.sena||'';
    document.getElementById('ag-f-pago').value=t.pago||'sin-seña';
    document.getElementById('ag-f-notas').value=t.notas||'';
  }else{
    document.getElementById('ag-f-paciente').value='';
    document.getElementById('ag-f-prof').value=document.getElementById('ag-prof-filter').value||'BG';
    document.getElementById('ag-f-estado').value='pendiente';
    document.getElementById('ag-f-sena').value='';
    document.getElementById('ag-f-pago').value='sin-seña';
    document.getElementById('ag-f-notas').value='';
  }
  document.getElementById('ag-modal-bg').style.display='flex';
  setTimeout(function(){document.getElementById('ag-f-paciente').focus();},50);
}

document.getElementById('ag-btn-cancel').addEventListener('click',function(){document.getElementById('ag-modal-bg').style.display='none';editKey=null;});
document.getElementById('ag-modal-bg').addEventListener('click',function(e){if(e.target===this){document.getElementById('ag-modal-bg').style.display='none';editKey=null;}});
document.getElementById('ag-btn-save').addEventListener('click',function(){
  var key=editKey||(pendingDate+'_'+pendingTime);
  if(!key)return;
  turnos[key]={paciente:document.getElementById('ag-f-paciente').value.trim(),prof:document.getElementById('ag-f-prof').value,estado:document.getElementById('ag-f-estado').value,sena:document.getElementById('ag-f-sena').value,pago:document.getElementById('ag-f-pago').value,notas:document.getElementById('ag-f-notas').value.trim()};
  saveLocal();document.getElementById('ag-modal-bg').style.display='none';editKey=null;renderGrid();
});
document.getElementById('ag-btn-delete').addEventListener('click',function(){
  if(editKey&&turnos[editKey]){delete turnos[editKey];saveLocal();document.getElementById('ag-modal-bg').style.display='none';editKey=null;renderGrid();}
});

// ═══ NO LABORABLES ═══
function renderNLList(){
  var list=document.getElementById('ag-nl-list');list.innerHTML='';
  nlTmp.forEach(function(b,i){
    var row=document.createElement('div');
    row.className='ag-cfg-block';
    row.style.gridTemplateColumns='90px 60px 72px 72px 1fr auto';
    var profOpts=NL_PROFS.map(function(p){return'<option value="'+p+'"'+(b.prof===p?' selected':'')+'>'+(p==='BG'?'Guerrero':'Bertani')+'</option>';}).join('');
    var dayOpts=DIAS.map(function(dn,di){return'<option value="'+di+'"'+(b.day===di?' selected':'')+'>'+ dn+'</option>';}).join('');
    row.innerHTML='<select data-i="'+i+'" data-f="prof">'+profOpts+'</select>'
      +'<select data-i="'+i+'" data-f="day">'+dayOpts+'</select>'
      +'<input type="time" data-i="'+i+'" data-f="from" value="'+b.from+'">'
      +'<input type="time" data-i="'+i+'" data-f="to" value="'+b.to+'">'
      +'<input type="text" data-i="'+i+'" data-f="label" value="'+esc(b.label)+'" placeholder="Etiqueta">'
      +'<button class="ag-cfg-del" data-i="'+i+'">✕</button>';
    list.appendChild(row);
  });
  bindCfg('ag-nl-list',nlTmp,renderNLList);
}

document.getElementById('ag-btn-nl').addEventListener('click',function(){nlTmp=nlBlocks.map(function(b){return Object.assign({},b);});renderNLList();document.getElementById('ag-nl-bg').style.display='flex';});
document.getElementById('ag-nl-cancel').addEventListener('click',function(){document.getElementById('ag-nl-bg').style.display='none';});
document.getElementById('ag-nl-bg').addEventListener('click',function(e){if(e.target===this)document.getElementById('ag-nl-bg').style.display='none';});
document.getElementById('ag-nl-add').addEventListener('click',function(){nlTmp.push({prof:'BG',day:0,from:'09:00',to:'12:00',label:''});renderNLList();});
document.getElementById('ag-nl-save').addEventListener('click',function(){nlBlocks=nlTmp.slice();saveLocal();document.getElementById('ag-nl-bg').style.display='none';renderGrid();});

// ═══ DISPONIBILIDAD ═══
function renderDispList(){
  var list=document.getElementById('ag-disp-list');list.innerHTML='';
  dispTmp.forEach(function(b,i){
    var row=document.createElement('div');
    row.className='ag-cfg-block';
    row.style.gridTemplateColumns='90px 60px 72px 72px 1fr auto';
    var profOpts=ALL_PROFS.map(function(p){return'<option value="'+p+'"'+(b.prof===p?' selected':'')+'>'+PROF_LBL[p]+'</option>';}).join('');
    var dayOpts=DIAS.map(function(dn,di){return'<option value="'+di+'"'+(b.day===di?' selected':'')+'>'+ dn+'</option>';}).join('');
    row.innerHTML='<select data-i="'+i+'" data-f="prof">'+profOpts+'</select>'
      +'<select data-i="'+i+'" data-f="day">'+dayOpts+'</select>'
      +'<input type="time" data-i="'+i+'" data-f="from" value="'+b.from+'">'
      +'<input type="time" data-i="'+i+'" data-f="to" value="'+b.to+'">'
      +'<input type="text" data-i="'+i+'" data-f="label" value="'+esc(b.label)+'" placeholder="Etiqueta">'
      +'<button class="ag-cfg-del" data-i="'+i+'">✕</button>';
    list.appendChild(row);
  });
  bindCfg('ag-disp-list',dispTmp,renderDispList);
}

document.getElementById('ag-btn-disp').addEventListener('click',function(){dispTmp=dispBlocks.map(function(b){return Object.assign({},b);});renderDispList();document.getElementById('ag-disp-bg').style.display='flex';});
document.getElementById('ag-disp-cancel').addEventListener('click',function(){document.getElementById('ag-disp-bg').style.display='none';});
document.getElementById('ag-disp-bg').addEventListener('click',function(e){if(e.target===this)document.getElementById('ag-disp-bg').style.display='none';});
document.getElementById('ag-disp-add').addEventListener('click',function(){dispTmp.push({prof:'BG',day:0,from:'09:00',to:'12:00',label:''});renderDispList();});
document.getElementById('ag-disp-save').addEventListener('click',function(){dispBlocks=dispTmp.slice();saveLocal();document.getElementById('ag-disp-bg').style.display='none';renderGrid();});

function bindCfg(listId,arr,rerender){
  document.querySelectorAll('#'+listId+' select,#'+listId+' input').forEach(function(el){
    el.addEventListener('change',function(){var idx=parseInt(this.dataset.i),f=this.dataset.f;arr[idx][f]=f==='day'?parseInt(this.value):this.value;});
  });
  document.querySelectorAll('#'+listId+' .ag-cfg-del').forEach(function(btn){
    btn.addEventListener('click',function(){arr.splice(parseInt(this.dataset.i),1);rerender();});
  });
}

document.getElementById('ag-prev').addEventListener('click',function(){currentMonday=addDays(currentMonday,-7);renderGrid();});
document.getElementById('ag-next').addEventListener('click',function(){currentMonday=addDays(currentMonday,7);renderGrid();});
document.getElementById('ag-today-btn').addEventListener('click',function(){currentMonday=getMonday(new Date());renderGrid();});
document.getElementById('ag-prof-filter').addEventListener('change',renderGrid);

function saveLocal(){
  try{localStorage.setItem(LS_T,JSON.stringify(turnos));}catch(e){}
  try{localStorage.setItem(LS_NL,JSON.stringify(nlBlocks));}catch(e){}
  try{localStorage.setItem(LS_D,JSON.stringify(dispBlocks));}catch(e){}
}
function loadLocal(){
  try{var r=localStorage.getItem(LS_T);if(r)turnos=JSON.parse(r);}catch(e){}
  try{var rn=localStorage.getItem(LS_NL);nlBlocks=rn?JSON.parse(rn):DEFAULT_NL.slice();}catch(e){nlBlocks=DEFAULT_NL.slice();}
  try{var rd=localStorage.getItem(LS_D);dispBlocks=rd?JSON.parse(rd):DEFAULT_DISP.slice();}catch(e){dispBlocks=DEFAULT_DISP.slice();}
  renderGrid();
}
loadLocal();
})();