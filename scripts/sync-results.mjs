import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import * as cheerio from "cheerio";

const ROOT = process.cwd();
const SCHEDULE_URL = "https://jufa-chugoku.jp/result/2026/tid_558/";
const RESULT_URL = "https://football-system.jp/fss/pubGameResultConf.php";
const TAIKAI_HOLD_ID = "558";
const FED_ID = "15";
const DATA_FILE = path.join(ROOT, "data.js");
const DETAILS_FILE = path.join(ROOT, "details.js");
const STATE_FILE = path.join(ROOT, "data", "sync-state.json");
const RAW_DIR = path.join(ROOT, "data", "raw-results");

const TEAM_NAMES = [
  "IPU・環太平洋大学","川崎医療福祉大学","福山大学","福山平成大学",
  "広島大学","広島経済大学","広島修道大学","広島文化学園大学",
  "周南公立大学","山口大学"
];

function ensureDirs() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
}
function loadJsConst(file, name) {
  const text = fs.readFileSync(file, "utf8");
  const prefix = `const ${name} = `;
  const start = text.indexOf(prefix);
  if (start < 0) throw new Error(`${name} が見つかりません: ${file}`);
  return JSON.parse(text.slice(start + prefix.length).trim().replace(/;\s*$/, ""));
}
function saveJsConst(file, name, value) {
  fs.writeFileSync(file, `const ${name} = ${JSON.stringify(value, null, 2)};\n`, "utf8");
}
const norm = s => String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const unique = arr => [...new Set(arr)];

function parseDate(text) {
  const m = norm(text).match(/(20\d{2})[年\/.-]\s*(\d{1,2})[月\/.-]\s*(\d{1,2})/);
  return m ? `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}` : "";
}
function parseTime(text) {
  const m = norm(text).match(/(\d{1,2})[:時](\d{2})/);
  return m ? `${String(m[1]).padStart(2,"0")}:${m[2]}` : "";
}
function parseRound(text) {
  const m = norm(text).match(/第\s*(\d+)\s*節/);
  return m ? `第${m[1]}節` : "";
}
function parseScore(text) {
  const m = norm(text).match(/(?:^|\s)(\d{1,2})\s*[-－–]\s*(\d{1,2})(?:\s|$)/);
  return m ? { home_score:Number(m[1]), away_score:Number(m[2]) } : null;
}
function extractTeams(text) {
  return unique(TEAM_NAMES.filter(t => norm(text).includes(t))).slice(0,2);
}
function parseGameId(postData) {
  if (!postData) return null;
  return new URLSearchParams(postData).get("game_id");
}
function inferMatchNo(text) {
  const m = norm(text).match(/マッチ\s*No\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}
function parseBasicDetail(html) {
  const $ = cheerio.load(html);
  const text = norm($("body").text());
  return {
    text,
    match_no: inferMatchNo(text),
    round: parseRound(text),
    date: parseDate(text),
    time: parseTime(text),
    teams: extractTeams(text),
    score: parseScore(text)
  };
}

async function collectFormCandidates(frame) {
  return await frame.evaluate(({teams}) => {
    const clean = s => String(s || "").replace(/\s+/g," ").trim();
    const result = [];
    for (const form of document.querySelectorAll("form")) {
      const action = form.getAttribute("action") || "";
      const inputs = Object.fromEntries(
        [...form.querySelectorAll("input[name]")].map(i => [i.name, i.value])
      );
      if (!action.includes("pubGameResultConf.php") && !inputs.game_id) continue;
      let parent = form;
      let context = "";
      for (let i=0;i<6 && parent;i++,parent=parent.parentElement) {
        const t = clean(parent.innerText || parent.textContent);
        if (t.length > 20 && t.length < 1000) { context=t; break; }
      }
      const foundTeams = teams.filter(t => context.includes(t));
      const scoreText = clean(form.innerText || form.textContent);
      result.push({
        game_id: inputs.game_id || null,
        taikai_hold_id: inputs.taikai_hold_id || null,
        fed_id: inputs.fed_id || null,
        context,
        scoreText,
        teams: [...new Set(foundTeams)].slice(0,2)
      });
    }
    return result;
  }, {teams: TEAM_NAMES});
}

async function collectClickableCandidates(frame) {
  return await frame.evaluate(({teams}) => {
    const clean = s => String(s || "").replace(/\s+/g," ").trim();
    const scoreLike = s => /^\d{1,2}\s*[-－–]\s*\d{1,2}$/.test(clean(s));
    const found = [];
    for (const node of document.querySelectorAll("a,button,input[type=submit],input[type=button]")) {
      const label = clean(node.innerText || node.value || node.textContent);
      if (!scoreLike(label)) continue;
      let parent=node, context="";
      for(let i=0;i<6 && parent;i++,parent=parent.parentElement){
        const t=clean(parent.innerText || parent.textContent);
        if(t.length>20 && t.length<1000){context=t;break;}
      }
      const foundTeams=teams.filter(t=>context.includes(t));
      found.push({label,context,teams:[...new Set(foundTeams)].slice(0,2)});
    }
    return found;
  }, {teams: TEAM_NAMES});
}

async function discoverGames(page) {
  const games = new Map();
  const captured = new Map();

  page.on("request", req => {
    if (req.url().includes("pubGameResultConf.php") && req.method() === "POST") {
      const gameId = parseGameId(req.postData());
      if (gameId) captured.set(gameId, { game_id: gameId });
    }
  });

  await page.goto(SCHEDULE_URL, { waitUntil:"networkidle", timeout:90000 });
  await page.waitForTimeout(3000);

  const frames = page.frames();
  console.log(`frames: ${frames.length}`);

  // First choice: inspect forms directly. This avoids clicking every score.
  for (const frame of frames) {
    try {
      const forms = await collectFormCandidates(frame);
      for (const f of forms) {
        if (!f.game_id) continue;
        const score = parseScore(f.scoreText) || parseScore(f.context);
        const teams = f.teams.length === 2 ? f.teams : extractTeams(f.context);
        games.set(String(f.game_id), {
          game_id:String(f.game_id),
          teams,
          score,
          round:parseRound(f.context),
          date:parseDate(f.context),
          time:parseTime(f.context),
          context:f.context
        });
      }
    } catch (e) {
      console.warn("form scan skipped:", frame.url(), String(e));
    }
  }

  // Fallback: click score buttons in every frame and capture POST.
  if (games.size === 0) {
    for (const frame of frames) {
      let items = [];
      try { items = await collectClickableCandidates(frame); } catch { continue; }
      for (const item of items) {
        const locator = frame.getByText(item.label, { exact:true }).first();
        try {
          const reqPromise = page.waitForRequest(
            req => req.url().includes("pubGameResultConf.php") && req.method()==="POST",
            { timeout:5000 }
          );
          await locator.click({ force:true, timeout:3000 });
          const req = await reqPromise;
          const gameId = parseGameId(req.postData());
          if (gameId) games.set(String(gameId), {
            game_id:String(gameId),
            teams:item.teams,
            score:parseScore(item.label),
            round:parseRound(item.context),
            date:parseDate(item.context),
            time:parseTime(item.context),
            context:item.context
          });
          await page.goBack({ waitUntil:"domcontentloaded", timeout:15000 }).catch(()=>{});
          if (!page.url().includes("jufa-chugoku.jp")) {
            await page.goto(SCHEDULE_URL,{waitUntil:"networkidle",timeout:90000});
            await page.waitForTimeout(1500);
          }
        } catch (e) {
          console.warn("click skipped:", item.label, String(e));
        }
      }
    }
  }

  return [...games.values()];
}

async function fetchDetail(request, gameId) {
  const res = await request.post(RESULT_URL, {
    form: { taikai_hold_id:TAIKAI_HOLD_ID, fed_id:FED_ID, game_id:String(gameId) },
    headers: {
      "Referer": SCHEDULE_URL,
      "Origin": "https://football-system.jp"
    },
    timeout:60000
  });
  if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
  return await res.text();
}

function upsertBasicMatch(matches,row,detail) {
  const matchNo = detail.match_no;
  const teams = detail.teams.length===2 ? detail.teams : row.teams;
  const score = detail.score || row.score;
  if (!matchNo || !score || teams.length!==2) return {changed:false, reason:"必要情報不足"};
  const i = matches.findIndex(m=>Number(m.match_no)===Number(matchNo));
  const old = i>=0 ? matches[i] : null;
  const next = {
    ...(old||{}),
    match_no:Number(matchNo),
    round:detail.round||row.round||old?.round||"",
    date:detail.date||row.date||old?.date||"",
    time:detail.time||row.time||old?.time||"13:00",
    venue:old?.venue||"",
    home:teams[0], away:teams[1],
    home_score:score.home_score, away_score:score.away_score,
    goals:old?.goals||[],
    game_id:Number(row.game_id)
  };
  const changed = JSON.stringify(old)!==JSON.stringify(next);
  if(i>=0) matches[i]=next; else matches.push(next);
  return {changed, match_no:matchNo};
}

async function main() {
  ensureDirs();
  const matches = loadJsConst(DATA_FILE,"INITIAL_MATCHES");
  const details = fs.existsSync(DETAILS_FILE) ? loadJsConst(DETAILS_FILE,"MATCH_DETAILS") : {};
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE,"utf8"))
    : {games:{}};

  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({locale:"ja-JP"});
  const page = await context.newPage();

  let discovered = [], changed = 0, errors = [];
  try {
    discovered = await discoverGames(page);
    console.log(`discovered: ${discovered.length}`);
    for (const row of discovered) {
      try {
        const html = await fetchDetail(context.request,row.game_id);
        fs.writeFileSync(path.join(RAW_DIR,`${row.game_id}.html`),html,"utf8");
        const detail = parseBasicDetail(html);
        const result = upsertBasicMatch(matches,row,detail);
        if(result.changed) changed++;
        state.games[row.game_id]={
          game_id:row.game_id,
          match_no:detail.match_no,
          teams:detail.teams.length?detail.teams:row.teams,
          score:detail.score||row.score,
          last_seen:new Date().toISOString()
        };
      } catch(e) {
        errors.push({game_id:row.game_id,error:String(e)});
      }
    }
  } finally {
    await browser.close();
  }

  matches.sort((a,b)=>Number(a.match_no)-Number(b.match_no));
  saveJsConst(DATA_FILE,"INITIAL_MATCHES",matches);
  saveJsConst(DETAILS_FILE,"MATCH_DETAILS",details);

  state.last_run=new Date().toISOString();
  state.discovered_count=discovered.length;
  state.changed_count=changed;
  state.errors=errors;
  fs.writeFileSync(STATE_FILE,JSON.stringify(state,null,2)+"\n","utf8");

  console.log(`changed: ${changed}, errors: ${errors.length}`);
  if(discovered.length===0) process.exitCode=2;
}
main().catch(e=>{console.error(e);process.exit(1)});
