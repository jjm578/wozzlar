/* =========================
   FEEDBACK FORM (NEW)
   Paste your Google Form URL here:
   ========================= */
const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeHq5VUwQRSPOqBnLSt01ojhJxIEnkwKE7H67PF7c8s_K3xcg/viewform?usp=dialog";
const CONTACT_FORM_URL = "https://forms.gle/UC32x2DhvXU3Xgd27";

/* ===== Manifest so A2HS uses favicon.ico ===== */
(function(){
  try{
    const manifest = {
      name: "Wozzlar",
      short_name: "Wozzlar",
      start_url: ".",
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
      icons: [
        {"src":"favicon.ico","sizes":"48x48 72x72 96x96 128x128 192x192 256x256 384x384 512x512","type":"image/x-icon","purpose":"any"}
      ]
    };
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest));
    document.head.appendChild(link);
  }catch{}
})();

/* ===== NEW: Day/Night mode (day = before 6pm, night = 6pm+) ===== */
(function(){
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  function applyDayNight(){
    const h = new Date().getHours();
    const isNight = (h >= 18); /* after 6pm */
    document.body.classList.toggle('night', isNight);
    document.body.classList.toggle('day', !isNight);
    if(themeMeta){
      themeMeta.setAttribute('content', isNight ? '#000000' : '#ffffff');
    }
  }
  window.addEventListener('DOMContentLoaded', ()=>{
    applyDayNight();
    setInterval(applyDayNight, 5 * 60 * 1000);
  });
})();

/* ===== Google Sheets puzzle sources (NEW) ===== */
const DAILY_CSV_URL = "https://docs.google.com/spreadsheets/d/1M3C3PeE0bMkIceaYNFqOv0WvJk5wb1lF4cGR6VLTWa8/export?format=csv&gid=0";
const PRACTICE_CSV_URL = "https://docs.google.com/spreadsheets/d/1M3C3PeE0bMkIceaYNFqOv0WvJk5wb1lF4cGR6VLTWa8/export?format=csv&gid=1983707566";

function formatLocalYMD(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

/* Robust-ish CSV parsing (handles quotes, commas inside quotes) */
function parseCSV(text){
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const next = text[i+1];
    if(ch === '"'){
      if(inQuotes && next === '"'){ cell += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if(ch === ',' && !inQuotes){
      row.push(cell); cell = '';
    } else if((ch === '\n' || ch === '\r') && !inQuotes){
      if(ch === '\r' && next === '\n'){ i++; }
      row.push(cell);
      const trimmed = row.map(v => (v ?? '').trim());
      if(trimmed.some(v => v !== '')) rows.push(trimmed);
      row = []; cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  const trimmed = row.map(v => (v ?? '').trim());
  if(trimmed.some(v => v !== '')) rows.push(trimmed);
  return rows;
}

function phraseToWords(phrase){
  const raw = String(phrase || '').trim().replace(/\s+/g,' ');
  if(!raw) return ["WOZZLAR"]; /* ultra fallback */
  return raw
    .split(' ')
    .map(w => w.toUpperCase().replace(/[^A-Z]/g,'')) /* keep your A–Z logic stable */
    .filter(Boolean);
}

async function fetchCSVRows(url, cacheKey){
  const cached = sessionStorage.getItem(cacheKey);
  if(cached){
    try{
      const parsed = JSON.parse(cached);
      if(Array.isArray(parsed) && parsed.length) return parsed;
    }catch{}
  }
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error("Fetch failed: " + res.status);
  const text = await res.text();
  const rows = parseCSV(text);
  sessionStorage.setItem(cacheKey, JSON.stringify(rows));
  return rows;
}

// NEW: always fetch fresh (no sessionStorage) for DAILY
async function fetchCSVRowsFresh(url){
  const busted = url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  const res = await fetch(busted, { cache: "no-store" });
  if(!res.ok) throw new Error("Fetch failed: " + res.status);
  const text = await res.text();
  return parseCSV(text);
}

async function getDailyPuzzleFromSheet(){
  const rows = await fetchCSVRowsFresh(DAILY_CSV_URL);
  if(!rows || rows.length < 2) throw new Error("Daily CSV has no data rows.");
  // rows[0] = header, rows[1..] = data
  const today = formatLocalYMD(new Date());
  const header = rows[0].map(h => (h||'').toLowerCase());
  const idxDate = header.indexOf('date');
  const idxNum = header.indexOf('puzzlenumber');
  const idxTheme = header.indexOf('theme');
  const idxPhrase = header.indexOf('phrase');

  // Fallback to known positions if headers are missing
  const iDate = idxDate !== -1 ? idxDate : 0;
  const iNum = idxNum !== -1 ? idxNum : 1;
  const iTheme = idxTheme !== -1 ? idxTheme : 2;
  const iPhrase = idxPhrase !== -1 ? idxPhrase : 3;

  const data = rows.slice(1);
  const found = data.find(r => String(r[iDate]||'').trim() === today);
  if(!found) throw new Error("No daily row found for " + today);

  const puzzleNumber = parseInt(String(found[iNum]||'').trim(), 10);
  const theme = String(found[iTheme]||'').trim() || "Daily";
  const phrase = String(found[iPhrase]||'').trim();

  const words = phraseToWords(phrase);
  return { theme, words, puzzleNumber: Number.isFinite(puzzleNumber) ? puzzleNumber : null, date: today };
}

async function getRandomPracticePuzzleFromSheet(){
  const rows = await fetchCSVRows(PRACTICE_CSV_URL, "wozzlar_practice_csv_rows_v1");
  if(!rows || rows.length < 2) throw new Error("Practice CSV has no data rows.");
  const header = rows[0].map(h => (h||'').toLowerCase());
  const idxTheme = header.indexOf('theme');
  const idxPhrase = header.indexOf('phrase');

  const iTheme = idxTheme !== -1 ? idxTheme : 0;
  const iPhrase = idxPhrase !== -1 ? idxPhrase : 1;

  const data = rows.slice(1).filter(r => (r[iPhrase]||'').trim() !== '');
  if(!data.length) throw new Error("Practice CSV has no usable rows.");

  const pick = data[Math.floor(Math.random()*data.length)];
  const theme = String(pick[iTheme]||'').trim() || "Practice";
  const phrase = String(pick[iPhrase]||'').trim();
  const words = phraseToWords(phrase);
  return { theme, words };
}

/* ===== Core setup ===== */
const PUZZLES = [
  { theme: "Movie Quotes", words: ["MAY","THE","FORCE","BE","WITH","YOU"] },
  { theme: "Idioms",       words: ["PIECE","OF","CAKE"] },
  { theme: "Travel",       words: ["PACK","YOUR","BAGS"] },
  { theme: "Sports",       words: ["CONNOR","MCDAVID"] },
  { theme: "Foodie",       words: ["HOT","DOG","EATING","CONTEST"] },
  { theme: "Pop Music",    words: ["SHAKE","IT","OFF"] },
  { theme: "Game Night",   words: ["ROYAL","FLUSH"] },
  { theme: "Song Names",     words: ["SMELLS","LIKE","TEEN","SPIRIT"] },
  { theme: "90s Animation", words: ["A","GOOFY","MOVIE"] },
  { theme: "Travel",    words: ["TAKING","THE","TRAIN","TO","ALBERTA"] },
  { theme: "Expressions - Time",      words: ["BETTER","LATE","THAN","NEVER"] },
  { theme: "Aerial Wildlife",     words: ["FLYING","SQUIRREL"] },
  { theme: "Coffee Break",  words: ["MORNING","CUP","OF","JOE"] },
  { theme: "Work Expressions",  words: ["BACK","TO","THE","GRIND"] },
  { theme: "Movie Quotes - Jim Carrey", words: ["SHIKAKA"] },
  { theme: "Person",       words: ["DAN","THOMAS"] },
  { theme: "Landmarks",     words: ["STATUE","OF","LIBERTY"] },
  { theme: "Expressions - Romance",  words: ["LOVE","AT","FIRST","SIGHT"] },
  { theme: "Events", words: ["MOVIE","DEBUT"] },
  { theme: "Positive Advice ", words: ["LOOK", "ON", "THE", "BRIGHT", "SIDE"] },
  { theme: "Famous Quotes",     words: ["JUST","DO","IT"] },
  { theme: "Before and After",     words: ["COUCH","POTATO","SALAD"] },
  { theme: "Characters", words: ["YODA"] },
  { theme: "Movie Quotes - Jim Carrey", words: ["YOUR","BALLS","ARE","SHOWING"] },
  { theme: "Expressions - Business",     words: ["TIME","IS","MONEY"] },
  { theme: "Song Names", words: ["UNDER","THE","BRIDGE"] },
  { theme: "Food and Drink",       words: ["BIG","MAC"] },
  { theme: "Movie Quotes", words: ["SHOW","ME","THE","MONEY"] },
  { theme: "On the Map", words: ["NORTH","KOREA"] },
  { theme: "Music", words: ["HIT", "ME", "BABY", "ONE", "MORE", "TIME"] },
  { theme: "Around the House", words: ["DINING","ROOM","TABLE"] },
  { theme: "Person", words: ["SELENA","GOMEZ"] },
  { theme: "Lifestyle", words: ["TAKE", "THE", "DOG", "FOR", "A", "WALK"] },
  { theme: "Get Out of Here",        words: ["HIT","THE","ROAD"] },
  { theme: "Expressions - Adventure",  words: ["OFF","THE","BEATEN","PATH"] },
  { theme: "Magic", words: ["ABRA","CADABRA"] },
  { theme: "Before and After",     words: ["FAMILY","TREE","HOUSE"] },
  { theme: "TV Quotes", words: ["LIVE","LONG","AND","PROSPER"] },
  { theme: "Animals", words: ["POLAR","BEAR"] },
  { theme: "Landmarks", words: ["THE","EIFFEL","TOWER"] },
  { theme: "Expressions - Fitness",      words: ["NO","PAIN","NO","GAIN"] },
  { theme: "TV Quote", words: ["WINTER","IS","COMING"] },
  { theme: "Food and Drink", words: ["SPICY","RAMEN"] },
  { theme: "Before and After",     words: ["BOOK","CLUB","SODA"] },
  { theme: "Gym Class", words: ["DROP","AND","GIVE","ME","TEN"] },
  { theme: "Mission Failure", words: ["LOST","IN","SPACE"] },
  { theme: "Person", words: ["TAYLOR","SWIFT"] },
  { theme: "Song Names", words: ["HERE","COMES","THE","SUN"] },
  { theme: "Sleepover", words: ["TRUTH","OR","DARE"] },
  { theme: "Holiday", words: ["RING", "IN", "THE", "NEW", "YEAR"] },
  { theme: "Landmarks", words: ["TAJ","MAHAL"] },
  { theme: "TV Quotes", words: ["NO","SOUP","FOR","YOU"] },
  { theme: "Around the House", words: ["KITCHEN","PANTRY"] },
  { theme: "Inspirational Sayings", words: ["LOOK","FOR","THE","SILVER","LINING"] },
  { theme: "Food and Drink", words: ["TACOS","AND","SALSA"] },
  { theme: "Wildlife", words: ["BALD","EAGLE"] },
  { theme: "Before and After",     words: ["NIGHT","LIFE","GUARD"] },
  { theme: "Person", words: ["ELON","MUSK"] },
  { theme: "Best Sellers", words: ["GREEN","EGGS","AND","HAM"] },
  { theme: "Snacks", words: ["COOL","RANCH","CHIPS"] },
  { theme: "Lyrics", words: ["I", "WANT", "IT", "THAT", "WAY"] },
  { theme: "Movie Quote", words: ["HAKUNA","MATATA"] },
  { theme: "Places", words: ["THE", "CITY", "THAT", "NEVER", "SLEEPS"] },
];

const PRACTICE_PUZZLES = [
  { theme: "Breakfast",  words: ["PANCAKES","AND","SYRUP"] },
  { theme: "Wildlife", words: ["BLACK","BEETLE"] },
  { theme: "Success",  words: ["DREAM","BIG"] },
  { theme: "Morning Routine",  words: ["RISE","AND","SHINE"] },
  { theme: "City Life",  words: ["HUSTLE","AND","BUSTLE"] },
  { theme: "Expression",  words: ["CALM","BEFORE","THE","STORM"] },
  { theme: "Games",  words: ["ROLL","THE","DICE"] },
  { theme: "Expressions - Seasons",  words: ["FALL","INTO","AUTUMN"] },
  { theme: "Technology",  words: ["STAY","CONNECTED"] },
  { theme: "Cooking",  words: ["SLICE","AND","DICE"] },
  { theme: "Ocean",  words: ["SAIL","THE","SEVEN","SEAS"] },
  { theme: "Humor",  words: ["PUN","INTENDED"] },
  { theme: "Friendship",  words: ["THICK","AND","THIN"] },
  { theme: "Music",  words: ["ROCK","AND","ROLL"] },
  { theme: "Expressions",  words: ["HOLD","YOUR","HORSES"] },
  { theme: "Reset",  words: ["SPILL","THE","BEANS"] },
  { theme: "Tech",       words: ["NEW","FEATURE","DROP"] },
  { theme: "Weather",    words: ["LET","IT","SNOW"] },
  { theme: "Sports",     words: ["HAT","TRICK","HERO"] },
  { theme: "Movie Quotes",     words: ["SHOW","ME","THE","MONEY"] },
  { theme: "Expressions - Animals",    words: ["CURIOUS","CAT"] },
  { theme: "Travel",     words: ["WHEELS","UP"] },
  { theme: "Books",      words: ["READY","PLAYER","ONE"] },
  { theme: "Coffee",     words: ["FRESH","GROUND","BEANS"] },
  { theme: "Movie Quotes", words: ["SHOW","ME","THE","MONEY"] },
  { theme: "Expressions", words: ["BREAK","THE","ICE"] },
  { theme: "Expressions - Travel", words: ["HIT","THE","OPEN","ROAD"] },
  { theme: "Sports", words: ["SLAP","SHOT"] },
  { theme: "Pop Music", words: ["CALL","ME","MAYBE"] },
  { theme: "Game Night", words: ["HIDE","AND","SEEK"] },
  { theme: "Expressions - Romance", words: ["HEAD","OVER","HEELS"] },
  { theme: "Expression", words: ["BITE","THE","BULLET"] },
  { theme: "Pop Music", words: ["BAD","BLOOD"] },
  { theme: "Song Names", words: ["LET","IT","BE"] },
  { theme: "Expressions - Life", words: ["LIVE","AND","LEARN"] },
  { theme: "Travel", words: ["PARK","THE","CAMPER"] },
  { theme: "Expression", words: ["HIT","THE","SACK"] },
  { theme: "Song Names", words: ["BACK","IN","BLACK"] },
  { theme: "Fitness", words: ["LIFT","AND","SQUAT"] },
  { theme: "Expressions - Nature", words: ["UNDER","THE","STARS"] },
  { theme: "Adventure", words: ["FOLLOW","THE","MAP"] },
  { theme: "Characters (Fictional)", words: ["HARRY","POTTER"] },
  { theme: "Characters (Fictional)", words: ["NED","STARK"] },
  { theme: "Person (Real People)", words: ["BRUNO","MARS"] },
  { theme: "Person (Real People)", words: ["EMMA","WATSON"] },
  { theme: "Characters (Fictional)", words: ["SHREK"] },
  { theme: "Best Sellers", words: ["THE","SILENT","WIFE"] },
  { theme: "Best Sellers", words: ["WHERE","THE","CROWD","SANG"] },
  { theme: "Headline", words: ["LOCAL","TEAM","WINS"] },
  { theme: "Travel", words: ["SNOWING","IN","JAPAN"] },
  { theme: "Pop Music", words: ["SHAKE","IT","OFF"] },
  { theme: "Sports Idioms", words: ["OUT","OF","LEFT","FIELD"] },
  { theme: "Geography", words: ["SOUTH","OF","FRANCE"] },
  { theme: "Space", words: ["HOUSTON","WE","HAVE","A","PROBLEM"] },
  { theme: "Wellness", words: ["COLD","PLUNGE"] },
  { theme: "Beach Life", words: ["RIDE","THE","WAVE"] },
  { theme: "Movie Night", words: ["GRAB","SOME","POPCORN"] },
  { theme: "Nature Idioms", words: ["BIRDS","OF","A","FEATHER"] },
  { theme: "Movies", words: ["BACK","TO","THE","FUTURE"] },
  { theme: "Good Morning", words: ["RISE","AND","SHINE"] },
  { theme: "Rainy Day", words: ["STAY","IN","BED"] },
  { theme: "Fresh Air", words: ["OPEN","THE","WINDOW"] },
  { theme: "Cozy Cabin", words: ["LIGHT","THE","FIRE"] },
  { theme: "Summer Breakfast", words: ["SUNNY","SIDE","UP"] },
  { theme: "Music Games", words: ["NAME","THAT","TUNE"] },
  { theme: "Old Sayings", words: ["TIME","WILL","TELL"] },
  { theme: "Classic Sayings", words: ["LOOK","BOTH","WAYS"] },
  { theme: "Pirate Talk", words: ["SWAB","THE","DECK"] },
  { theme: "Holiday", words: ["WRAP", "THE", "GIFTS", "FOR", "THE", "KIDS"] },
  { theme: "Holiday", words: ["WARM", "UP", "WITH", "HOT", "COCOA"] },
];

/* Kept: old anchor-based numbering as fallback only */
const START_ANCHOR = new Date(2025, 10, 3);
const now = new Date();
const daysSince = Math.floor(
  (Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) -
   Date.UTC(START_ANCHOR.getFullYear(),START_ANCHOR.getMonth(),START_ANCHOR.getDate())) / 86400000
);
const dailyIndex = ((daysSince % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
const dailyPuzzleNumberFallback = daysSince + 1;

const phraseEl  = document.getElementById('phrase');
const kbEl      = document.getElementById('kb');
const themeEl   = document.getElementById('theme-text');
const hintEl    = document.getElementById('hint');

const shareButton = document.getElementById('shareButton');

const modalEl    = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalMsg   = document.getElementById('modalMsg');
const modalMeta  = document.getElementById('modalMeta');
const shareWrap  = document.getElementById('shareWrap');
const sharePre   = document.getElementById('sharePre');
const modalClose = document.getElementById('modalClose');
const modalShare = document.getElementById('modalShare');
const modalPrimary = document.getElementById('modalPrimary');
const shareVisual= document.getElementById('shareVisual');
const stackTitle = document.getElementById('stackTitle');
const streakLine = document.getElementById('streakLine');
const modalCustom= document.getElementById('modalCustom');

const btnPractice= document.getElementById('btnPractice');
const brandBtn   = document.getElementById('brandBtn');
const hamburger  = document.getElementById('hamburger');
const menu       = document.getElementById('menu');
const feedbackLink = document.getElementById('feedbackLink');
const howToPlayLink = document.getElementById('howToPlayLink');
const a2hsLink   = document.getElementById('a2hsLink');
const contactLink = document.getElementById('contactLink');

const wozzBadge  = document.getElementById('wozzBadge');
const superBadge = document.getElementById('superBadge');
const wompBadge  = document.getElementById('wompBadge');

const BRAND_LETTERS = ['bW','bO','bZ1','bZ2','bL','bA','bR'].map(id => document.getElementById(id));

const KEY_ROWS = ["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];

const TOTAL_GUESS_LIMIT = 7;

function setBadge(which){
  wozzBadge.classList.remove('show');
  superBadge.classList.remove('show');
  wompBadge.classList.remove('show');
  if(which === 'wozzlar'){ wozzBadge.classList.add('show'); }
  if(which === 'superwomp'){ superBadge.classList.add('show'); }
  if(which === 'womp'){ wompBadge.classList.add('show'); }
}

/* ===== Persistence helpers ===== */
function todayKey(){
  const d = new Date();
  const y = d.getFullYear(), m = (d.getMonth()+1).toString().padStart(2,'0'), day = d.getDate().toString().padStart(2,'0');
  return `wozzlar_daily_${y}-${m}-${day}`;
}
function saveDailyState(){
  if(state.isPractice) return;
  const payload = {
    puzzleNumber: currentPuzzleNumber(),
    words: state.words,
    theme: state.theme,
    solvedWord: state.solvedWord,
    active: state.active,
    caret: state.caret,
    inPhrase: Array.from(state.inPhrase),
    locks: state.locks,
    entries: state.entries,
    keyState: state.keyState,
    guessCount: state.guessCount,
    history: state.history,
    flowIndex: state.flowIndex,
    mode: state.mode,
    wompShown: state.wompShown,
    failedAllIn: state.failedAllIn || false,
    persistentNear: state.persistentNear
  };
  try{ localStorage.setItem(todayKey(), JSON.stringify(payload)); }catch{}
}
function loadDailyStateIfAny(){
  try{
    const raw = localStorage.getItem(todayKey());
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s) return false;
    state.words = s.words;
    state.theme = s.theme;
    state.solvedWord = s.solvedWord;
    state.active = s.active;
    state.caret = s.caret;
    state.inPhrase = new Set(s.inPhrase || []);
    state.locks = s.locks;
    state.entries = s.entries;
    state.keyState = s.keyState || {};
    state.guessCount = s.guessCount || 0;
    state.history = s.history || [];
    state.flowIndex = s.flowIndex || state.words.map(()=>0);
    state.mode = s.mode || 'normal';
    state.wompShown = !!s.wompShown;
    state.failedAllIn = !!s.failedAllIn;
    state.persistentNear = s.persistentNear || state.words.map(w => Array.from({length:w.length},()=>false));
    return true;
  }catch{ return false; }
}

/* baseState now carries puzzleNumber (NEW, minimal) */
const baseState = (puz, numberLabel, puzzleNumber=null) => ({
  words: puz.words.map(w=>w.toUpperCase()),
  solvedWord: [],
  active: 0,
  caret: 0,
  inPhrase: new Set(),
  locks: [],
  entries: [],
  keyEls: {},
  keyState: {},
  theme: puz.theme,
  mode: 'normal',
  guessCount: 0,
  solveIndex: 0,
  history: [],
  wordsContaining: {},
  flowIndex: [],
  wompShown: false,
  failedAllIn: false,
  numberLabel: numberLabel,
  isPractice: numberLabel === 'Practice',
  puzzleNumber: puzzleNumber, /* NEW */
  persistentNear: puz.words.map(w => Array.from({length:w.length},()=>false))
});

/* Start with fallback daily until sheet loads */
let state = baseState(PUZZLES[dailyIndex], "Daily #" + dailyPuzzleNumberFallback, dailyPuzzleNumberFallback);

state.words.forEach((w, wi) => {
  w.split('').forEach(c => {
    if(/[A-Z]/.test(c)){
      state.inPhrase.add(c);
      (state.wordsContaining[c] ||= new Set()).add(wi);
    }
  });
});
state.solvedWord = state.words.map(()=> false);
state.locks  = state.words.map(w => Array.from({length:w.length}, ()=> null));
state.entries= state.words.map(w => Array.from({length:w.length}, ()=> ''));
state.flowIndex = state.words.map(()=>0);

function totalSolveLength(){ return state.words.reduce((t,w,i)=> t + w.length + (i<state.words.length-1?1:0), 0); }
function solveIndexToPos(si){
  let acc = 0;
  for(let wi=0; wi<state.words.length; wi++){
    const wlen = state.words[wi].length;
    if(si < acc + wlen){ return { wi, pos: si - acc, space:false }; }
    acc += wlen;
    if(wi < state.words.length-1){
      if(si === acc) return { wi, pos:-1, space:true };
      acc += 1;
    }
  }
  return { wi: state.words.length-1, pos: state.words[state.words.length-1].length-1, space:false };
}
function stepRightSkippingSpace(){
  const total = totalSolveLength();
  if(state.solveIndex >= total - 1) return;
  do { state.solveIndex++; } while(solveIndexToPos(state.solveIndex).space && state.solveIndex < total - 1);
}
function stepLeftSkippingSpace(){
  if(state.solveIndex <= 0) return;
  do { state.solveIndex--; } while(solveIndexToPos(state.solveIndex).space && state.solveIndex > 0);
}

function isLocked(wi,pos){ return state.locks[wi][pos] !== null; }

function buildPhrase(){
  phraseEl.innerHTML = "";
  state.words.forEach((w, i) => {
    const row = document.createElement('div');
    row.className = "word-row";
    row.dataset.row = i;
    row.setAttribute('role','button');
    row.setAttribute('tabindex','0');
    row.setAttribute('aria-label', `Word ${i+1} of ${state.words.length}, ${w.length} letters`);

    const left = document.createElement('div'); left.className = 'side-tags left'; left.id = `tags-left-${i}`;
    row.appendChild(left);

    for(let j=0;j<w.length;j++){
      const tile = document.createElement('div');
      tile.className = "tile";
      tile.dataset.pos = j;

      const chSpan = document.createElement('span');
      chSpan.className = 'char';
      tile.appendChild(chSpan);

      tile.addEventListener('click', (ev)=>{
        const wi = parseInt(row.dataset.row,10);
        if(state.mode !== 'normal') return;
        if(state.active !== wi){ setActive(wi); return; }
        state.flowIndex[wi] = j;
        updateNormalCaretHighlight();
      });
      row.appendChild(tile);
    }

    row.addEventListener('click', (e)=>{ if(state.active !== i) setActive(i); });
    row.addEventListener('touchstart', ()=>{ if(state.active !== i) setActive(i); }, {passive:true});
    phraseEl.appendChild(row);
  });
  setActive(Math.min(state.active || 0, state.words.length-1));
  paintRows();
  updateSolveCaret();
  refreshSideTagsAll();
}

function setTheme(){
  const raw = state.theme || "";
  const stripped = raw.replace(/^\s*Practice\s*•\s*/i, "");
  if(state.isPractice){
    themeEl.innerHTML = `<span class="practice-pill">Practice</span> • ${stripped}`;
  }else{
    /* CHANGED: keep Daily# OFF the page (it stays in share copy) */
    themeEl.textContent = raw;
  }
  setShareButtonState();
}

/* NEW: modal close behavior can cancel ALL IN when asked */
function setModalCloseCancelsAllIn(shouldCancel){
  try{ modalEl.dataset.cancelAllInOnClose = shouldCancel ? '1' : ''; }catch{}
}

function setActive(i){
  if(state.mode !== 'normal') return;
  if(state.solvedWord[i]) return;
  state.active = i;
  [...phraseEl.children].forEach((row, idx) => row.classList.toggle('active', idx === i));
  updateNormalCaretHighlight();
  updateControlsState();
  saveDailyState();
}

function paintRows(){
  state.words.forEach((word, wi)=>{
    const row = phraseEl.children[wi];
    const tiles = row.querySelectorAll('.tile');
    for(let pi=0;pi<tiles.length;pi++){
      const tile = tiles[pi];
      tile.className = 'tile';
      const chSpan = tile.querySelector('.char');
      const locked = state.locks[wi][pi];
      const entry  = state.entries[wi][pi] || '';

      if(locked){
        tile.classList.add('hit');
        chSpan.textContent = locked;
      } else if(state.persistentNear && state.persistentNear[wi] && state.persistentNear[wi][pi]){
        tile.classList.add('near');
        chSpan.textContent = entry || '';
      } else {
        chSpan.textContent = entry || '';
      }
    }
  });
}

function computeNextFlowIndex(wi){
  const L = state.entries[wi].length;
  let idx = Math.max(0, Math.min(state.flowIndex[wi] ?? 0, L-1));
  const anyEmptyEditable = state.entries[wi].some((c, p)=> !isLocked(wi,p) && c==='');
  if(!anyEmptyEditable){ return Math.max(0, L-1); }
  if(isLocked(wi, idx) || state.entries[wi][idx]===''){ return idx; }
  for(let p=idx+1; p<L; p++){ if(isLocked(wi,p) || state.entries[wi][p]===''){ return p; } }
  for(let p=idx-1; p>=0; p--){ if(isLocked(wi,p) || state.entries[wi][p]===''){ return p; } }
  return idx;
}

function updateNormalCaretHighlight(){
  if(state.mode !== 'normal') return;
  [...phraseEl.querySelectorAll('.tile.caret-soft')].forEach(el=>el.classList.remove('caret-soft'));
  const wi = state.active;
  const row = phraseEl.children[wi];
  if(!row) return;
  const idx = computeNextFlowIndex(wi);
  row.querySelector(`.tile[data-pos="${idx}"]`)?.classList.add('caret-soft');
}

function updateSolveCaret(){
  [...phraseEl.querySelectorAll('.tile.caret')].forEach(el=>el.classList.remove('caret'));
  if(state.mode !== 'solve') return;
  let map = solveIndexToPos(state.solveIndex);
  if(map.space){ stepRightSkippingSpace(); map = solveIndexToPos(state.solveIndex); }
  phraseEl.children[map.wi]?.querySelector(`.tile[data-pos="${map.pos}"]`)?.classList.add('caret');
  [...phraseEl.children].forEach((r, idx)=>r.classList.toggle('active', idx === map.wi));
}

function scoreGuess(guess, target){
  const res = Array(target.length).fill('miss');
  const tArr = target.split(''), gArr = guess.split('');
  const remain = {};
  for(let i=0;i<tArr.length;i++){ if(gArr[i] === tArr[i]) res[i] = 'hit'; else remain[tArr[i]] = (remain[tArr[i]]||0)+1; }
  for(let i=0;i<gArr.length;i++){ if(res[i]==='hit') continue; if(remain[gArr[i]]>0){ res[i]='near'; remain[gArr[i]]--; } }
  return res;
}

function setKeyLabelVisibility(el, letterState, letter){
  if(!el) return;
  const labelSpan = el.querySelector('.key-label');
  if(!labelSpan) return;
  if(letterState === 'miss'){ labelSpan.textContent = ''; }
  else { labelSpan.textContent = letter || ''; }
}

function applyKeyState(letter, newState){
  const order = { miss:0, near:1, hit:2 };
  const curr = state.keyState[letter] ?? null;
  if(curr === null || order[newState] > order[curr]){
    state.keyState[letter] = newState;
    const el = state.keyEls[letter];
    if(el){
      el.classList.remove('hit','near','miss');
      el.classList.add(newState);
      setKeyLabelVisibility(el, newState, letter);
    }
  }
}
function updateKeyboardFromGuess(guess, scores){
  const agg = {};
  for(let i=0;i<guess.length;i++){
    const ch = guess[i];
    if(!/^[A-Z]$/.test(ch)) continue;
    agg[ch] ||= {hit:false, inPhrase:false};
    if(scores[i]==='hit') agg[ch].hit = true;
    if(state.inPhrase.has(ch)) agg[ch].inPhrase = true;
  }
  Object.keys(agg).forEach(ch=> applyKeyState(ch, agg[ch].hit ? 'hit' : (agg[ch].inPhrase ? 'near' : 'miss')));
  renderKeyCounters();
}

function lockHits(wi, guess, scores){
  for(let i=0;i<scores.length;i++){
    if(scores[i]==='hit'){
      state.locks[wi][i] = guess[i];
      if(state.persistentNear && state.persistentNear[wi]) state.persistentNear[wi][i] = false;
    }
  }
  const solved = state.locks[wi].every(ch => !!ch);
  if(solved && state.persistentNear && state.persistentNear[wi]){
    state.persistentNear[wi] = state.persistentNear[wi].map(()=>false);
  }
}

function recomputePersistentNear(){
  state.persistentNear = state.words.map(w => Array.from({length:w.length}, ()=>false));
  if(!state.keyState) return;

  const discovered = new Set();
  Object.entries(state.keyState).forEach(([ch, st])=>{
    if(st === 'hit' || st === 'near') discovered.add(ch);
  });
  if(discovered.size === 0) return;

  for(let wi=0; wi<state.words.length; wi++){
    for(let pi=0; pi<state.words[wi].length; pi++){
      if(state.locks[wi][pi] !== null) continue;
      const solLetter = state.words[wi][pi];
      if(discovered.has(solLetter)){
        state.persistentNear[wi][pi] = true;
      }
    }
  }
}

function makeRow(chars, cols){
  const row = document.createElement('div');
  row.className = 'kb-row';
  row.style.setProperty('--cols', cols);
  chars.forEach(c => row.appendChild(makeKey(c)));
  return row;
}
function makeKey(label){
  const k = document.createElement('div');
  k.className = 'key';
  k.dataset.key = label;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'key-label';
  labelSpan.textContent = label;
  k.appendChild(labelSpan);

  const cs = document.createElement('div');
  cs.className = 'count-squares';
  k.appendChild(cs);

  state.keyEls[label] = k;
  return k;
}
function makeCtrlKey(label, keyName){
  const k = document.createElement('div');
  k.className = 'key ctrl';
  k.dataset.key = keyName || label;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'key-label';
  labelSpan.textContent = label;
  k.appendChild(labelSpan);

  return k;
}

function kbClickHandler(e){
  const k = e.target.closest('.key'); if(!k) return;
  const lab = k.dataset.key;
  if(/^[A-Z]$/.test(lab)){ typeLetter(lab); return; }
  if(lab === 'ENTER'){ submit(); return; }
  if(lab === '⌫'){ backspace(); return; }
  if(lab === 'ALL IN'){ toggleSolveMode(k); return; }
  if(lab === 'REVEAL ANSWER'){ revealPracticeAnswer(); return; }
  if(lab === 'CLEAR'){ clearBoard(); return; }
}

function buildKeyboard(){
  kbEl.innerHTML = "";
  state.keyEls = {};

  const r1 = makeRow(KEY_ROWS[0].split(''), 10);
  const r2 = makeRow(KEY_ROWS[1].split(''), 9);
  const r3 = document.createElement('div'); r3.className = 'kb-row'; r3.style.setProperty('--cols', 8);
  KEY_ROWS[2].split('').forEach(c=> r3.appendChild(makeKey(c)));
  r3.appendChild(makeCtrlKey('⌫'));

  const r4 = document.createElement('div'); r4.className = 'kb-row controls-row'; r4.style.setProperty('--cols', state.isPractice ? 3 : 2);

  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'controls';

  const rowA = document.createElement('div');
  rowA.className = 'ctrl-row';
  const clearBtnWrapper = document.createElement('div');
  clearBtnWrapper.className = 'btn-clear';
  const clearBtn = makeCtrlKey('CLEAR','CLEAR');
  clearBtn.id = 'btnClear';
  clearBtnWrapper.appendChild(clearBtn);
  const enter = makeCtrlKey('ENTER','ENTER'); enter.id = 'btnEnter';
  rowA.appendChild(clearBtnWrapper);
  rowA.appendChild(enter);

  const rowB = document.createElement('div');
  rowB.className = 'ctrl-row';
  const solve = makeCtrlKey('ALL IN','ALL IN'); solve.id = 'btnSolve'; solve.setAttribute('aria-pressed','false');
  rowB.appendChild(solve);
  const reveal = state.isPractice ? makeCtrlKey('REVEAL ANSWER','REVEAL ANSWER') : null;
  if(reveal){ reveal.id = 'btnReveal'; rowB.appendChild(reveal); }

  if(!reveal){
    const ph = document.createElement('div'); ph.style.visibility='hidden'; ph.style.flex='1';
    rowB.appendChild(ph);
  }

  controlsDiv.appendChild(rowA);
  controlsDiv.appendChild(rowB);

  r4.appendChild(controlsDiv);

  kbEl.appendChild(r1); kbEl.appendChild(r2); kbEl.appendChild(r3); kbEl.appendChild(r4);
  kbEl.onclick = kbClickHandler;

  Object.entries(state.keyState || {}).forEach(([ch, st])=>{
    const el = state.keyEls[ch];
    if(el){
      el.classList.add(st);
      setKeyLabelVisibility(el, st, ch);
    }
  });
}

function computeTotalOccurrences(){
  const map = {};
  state.words.forEach(w => w.split('').forEach(ch => {
    if(/[A-Z]/.test(ch)){ map[ch] = (map[ch]||0) + 1; }
  }));
  return map;
}
function computeLockedOccurrences(){
  const map = {};
  state.locks.forEach(row => row.forEach(ch => {
    if(ch){ map[ch] = (map[ch]||0) + 1; }
  }));
  return map;
}
function computeRemainingByLetter(){
  const totals = computeTotalOccurrences();
  const locked = computeLockedOccurrences();
  const remaining = {};
  Object.keys(totals).forEach(ch => {
    remaining[ch] = Math.max(0, (totals[ch]||0) - (locked[ch]||0));
  });
  return remaining;
}

function renderKeyCounters(){
  const counts = computeRemainingByLetter();
  Object.keys(state.keyEls).forEach(k => {
    if(!/^[A-Z]$/.test(k)) return;
    const el = state.keyEls[k];
    const cs = el.querySelector('.count-squares');
    if(!cs) return;
    cs.innerHTML = '';
    const n = counts[k] || 0;
    const ks = state.keyState[k];
    if((ks === 'hit' || ks === 'near') && n > 0){
      const squares = Math.min(n, 9);
      cs.classList.toggle('many', squares >= 4);
      for(let i=0;i<squares;i++){
        const sq = document.createElement('div'); sq.className = 'sq';
        cs.appendChild(sq);
      }
    }
  });
}

function buildGuessScoreMapForRow(wi){
  const map = {};
  state.history.forEach(h=>{
    if(h.wi===wi && !map[h.guess]){ map[h.guess] = h.scores.slice(); }
  });
  return map;
}

function uniqueGuessesForRow(wi){
  const set = new Set();
  state.history.forEach(h=>{ if(h.wi===wi){ set.add(h.guess); } });
  return Array.from(set);
}
function renderSideTags(wi){
  const left = document.getElementById(`tags-left-${wi}`);
  if(!left) return;
  left.innerHTML = '';

  const scoreMap = buildGuessScoreMapForRow(wi);
  const uniq = uniqueGuessesForRow(wi);
  uniq.forEach(word => {
    const el = document.createElement('span');
    el.className = 'tag';
    const scores = scoreMap[word] || [];
    const frag = document.createDocumentFragment();
    word.toUpperCase().split('').forEach((ch, idx) => {
      const sp = document.createElement('span');
      sp.className = 'ltr' + (scores[idx]==='near' ? ' near' : '' );
      sp.textContent = ch;
      frag.appendChild(sp);
    });
    el.appendChild(frag);
    left.appendChild(el);
  });
}
function refreshSideTagsAll(){ for(let wi=0; wi<state.words.length; wi++){ renderSideTags(wi); } }

function typeLetter(ch){
  if(state.mode === 'solve'){ typeSolve(ch); saveDailyState(); return; }
  typeNormal(ch.toUpperCase());
  renderKeyCounters();
  saveDailyState();
}

function typeNormal(ch){
  const wi = state.active; if(state.solvedWord[wi]) return;
  const L = state.entries[wi].length;
  let pos = Math.max(0, Math.min(state.flowIndex[wi] || 0, L-1));
  if(isLocked(wi,pos)){
    state.flowIndex[wi] = Math.min(pos + 1, L-1);
    paintRows(); updateNormalCaretHighlight(); updateControlsState();
    return;
  }
  if(state.entries[wi][pos] === ''){
    state.entries[wi][pos] = ch;
    pos++;
  } else {
    let p2 = pos + 1;
    while(p2 < L && (isLocked(wi,p2) || state.entries[wi][p2] !== '')) p2++;
    if(p2 < L){ state.entries[wi][p2] = ch; pos = p2 + 1; }
  }
  state.flowIndex[wi] = Math.min(pos, L-1);
  paintRows(); updateNormalCaretHighlight(); updateControlsState();
}

function backspace(){
  if(state.mode === 'solve'){ backspaceSolve(); saveDailyState(); return; }
  const wi = state.active; if(state.solvedWord[wi]) return;
  const L = state.entries[wi].length;
  let p = Math.max(0, Math.min(state.flowIndex[wi], L-1));
  if(p >= 0 && isLocked(wi,p)) p--;
  while(p >= 0 && (isLocked(wi,p) || state.entries[wi][p] === '')) p--;
  if(p >= 0 && !isLocked(wi,p)){ state.entries[wi][p] = ''; state.flowIndex[wi] = p; }
  else { state.flowIndex[wi] = Math.max(0, state.flowIndex[wi]-1); }
  paintRows(); updateNormalCaretHighlight(); updateControlsState();
  renderKeyCounters();
  saveDailyState();
}

function buildGuessFromEntries(wi){ return state.entries[wi].map((c,i)=> (state.locks[wi][i] ?? c) || '').join(''); }

function wordReady(wi){
  for(let i=0;i<state.entries[wi].length;i++){
    const v = state.locks[wi][i] ?? state.entries[wi][i];
    if(!v || v==='') return false;
  }
  return true;
}

/* CHANGED: allow optional skip of daily overlays (used by ALL IN so it doesn't pop "last chance" mid-submit) */
function incrementGuessCount(opts = {}){
  const { skipOverlays = false } = opts;
  state.guessCount++;
  for(let i=0;i<BRAND_LETTERS.length;i++){ BRAND_LETTERS[i].classList.toggle('lit', i < state.guessCount); }

  if(skipOverlays) return;

  if(!state.isPractice){
    if(state.guessCount === TOTAL_GUESS_LIMIT - 1 && !isPuzzleSolved()){
      showLastChanceOverlay();
    }
    if(state.guessCount === TOTAL_GUESS_LIMIT && !isPuzzleSolved() && !state.wompShown){
      state.wompShown = true;
      showOutOfGuessesOverlay();
    }
  }
}

function isPuzzleSolved(){ return state.solvedWord.every(Boolean); }

function firstOpenSolveIndex(){
  const total = totalSolveLength();
  for(let si=0; si<total; si++){
    const m = solveIndexToPos(si);
    if(m.space) continue;
    if(!isLocked(m.wi, m.pos) && (state.entries[m.wi][m.pos]||'')===''){ return si; }
  }
  for(let si=0; si<total; si++){
    const m = solveIndexToPos(si);
    if(m.space) continue;
    if(!isLocked(m.wi, m.pos)){ return si; }
  }
  return 0;
}

function toggleSolveMode(btnEl){
  if(isPuzzleSolved()){ showAllInUnavailable(); return; }
  const willOn = state.mode !== 'solve';
  ensureSolveMode(willOn);
  const solveKey = (btnEl || state.keyEls['ALL IN']);
  if(solveKey){ solveKey.setAttribute('aria-pressed', willOn ? 'true' : 'false'); }
  if(willOn){ showAllInIntro(); }
  saveDailyState();
}
function ensureSolveMode(on){
  const solveKey = state.keyEls['ALL IN'];
  const enterKey = state.keyEls['ENTER'];
  if(on){
    state.mode='solve';
    solveKey?.classList.add('hit');
    solveKey?.setAttribute('aria-pressed','true');
    state.solveIndex = firstOpenSolveIndex();
    enterKey?.classList.add('disabled');
  } else {
    state.mode='normal';
    solveKey?.classList.remove('hit','near','miss');
    solveKey?.setAttribute('aria-pressed','false');
    enterKey?.classList.remove('disabled');
    updateControlsState();
  }
  updateSolveCaret(); updateNormalCaretHighlight(); updateControlsState();
}

function typeSolve(ch){
  ch = ch.toUpperCase();
  let map = solveIndexToPos(state.solveIndex);
  if(map.space){ stepRightSkippingSpace(); map = solveIndexToPos(state.solveIndex); }
  if(!isLocked(map.wi,map.pos)){ state.entries[map.wi][map.pos] = ch; }
  paintRows(); stepRightSkippingSpace(); updateSolveCaret(); updateControlsState();
  renderKeyCounters();
}
function backspaceSolve(){
  let map = solveIndexToPos(state.solveIndex);
  let cleared = false;
  if(!map.space && !isLocked(map.wi,map.pos) && state.entries[map.wi][map.pos] !== ''){ state.entries[map.wi][map.pos] = ''; cleared = true; }
  if(!cleared){ stepLeftSkippingSpace(); map = solveIndexToPos(state.solveIndex); if(!map.space && !isLocked(map.wi,map.pos)){ state.entries[map.wi][map.pos] = ''; } }
  paintRows(); updateSolveCaret(); updateControlsState();
  renderKeyCounters();
}
function submitSolve(){
  for(let wi=0; wi<state.words.length; wi++){ if(!wordReady(wi)){ invalidSubmitShake("Complete the phrase before submitting."); return; } }

  /* CHANGED: ALL IN now counts as a guess (daily + practice) */
  incrementGuessCount({ skipOverlays: true });

  const attempt = state.words.map((w,wi)=> state.entries[wi].map((c,i)=> state.locks[wi][i] ?? c).join('')).join(' ');
  const target  = state.words.join(' ');
  if(attempt === target){
    for(let wi=0; wi<state.words.length; wi++){
      const solved = state.words[wi];
      state.solvedWord[wi] = true;
      state.locks[wi] = solved.split('');
      if(state.persistentNear && state.persistentNear[wi]) state.persistentNear[wi] = state.persistentNear[wi].map(()=>false);
    }

    const totalLetters = state.words.reduce((t,w,i)=> t + w.length, 0);
    const heartsScores = Array(totalLetters).fill('hit');
    const guessCompact = state.words.join('').toUpperCase();

    const heartsEntry = { wi: -1, guess: guessCompact, scores: heartsScores };

    if(state.guessCount > 0 && state.history.length >= state.guessCount){
      state.history[state.guessCount - 1] = heartsEntry;
      state.history = state.history.slice(0, state.guessCount);
    } else {
      state.history.push(heartsEntry);
    }

    paintRows();

    ensureSolveMode(false);
    showCompletionOverlay(true);
    setShareButtonState();
  }else{
    state.failedAllIn = true;
    if(!state.isPractice){
      setLastResult(currentPuzzleNumber(), 'superwomp');
      setBadge('superwomp');
      showYesterdayBadgeIfAny(); /* NEW: ensure badge is shown immediately */
      showSuperWompOverlay();
    }
    ensureSolveMode(false);
  }
  saveDailyState();
}

function submitActiveWord(){
  const wi = state.active; if(state.solvedWord[wi]) return;

  if(!wordReady(wi)){ invalidSubmitShake(`Fill all ${state.words[wi].length} letters first.`); return; }

  const target = state.words[wi];
  const guess  = buildGuessFromEntries(wi).toUpperCase();
  const scores = scoreGuess(guess, target);

  renderReveal(wi, guess, scores);
  updateKeyboardFromGuess(guess, scores);

  state.history.push({ wi, guess, scores });
  incrementGuessCount();

  if(guess === target){
    state.solvedWord[wi] = true;
    state.locks[wi] = target.split('');
    if(state.persistentNear && state.persistentNear[wi]) state.persistentNear[wi] = state.persistentNear[wi].map(()=>false);

    const next = state.solvedWord.findIndex(v => !v);
    if(next !== -1){
      state.active = next;
      state.flowIndex[next] = 0;
      [...phraseEl.children].forEach((row, idx) => row.classList.toggle('active', idx === next));
      updateNormalCaretHighlight();
    }else{
      showCompletionOverlay();
      setShareButtonState();
    }
  }else{
    lockHits(wi, guess, scores);
    for(let i=0;i<state.entries[wi].length;i++){ if(!isLocked(wi,i)) state.entries[wi][i] = ''; }
    state.flowIndex[wi] = 0;
    updateNormalCaretHighlight();
  }

  recomputePersistentNear();

  paintRows(); updateControlsState(); renderSideTags(wi);
  renderKeyCounters();
  saveDailyState();
}

function renderReveal(wi, guess, scores){
  const row = phraseEl.children[wi];
  const tiles = row.querySelectorAll('.tile');
  for(let i=0;i<tiles.length;i++){
    const chSpan = tiles[i].querySelector('.char');
    chSpan.textContent = guess[i] || '';
    tiles[i].className = 'tile ' + scores[i];
  }
}

const SYMBOLS = { hit:'🩷', near:'🟦', miss:'⬛' };

/* currentPuzzleNumber now prefers sheet puzzleNumber (NEW) */
function currentPuzzleNumber(){
  return (state && !state.isPractice && Number.isFinite(state.puzzleNumber) && state.puzzleNumber > 0)
    ? state.puzzleNumber
    : dailyPuzzleNumberFallback;
}

function buildSilhouetteShare(streakCount, badgeWord){
  const solvedIn = `${state.guessCount}/${TOTAL_GUESS_LIMIT}`;
  const num = currentPuzzleNumber();
  const lines = [
    `Wozzlar - Daily #${num}`,
    `“${state.theme}”`,
    `${solvedIn}`,
    `* Streak ${streakCount}${badgeWord ? `, ${badgeWord}` : ''}`,
    `https://wozzlar.com`
  ];
  state.history.forEach((h, idx) => {
    const row = (h.scores || []).map(s => SYMBOLS[s] || SYMBOLS.miss).join('');
    lines.push(`${idx+1} ${row}`);
  });
  return lines.join('\\n').replace(/\\\\n/g, '\\n').split('\\n').join('\\n').replace(/\\n/g, '\n');
}

function setActions({closeText="Close", primaryText=null, onPrimary=null, showShare=false}){
  modalClose.textContent = closeText;
  modalPrimary.hidden = !primaryText;
  if(primaryText){ modalPrimary.textContent = primaryText; modalPrimary.onclick = onPrimary || null; }
  modalShare.hidden = !showShare;
}
function clearStatsBlocks(){
  stackTitle.hidden = true;
  shareVisual.hidden = true;
  shareWrap.hidden = true;
  modalShare.hidden = true;
  shareVisual.innerHTML = '';
  sharePre.textContent = '';
}

function showCompletionOverlay(fromAllIn){
  setModalCloseCancelsAllIn(false);
  const solvedIn = `${state.guessCount}/${TOTAL_GUESS_LIMIT}`;
  modalTitle.textContent = `Wozzlar — ${state.numberLabel} • ${solvedIn}`;
  modalMeta.hidden = false; modalMeta.textContent = `Theme: ${state.theme}`;
  modalCustom.innerHTML = "";
  modalMsg.textContent   = `You solved Wozzlar in ${solvedIn} guesses.`;

  const visual = document.createDocumentFragment();
  state.history.forEach(h=>{
    const line = document.createElement('div'); line.className = 'guess-line';

    const scores = h.scores || [];
    const chars = (h.guess || '').split('');
    for(let i=0;i<scores.length;i++){
      const span=document.createElement('span');
      span.className = `letter ${scores[i]||'miss'}`;
      span.textContent = chars[i] || '';
      line.appendChild(span);
    }
    visual.appendChild(line);
  });
  shareVisual.innerHTML=''; shareVisual.appendChild(visual);
  stackTitle.hidden=false; shareVisual.hidden=false;

  let badgeWord = '';
  if(!state.isPractice){
    if(state.failedAllIn){
      setLastResult(currentPuzzleNumber(), 'superwomp');
      setBadge('superwomp');
      badgeWord = 'Badge: Super Womp';
    }else if(state.guessCount <= TOTAL_GUESS_LIMIT){
      setLastResult(currentPuzzleNumber(), 'wozzlar');
      setBadge('wozzlar');
      badgeWord = 'Badge: Wozzlar';
    }else{
      setLastResult(currentPuzzleNumber(), 'womp');
      setBadge('womp');
      badgeWord = 'Badge: Womp';
    }

    /* NEW: once today is completed, always show today's badge immediately (not yesterday) */
    showYesterdayBadgeIfAny();
  }

  const streak = updateStreakOnWin();
  if(!state.isPractice){
    streakLine.textContent = `🔥 Streak ${streak}`; streakLine.hidden=false;
  } else { streakLine.hidden = true; }

  const shareText = buildSilhouetteShare(streak, badgeWord);
  shareWrap.hidden=false; sharePre.textContent = shareText;
  setActions({closeText:"Close", primaryText:null, onPrimary:null, showShare:true});
  modalEl.classList.add('show');
  saveDailyState();

  setShareButtonState();

  modalShare.onclick = async ()=> {
    try{
      if(navigator.share){
        await navigator.share({ text: shareText, title: "Wozzlar Result" });
      }else if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(shareText);
        modalShare.textContent="Copied!";
        setTimeout(()=> modalShare.textContent="Share",1500);
      }else{
        const range = document.createRange(); range.selectNodeContents(sharePre);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        modalShare.textContent="Select & copy ↑";
        setTimeout(()=> modalShare.textContent="Share",2000);
      }
    }catch(e){
      modalShare.textContent="Share failed";
      setTimeout(()=> modalShare.textContent="Share",2000);
    }
  };
}

function showInfoModal(message){
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "Notice";
  modalMeta.hidden = true;
  modalCustom.innerHTML = "";
  modalMsg.textContent = message;
  clearStatsBlocks();
  setActions({closeText:"Close", primaryText:null, onPrimary:null, showShare:false});
  modalEl.classList.add('show');
}

function showLastChanceOverlay(){
  setModalCloseCancelsAllIn(true); /* NEW: Back to Puzzle cancels ALL IN */
  modalTitle.textContent = "Last chance before the trombone!";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <p>You’ve got one last shot to earn your 🏆 Wozzlar badge for the day.</p>
        <p>Go ALL IN and nail it to claim glory — but miss, and you’ll receive a 🎺 Super Womp.</p>
        <p>If you’d rather play it safe, keep guessing normally — you can still finish the puzzle, but your badge will be a 😐 Womp instead.</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({
    closeText:"Back to Puzzle",
    primaryText:"Go ALL IN",
    onPrimary:()=>{ setModalCloseCancelsAllIn(false); modalEl.classList.remove('show'); ensureSolveMode(true); }
  });
  modalEl.classList.add('show');
  saveDailyState();
}

function showOutOfGuessesOverlay(){
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "😒 Womp…";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>Out of guesses for the badge.</h4>
        <p>You’ve used all <strong>${TOTAL_GUESS_LIMIT}</strong> attempts. You can keep solving to finish the puzzle, but today’s badge will be <strong>Womp</strong> (unless you already earned <strong>Super Womp</strong> by missing ALL IN).</p>
        <p style="margin-top:6px">Finish the phrase anyway and share your attempt history.</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({closeText:"Back to Puzzle"});
  modalEl.classList.add('show');
  saveDailyState();
}

function showAllInIntro(){
  setModalCloseCancelsAllIn(true); /* NEW: Back to Puzzle cancels ALL IN */
  modalTitle.textContent = "ALL IN";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>High stakes time.</h4>
        <p>Try to fill the entire phrase at once. It <strong>counts as a guess</strong>, and if you miss, you earn the <strong>🎺 Super Womp</strong> badge.</p>
        <p style="margin-top:6px">Get it right, and you earn the <strong>🏆 Wozzlar</strong> badge.</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({
    closeText:"Back to Puzzle",
    primaryText:"Go ALL IN",
    onPrimary:()=>{ setModalCloseCancelsAllIn(false); modalEl.classList.remove('show'); }
  });
  modalEl.classList.add('show');
  saveDailyState();
}

function showAllInUnavailable(){
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "ALL IN — Unavailable";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>Nice try!</h4>
        <p>Today’s puzzle is already complete. ALL IN lets you attempt the <strong>entire phrase at once</strong> (and it <strong>counts as a guess</strong>) — but if you miss, you get the <strong>Super Womp</strong> badge.</p>
        <p style="margin-top:6px">Come back tomorrow for a fresh ALL IN shot.</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({closeText:"Back to Puzzle"});
  modalEl.classList.add('show');
}

function showSuperWompOverlay(){
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "🎺 Womp womp womp…";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>Super Womp bestowed.</h4>
        <p>Your ALL IN was incorrect. You can continue solving, but today’s badge is now the <strong>Super Womp</strong>.</p>
        <p style="margin-top:6px">Finish the puzzle and share your shame — the trombone will blare proudly above.</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({closeText:"Back to Puzzle"});
  modalEl.classList.add('show');
  saveDailyState();
}

/* CHANGED: Close can cancel ALL IN if modal requested it */
modalClose.addEventListener('click', ()=> {
  if(modalEl.dataset.cancelAllInOnClose === '1' && state && state.mode === 'solve'){
    ensureSolveMode(false);
  }
  setModalCloseCancelsAllIn(false);
  modalEl.classList.remove('show');
  saveDailyState();
});

function setShareButtonState(){
  if(!shareButton) return;
  if(isPuzzleSolved()){
    shareButton.removeAttribute('disabled');
    shareButton.setAttribute('aria-disabled','false');
    shareButton.classList.remove('disabled');
  } else {
    shareButton.setAttribute('disabled','');
    shareButton.setAttribute('aria-disabled','true');
    shareButton.classList.add('disabled');
  }
}
shareButton.addEventListener('click', (e)=>{
  e.preventDefault();
  if(isPuzzleSolved()){
    showCompletionOverlay(false);
  } else {
    showInfoModal("Complete the puzzle to share your result.");
  }
});

function keyHandler(e){
  if(e.key === 'Enter'){ e.preventDefault(); submit(); return; }
  if(e.key === 'Backspace'){ e.preventDefault(); backspace(); return; }
  if(e.key.length === 1){
    const ch = e.key.toUpperCase();
    if(/^[A-Z]$/.test(ch)){ e.preventDefault(); typeLetter(ch); }
  }
}
document.addEventListener('keydown', keyHandler);

function updateControlsState(){
  const enterKey = state.keyEls['ENTER'];
  if(!enterKey) return;
  const wi = state.active;
  const canEnter = (state.mode === 'normal') && !state.solvedWord[wi] && wordReady(wi);
  enterKey.classList.toggle('disabled', !canEnter);
}

/* ===== Practice mode ===== */
function showPracticeInterstitial(){
  saveDailyState();
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "Practice Mode";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>Watch an ad to practice</h4>
        <p>Practice puzzles don’t affect streaks or badges (no Wozzlar, Womp, or Super Womp in practice). Each new practice puzzle requires viewing an interstitial ad.</p>
        <div id="adBox" style="margin-top:10px;height:160px;border:1px dashed rgba(58,58,84,.8);border-radius:10px;display:flex;align-items:center;justify-content:center;">Interstitial Ad Placeholder</div>
      </div>
    </div>
  `;
  clearStatsBlocks();
  let watching = false;
  function startWatch(){
    if(watching) return;
    watching = true;
    const box = document.getElementById('adBox');
    if(!box) return;
    let seconds = 5;
    box.textContent = "Ad playing… " + seconds + "s";
    const iv = setInterval(()=>{
      seconds--; box.textContent = "Ad playing… " + seconds + "s";
      if(seconds<=0){ clearInterval(iv); box.textContent = "Ad complete ✔"; modalPrimary.disabled=false; }
    },1000);
  }
  setActions({
    closeText:"Not now",
    primaryText:"Watch Ad",
    onPrimary:()=>{
      if(modalPrimary.textContent === "Watch Ad"){
        modalPrimary.textContent = "Start Practice";
        modalPrimary.disabled = true;
        startWatch();
      }else{
        modalEl.classList.remove('show');
        beginPracticePuzzle();
      }
    }
  });
  modalEl.classList.add('show');
}

/* beginPracticePuzzle now pulls from sheet first, falls back to local list (NEW) */
async function beginPracticePuzzle(){
  saveDailyState();

  let puz;
  try{
    const sheet = await getRandomPracticePuzzleFromSheet();
    puz = { theme: sheet.theme, words: sheet.words };
  }catch{
    puz = PRACTICE_PUZZLES[Math.floor(Math.random()*PRACTICE_PUZZLES.length)];
  }

  state = baseState(puz, "Practice", null);
  state.words.forEach((w, wi) => {
    w.split('').forEach(c => {
      if(/[A-Z]/.test(c)){
        state.inPhrase.add(c);
        (state.wordsContaining[c] ||= new Set()).add(wi);
      }
    });
  });
  state.solvedWord = state.words.map(()=> false);
  state.locks  = state.words.map(w => Array.from({length:w.length}, ()=> null));
  state.entries= state.words.map(w => Array.from({length:w.length}, ()=> ''));
  state.flowIndex = state.words.map(()=>0);
  state.persistentNear = state.words.map(w => Array.from({length:w.length},()=>false));
  setBadge('none');

  rebuildUIFromState();
  renderKeyCounters();
}

function rebuildUIFromState(){
  recomputePersistentNear();
  buildPhrase();
  setTheme();
  buildKeyboard();
  paintRows();
  updateNormalCaretHighlight();
  updateSolveCaret();
  updateControlsState();
  setShareButtonState();
}

/* ===== Daily loader ===== */
async function loadDailyPuzzle(){
  // First attempt: pull from sheet (NEW)
  let puz, label, puzzleNumber;
  try{
    const sheetDaily = await getDailyPuzzleFromSheet();
    puz = { theme: sheetDaily.theme, words: sheetDaily.words };
    puzzleNumber = sheetDaily.puzzleNumber ?? dailyPuzzleNumberFallback;
    label = "Daily #" + puzzleNumber;
  }catch{
    puz = PUZZLES[dailyIndex];
    puzzleNumber = dailyPuzzleNumberFallback;
    label = "Daily #" + puzzleNumber;
  }

  state = baseState(puz, label, puzzleNumber);

  state.words.forEach((w, wi) => {
    w.split('').forEach(c => {
      if(/[A-Z]/.test(c)){
        state.inPhrase.add(c);
        (state.wordsContaining[c] ||= new Set()).add(wi);
      }
    });
  });
  state.solvedWord = state.words.map(()=> false);
  state.locks  = state.words.map(w => Array.from({length:w.length}, ()=> null));
  state.entries= state.words.map(w => Array.from({length:w.length}, ()=> ''));
  state.flowIndex = state.words.map(()=>0);

  loadDailyStateIfAny(); // restore progress for today
  rebuildUIFromState();
  renderKeyCounters();
  saveDailyState();
}

/* ===== Menu & links ===== */
hamburger.addEventListener('click', ()=>{
  const open = !menu.classList.contains('show');
  menu.classList.toggle('show', open);
  hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#menu') && !e.target.closest('#hamburger')){
    menu.classList.remove('show');
    hamburger.setAttribute('aria-expanded','false');
  }
});

/* ===== Feedback link activation (CHANGED) ===== */
(function setupFeedbackLink(){
  if(!feedbackLink) return;
  if(FEEDBACK_FORM_URL && typeof FEEDBACK_FORM_URL === 'string' && FEEDBACK_FORM_URL.trim()){
    feedbackLink.href = FEEDBACK_FORM_URL.trim();
    feedbackLink.target = "_blank";
    feedbackLink.rel = "noopener noreferrer";
    feedbackLink.setAttribute('aria-label', 'Open feedback form in a new tab');
  }else{
    feedbackLink.href = "#";
    feedbackLink.removeAttribute('target');
    feedbackLink.removeAttribute('rel');
  }
})();
(function setupContactLink(){
  if(!contactLink) return;
  if(CONTACT_FORM_URL && typeof CONTACT_FORM_URL === 'string' && CONTACT_FORM_URL.trim()){
    contactLink.href = CONTACT_FORM_URL.trim();
    contactLink.target = "_blank";
    contactLink.rel = "noopener noreferrer";
    contactLink.setAttribute('aria-label', 'Open contact form in a new tab');
  }else{
    contactLink.addEventListener('click', (e)=>{
      e.preventDefault();
      showModalMessage('Contact form not configured yet.');
    });
  }
})();

feedbackLink.addEventListener('click', (e)=>{
  // If URL is set, allow normal link behavior (new tab).
  const url = (FEEDBACK_FORM_URL || "").trim();
  if(url){
    // Close menu for UX, then allow anchor default open.
    menu.classList.remove('show');
    hamburger.setAttribute('aria-expanded','false');
    return;
  }
  // Otherwise, prevent and show friendly message.
  e.preventDefault();
  menu.classList.remove('show');
  hamburger.setAttribute('aria-expanded','false');
  showInfoModal("Feedback form isn’t wired up yet. Paste your Google Form URL into FEEDBACK_FORM_URL near the top of the script.");
});

howToPlayLink.addEventListener('click', (e)=>{
  e.preventDefault();
  showHowToPlay();
});

/* ===== Add to Home Screen ===== */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function isMobile(){
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
async function handleAddToHomeScreen(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if(choice && choice.outcome === 'accepted'){
        showInfoModal("App added (or being added) to your Home screen.");
      }else{
        showInfoModal("Install dismissed. You can try again from the browser menu.");
      }
    }catch{ }
    return;
  }

  const isMac = navigator.platform && /Mac/i.test(navigator.platform);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  let html = '<div class="wizard-wrap"><div class="wizard-emoji">📌</div><div class="speech">';
  if(isIOS){
    html += `<h4>Add to Home Screen (iOS)</h4>
      <p>In Safari, tap the <strong>Share</strong> icon, then scroll and tap <strong>Add to Home Screen</strong>.</p>`;
  }else if(isMobile()){
    html += `<h4>Add to Home Screen (Android)</h4>
      <p>Open the browser menu (<strong>⋮</strong>) and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>`;
  }else{
    html += `<h4>Add a Bookmark (Desktop)</h4>
      <p>Press <strong>${isMac ? '⌘' : 'Ctrl'} + D</strong> to bookmark, or pin this tab.</p>`;
  }
  html += `</div></div>`;

  modalTitle.textContent = isMobile() ? "Add to Home Screen" : "Add bookmark";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = html;
  clearStatsBlocks();
  setActions({closeText:"Got it"});
  modalEl.classList.add('show');
  setModalCloseCancelsAllIn(false);
}
a2hsLink.addEventListener('click', (e)=>{ e.preventDefault(); handleAddToHomeScreen(); });

/* ===== Yesterday/result badges ===== */
function setLastResult(puzzleNumber, result){ try{ localStorage.setItem('wozzlar_last_result_v2', JSON.stringify({puzzleNumber, result})); }catch{} }
function getLastResult(){ try{ return JSON.parse(localStorage.getItem('wozzlar_last_result_v2')) || null; }catch{ return null; } }

/* CHANGED: show badge for TODAY (if completed) OR yesterday (if today not completed yet). */
function showYesterdayBadgeIfAny(){
  const last = getLastResult();
  const todayNum = currentPuzzleNumber();
  if(!last) { setBadge('none'); return; }

  // Prefer showing today's earned badge (after you finish).
  if(last.puzzleNumber === todayNum){
    if(last.result === 'wozzlar'){ setBadge('wozzlar'); }
    else if(last.result === 'superwomp'){ setBadge('superwomp'); }
    else if(last.result === 'womp'){ setBadge('womp'); }
    else { setBadge('none'); }
    return;
  }

  // Otherwise show yesterday's badge on first open.
  if(last.puzzleNumber === todayNum - 1){
    if(last.result === 'wozzlar'){ setBadge('wozzlar'); }
    else if(last.result === 'superwomp'){ setBadge('superwomp'); }
    else if(last.result === 'womp'){ setBadge('womp'); }
    else { setBadge('none'); }
  }else{
    setBadge('none');
  }
}

/* ===== Streak helpers ===== */
function getStreakInfo(){ try{ return JSON.parse(localStorage.getItem('wozzlar_streak_v1')) || {streak:0,lastPuzzle:0}; }catch{ return {streak:0,lastPuzzle:0}; } }
function setStreakInfo(obj){ localStorage.setItem('wozzlar_streak_v1', JSON.stringify(obj)); }
function updateStreakOnWin(){
  if(state.isPractice) return 0;
  const info = getStreakInfo();
  const puzzleNumber = currentPuzzleNumber();
  if(info.lastPuzzle === puzzleNumber){ }
  else if(info.lastPuzzle === puzzleNumber - 1){ info.streak = (info.streak||0) + 1; info.lastPuzzle = puzzleNumber; }
  else { info.streak = 1; info.lastPuzzle = puzzleNumber; }
  setStreakInfo(info);
  return info.streak;
}

/* ===== HOW TO PLAY overlay ===== */
function showHowToPlay(){
  setModalCloseCancelsAllIn(false);
  modalTitle.textContent = "How to Play Wozzlar";
  modalMeta.hidden = true;
  modalMsg.textContent = "";
  modalCustom.innerHTML = `
    <div class="wizard-wrap">
      <div class="wizard-emoji">🧙‍♂️</div>
      <div class="speech">
        <h4>Goal</h4>
        <p>Solve every word in today’s phrase before you run out of guesses.</p>
        <h4 style="margin-top:10px">Basics</h4>
        <p>Tap or click a word to work on it.</p>
        <p>Type letters using your keyboard or the on-screen keys.</p>
        <p>Press ENTER to submit your word.</p>
        <p>Keep solving until the full phrase is complete.</p>
        <h4 style="margin-top:10px">Tile Colors</h4>
        <p>Pink – <strong>HIT</strong> — right letter, right spot.</p>
        <p>Blue – <strong>NEAR</strong> — letter is in the phrase, but not in this spot. (These stay blue until that position is solved.)</p>
        <p>Dark – <strong>MISS</strong> — letter isn’t in the phrase.</p>
        <h4 style="margin-top:10px">Keyboard Colors</h4>
        <p>Pink key – letter placed correctly somewhere.</p>
        <p>Blue key – letter exists elsewhere in the phrase.</p>
        <p>Dark key – letter not in the phrase (the letter will disappear from the key once confirmed).</p>
        <p>Pink key with blue squares – shows how many more of that letter remain in the phrase.</p>
        <h4 style="margin-top:10px">Hints Beside Each Word</h4>
        <p>Left side shows your past unique guesses for that word.</p>
        <p>Underlined letters mean the letter belongs in that word but in a different position.</p>
        <h4 style="margin-top:10px">ALL IN (High-Stakes Mode)</h4>
        <p>This feature allows you to fill in the entire puzzle, not just one word at a time.</p>
        <p><strong>ALL IN counts as a guess.</strong> If you miss, you earn the 🎺 Super Womp badge.</p>
        <p>Get it right, and you earn the 🏆 Wozzlar badge.</p>
        <h4 style="margin-top:10px">Guesses & Badges (Daily)</h4>
        <p>You get 7 guesses per day.</p>
        <p>Solve within the limit → 🏆 Wozzlar badge.</p>
        <p>Need more than 7 guesses → 😐 Womp badge.</p>
        <p>Miss an ALL IN → 🎺 Super Womp badge.</p>
        <p>Win streaks build daily.</p>
        <h4 style="margin-top:10px">Practice Mode</h4>
        <p>Play unlimited puzzles — no streaks, no badges.</p>
        <h4 style="margin-top:10px">Tips</h4>
        <p>Tap boxes to move the cursor.</p>
        <p>Backspace deletes unlocked letters.</p>
        <p>Blue highlights persist until that position is solved; typed letters show on top of the highlight.</p>
        <h4 style="margin-top:10px">Reset</h4>
        <p>A new daily puzzle appears at midnight (local time).</p>
      </div>
    </div>
  `;
  clearStatsBlocks();
  setActions({closeText:"Got it"});
  modalEl.classList.add('show');
}

/* ===== Init & navigation safety ===== */
async function goToDaily(){
  modalEl.classList.remove('show');
  menu.classList.remove('show');
  hamburger.setAttribute('aria-expanded','false');
  saveDailyState();
  await loadDailyPuzzle();
  showYesterdayBadgeIfAny(); /* keep badge correct after returning */
}

async function init(){
  // Load sheet daily (or fallback), then restore any saved daily state.
  await loadDailyPuzzle();
  showYesterdayBadgeIfAny();

  btnPractice.addEventListener('click', showPracticeInterstitial);
  brandBtn.addEventListener('click', ()=>{ goToDaily(); });

  window.addEventListener('beforeunload', saveDailyState);
}
window.addEventListener('DOMContentLoaded', ()=>{ init(); });

/* ===== Submit entry point ===== */
function submit(){ if(state.mode === 'solve'){ submitSolve(); } else { submitActiveWord(); } }

/* ===== PRACTICE: Reveal implementation ===== */
function revealPracticeAnswer(){
  if(!state.isPractice) return;
  for(let wi=0; wi<state.words.length; wi++){
    const word = state.words[wi];
    state.locks[wi] = word.split('');
    state.entries[wi] = word.split('');
    state.solvedWord[wi] = true;
    if(state.persistentNear && state.persistentNear[wi]) state.persistentNear[wi] = state.persistentNear[wi].map(()=>false);
    const scores = Array(word.length).fill('hit');
    state.history.push({ wi, guess: word, scores });
  }
  paintRows();
  renderKeyCounters();
  showCompletionOverlay(false);
  setShareButtonState();
}

/* ===== CLEAR BOARD implementation ===== */
function clearBoard(){
  for(let wi=0; wi<state.entries.length; wi++){
    for(let pi=0; pi<state.entries[wi].length; pi++){
      if(!isLocked(wi,pi)){
        state.entries[wi][pi] = '';
      }
    }
    state.flowIndex[wi] = 0;
  }
  paintRows();
  if(state.mode === 'solve'){ updateSolveCaret(); } else { updateNormalCaretHighlight(); }
  updateControlsState();
  renderKeyCounters();
  saveDailyState();
}

function invalidSubmitShake(msg){
  phraseEl.classList.add('shake');
  setTimeout(()=> phraseEl.classList.remove('shake'), 450);
  showInfoModal(msg);
}
