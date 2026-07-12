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
  "IPU・環太平洋大学",
  "川崎医療福祉大学",
  "福山大学",
  "福山平成大学",
  "広島大学",
  "広島経済大学",
  "広島修道大学",
  "広島文化学園大学",
  "周南公立大学",
  "山口大学"
];

function ensureDirs() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
}

function loadJsConst(file, name) {
  const text = fs.readFileSync(file, "utf8");
  const prefix = `const ${name} = `;
  const start = text.indexOf(prefix);
  if (start < 0) throw new Error(`${file}: ${name} が見つかりません`);
  const jsonText = text.slice(start + prefix.length).trim().replace(/;\s*$/, "");
  return JSON.parse(jsonText);
}
function saveJsConst(file, name, value) {
  fs.writeFileSync(file, `const ${name} = ${JSON.stringify(value, null, 2)};\n`, "utf8");
}
function normalize(s) {
  return String(s || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function parseDate(text) {
  const m = text.match(/(20\d{2})[年\/.-]\s*(\d{1,2})[月\/.-]\s*(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
}
function parseTime(text) {
  const m = text.match(/(\d{1,2})[:時](\d{2})/);
  return m ? `${String(m[1]).padStart(2,"0")}:${m[2]}` : "13:00";
}
function parseRound(text) {
  const m = text.match(/第\s*(\d+)\s*節/);
  return m ? `第${m[1]}節` : "";
}
function extractTeams(text) {
  const found = TEAM_NAMES.filter(t => text.includes(t));
  return [...new Set(found)].slice(0, 2);
}
function parseScore(text) {
  const all = [...text.matchAll(/(?:^|\s)(\d{1,2})\s*[-－–]\s*(\d{1,2})(?:\s|$)/g)];
  if (!all.length) return null;
  const m = all[0];
  return { home_score: Number(m[1]), away_score: Number(m[2]) };
}
function scoreLike(text) {
  return /^\s*\d{1,2}\s*[-－–]\s*\d{1,2}\s*$/.test(normalize(text));
}
function parseGameId(postData) {
  if (!postData) return null;
  const params = new URLSearchParams(postData);
  return params.get("game_id");
}
function inferMatchNo(detailText) {
  const m = detailText.match(/マッチ\s*No\.?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}
function parseBasicDetail(html) {
  const $ = cheerio.load(html);
  const text = normalize($("body").text());
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

async function discoverGames(page) {
  const captured = new Map();

  page.on("request", req => {
    if (req.url().includes("pubGameResultConf.php") && req.method() === "POST") {
      const gameId = parseGameId(req.postData());
      if (gameId) captured.set(gameId, { game_id: gameId });
    }
  });

  await page.goto(SCHEDULE_URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);

  const candidates = page.locator("a,button,input[type=submit],input[type=button],td,span");
  const count = await candidates.count();
  const rows = [];

  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    let txt = "";
    try { txt = normalize(await el.innerText({ timeout: 300 })); } catch {}
    if (!scoreLike(txt)) continue;

    const contextText = await el.evaluate(node => {
      let cur = node;
      for (let n = 0; n < 6 && cur; n++, cur = cur.parentElement) {
        const t = (cur.innerText || cur.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length > 20 && t.length < 600) return t;
      }
      return (node.innerText || node.textContent || "").trim();
    });

    const teams = extractTeams(contextText);
    const score = parseScore(txt);
    if (teams.length !== 2 || !score) continue;

    let requestInfo = null;
    try {
      const reqPromise = page.waitForRequest(
        req => req.url().includes("pubGameResultConf.php") && req.method() === "POST",
        { timeout: 4000 }
      );
      await el.click({ force: true, timeout: 3000 });
      const req = await reqPromise;
      const game_id = parseGameId(req.postData());
      requestInfo = { game_id };
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(()=>{});
      if (!page.url().includes("jufa-chugoku.jp")) {
        await page.goto(SCHEDULE_URL, { waitUntil: "networkidle", timeout: 90000 });
      }
    } catch {
      // クリックできない場合でも一覧情報は保存する
    }

    rows.push({
      teams,
      ...score,
      round: parseRound(contextText),
      date: parseDate(contextText),
      time: parseTime(contextText),
      context: contextText,
      game_id: requestInfo?.game_id || null
    });
  }

  // duplicates
  return rows.filter((r, i, a) =>
    i === a.findIndex(x =>
      x.teams.join("|") === r.teams.join("|") &&
      x.date === r.date &&
      x.home_score === r.home_score &&
      x.away_score === r.away_score
    )
  );
}

async function fetchDetail(request, gameId) {
  const response = await request.post(RESULT_URL, {
    form: {
      taikai_hold_id: TAIKAI_HOLD_ID,
      fed_id: FED_ID,
      game_id: String(gameId)
    },
    timeout: 60000
  });
  if (!response.ok()) throw new Error(`game_id ${gameId}: HTTP ${response.status()}`);
  return await response.text();
}

function chooseOrientation(row, detail) {
  if (detail.teams.length === 2) return detail.teams;
  return row.teams;
}

function upsertBasicMatch(matches, row, detail) {
  const matchNo = detail.match_no;
  if (!matchNo) return { changed: false, reason: "match_no不明" };
  const teams = chooseOrientation(row, detail);
  if (teams.length !== 2) return { changed: false, reason: "チーム不明" };
  const score = detail.score || { home_score: row.home_score, away_score: row.away_score };
  const idx = matches.findIndex(m => Number(m.match_no) === matchNo);
  const old = idx >= 0 ? matches[idx] : null;
  const updated = {
    ...(old || {}),
    match_no: matchNo,
    round: detail.round || row.round || old?.round || "",
    date: detail.date || row.date || old?.date || "",
    time: detail.time || row.time || old?.time || "13:00",
    venue: old?.venue || "",
    home: teams[0],
    away: teams[1],
    home_score: score.home_score,
    away_score: score.away_score,
    goals: old?.goals || [],
    game_id: row.game_id ? Number(row.game_id) : old?.game_id
  };
  const changed = JSON.stringify(old) !== JSON.stringify(updated);
  if (idx >= 0) matches[idx] = updated;
  else matches.push(updated);
  return { changed, match_no: matchNo };
}

async function main() {
  ensureDirs();
  const matches = loadJsConst(DATA_FILE, "INITIAL_MATCHES");
  const details = fs.existsSync(DETAILS_FILE)
    ? loadJsConst(DETAILS_FILE, "MATCH_DETAILS")
    : {};
  const state = fs.existsSync(STATE_FILE)
    ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))
    : { games: {} };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();

  console.log("大会ページを確認中...");
  const discovered = await discoverGames(page);
  console.log(`結果リンク候補: ${discovered.length}件`);

  let changes = 0;
  const errors = [];

  for (const row of discovered) {
    if (!row.game_id) continue;
    try {
      const html = await fetchDetail(context.request, row.game_id);
      const rawPath = path.join(RAW_DIR, `${row.game_id}.html`);
      fs.writeFileSync(rawPath, html, "utf8");
      const detail = parseBasicDetail(html);
      const result = upsertBasicMatch(matches, row, detail);
      if (result.changed) changes++;
      state.games[row.game_id] = {
        game_id: row.game_id,
        match_no: detail.match_no,
        last_seen: new Date().toISOString(),
        teams: detail.teams.length ? detail.teams : row.teams,
        score: detail.score || {home_score: row.home_score, away_score: row.away_score}
      };
    } catch (err) {
      errors.push({ game_id: row.game_id, error: String(err) });
    }
  }

  matches.sort((a,b)=>Number(a.match_no)-Number(b.match_no));
  saveJsConst(DATA_FILE, "INITIAL_MATCHES", matches);
  saveJsConst(DETAILS_FILE, "MATCH_DETAILS", details);
  state.last_run = new Date().toISOString();
  state.discovered_count = discovered.length;
  state.changed_count = changes;
  state.errors = errors;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)+"\n", "utf8");

  await browser.close();
  console.log(`更新件数: ${changes}`);
  if (errors.length) console.warn(`エラー: ${errors.length}件`);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
