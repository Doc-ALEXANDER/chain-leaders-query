'use strict';
(() => {
 const D=window.CHAIN_DATA;
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=n=>Number(n).toLocaleString('zh-CN');
 const unique=values=>[...new Set(values.filter(x=>x!==''&&x!==null&&x!==undefined))];
 const short=(s,n=66)=>String(s||'').length>n?String(s).slice(0,n)+'…':String(s||'');
 const url=s=>/^https?:\/\//i.test(s||'')?esc(s):'';
 const sourceLink=(u,text)=>url(u)?`<a href="${url(u)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`:'';
 const official=r=>/^政府原文/.test(r.evidence);
 const params=new URLSearchParams(location.search);
 const state={province:params.get('province')||'',q:params.get('q')||'',tab:params.get('tab')||'companies',policy:params.get('policy')||'',year:params.get('year')||'',status:params.get('status')||'',evidence:params.get('evidence')||'',page:Math.max(1,Number(params.get('page'))||1)};
 if(!D.provinces.some(p=>p.name===state.province))state.province='';
 if(!['companies','supplements','coverage'].includes(state.tab))state.tab='companies';
 const PAGE_SIZE=25;
 let current=[],timer,toastTimer;
 const policies=unique(D.records.map(r=>r.scheme)).sort((a,b)=>a.localeCompare(b,'zh-CN'));
 const years=unique(D.records.map(r=>String(r.year)).filter(Boolean)).sort().reverse();
 const statuses=unique(D.records.map(r=>r.status));
 function addOptions(id,values){for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=v;$(id).append(o);}}
 addOptions('policyFilter',policies);addOptions('yearFilter',years);addOptions('statusFilter',statuses);
 const unspecified=document.createElement('option');unspecified.value='unspecified';unspecified.textContent='未标明年度';$('yearFilter').append(unspecified);
 if(state.policy&&!policies.includes(state.policy))state.policy='';
 if(state.year&&!years.includes(state.year)&&state.year!=='unspecified')state.year='';
 if(state.status&&!statuses.includes(state.status))state.status='';
 if(!['','official','other'].includes(state.evidence))state.evidence='';
 for(const p of D.provinces){
  const button=document.createElement('button');button.className='province-button';button.dataset.province=p.name;
  button.innerHTML=`<span>${esc(p.name)}</span><b>${p.entities?fmt(p.entities):'补充'}</b>`;$('provinceList').append(button);
  const option=document.createElement('option');option.value=p.name;option.textContent=p.full;$('provinceSelect').append(option);
 }
 const recordText=D.records.map(r=>[r.name,r.province,r.city,r.chain,r.scheme,r.publisher,r.batch,r.year,r.status].join(' ').toLowerCase());
 const supplementText=D.supplements.map(s=>[s.name,s.province,s.kind,s.location,s.scope,s.note].join(' ').toLowerCase());
 const words=()=>state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
 function matchRecord(r){
  return (!state.province||r.province===state.province)&&(!state.policy||r.scheme===state.policy)&&(!state.year||(state.year==='unspecified'?!r.year:String(r.year)===state.year))&&(!state.status||r.status===state.status)&&(!state.evidence||(state.evidence==='official'?official(r):!official(r)))&&words().every(w=>recordText[r.rid].includes(w));
 }
 function badge(s){const cls=/公示|拟/.test(s)?'pending':/培育/.test(s)?'blue':/历史|征集|报道|记载/.test(s)?'neutral':'';return `<span class="badge ${cls}">${esc(s)}</span>`;}
 function resultRows(){
  if(state.tab==='companies')return D.entities.filter(e=>!state.province||e.province===state.province).map(e=>({e,rr:e.record_ids.map(i=>D.records[i]).filter(matchRecord)})).filter(x=>x.rr.length);
  if(state.tab==='supplements')return D.supplements.map((s,i)=>({s,i})).filter(x=>(!state.province||x.s.province===state.province)&&words().every(w=>supplementText[x.i].includes(w)));
  return D.provinces.filter(p=>(!state.province||p.name===state.province)&&words().every(w=>(p.name+' '+p.full+' '+p.note).toLowerCase().includes(w)));
 }
 function syncURL(){const p=new URLSearchParams();for(const k of ['province','q','tab','policy','year','status','evidence','page'])if(state[k]&&!(k==='tab'&&state[k]==='companies')&&!(k==='page'&&state[k]===1))p.set(k,state[k]);history.replaceState(null,'',location.pathname+(p.toString()?'?'+p.toString():'')+location.hash);}
 function syncControls(){
  for(const [id,key] of [['searchInput','q'],['provinceSelect','province'],['policyFilter','policy'],['yearFilter','year'],['statusFilter','status'],['evidenceFilter','evidence']])$(id).value=state[key];
  document.querySelectorAll('[data-province]').forEach(b=>{const selected=b.dataset.province===state.province;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
  for(const id of ['policyFilter','yearFilter','statusFilter','evidenceFilter']){const inactive=state.tab!=='companies';$(id).disabled=inactive;$(id).parentElement.classList.toggle('disabled',inactive);$(id).title=inactive?'此分类按省份和关键词筛选':'';}
 }
 function renderChips(){
  const labels={province:'省份',q:'关键词',policy:'政策',year:'年度',status:'状态',evidence:'来源'};
  $('activeFilters').innerHTML=Object.entries(labels).filter(([k])=>state[k]&&(state.tab==='companies'||['province','q'].includes(k))).map(([k,l])=>`<button class="filter-chip" data-remove="${k}" aria-label="移除${esc(l)}筛选">${esc(l)}：${esc(k==='evidence'?(state[k]==='official'?'政府原文':'转载及其他'):k==='year'&&state[k]==='unspecified'?'未标明年度':state[k])}<span aria-hidden="true">×</span></button>`).join('');
 }
 function renderCompanyRows(rows){
  $('tableHead').innerHTML='<tr><th scope="col">企业 / 单位名称</th><th scope="col">所在地区</th><th scope="col">政策类别 / 产业链</th><th scope="col">批次与认定状态</th><th scope="col">资料详情</th></tr>';
  $('tableBody').innerHTML=rows.map(({e,rr})=>{
   const policy=unique(rr.map(r=>r.scheme)),chains=unique(rr.map(r=>r.chain)),ss=unique(rr.map(r=>r.status)),yy=unique(rr.map(r=>r.year)).sort();
   return `<tr><td><button class="company-link" data-detail="c:${e.eid}">${esc(e.name)}</button><span class="subtext">${esc(e.entity_type)} · ${rr.length}条匹配记录</span></td><td>${esc(e.province)}<span class="subtext">${esc(short(unique(rr.map(r=>r.city)).join('；'),42)||'城市未注明')}</span></td><td title="${esc(policy.join('；')+' / '+chains.join('；'))}">${esc(short(policy.join('；'),45))}<span class="subtext">${esc(short(chains.join('；'),64)||'具体产业链见原文')}</span></td><td><span class="year-text">${esc(yy.length?yy.join(' / ')+' 年':'年度未注明')}</span>${ss.slice(0,3).map(badge).join('')}${ss.length>3?`<span class="subtext">另${ss.length-3}种状态，见详情</span>`:''}<span class="subtext">${esc(short(unique(rr.map(r=>r.evidence)).join('；'),44))}</span></td><td><button class="detail-link" data-detail="c:${e.eid}">查看批次 ↗</button></td></tr>`;
  }).join('');
 }
 function renderSupplementRows(rows){
  $('tableHead').innerHTML='<tr><th scope="col">企业 / 机构原名</th><th scope="col">所属省份</th><th scope="col">国资证据 / 省内关系</th><th scope="col">来源范围</th><th scope="col">资料详情</th></tr>';
  $('tableBody').innerHTML=rows.map(({s,i})=>`<tr><td><button class="company-link" data-detail="s:${i}">${esc(s.name)}</button><span class="subtext">国资补充 · 不代表链主认定</span></td><td>${esc(s.province)}</td><td>${esc(s.kind)}<span class="subtext">${esc(s.location)}</span></td><td>${esc(short(s.scope,80))}<span class="subtext">${esc(s.date||'资料未单列日期')}</span></td><td><button class="detail-link" data-detail="s:${i}">查看来源 ↗</button></td></tr>`).join('');
 }
 function renderCoverage(rows){$('coverageCards').innerHTML=rows.map(p=>`<article class="coverage-card"><h3>${esc(p.full)}<span>${p.entities?'取得名单或线索':'国资补充'}</span></h3><div class="card-numbers"><div><b>${fmt(p.entities)}</b>原名去重主体</div><div><b>${fmt(p.records)}</b>分批次记录</div><div><b>${fmt(p.supplements)}</b>国资补充</div></div><p>${esc(p.note)}</p><button data-open-province="${esc(p.name)}">${p.entities?'查询本省链主资料':'查看本省国资补充'} <span aria-hidden="true">→</span></button></article>`).join('');}
 function render(){
  current=resultRows();const p=D.provinces.find(x=>x.name===state.province);syncControls();syncURL();renderChips();
  $('pageTitle').textContent=p?`${p.name}链主企业查询`:'全国链主企业查询';
  $('metricRegions').textContent=p?'1':'31';$('metricEntities').textContent=fmt(p?p.entities:1152);$('metricRecords').textContent=fmt(p?p.records:1414);$('metricSupplements').textContent=fmt(p?p.supplements:209);
  $('scopeNote').querySelector('p').textContent=p?p.note:'21省取得名单或部分入选证据，其余10省提供国央企补充。公示、培育与正式认定分别标注；补充资料不代表链主认定。';
  $('provinceDownload').href=p?p.download:'downloads/national.xlsx';$('provinceDownload').textContent=p?`下载${p.name}Excel ↓`:'下载全国总表 ↓';
  $('supplementWarning').hidden=state.tab!=='supplements';$('exportButton').hidden=state.tab==='coverage';
  $('resultTitle').textContent=state.tab==='companies'?'企业与单位':state.tab==='supplements'?'国央企及国资参股补充':'31省资料覆盖';
  const matchedRecords=state.tab==='companies'?current.reduce((n,x)=>n+x.rr.length,0):0;
  $('resultCount').textContent=state.tab==='companies'?`找到 ${fmt(current.length)} 个主体 · 涉及 ${fmt(matchedRecords)} 条匹配记录`:`找到 ${fmt(current.length)} ${state.tab==='supplements'?'条补充资料 · 支持按省份和关键词筛选':'个省级地区 · 点击卡片查看本省资料'}`;
  $('tableContainer').hidden=state.tab==='coverage'||!current.length;$('coverageCards').hidden=state.tab!=='coverage'||!current.length;$('emptyState').hidden=!!current.length;
  const maxPage=Math.max(1,Math.ceil(current.length/PAGE_SIZE));state.page=Math.max(1,Math.min(state.page,maxPage));syncURL();
  if(state.tab==='companies')renderCompanyRows(current.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE));
  else if(state.tab==='supplements')renderSupplementRows(current.slice((state.page-1)*PAGE_SIZE,state.page*PAGE_SIZE));else renderCoverage(current);
  $('pagination').hidden=state.tab==='coverage'||!current.length;$('pageInfo').textContent=`显示 ${(state.page-1)*PAGE_SIZE+1}–${Math.min(state.page*PAGE_SIZE,current.length)} 项，共 ${fmt(current.length)} 项`;$('pageNumber').textContent=`${state.page} / ${maxPage}`;$('previousPage').disabled=state.page===1;$('nextPage').disabled=state.page===maxPage;
  if(!current.length){
   const missing=p&&!p.records&&state.tab==='companies'&&!state.q&&!state.policy&&!state.year&&!state.status&&!state.evidence;
   $('emptyTitle').textContent=missing?`本次尚未取得${p.name}可核录的链主表`:'没有找到匹配的资料';$('emptyDescription').textContent=missing?`已另列 ${p.supplements} 条国资补充，保留原始来源与适用口径。`:'尝试减少关键词或筛选条件。没有匹配结果不表示当地没有链主企业。';$('emptyAction').textContent=missing?'查看国资补充':'重置筛选';$('emptyAction').dataset.action=missing?'supplements':'reset';
  }
 }
 function reset(){Object.assign(state,{province:'',q:'',policy:'',year:'',status:'',evidence:'',page:1});render();}
 function setProvince(p,tab){state.province=p;if(tab)state.tab=tab;state.page=1;render();}
 function recordCard(r){return `<article class="record-card"><header><h4>${esc(r.year||'年度未注明')} · ${esc(r.batch)}</h4>${badge(r.status)}</header><dl><dt>政策名称</dt><dd>${esc(r.scheme)}</dd><dt>产业链</dt><dd>${esc(r.chain||'来源未单列')}</dd><dt>公布层级</dt><dd>${esc(r.level)}</dd><dt>发布部门</dt><dd>${esc(r.publisher||'见原始资料')}</dd><dt>资料日期</dt><dd>${esc(r.date||'未注明；年度按原文保存')}</dd><dt>来源类型</dt><dd>${esc(r.evidence)}</dd><dt>来源标题</dt><dd>${esc(r.source_title)}</dd><dt>核录位置</dt><dd>${esc(r.location||'网页正文 / 附件')}</dd></dl><div class="source-links">${sourceLink(r.source_url,'打开通知或资料原文')}${sourceLink(r.attachment_url,'打开名单附件')}</div>${r.note?`<p class="record-note">${esc(r.note)}</p>`:''}</article>`;}
 function openCompany(eid,all=false){
  const e=D.entities[eid];if(!e)return;const rr=e.record_ids.map(i=>D.records[i]);const shown=all?rr:rr.filter(matchRecord);
  $('detailEyebrow').textContent='企业 / 单位公开资料';
  $('detailContent').innerHTML=`<h2 id="detailTitle">${esc(e.name)}</h2><div class="detail-meta"><span>${esc(e.province)}</span><span>${esc(e.entity_type)}</span><span>共 ${rr.length} 条原始记录</span></div><p class="detail-notice">当前显示${all?'全部':shown.length===rr.length?'全部':'筛选匹配的'} ${shown.length} 条记录。公示、培育、历史认定及国家级线索按来源状态保存；历史入选不自动证明目前有效。</p>${shown.length<rr.length?`<p><button class="text-button" data-all-records="${eid}">查看该主体全部 ${rr.length} 条记录 →</button></p>`:''}<h3>分年度 · 分批次证据</h3>${shown.map(recordCard).join('')}`;
  if(!$('detailDialog').open)$('detailDialog').showModal();$('detailDialog').scrollTop=0;
 }
 function openSupplement(i){
  const s=D.supplements[i];if(!s)return;$('detailEyebrow').textContent='国资补充资料';
  $('detailContent').innerHTML=`<h2 id="detailTitle">${esc(s.name)}</h2><div class="detail-meta"><span>${esc(s.province)}</span><span>${esc(s.kind)}</span></div><p class="detail-notice">国央企及国资参股补充线索，不代表链主认定。</p><article class="record-card"><dl><dt>省内关系</dt><dd>${esc(s.location)}</dd><dt>来源范围</dt><dd>${esc(s.scope)}</dd><dt>资料日期</dt><dd>${esc(s.date||'来源未单列')}</dd><dt>来源类型</dt><dd>${esc(s.evidence)}</dd><dt>来源标题</dt><dd>${esc(s.title)}</dd></dl><div class="source-links">${sourceLink(s.url,'打开原始来源')}</div>${s.note?`<p class="record-note">${esc(s.note)}</p>`:''}</article>`;$('detailDialog').showModal();$('detailDialog').scrollTop=0;
 }
 function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
 function exportCSV(){
  let rows,name;
  if(state.tab==='companies'){
   rows=[['省份','企业或单位原名','主体性质','城市或地区','政策名称','产业链','年度','批次','认定状态','来源类型','通知或资料原文','附件网址','备注']];
   for(const {e,rr} of current)for(const r of rr)rows.push([e.province,e.name,e.entity_type,r.city,r.scheme,r.chain,r.year,r.batch,r.status,r.evidence,r.source_url,r.attachment_url,r.note]);name='链主企业匹配记录';
  }else{rows=[['省份','企业或机构原名','国资证据','省内关系','来源范围','资料日期','链主认定关系','来源网址','备注'],...current.map(({s})=>[s.province,s.name,s.kind,s.location,s.scope,s.date,s.chain_status,s.url,s.note])];name='国资补充';}
  const csv='\ufeff'+rows.map(r=>r.map(v=>{let t=String(v??'');if(/^[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),a=document.createElement('a'),href=URL.createObjectURL(blob);a.href=href;a.download=`${state.province||'全国'}_${name}_20261030.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);toast(`已导出 ${rows.length-1} 条${state.tab==='companies'?'匹配来源记录':'补充资料'}`);
 }
 document.addEventListener('click',event=>{
  const province=event.target.closest('[data-province]');if(province){setProvince(province.dataset.province);return;}
  const tab=event.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;state.page=1;render();return;}
  const detail=event.target.closest('[data-detail]');if(detail){const [kind,n]=detail.dataset.detail.split(':');if(kind==='c')openCompany(Number(n));else openSupplement(Number(n));return;}
  const all=event.target.closest('[data-all-records]');if(all){openCompany(Number(all.dataset.allRecords),true);return;}
  const card=event.target.closest('[data-open-province]');if(card){const p=D.provinces.find(p=>p.name===card.dataset.openProvince);state.q='';setProvince(p.name,p.entities?'companies':'supplements');return;}
  const remove=event.target.closest('[data-remove]');if(remove){state[remove.dataset.remove]='';state.page=1;render();}
 });
 $('searchInput').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=$('searchInput').value;state.page=1;render();},160);});
 const search=()=>{clearTimeout(timer);state.q=$('searchInput').value;state.page=1;render();};$('searchButton').addEventListener('click',search);$('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
 for(const [id,key] of [['provinceSelect','province'],['policyFilter','policy'],['yearFilter','year'],['statusFilter','status'],['evidenceFilter','evidence']])$(id).addEventListener('change',()=>{state[key]=$(id).value;state.page=1;render();});
 $('resetButton').addEventListener('click',reset);$('emptyAction').addEventListener('click',()=>{if($('emptyAction').dataset.action==='supplements'){state.tab='supplements';state.page=1;render();}else reset();});
 for(const [id,direction] of [['previousPage',-1],['nextPage',1]])$(id).addEventListener('click',()=>{state.page+=direction;render();$('resultTitle').scrollIntoView({behavior:'smooth',block:'start'});});
 $('closeDetail').addEventListener('click',()=>$('detailDialog').close());$('closeAbout').addEventListener('click',()=>$('aboutDialog').close());$('aboutButton').addEventListener('click',()=>$('aboutDialog').showModal());
 for(const id of ['detailDialog','aboutDialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
 $('exportButton').addEventListener('click',exportCSV);
 $('shareButton').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('当前查询链接已复制，可直接发送给别人');}catch{toast('请复制浏览器地址栏中的网址，即可分享当前查询');}});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)&&!$('detailDialog').open&&!$('aboutDialog').open){e.preventDefault();$('searchInput').focus();}});
 render();
})();
