
let matches=JSON.parse(localStorage.getItem("cfd-v05-matches")||"null")||INITIAL_MATCHES;
let favorites=JSON.parse(localStorage.getItem("cfd-v05-favorites")||"[]");
const $=id=>document.getElementById(id);
const teams=()=>[...new Set(matches.flatMap(m=>[m.home,m.away]))].sort((a,b)=>a.localeCompare(b,"ja"));
function stats(mode="all"){const s={};teams().forEach(t=>s[t]={team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,cleanSheets:0});for(const m of matches){const entries=mode==="home"?[[m.home,m.home_score,m.away_score]]:mode==="away"?[[m.away,m.away_score,m.home_score]]:[[m.home,m.home_score,m.away_score],[m.away,m.away_score,m.home_score]];for(const [t,gf,ga] of entries){const x=s[t];x.p++;x.gf+=gf;x.ga+=ga;if(ga===0)x.cleanSheets++;if(gf>ga){x.w++;x.pts+=3}else if(gf===ga){x.d++;x.pts++}else x.l++}}return Object.values(s).map(x=>({...x,gd:x.gf-x.ga,avgGoals:x.p?x.gf/x.p:0,avgConceded:x.p?x.ga/x.p:0})).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf)}
function players(){const m={};for(const x of matches)for(const g of x.goals||[]){if(g.scorer&&g.scorer!=="オウンゴール"){m[g.scorer]??={name:g.scorer,team:g.team,goals:0,assists:0};m[g.scorer].goals++}if(g.assist){m[g.assist]??={name:g.assist,team:g.team,goals:0,assists:0};m[g.assist].assists++}}return Object.values(m).map(x=>({...x,ga:x.goals+x.assists}))}
function standingHTML(mode,compact=false){return `<table><thead><tr><th>#</th><th>チーム</th><th>試</th><th>勝点</th>${compact?"":`<th>勝</th><th>分</th><th>敗</th><th>得失</th>`}</tr></thead><tbody>${stats(mode).map((x,i)=>`<tr class="row-link" onclick="openTeam('${x.team}')"><td>${i+1}</td><td><b>${x.team}</b></td><td>${x.p}</td><td><b>${x.pts}</b></td>${compact?"":`<td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.gd>0?"+":""}${x.gd}</td>`}</tr>`).join("")}</tbody></table>`}
function playerCards(type){return players().sort((a,b)=>b[type]-a[type]||b.goals-a.goals).slice(0,5).map((x,i)=>`<div class="rank-card"><small>${i+1}位</small><b>${x[type]}</b><strong>${x.name}</strong><small>${x.team}</small></div>`).join("")}
function teamRankCards(type){let d=stats();d.sort((a,b)=>type==="avgConceded"?a[type]-b[type]:b[type]-a[type]);return d.slice(0,5).map((x,i)=>`<div class="rank-card"><small>${i+1}位</small><b>${type.startsWith("avg")?x[type].toFixed(2):x[type]}</b><strong>${x.team}</strong><small>${type==="avgGoals"?"平均得点":type==="avgConceded"?"平均被得点":"無失点"}</small></div>`).join("")}
function matchRow(m){return `<div class="match-row" onclick="openMatch(${m.match_no})"><div class="match-date">${m.round}<br>${m.date.slice(5).replace("-","/")}</div><div class="match-teams">${m.home}<br>${m.away}</div><div class="match-score">${m.home_score} - ${m.away_score}</div></div>`}
function renderHome(){
 $("homeStandings").innerHTML=standingHTML($("homeStandingMode").value,true);
 $("homeMatches").innerHTML=[...matches].sort((a,b)=>b.match_no-a.match_no).slice(0,6).map(matchRow).join("");
 $("homePlayerRanks").innerHTML=playerCards($("homePlayerStat").value);
 $("homeTeamRanks").innerHTML=teamRankCards($("homeTeamStat").value);
}
function renderMatches(){const r=$("roundFilter").value,t=$("teamFilter").value,q=$("search").value.trim();$("matchList").innerHTML=[...matches].sort((a,b)=>a.match_no-b.match_no).filter(m=>(!r||m.round===r)&&(!t||(m.home===t||m.away===t))&&(!q||`${m.home}${m.away}${m.venue}`.includes(q))).map(m=>`<div class="match-card" onclick="openMatch(${m.match_no})"><div class="match-top"><div><small>${m.round}・MATCH ${m.match_no}</small><h3>${m.home} vs ${m.away}</h3></div><strong class="match-score">${m.home_score} - ${m.away_score}</strong></div><div class="meta">${m.date} ${m.time}｜${m.venue}</div></div>`).join("")}
function renderPlayers(){const type=$("playerType").value;$("playerTable").innerHTML=`<table><thead><tr><th>#</th><th>選手</th><th>チーム</th><th>${type==="goals"?"得点":type==="assists"?"アシスト":"G+A"}</th></tr></thead><tbody>${players().sort((a,b)=>b[type]-a[type]).map((x,i)=>`<tr><td>${i+1}</td><td>${x.name}</td><td>${x.team}</td><td><b>${x[type]}</b></td></tr>`).join("")}</tbody></table>`}
function renderTeams(){$("teamCards").innerHTML=stats().map(x=>`<div class="team-card" onclick="openTeam('${x.team}')"><button class="fav ${favorites.includes(x.team)?"active":""}" onclick="event.stopPropagation();toggleFav('${x.team}')">★</button><h3>${x.team}</h3><small>${x.w}勝 ${x.d}分 ${x.l}敗｜${x.gf}得点 ${x.ga}失点</small></div>`).join("")}
function toggleFav(t){favorites=favorites.includes(t)?favorites.filter(x=>x!==t):[...favorites,t];localStorage.setItem("cfd-v05-favorites",JSON.stringify(favorites));renderTeams();renderFav()}
function renderFav(){$("favContent").innerHTML=favorites.length?favorites.map(t=>`<div class="team-card" onclick="openTeam('${t}')"><h3>★ ${t}</h3><small>チームページを開く</small></div>`).join(""):`<div class="pending">チーム一覧の★を押すと、ここに表示されます。</div>`}
function show(id){document.querySelectorAll(".page,.nav").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");document.querySelector(`.nav[data-page="${id}"]`).classList.add("active");window.scrollTo({top:0,behavior:"smooth"})}
function openTeam(t){show("teams");$("teamCards").parentElement.classList.add("hidden");$("teamDetail").classList.remove("hidden");const s=stats().find(x=>x.team===t),ms=matches.filter(m=>m.home===t||m.away===t).sort((a,b)=>b.match_no-a.match_no),vs=VENUES[t]||[];$("teamDetail").innerHTML=`<button class="back" onclick="closeTeam()">← チーム一覧</button><h2>${t}</h2><div class="rank-cards"><div class="rank-card"><small>試合</small><b>${s.p}</b></div><div class="rank-card"><small>勝点</small><b>${s.pts}</b></div><div class="rank-card"><small>得点</small><b>${s.gf}</b></div><div class="rank-card"><small>失点</small><b>${s.ga}</b></div><div class="rank-card"><small>無失点</small><b>${s.cleanSheets}</b></div></div><div class="team-grid"><div><h3>ホームグラウンド</h3>${vs.map(v=>`<div class="venue"><h4>${v[0]}</h4><p>${v[1]}</p><p>${v[2]}</p></div>`).join("")}</div><div><h3>終了した試合</h3>${ms.slice(0,8).map(matchRow).join("")}<div class="pending">今後の日程、スカッド、詳細スタッツは自動取得接続後に追加します。</div></div></div>`}
function closeTeam(){$("teamDetail").classList.add("hidden");$("teamCards").parentElement.classList.remove("hidden")}

function calculateMinutes(detail,team){
 const result={};
 const starters=detail.lineups[team]?.starters||[],bench=detail.lineups[team]?.bench||[];
 starters.forEach(p=>result[p[2]]={name:p[2],pos:p[0],number:p[1],start:0,end:90,minutes:90,status:"先発"});
 bench.forEach(p=>result[p[2]]={name:p[2],pos:p[0],number:p[1],start:null,end:null,minutes:0,status:"ベンチ"});
 (detail.subs||[]).filter(s=>s.team===team).forEach(s=>{
   if(result[s.out]){result[s.out].end=Math.min(90,s.minute);result[s.out].minutes=Math.max(0,result[s.out].end-result[s.out].start)}
   if(result[s.in]){result[s.in].start=Math.min(90,s.minute);result[s.in].end=90;result[s.in].minutes=Math.max(0,90-result[s.in].start);result[s.in].status="途中出場"}
 });
 return result;
}
function lineupTable(detail,team){
 const mins=calculateMinutes(detail,team),l=detail.lineups[team];
 const rows=(arr,label)=>`<h4>${label}</h4><table><thead><tr><th>Pos</th><th>#</th><th>選手</th><th>出場時間</th><th>シュート</th></tr></thead><tbody>${arr.map(p=>`<tr><td>${p[0]}</td><td>${p[1]}</td><td>${p[2]}${p[3]==="C"?" (C)":""}</td><td>${mins[p[2]]?.minutes||0}分</td><td>${detail.shots?.[team]?.players?.[p[2]]||0}</td></tr>`).join("")}</tbody></table>`;
 return rows(l.starters,"スタメン")+rows(l.bench,"ベンチ");
}
function statCompare(detail,home,away){
 const labels=[["shots","シュート"],["corners","コーナーキック"],["goal_kicks","ゴールキック"],["direct_fk","直接FK"],["indirect_fk","間接FK"],["offsides","オフサイド"],["pk","PK"]];
 return `<div class="stat-list">${labels.map(([key,label])=>{const h=key==="shots"?detail.shots?.[home]?.total:detail.team_stats?.[home]?.[key],a=key==="shots"?detail.shots?.[away]?.total:detail.team_stats?.[away]?.[key];return `<div class="stat-line"><b>${h??"-"}</b><span>${label}</span><b>${a??"-"}</b></div>`}).join("")}</div>`;
}
function timeline(m,d){
 const goals=(m.goals||[]).map(g=>({
   minute:parseInt(g.minute,10)||0,
   text:`⚽ ${g.scorer}${g.assist?`（${g.assist}）`:""}`,
   team:g.team
 }));
 const subs=(d.subs||[]).map(s=>({
   minute:s.minute,
   text:`⇄ OUT ${s.out} / IN ${s.in}`,
   team:s.team
 }));
 const cards=(d.cards||[]).map(c=>({
   minute:c.minute,
   text:`${c.type==="red"?"🟥":"🟨"} ${c.player} ${c.reason||""}`,
   team:c.team
 }));
 const ev=[...goals,...subs,...cards].sort((a,b)=>a.minute-b.minute);
 return ev.map(e=>`<div class="timeline-row"><strong>${e.minute}'</strong><span>${e.text}</span><small>${e.team}</small></div>`).join("");
}
function openMatch(no){
 const m=matches.find(x=>x.match_no===no),d=MATCH_DETAILS[String(no)],hg=(m.goals||[]).filter(g=>g.team===m.home),ag=(m.goals||[]).filter(g=>g.team===m.away);
 if(!d){$("modalBody").innerHTML=`<div class="score-head"><small>${m.round}・MATCH ${m.match_no}</small><h2>${m.home}<span class="big">${m.home_score} - ${m.away_score}</span>${m.away}</h2><p>${m.date} ${m.time}｜${m.venue}</p></div><div class="goals"><div class="goal-box"><h3>${m.home}</h3>${hg.length?hg.map(g=>`<div class="goal">${g.minute}' ⚽ ${g.scorer}${g.assist?`（${g.assist}）`:""}</div>`).join(""):"得点なし"}</div><div class="goal-box"><h3>${m.away}</h3>${ag.length?ag.map(g=>`<div class="goal">${g.minute}' ⚽ ${g.scorer}${g.assist?`（${g.assist}）`:""}</div>`).join(""):"得点なし"}</div></div><div class="pending">この試合の詳細データは準備中です。</div>`;$("modal").classList.remove("hidden");return}
 $("modalBody").innerHTML=`<div class="score-head"><small>${m.round}・MATCH ${m.match_no}</small><h2>${m.home}<span class="big">${m.home_score} - ${m.away_score}</span>${m.away}</h2><p>${m.date} ${m.time}｜${m.venue}</p><p>${d.weather}・${d.wind}・ピッチ${d.pitch}｜観客 ${d.attendance}人</p></div>
 <div class="detail-tabs"><button class="active" onclick="showMatchTab('overview',event)">概要</button><button onclick="showMatchTab('stats',event)">スタッツ</button><button onclick="showMatchTab('lineups',event)">ラインナップ</button><button onclick="showMatchTab('timeline',event)">タイムライン</button></div>
 <div id="matchTab-overview" class="match-tab"><div class="goals"><div class="goal-box"><h3>${m.home}</h3>${hg.length?hg.map(g=>`<div class="goal">${g.minute}' ⚽ ${g.scorer}${g.assist?`（${g.assist}）`:""}</div>`).join(""):"得点なし"}</div><div class="goal-box"><h3>${m.away}</h3>${ag.length?ag.map(g=>`<div class="goal">${g.minute}' ⚽ ${g.scorer}${g.assist?`（${g.assist}）`:""}</div>`).join(""):"得点なし"}</div></div><div class="official-box"><h3>審判</h3><p>主審 ${d.officials.referee}｜副審 ${d.officials.assistant1}・${d.officials.assistant2}｜第4審 ${d.officials.fourth}</p></div></div>
 <div id="matchTab-stats" class="match-tab hidden"><div class="compare-head"><b>${m.home}</b><b>${m.away}</b></div>${statCompare(d,m.home,m.away)}</div>
 <div id="matchTab-lineups" class="match-tab hidden"><div class="lineup-grid"><div><h3>${m.home}</h3>${lineupTable(d,m.home)}</div><div><h3>${m.away}</h3>${lineupTable(d,m.away)}</div></div></div>
 <div id="matchTab-timeline" class="match-tab hidden"><div class="timeline">${timeline(m,d)}</div></div>`;
 $("modal").classList.remove("hidden")
}
function showMatchTab(id,ev){document.querySelectorAll(".match-tab").forEach(x=>x.classList.add("hidden"));document.querySelectorAll(".detail-tabs button").forEach(x=>x.classList.remove("active"));document.getElementById("matchTab-"+id).classList.remove("hidden");if(ev?.currentTarget)ev.currentTarget.classList.add("active")}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>show(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
$("homeStandingMode").onchange=renderHome;
$("fullStandingMode").onchange=()=>{$("fullStandings").innerHTML=standingHTML($("fullStandingMode").value,false)};
$("homePlayerStat").onchange=renderHome;
$("homeTeamStat").onchange=renderHome;
$("playerType").onchange=renderPlayers;
[$("roundFilter"),$("teamFilter"),$("search")].forEach(e=>e.addEventListener("input",renderMatches));
$("theme").onclick=()=>document.body.classList.toggle("dark");
$("modalClose").onclick=()=>$("modal").classList.add("hidden");
$("modal").onclick=e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")};
$("roundFilter").innerHTML='<option value="">全節</option>'+[...new Set(matches.map(m=>m.round))].map(x=>`<option>${x}</option>`).join("");
$("teamFilter").innerHTML='<option value="">全チーム</option>'+teams().map(x=>`<option>${x}</option>`).join("");
renderHome();
$("fullStandings").innerHTML=standingHTML("all",false);
renderMatches();
renderPlayers();
renderTeams();
renderFav();
