
const KEY="chugoku-soccer-complete-v2";let matches=JSON.parse(localStorage.getItem(KEY)||"null")||INITIAL_MATCHES;
const save=()=>{localStorage.setItem(KEY,JSON.stringify(matches));renderAll()};
const teams=()=>[...new Set(matches.flatMap(m=>[m.home,m.away]))].sort((a,b)=>a.localeCompare(b,"ja"));
const rounds=()=>[...new Set(matches.map(m=>m.round))].sort((a,b)=>parseInt(a.match(/\d+/))-parseInt(b.match(/\d+/)));
function stats(){const map={};for(const m of matches)for(const x of m.goals||[]){if(x.scorer&&x.scorer!=="オウンゴール"){map[x.scorer]??={name:x.scorer,team:x.team,goals:0,assists:0};map[x.scorer].goals++}if(x.assist){map[x.assist]??={name:x.assist,team:x.team,goals:0,assists:0};map[x.assist].assists++}}return Object.values(map).map(x=>({...x,ga:x.goals+x.assists}))}
function standings(){const s={};for(const t of teams())s[t]={team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};for(const m of matches){const h=s[m.home],a=s[m.away];h.p++;a.p++;h.gf+=m.home_score;h.ga+=m.away_score;a.gf+=m.away_score;a.ga+=m.home_score;if(m.home_score>m.away_score){h.w++;h.pts+=3;a.l++}else if(m.home_score<m.away_score){a.w++;a.pts+=3;h.l++}else{h.d++;a.d++;h.pts++;a.pts++}}for(const x of Object.values(s))x.gd=x.gf-x.ga;return Object.values(s).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team,"ja"))}
function fill(id,vals,blank){const e=document.getElementById(id),cur=e.value;e.innerHTML=(blank?`<option value="">${blank}</option>`:"")+vals.map(v=>`<option>${v}</option>`).join("");if([...e.options].some(o=>o.value===cur))e.value=cur}
function rankTable(data,type){const lab=type==="goals"?"得点":type==="assists"?"アシスト":"G+A";return `<table><thead><tr><th>順位</th><th>選手</th><th>大学</th><th>${lab}</th></tr></thead><tbody>${data.map((x,i)=>`<tr><td>${i+1}</td><td>${x.name}</td><td>${x.team}</td><td>${x[type]}</td></tr>`).join("")}</tbody></table>`}
function renderDashboard(){const st=stats().sort((a,b)=>b.goals-a.goals||b.assists-a.assists);matchCount.textContent=matches.length;goalCount.textContent=matches.reduce((s,m)=>s+m.home_score+m.away_score,0);teamCount.textContent=teams().length;topScorer.textContent=st[0]?`${st[0].name}（${st[0].goals}）`:"-";latestMatches.innerHTML=[...matches].sort((a,b)=>b.match_no-a.match_no).slice(0,5).map(card).join("");top10.innerHTML=rankTable(st.slice(0,10),"goals")}
function card(m){const idx=matches.findIndex(x=>x.match_no===m.match_no);return `<article class="match-card"><div class="scoreline"><div><span class="badge">${m.round} / Match ${m.match_no}</span><div class="teams">${m.home} vs ${m.away}</div></div><div class="score">${m.home_score} - ${m.away_score}</div></div><div class="meta">${m.date} ${m.time}｜${m.venue}</div><div class="goal-list">${(m.goals||[]).map(x=>`${x.minute}' ${x.scorer}${x.assist?`（${x.assist}）`:""}`).join("<br>")||"得点なし"}</div><div class="match-actions"><button class="edit-btn" onclick="editMatch(${idx})">編集</button><button class="delete-btn" onclick="deleteMatch(${idx})">削除</button></div></article>`}
function openTeamPage(team){
  fill("teamSelect",teams(),"");
  teamSelect.value=team;
  renderTeam();
  document.querySelectorAll(".tab,.panel").forEach(x=>x.classList.remove("active"));
  document.querySelector('[data-tab="teams"]').classList.add("active");
  document.getElementById("teams").classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderStandings(){
  standingsTable.innerHTML=`<table><thead><tr><th>順位</th><th>大学</th><th>試合</th><th>勝</th><th>分</th><th>敗</th><th>得点</th><th>失点</th><th>得失差</th><th>勝点</th></tr></thead><tbody>${standings().map((x,i)=>`<tr class="standings-row" data-team="${x.team}"><td>${i+1}</td><td class="team-link">${x.team}</td><td>${x.p}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.gf}</td><td>${x.ga}</td><td>${x.gd>0?"+":""}${x.gd}</td><td><b>${x.pts}</b></td></tr>`).join("")}</tbody></table>`;
  standingsTable.querySelectorAll(".standings-row").forEach(row=>{
    row.addEventListener("click",()=>openTeamPage(row.dataset.team));
  });
}
function renderMatches(){const r=roundFilter.value,t=matchTeamFilter.value,q=matchSearch.value.trim();matchList.innerHTML=[...matches].sort((a,b)=>a.match_no-b.match_no).filter(m=>(!r||m.round===r)&&(!t||(m.home===t||m.away===t))&&(!q||`${m.home}${m.away}${m.venue}`.includes(q))).map(card).join("")||"<p>該当なし</p>"}
function renderRanking(){const type=rankingType.value,t=rankingTeamFilter.value;rankingTable.innerHTML=rankTable(stats().filter(x=>!t||x.team===t).sort((a,b)=>b[type]-a[type]||b.goals-a.goals||a.name.localeCompare(b.name,"ja")),type)}
function renderTeam(){const t=teamSelect.value||teams()[0];teamSelect.value=t;const ms=matches.filter(m=>m.home===t||m.away===t);let gf=0,ga=0,w=0,d=0,l=0;for(const m of ms){const f=m.home===t?m.home_score:m.away_score,a=m.home===t?m.away_score:m.home_score;gf+=f;ga+=a;if(f>a)w++;else if(f<a)l++;else d++}const top=stats().filter(x=>x.team===t).sort((a,b)=>b.ga-a.ga||b.goals-a.goals).slice(0,10);const venueHtml=(VENUES[t]||[]).map(v=>`<div class="venue-box"><h3>${v[0]}</h3><p>${v[1]}</p><p>${v[2]}</p></div>`).join("");teamSummary.innerHTML=`<div class="cards"><div class="card"><span>試合</span><strong>${ms.length}</strong></div><div class="card"><span>成績</span><strong>${w}勝${d}分${l}敗</strong></div><div class="card"><span>得点</span><strong>${gf}</strong></div><div class="card"><span>失点</span><strong>${ga}</strong></div></div><div class="grid2"><div class="box"><h2>終了した試合</h2>${ms.sort((a,b)=>b.match_no-a.match_no).map(m=>`<p>Match ${m.match_no}　${m.home} ${m.home_score}-${m.away_score} ${m.away}</p>`).join("")}<div class="coming-note">今後の試合日程は、公式日程の自動取得処理を接続後に表示します。</div></div><div class="box"><h2>チーム内 G+A</h2>${rankTable(top,"ga")}<div class="coming-note">出場時間・シュート・カード・スカッドは詳細結果の自動取得後に追加します。</div></div></div><div class="box"><h2>ホームグラウンド</h2>${venueHtml||"<p>情報準備中</p>"}</div>`}
function renderAll(){fill("roundFilter",rounds(),"全節");fill("matchTeamFilter",teams(),"全大学");fill("rankingTeamFilter",teams(),"リーグ全体");fill("teamSelect",teams(),"");renderDashboard();renderStandings();renderMatches();renderRanking();renderTeam()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab,.panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active")});
["roundFilter","matchTeamFilter","matchSearch"].forEach(id=>document.getElementById(id).addEventListener("input",renderMatches));["rankingType","rankingTeamFilter"].forEach(id=>document.getElementById(id).addEventListener("input",renderRanking));teamSelect.addEventListener("input",renderTeam);

function editMatch(i){
  const m=matches[i],f=matchForm;
  f.edit_index.value=i;
  f.round.value=m.round;
  f.match_no.value=m.match_no;
  f.date.value=m.date;
  f.time.value=m.time;
  f.venue.value=m.venue;
  f.home.value=m.home;
  f.away.value=m.away;
  f.home_score.value=m.home_score;
  f.away_score.value=m.away_score;
  f.goals.value=(m.goals||[]).map(x=>[x.minute,x.team,x.scorer,x.assist||""].join(",")).join("\n");
  formTitle.textContent=`Match ${m.match_no} を編集`;
  cancelEdit.hidden=false;
  document.querySelector('[data-tab="add"]').click();
  window.scrollTo({top:0,behavior:"smooth"});
}
function deleteMatch(i){
  const m=matches[i];
  if(confirm(`Match ${m.match_no}「${m.home} vs ${m.away}」を削除しますか？`)){
    matches.splice(i,1);save();
  }
}
function clearEdit(){
  matchForm.reset();
  matchForm.edit_index.value="";
  formTitle.textContent="試合を追加";
  cancelEdit.hidden=true;
}
cancelEdit.onclick=clearEdit;

resetBtn.onclick=()=>{if(confirm("追加データを削除して43試合の初期状態へ戻しますか？")){matches=structuredClone(INITIAL_MATCHES);save()}};
matchForm.onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),goals=(f.get("goals")||"").split(/\n/).map(x=>x.trim()).filter(Boolean).map(line=>{const [minute,team,scorer,assist=""]=line.split(",").map(x=>x.trim());return{minute,team,scorer,assist}});const obj={match_no:+f.get("match_no"),round:f.get("round"),date:f.get("date"),time:f.get("time"),venue:f.get("venue"),home:f.get("home"),away:f.get("away"),home_score:+f.get("home_score"),away_score:+f.get("away_score"),goals};const idx=f.get("edit_index");if(idx!==""){matches[+idx]=obj;alert("修正を保存しました")}else{matches.push(obj);alert("保存しました")}save();clearEdit();document.querySelector('[data-tab="matches"]').click()};
renderAll();
