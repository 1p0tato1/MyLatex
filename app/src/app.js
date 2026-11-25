import * as pdfjs from "./pdf.min.mjs";
import { t as tr, loadLang, apply as applyI18n, detectLang, lang as curLang, LANGS, menuLabels } from "./i18n.js";
import { createEditor } from "./editor.js";
pdfjs.GlobalWorkerOptions.workerSrc = "./pdf.worker.min.mjs";
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const win = window.__TAURI__.window.getCurrentWindow();
const $ = (i) => document.getElementById(i);

const TEMPLATE = String.raw`\documentclass[11pt]{article}
\usepackage{amsmath}

\title{Untitled}
\author{}
\date{\today}

\begin{document}
\maketitle

Hello, world! $e^{i\pi}+1=0$

\end{document}
`;

// ---------- state
let tabs = [], cur = null, nextId = 1, busy = false, again = null, timer, gen = 0;
let autoOn = localStorage.auto !== "0", keepOn = localStorage.keep !== "0";
const base = (p) => p.split("/").pop();
const stem = (t) => t.name.replace(/\.tex$/i, "");
const dir = (p) => (p ? p.slice(0, p.lastIndexOf("/")) : null);
const tabText = (t) => (t === cur ? ed.get() : t.state.doc.toString());

// Projet multi-fichiers: "main document" (menu Build) ou commentaire magique `% !TEX root = main.tex`.
// Compiler n'importe quel fichier du projet compile le document principal; le PDF/les erreurs sont portés par lui.
let main = null;
const rootOf = (t) => {
  const m = t.path && tabText(t).slice(0, 2000).match(/^%\s*!TEX\s+root\s*=\s*(.+?)\s*$/im);
  if (!m) return null;
  const p = m[1].startsWith("/") ? m[1] : dir(t.path) + "/" + m[1].replace(/^\.\//, "");
  return tabs.find((x) => x.path === p) || null; // ponytail: le fichier racine doit être ouvert dans un onglet
};
const own = (t) => (main && tabs.includes(main) && (t === main || (t.path && main.path && t.path.startsWith(dir(main.path) + "/"))) ? main : rootOf(t) || t);

// ---------- theme / zoom
// Thèmes (menu View > Theme): system, light, dark (New UI), darcula, hc (contraste élevé)
const THEMES = ["system", "light", "light-header", "intellij", "islands-light", "fleet-light", "dark", "darcula", "islands-dark", "fleet-dark", "hc"], mq = matchMedia("(prefers-color-scheme: dark)");
let themeName = THEMES.includes(localStorage.theme) ? localStorage.theme : "system";
const setTheme = (n) => {
  themeName = n; localStorage.theme = n;
  document.documentElement.dataset.theme = n === "system" ? (mq.matches ? "dark" : "light") : n;
  invoke("set_theme_check", { name: n });
};
mq.addEventListener("change", () => themeName === "system" && setTheme("system"));
setTheme(themeName);
let fs = +localStorage.fs || 13;
const setFs = (n) => { fs = Math.min(32, Math.max(8, n)); localStorage.fs = fs; document.documentElement.style.setProperty("--fs", fs + "px"); };
setFs(fs);

// ---------- status / progress
const status = (cls, txt) => { $("st").className = cls; $("st").textContent = txt; };
const statusFor = (t) => {
  if (t.compiling) return;
  const n = t.warns?.length || 0;
  if (t.ok === true) status(n ? "warn" : "ok", n ? tr("msg.compiledW", { n }) : tr("msg.compiled"));
  else if (t.ok === false) status("err", t.log?.startsWith("MISSING") ? tr("msg.packageNeeded") : tr("msg.error"));
  else status("", tr("msg.ready"));
  $("st").classList.toggle("clickable", t.ok === false || n > 0);
};
// warnings TeX collectés pendant la compilation (dédupliqués, bruit filtré)
let warns = [];
const pushWarn = (l) => {
  const m = l.match(/^warning: (?:(.+?\.tex):(\d+): )?(.*)$/);
  if (!m || /warnings were issued|could not represent character/.test(m[3]) || warns.length > 150) return;
  const w = { kind: "warn", file: m[1], line: m[2] ? +m[2] : 0, msg: m[3] };
  if (!warns.some((x) => x.file === w.file && x.line === w.line && x.msg === w.msg)) warns.push(w);
};
let files = 0, mb = 0, line = "";
const exp = JSON.parse(localStorage.exp || '{"f":60,"mb":45}'); // totaux estimés d'après le dernier téléchargement complet
const showDl = () => {
  const el = $("dl"); el.style.display = busy && (files || line) ? "block" : "none";
  const pct = Math.min(95, Math.round(100 * Math.max(files / exp.f, mb / exp.mb)));
  $("prog").classList.toggle("det", busy && files > 0); $("prog").style.setProperty("--p", pct + "%");
  el.innerHTML = (files ? `<b>${pct}%</b> · <b>${files}</b>/≈${Math.max(exp.f, files)} files · <b>${mb.toFixed(1)}</b>/≈${Math.max(exp.mb, mb).toFixed(0)} MB — ` : "") + line;
};
listen("tex-log", (e) => {
  if (e.payload.startsWith("warning:")) pushWarn(e.payload);
  const m = e.payload.match(/^note: downloading (.+)/);
  if (m) { files++; line = m[1]; status("busy", tr("msg.downloading")); }
  else if (/generating format/.test(e.payload)) { line = tr("msg.prepFormat"); status("busy", tr("msg.preparing")); }
  else if (/Running/.test(e.payload)) status("busy", tr("msg.compiling"));
  showDl();
});
listen("tex-mb", (e) => { mb = e.payload; showDl(); });

// ---------- editor
const ed = createEditor($("ed"), {
  onSync: () => syncToPdf(),
  onChange() {
    cur.pristine = false; if (!cur.dirty) { cur.dirty = true; renderTabs(); setTitle(); }
    clearTimeout(st); st = setTimeout(saveSession, 800);
    if (saveOn && cur.path) { clearTimeout(svT); const t = cur; svT = setTimeout(() => quietSave(t), 1000); }
    if (autoOn) { clearTimeout(timer); timer = setTimeout(() => compile(cur), 600); }
    clearTimeout(ot); ot = setTimeout(() => { buildOutline(); refreshData(false); }, 300);
  },
  onCursor(s) { pos(s); clearTimeout(wt); wt = setTimeout(() => { words(); markOutline(); }, 250); },
});
let wt, st, ot;
const pos = (s) => { const p = s.selection.main.head, l = s.doc.lineAt(p); $("pos").textContent = tr("msg.pos", { l: l.number, c: p - l.from + 1 }); };
const words = () => {
  const n = (ed.get().replace(/%.*$/gm, "").replace(/\\[a-zA-Z@]+\*?/g, " ").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  $("words").textContent = tr("msg.words", { n });
};

// ---------- tabs
function mk(path, text, dirty = false) {
  const t = { id: String(nextId++), path, name: path ? base(path) : "", state: ed.newState(text), dirty, ok: null, log: "", pdf: null, pages: 0, top: 0 };
  if (!path) { let n = 1; const used = new Set(tabs.map((x) => x.name)); const u = tr("msg.untitled"); while (used.has(n === 1 ? u : u + " " + n)) n++; t.name = n === 1 ? u : u + " " + n; }
  tabs.push(t); return t;
}
function renderTabs() {
  $("tabs").replaceChildren(...tabs.map((t) => {
    const d = document.createElement("div");
    d.className = "tab" + (t === cur ? " on" : "") + (t.dirty ? " dirty" : "") + (t === main ? " main" : "");
    d.title = t.path || t.name;
    d.innerHTML = "<i></i><span></span><b>×</b>";
    d.querySelector("span").textContent = t.name;
    d.onmousedown = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t); } else if (!e.target.closest("b")) show(t); };
    d.querySelector("b").onclick = (e) => { e.stopPropagation(); closeTab(t); };
    return d;
  }));
  $("tabs").querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
const setTitle = () => win.setTitle(cur ? `${cur.name}${cur.dirty ? " — " + tr("msg.edited") : ""} — MyLatex` : "MyLatex").catch(() => {});

function show(t) {
  if (cur === t) return;
  const prev = cur && own(cur);
  if (cur) { cur.state = ed.state(); prev.top = $("pv").scrollTop; if (saveOn) quietSave(cur); }
  cur = t; const o = own(t); ed.setState(t.state); renderTabs(); setTitle(); statusFor(o); showLog(o);
  words(); pos(ed.state()); buildOutline(); refreshData(true); applyMarks();
  if (o === prev && o.pdf) updPage();
  else if (o.pdf) render(o.pdf, o).then(() => ($("pv").scrollTop = o.top));
  else { $("pv").replaceChildren(); updPage(); compile(t); }
  ed.focus(); saveSession();
}

function newTab(text = TEMPLATE) { const t = mk(null, text); t.pristine = true; show(t); return t; }

async function openPaths(paths) {
  let last;
  for (const p of paths) {
    const ex = tabs.find((t) => t.path === p);
    if (ex) { last = ex; continue; }
    const text = await invoke("read_file", { path: p });
    if (text == null) { status("err", tr("msg.cannotRead", { name: base(p) })); continue; }
    last = mk(p, text);
  }
  if (!last) return;
  // remplace l'onglet "Untitled" intact
  const pr = tabs.filter((t) => t.pristine && !t.dirty && !t.path);
  show(last);
  for (const t of pr) if (tabs.length > 1 && t !== last) tabs.splice(tabs.indexOf(t), 1);
  renderTabs(); saveSession();
}

async function save(t) {
  if (!t.path) return saveAs(t);
  try { await invoke("write_file", { path: t.path, text: tabText(t) }); } catch (e) { status("err", tr("msg.saveFailed", { e })); return false; }
  t.dirty = false; renderTabs(); setTitle(); saveSession(); status("ok", tr("msg.saved", { name: t.name })); return true;
}
async function saveAs(t) {
  const p = await invoke("save_dialog", { name: stem(t) + ".tex", dir: dir(t.path) });
  if (!p) return false;
  const path = /\.tex$/i.test(p) ? p : p + ".tex";
  try { await invoke("write_file", { path, text: tabText(t) }); } catch (e) { status("err", tr("msg.saveFailed", { e })); return false; }
  t.path = path; t.name = base(path); t.dirty = false; t.pristine = false; renderTabs(); setTitle(); saveSession(); status("ok", tr("msg.saved", { name: t.name }));
  return true;
}
// true = on peut fermer (enregistré, abandonné, ou rien à enregistrer)
async function confirmClose(t) {
  if (!t.dirty) return true;
  show(t);
  const r = await invoke("ask_save", { title: tr("dlg.saveTitle", { name: t.name }), desc: tr("dlg.saveDesc"), save: tr("dlg.save"), dont: tr("dlg.dont"), cancel: tr("dlg.cancel") });
  if (r === 0) return save(t);
  if (r === 1) { t.dirty = false; return true; }
  return false;
}
async function closeTab(t) {
  if (!(await confirmClose(t))) return;
  const i = tabs.indexOf(t);
  if (tabs.length === 1) { tabs.splice(0, 1); cur = null; newTab(); return; }
  tabs.splice(i, 1);
  if (cur === t) { cur = null; show(tabs[Math.min(i, tabs.length - 1)]); } else renderTabs();
  saveSession();
}
async function quit() {
  await autosaveAll(); // auto-save actif: les fichiers nommés sont enregistrés sans question
  for (const t of tabs.slice()) if (!(await confirmClose(t))) return;
  saveSession(); invoke("quit");
}
const step = (d) => tabs.length > 1 && show(tabs[(tabs.indexOf(cur) + d + tabs.length) % tabs.length]);

// ---------- enregistrement automatique (optionnel: désactivé par défaut)
let saveOn = localStorage.autosave === "1", svT;
const saveUI = () => { $("asv").classList.toggle("on", saveOn); $("asv").setAttribute("aria-checked", saveOn); };
async function quietSave(t) { // enregistre sans message; seulement les fichiers qui ont déjà un chemin
  if (!t.dirty || !t.path) return;
  try { await invoke("write_file", { path: t.path, text: tabText(t) }); t.dirty = false; renderTabs(); setTitle(); saveSession(); } catch (e) { status("err", tr("msg.autoSaveFailed", { e })); }
}
const autosaveAll = () => saveOn && Promise.all(tabs.map(quietSave));
const setAutoSave = (on) => { saveOn = on; localStorage.autosave = on ? "1" : "0"; saveUI(); invoke("set_check", { id: "autosave", on }); if (on) autosaveAll(); };
$("asv").onclick = () => setAutoSave(!saveOn);
addEventListener("blur", () => autosaveAll()); // en quittant la fenêtre

// ---------- session (onglets + texte non enregistré)
function saveSession() {
  if (cur) cur.state = ed.state();
  localStorage.session = JSON.stringify({
    cur: tabs.indexOf(cur),
    tabs: tabs.filter((t) => t.path || t.dirty).map((t) => ({ path: t.path, name: t.name, dirty: t.dirty, text: t.dirty || !t.path ? tabText(t) : null })),
  });
}
async function restore() {
  try {
    const s = JSON.parse(localStorage.session || "null");
    for (const x of s?.tabs || []) {
      const disk = x.path ? await invoke("read_file", { path: x.path }) : null;
      if (x.path && disk == null && x.text == null) continue;
      const t = mk(x.path, x.text ?? disk, !!x.dirty); if (!x.path) t.name = x.name;
    }
    if (tabs.length) show(tabs[Math.max(0, Math.min(s.cur, tabs.length - 1))]);
  } catch {}
  if (!tabs.length) newTab();
}

// ---------- aperçu PDF (garde le scroll, annule les rendus périmés)
// Mémoire: un seul document pdf.js (ouvert à la demande, fermé après 60 s d'inactivité: les pages déjà dessinées restent affichées);
// seules les pages proches de l'écran ont un canvas (libéré dès qu'elles sortent).
let live = null, idleT; // live = { src: ArrayBuffer du PDF, p: Promise<PDFDocumentProxy> }
const IDLE_MS = 60000, MAX_PX = 4e6, MAX_LIVE = 3; // pixels max par canvas (~16 Mo) et nombre max de pages dessinées en même temps
let liveDivs = []; // pixels max par canvas (~24 Mo)
const closeDoc = () => { const l = live; live = null; l?.p.then((d) => d.destroy(), () => {}); };
const touchDoc = () => { clearTimeout(idleT); idleT = setTimeout(closeDoc, IDLE_MS); };
function getDoc(o) {
  touchDoc();
  if (live?.src === o.pdf) return live.p;
  closeDoc();
  const p = pdfjs.getDocument({ data: new Uint8Array(o.pdf.slice(0)), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, enableXfa: false, isOffscreenCanvasSupported: false }).promise;
  live = { src: o.pdf, p }; return p;
}
const freeCanvas = (d) => { d.sharp = false; d.querySelectorAll("canvas").forEach((c) => { c.width = c.height = 0; c.remove(); }); liveDivs = liveDivs.filter((x) => x !== d); };
// garde au plus MAX_LIVE pages dessinées: libère les plus éloignées du centre de l'écran (mémoire graphique)
const trimLive = () => {
  const mid = pvEl.scrollTop + pvEl.clientHeight / 2;
  while (liveDivs.length > MAX_LIVE) { liveDivs.sort((a, b) => Math.abs(b.offsetTop + b.offsetHeight / 2 - mid) - Math.abs(a.offsetTop + a.offsetHeight / 2 - mid)); freeCanvas(liveDivs[0]); }
};
async function render(buf, t) {
  if ($("pv").clientWidth < 60) return; // PDF replié: rendu au prochain affichage
  const my = ++gen;
  const pdf = await getDoc(t);
  const myZ = pz, pv = $("pv"), top = pv.scrollTop, left = pv.scrollLeft, w = (pv.clientWidth - 24) * myZ, dpr = Math.min(devicePixelRatio, 2), ds = [];
  const io = new IntersectionObserver((es) => es.forEach(async (en) => {
    const d = en.target; d.vis = en.isIntersecting;
    if (!d.vis) { freeCanvas(d); return; }
    if (d.sharp || d.busy || my !== gen) return;
    d.busy = true;
    try {
      const pg = await (await getDoc(t)).getPage(+d.dataset.n);
      let sc = d.s * dpr; const v1 = pg.getViewport({ scale: 1 });
      sc = Math.min(sc, Math.sqrt(MAX_PX / (v1.width * v1.height)));
      const v = pg.getViewport({ scale: sc }), c = document.createElement("canvas");
      c.width = v.width; c.height = v.height; c.style.width = d.style.width;
      await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      pg.cleanup();
      if (my === gen && d.vis) { d.querySelectorAll("canvas").forEach((x) => { x.width = x.height = 0; x.remove(); }); d.prepend(c); d.sharp = true; liveDivs.push(d); trimLive(); }
      else { c.width = c.height = 0; }
    } catch {} finally { d.busy = false; }
  }), { root: pv, rootMargin: "100px 0px" });
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i), v = pg.getViewport({ scale: 1 }), d = document.createElement("div"); pg.cleanup();
    d.dataset.n = i; d.s = w / v.width; d.ph = v.height; d.style.height = v.height * d.s + "px"; d.style.width = w + "px"; ds.push(d);
    const old = pv.children[i - 1]?.querySelector("canvas"); // garde l'ancienne image (étirée) jusqu'au rendu net: pas de clignotement
    if (old) { old.style.width = w + "px"; d.append(old); }
    if (pz !== myZ) d.style.zoom = pz / myZ; // l'utilisateur a re-zoomé pendant le rendu
  }
  if (my !== gen) return;
  window.__io?.disconnect(); window.__io = io; rz = myZ; t.pages = pdf.numPages; liveDivs = [];
  pv.replaceChildren(...ds); pv.scrollTop = top; pv.scrollLeft = left; ds.forEach((d) => io.observe(d)); updPage();
}

// ---------- panneau d'erreurs (cliquable)
const esc = (x) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function parseErrors(log) {
  const L = log.split("\n"), out = [];
  for (let i = 0; i < L.length; i++) {
    let m = L[i].match(/^error: (?:(.+?\.tex):(\d+): )?(.*)$/);
    if (m && /something bad happened|unrecoverable error|^caused by|halted on/.test(m[3])) m = null;
    if (m && m[1]) out.push({ file: m[1], line: +m[2], msg: m[3] });
    else if (m && m[3] && !/^the .* engine/.test(m[3])) out.push({ msg: m[3] });
    const c = L[i].match(/^l\.(\d+) (.*)$/), e = out[out.length - 1];
    if (c && e && !e.ctx) { e.ctx = [L[i], (L[i + 1] || "").trim()]; e.line ??= +c[1]; }
  }
  if (!out.length) for (const l of L) { const m = l.match(/^! (.*)/); if (m) out.push({ msg: m[1] }); }
  return out;
}
async function openAt(file, line, word) {
  const o = own(cur);
  const path = file === "texput.tex" || !file ? o.path : file.startsWith("/") ? file : (dir(o.path || "") + "/" + file.replace(/^\.\//, ""));
  const t = path ? (tabs.find((x) => x.path === path) || (await openPaths([path]), tabs.find((x) => x.path === path))) : o;
  if (t) { show(t); ed.goto(line, word); }
}
const actionRow = (title, names, text, label, fn) => {
  const d = document.createElement("div"); d.className = "e act";
  d.innerHTML = `<div class="m">${esc(title)}</div><span class="loc">${esc(names)}</span><div style="margin-top:6px;color:var(--muted)">${esc(text)}</div>`;
  const b = document.createElement("button"); b.textContent = label; b.onclick = fn; d.append(b); return d;
};
function showLog(t, warnMode = false) {
  const el = $("err"), list = $("errlist");
  const missing = t.log?.startsWith("MISSING\n") ? t.log.split("\n").slice(1).filter(Boolean) : [];
  if (warnMode ? !t.warns?.length : !t.log) { el.classList.remove("on"); return; }
  el.classList.toggle("warn", warnMode);
  const errs = warnMode ? t.warns : missing.length ? [] : parseErrors(t.log), rows = [];
  if (missing.length) rows.push(actionRow(tr("err.pkgNeeded", { n: missing.length }), missing.join(", "),
    tr("err.pkgText"), tr("err.downloadBtn"), () => compile(cur, true)));
  else if (!warnMode) {
    const nf = [...new Set([...t.log.matchAll(/File [`'‘]([^`'’\n]+)['’] not found/g)].map((m) => m[1]))].filter((n) => !n.includes("#"));
    if (nf.length) rows.push(actionRow(tr("err.fileNotFound"), nf.join(", "), tr("err.fileNotFoundText"), tr("err.addFileBtn"), async () => {
      const src = await invoke("pick_file"), d = dir(own(cur).path || "");
      if (!src) return; if (!d) return status("err", tr("msg.saveFirst"));
      await invoke("copy_into", { src, dir: d, sub: "." }); compile(cur);
    }));
  }
  $("errt").textContent = warnMode ? tr("err.warn", { n: errs.length }) : missing.length ? tr("err.downloadNeeded") : errs.length ? tr("err", { n: errs.length }) : tr("err.failed");
  $("errc").textContent = missing.length ? "" : tr("err.clickToJump");
  list.replaceChildren(...rows, ...errs.map((e) => {
    const d = document.createElement("div"); d.className = "e";
    d.innerHTML = `<div class="m">${esc(e.msg)}</div>` + (e.line ? `<span class="loc">${e.file && e.file !== "texput.tex" ? esc(e.file.split("/").pop()) + " · " : ""}line ${e.line}</span>` : "") +
      (e.ctx ? `<pre>${esc(e.ctx[0])}<br>${esc(e.ctx[1])}</pre>` : "");
    if (e.line) d.onclick = () => openAt(e.file, e.line); else d.style.cursor = "default";
    return d;
  }));
  $("raw").textContent = t.log || ""; $("raw").classList.toggle("on", !warnMode && !errs.length && !missing.length && !rows.length);
  $("rawb").style.display = t.log && !missing.length ? "" : "none";
  el.classList.add("on");
}
$("st").onclick = () => { if (split >= 97) setSplit(prevSplit < 97 && prevSplit > 3 ? prevSplit : 50); const o = own(cur); if (o.ok === false) showLog(o); else if (o.warns?.length) showLog(o, true); };
$("errx").onclick = () => $("err").classList.remove("on");
$("rawb").onclick = () => $("raw").classList.toggle("on");

// ---------- zoom du PDF (boutons, ⌘+molette, pincement)
let pz = +localStorage.pz || 1, rz = pz, zt; // pz = zoom voulu, rz = zoom auquel les canvas sont dessinés
// Zoom instantané (CSS zoom sur les pages, ancré sur le curseur), puis re-rendu net après une courte pause.
const setZoom = (z, ax, ay) => {
  const nz = Math.min(4, Math.max(0.4, z)), pv = $("pv"); if (nz === pz) return;
  const k = nz / pz, sx = pv.scrollLeft, sy = pv.scrollTop;
  ax ??= pv.clientWidth / 2; ay ??= pv.clientHeight / 2;
  pz = nz; localStorage.pz = nz; $("zl").textContent = Math.round(pz * 100) + "%";
  for (const d of pv.children) d.style.zoom = pz / rz;
  pv.scrollLeft = (sx + ax) * k - ax; pv.scrollTop = (sy + ay) * k - ay;
  clearTimeout(zt);
  zt = setTimeout(() => { const o = cur && own(cur); if (o?.pdf) render(o.pdf, o); }, 160);
};
$("zi").onclick = () => setZoom(pz * 1.15); $("zo").onclick = () => setZoom(pz / 1.15); $("zl").onclick = () => setZoom(1);
$("zl").textContent = Math.round(pz * 100) + "%";
const anchor = (e) => { const r = $("pv").getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
$("pv").addEventListener("wheel", (e) => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(pz * Math.exp(-Math.max(-25, Math.min(25, e.deltaY)) * 0.01), ...anchor(e)); }
}, { passive: false });
let gz = 1; // pincement trackpad (Safari/WKWebView)
$("pv").addEventListener("gesturestart", (e) => { e.preventDefault(); gz = pz; });
$("pv").addEventListener("gesturechange", (e) => { e.preventDefault(); setZoom(gz * e.scale, ...anchor(e)); });
$("dlpdf").onclick = () => acts.export();

// ---------- page courante / navigation
const pvEl = $("pv");
const pageNow = () => { let n = 1; [...pvEl.children].forEach((d, i) => { if (d.offsetTop <= pvEl.scrollTop + pvEl.clientHeight / 3) n = i + 1; }); return n; };
function updPage() { const n = pvEl.children.length; $("pn").textContent = n ? pageNow() : "–"; $("pt").textContent = n || "–"; }
const goPage = (n) => { const d = pvEl.children[Math.min(Math.max(n, 1), pvEl.children.length) - 1]; d && pvEl.scrollTo({ top: d.offsetTop - 12, behavior: "smooth" }); };
pvEl.addEventListener("scroll", updPage);
$("pp").onclick = () => goPage(pageNow() - 1); $("np").onclick = () => goPage(pageNow() + 1);

// ---------- SyncTeX (source ⇄ PDF)
async function loadSync(o) {
  if (o.sync) return o.sync;
  const buf = await invoke("synctex", { id: o.id });
  if (!buf.byteLength) return null;
  const txt = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  const tags = {}, recs = []; let page = 0;
  for (const l of txt.split("\n")) {
    if (l[0] === "I") { const m = l.match(/^Input:(\d+):(.+)$/); if (m) tags[m[1]] = m[2]; continue; }
    if (l[0] === "{") { page = +l.slice(1); continue; }
    const m = /^([\[(hvxkg$])(\d+),(\d+)(?:,\d+)?:(-?\d+),(-?\d+)(?::(-?\d+)(?:,(-?\d+),(-?\d+))?)?/.exec(l);
    if (m && page && (tags[m[2]] === "texput" || /\.tex$/.test(tags[m[2]] || ""))) {
      const k = 65781.76; // sp → bp (= unités PDF)
      recs.push({ p: page, tag: m[2], line: +m[3], t: m[1], x: +m[4] / k, y: +m[5] / k, w: +(m[6] || 0) / k, h: +(m[7] || 0) / k, d: +(m[8] || 0) / k });
    }
  }
  return (o.sync = { tags, recs });
}
const tagPath = (o, sy, tag) => (sy.tags[tag] === "texput" ? o.path : sy.tags[tag]);

// éditeur → PDF: surligne la ligne (et le mot sous le curseur si on le retrouve dans le texte du PDF)
const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w) => new RegExp("(?<![\\p{L}\\p{N}])" + escRe(w) + "(?![\\p{L}\\p{N}])", "gu");
function showHit(p, rect) {
  const d = pvEl.children[p - 1]; if (!d) return;
  pvEl.scrollTo({ top: d.offsetTop + rect.y * d.s - pvEl.clientHeight / 3, behavior: "smooth" });
  const hit = document.createElement("div"); hit.className = "hit";
  Object.assign(hit.style, { left: rect.x * d.s - 3 + "px", top: rect.y * d.s - 2 + "px", width: rect.w * d.s + 6 + "px", height: rect.h * d.s + 4 + "px" });
  d.append(hit); setTimeout(() => hit.remove(), 2300);
}
// occurrences de `needle` dans le texte de la page p (ordre de lecture), éventuellement limitées à une zone
async function pageOcc(doc, p, needle, zone) {
  const pg = await doc.getPage(p), tc = await pg.getTextContent(), ph = pg.getViewport({ scale: 1 }).height, out = [], re = wordRe(needle);
  for (const it of tc.items) {
    const ty = ph - it.transform[5], tx = it.transform[4];
    if (zone && !(ty >= zone.y0 - 3 && ty <= zone.y1 + 3 && tx >= zone.x0 - 3 && tx <= zone.x1 + 3)) continue;
    re.lastIndex = 0; let m;
    while ((m = re.exec(it.str))) { const h = Math.max(it.height, 8); out.push({ x: tx + (it.width * m.index) / it.str.length, y: ty - h, w: (it.width * needle.length) / it.str.length, h: h + 3 }); }
  }
  pg.cleanup(); return out;
}

// Éditeur → PDF: du mot (ou de la sélection) sous le curseur à sa place dans le PDF.
// 1) SyncTeX donne la zone du paragraphe/ligne; 2) dans cette zone on retrouve la n-ième occurrence du mot (n = rang dans la ligne source);
// 3) sinon, recherche du texte dans tout le PDF (chaque appel passe à l'occurrence suivante).
let findState = { needle: "", i: 0 };
async function syncToPdf() {
  const o = own(cur); if (!o.pdf) return status("err", tr("msg.compileFirst"));
  const { line, word, sel, before } = ed.cursor(), needle = (sel || word).trim(), doc = await getDoc(o), sy = await loadSync(o);
  let zone = null;
  if (sy) {
    const mine = sy.recs.filter((r) => r.t !== "[" && tagPath(o, sy, r.tag) === (cur.path || o.path));
    let best = Infinity, L = line;
    for (const r of mine) { const d = Math.abs(r.line - line) + (r.line > line ? 0.1 : 0); if (d < best) { best = d; L = r.line; } }
    const hits = mine.filter((r) => r.line === L);
    if (hits.length) {
      const byPage = {}; hits.forEach((r) => (byPage[r.p] = (byPage[r.p] || 0) + 1));
      const p = +Object.keys(byPage).sort((a, b) => byPage[b] - byPage[a])[0];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const r of hits.filter((r) => r.p === p)) {
        const box = (r.t === "(" || r.t === "h") && r.w > 0 && r.h > 0 && r.h < 40;
        const [ax, ay, bx, by] = box ? [r.x, r.y - r.h, r.x + r.w, r.y + r.d] : [r.x, r.y - 9, r.x + r.w, r.y + 3];
        x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
      }
      zone = { p, x0, y0, x1, y1 };
    }
  }
  if (zone && needle) {
    const k = (before.match(wordRe(needle)) || []).length, occ = await pageOcc(doc, zone.p, needle, zone);
    if (occ.length) return showHit(zone.p, occ[Math.min(k, occ.length - 1)]);
  }
  if (zone) return showHit(zone.p, { x: zone.x0, y: zone.y0, w: zone.x1 - zone.x0, h: zone.y1 - zone.y0 });
  if (needle) { // repli: recherche dans tout le PDF
    const all = []; for (let p = 1; p <= doc.numPages; p++) for (const r of await pageOcc(doc, p, needle)) all.push({ p, r });
    if (all.length) { findState = { needle, i: findState.needle === needle ? (findState.i + 1) % all.length : 0 }; const h = all[findState.i]; return showHit(h.p, h.r); }
  }
  status("err", needle ? tr("msg.notFoundInPdf", { w: needle }) : tr("msg.cursorOnWord"));
}
$("syncb").onclick = () => syncToPdf();

// PDF → éditeur (double-clic ou ⌘-clic): saute à la ligne et sélectionne le mot cliqué
async function syncToSource(e) {
  const d = e.target.closest("#pv > div"), o = own(cur); if (!d || !o.pdf) return;
  const sy = await loadSync(o); if (!sy) return;
  const r0 = d.getBoundingClientRect(), p = +d.dataset.n, px = (e.clientX - r0.left) / d.s, py = (e.clientY - r0.top) / d.s;
  let best = null, bs = 1e9;
  for (const r of sy.recs) {
    if (r.p !== p || r.t === "[" || r.t === "(") continue;
    const dx = px >= r.x && px <= r.x + r.w ? 0 : Math.min(Math.abs(px - r.x), Math.abs(px - r.x - r.w)), dy = Math.abs(py - (r.y - 3));
    if (dy < 12 && dx + 4 * dy < bs) { bs = dx + 4 * dy; best = r; }
  }
  if (!best) return;
  let word = "";
  try { // mot sous le clic d'après le texte du PDF
    const pg = await (await getDoc(o)).getPage(p), tc = await pg.getTextContent(), ph = d.ph;
    for (const it of tc.items) {
      const ty = ph - it.transform[5], x = it.transform[4];
      if (Math.abs(py - (ty - it.height / 2)) < Math.max(it.height, 8) && px >= x && px <= x + it.width && it.str.length) {
        const k = Math.min(it.str.length - 1, Math.floor(((px - x) / it.width) * it.str.length)), re = /[\p{L}\p{N}]/u;
        let a = k, z = k; if (!re.test(it.str[k])) break;
        while (a > 0 && re.test(it.str[a - 1])) a--; while (z < it.str.length - 1 && re.test(it.str[z + 1])) z++;
        word = it.str.slice(a, z + 1); break;
      }
    }
  } catch {}
  openAt(tagPath(o, sy, best.tag), best.line, word);
}
pvEl.addEventListener("dblclick", syncToSource);
pvEl.addEventListener("click", (e) => e.metaKey && syncToSource(e));

// ---------- diagnostics dans l'éditeur (lignes soulignées) + données d'autocomplétion (labels, clés .bib)
function applyMarks() {
  const o = own(cur), list = [];
  for (const d of o.diag || []) {
    const path = !d.file || d.file === "texput.tex" ? o.path : d.file.startsWith("/") ? d.file : dir(o.path || "") + "/" + d.file.replace(/^\.\//, "");
    if ((path ? path === cur.path : cur === o) && d.line) list.push({ line: d.line, kind: d.kind, msg: d.msg });
  }
  ed.setMarks(list);
}
async function refreshData(withBib) {
  const o = own(cur), labels = new Set(), ot = tabText(o);
  for (const t of tabs) if (t === o || !o.path || !t.path || t.path.startsWith(dir(o.path) + "/")) for (const m of tabText(t).matchAll(/\\label\{([^}\n]+)\}/g)) labels.add(m[1]);
  const upd = { labels: [...labels] };
  if (withBib && o.path) {
    const names = [];
    for (const m of ot.matchAll(/\\bibliography\{([^}]*)\}/g)) names.push(...m[1].split(","));
    for (const m of ot.matchAll(/\\addbibresource(?:\[[^\]]*\])?\{([^}]*)\}/g)) names.push(m[1]);
    const bib = [];
    for (let n of names) {
      n = n.trim(); if (!n) continue; if (!/\.bib$/i.test(n)) n += ".bib";
      const txt = await invoke("read_file", { path: n.startsWith("/") ? n : dir(o.path) + "/" + n }); if (txt == null) continue;
      for (const m of txt.matchAll(/^@(\w+)\s*\{\s*([^,\s]+)\s*,/gm)) {
        const ti = /title\s*=\s*[{"]+([^}"]{0,70})/i.exec(txt.slice(m.index, m.index + 900));
        bib.push({ key: m[2], detail: ti ? ti[1].trim() : m[1] });
      }
    }
    upd.bib = bib;
  }
  ed.setData(upd);
}

// ---------- plan du document (barre latérale)
let outItems = [], outOn = localStorage.outline !== "0";
const OUT = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?(?:\[[^\]]*\])?\{(.*)$/, LV = { part: 0, chapter: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 3 };
function buildOutline() {
  if (!outOn) return;
  outItems = [];
  ed.get().split("\n").forEach((l, i) => {
    const m = OUT.exec(l); if (!m) return;
    let d = 1, k = 0; for (; k < m[2].length; k++) { if (m[2][k] === "{") d++; else if (m[2][k] === "}" && --d === 0) break; }
    outItems.push({ line: i + 1, lv: LV[m[1]], title: m[2].slice(0, k).replace(/\\[a-zA-Z]+\*?/g, "").replace(/[{}$]/g, "").trim() || "…" });
  });
  const min = Math.min(...outItems.map((x) => x.lv), 3);
  $("olist").replaceChildren(...(outItems.length ? outItems.map((it) => {
    const d = document.createElement("div"); d.className = "l" + Math.min(3, it.lv - min); d.textContent = it.title; d.title = it.title; d.dataset.line = it.line;
    d.onclick = () => ed.goto(it.line); return d;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: tr("ui.noSections") })]));
  markOutline();
}
function markOutline() {
  if (!outOn) return;
  const l = ed.cursor().line; let idx = -1; outItems.forEach((it, i) => { if (it.line <= l) idx = i; });
  [...$("olist").children].forEach((c, i) => c.classList.toggle("on", i === idx));
}
const setOutline = (on) => { outOn = on; localStorage.outline = on ? "1" : "0"; $("outline").classList.toggle("off", !on); $("tsb").classList.toggle("on", on); buildOutline(); };
$("tsb").onclick = () => setOutline(!outOn);
const setOW = (w) => document.documentElement.style.setProperty("--ow", w + "px");
setOW(+localStorage.outW || 210);
const ob = $("obar"); // poignée: glisser pour régler la largeur (140–420 px), double-clic = 210
ob.onpointerdown = (e) => { ob.setPointerCapture(e.pointerId); ob.classList.add("on"); };
ob.onpointermove = (e) => { if (ob.classList.contains("on")) setOW(Math.round(Math.min(420, Math.max(140, e.clientX - $("outline").getBoundingClientRect().left)))); };
ob.onpointerup = () => { ob.classList.remove("on"); localStorage.outW = parseInt(getComputedStyle($("outline")).width); };
ob.ondblclick = () => { setOW(210); localStorage.outW = 210; };

// ---------- guide intégré (menu Help): guide.<langue>.html, repli sur l'anglais
const fetchGuide = async () => { for (const l of [curLang(), "en"]) { const r = await fetch(`guide.${l}.html`); if (r.ok) return r.text(); } return ""; };
async function openGuide(anchor) {
  const body = $("gbody");
  body.innerHTML = await fetchGuide();
  $("guide").classList.add("on");
  const target = anchor && body.querySelector(anchor); target ? target.scrollIntoView() : (body.closest(".gc").scrollTop = 0);
}
const closeGuide = () => { $("guide").classList.remove("on"); $("gbody").replaceChildren(); }; // le DOM du guide est libéré à la fermeture
$("gx").onclick = closeGuide;
$("guide").addEventListener("mousedown", (e) => { if (e.target === $("guide")) closeGuide(); });
$("gbody").addEventListener("click", (e) => { const a = e.target.closest("a[href^='#']"); if (a) { e.preventDefault(); $("gbody").querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); } });

// ---------- fiches LaTeX (latexref.js), dans la même fenêtre que le guide
async function openLatexRef() {
  const { sheets } = await import("./latexref.js"), list = sheets((fr, en) => (curLang() === "fr" ? fr : en));
  const el = (tag, text, props) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  const toc = el("div", "", { className: "toc" }), parts = [el("h1", tr("menu.latexref")), toc];
  for (const [id, title, tex] of list) {
    toc.append(el("a", title, { href: "#ref-" + id }));
    const bar = el("div", "", { className: "toc" });
    bar.append(
      el("button", tr("ui.dlTex"), { onclick: async () => {
        const p = await invoke("save_dialog", { name: `latex-${id}.tex`, dir: null });
        if (!p) return;
        try { await invoke("write_file", { path: p, text: tex }); status("ok", tr("msg.saved", { name: base(p) })); } catch (e) { status("err", tr("msg.saveFailed", { e })); }
      } }),
      el("button", tr("ui.openTex"), { onclick: () => { closeGuide(); newTab(tex); } }),
    );
    parts.push(el("h2", title, { id: "ref-" + id }), bar, el("pre", tex.slice(tex.indexOf("\\maketitle") + 11, tex.indexOf("\\end{document}")).trim()));
  }
  $("gbody").replaceChildren(...parts);
  $("guide").classList.add("on"); $("gbody").closest(".gc").scrollTop = 0;
}

// ---------- orthographe anglaise (soulignement rouge; clic droit = suggestions)
let spellOn = localStorage.spell !== "0";
const spellUI = () => { $("spb").classList.toggle("on", spellOn); $("spb").setAttribute("aria-checked", spellOn); };
const setSpellCheck = (on) => { spellOn = on; localStorage.spell = on ? "1" : "0"; spellUI(); invoke("set_check", { id: "spell", on }); ed.setSpell(on, showSpellMenu); if (!on) $("slang").textContent = ""; };
$("spb").onclick = () => setSpellCheck(!spellOn);
function showSpellMenu(i) {
  const m = $("spell"); m.replaceChildren();
  const item = (txt, cls, fn) => { const d = document.createElement("div"); d.textContent = txt; if (cls) d.className = cls; if (fn) d.onclick = () => { closeSpell(); fn(); }; else d.style.cursor = "default"; m.append(d); };
  item(`“${i.word}”`, "hd");
  if (i.suggestions.length) i.suggestions.forEach((x) => item(x, "sg", () => ed.replace(i.from, i.to, x))); else item(tr("spell.none"), "hd");
  m.append(document.createElement("hr"));
  item(tr("spell.add"), "", () => ed.spellAdd(i.word)); item(tr("spell.ignore"), "", () => ed.spellIgnore(i.word));
  m.style.left = Math.min(i.x, innerWidth - 200) + "px"; m.style.top = Math.min(i.y, innerHeight - 40 - (i.suggestions.length + 3) * 28) + "px"; m.classList.add("on");
}
const closeSpell = () => $("spell").classList.remove("on");
addEventListener("mousedown", (e) => { if (!e.target.closest("#spell")) closeSpell(); }); addEventListener("blur", closeSpell);

// ---------- barre d'outils (gras, listes, formules…) et images
$("vbar").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); // garde le focus/la sélection dans l'éditeur
const tools = {
  bold: () => ed.wrap("\\textbf{", "}"), italic: () => ed.wrap("\\textit{", "}"), underline: () => ed.wrap("\\underline{", "}"),
  ul: () => ed.list("itemize"), ol: () => ed.list("enumerate"),
  math: () => ed.wrap("$", "$"), dmath: () => ed.wrap("\\[\n  ", "\n\\]"),
  cite: () => ed.insert("\\cite{${}}"), ref: () => ed.insert("\\ref{${}}"),
  img: async () => { const p = await invoke("pick_file"); if (p) /\.(png|jpe?g|pdf)$/i.test(p) ? insertImages([p]) : status("err", tr("msg.chooseImage")); },
};
$("vbar").onclick = (e) => tools[e.target.closest("button")?.dataset.a]?.();
$("hsel").onchange = () => { ed.heading($("hsel").value); $("hsel").value = ""; };

// Image déposée/choisie: copiée dans <projet>/figures/ si elle est ailleurs, puis \includegraphics dans un environnement figure.
async function insertImages(paths) {
  const o = own(cur), texdir = o.path ? dir(o.path) : null, blocks = [];
  for (const p of paths) {
    let rel = p;
    if (texdir) rel = p.startsWith(texdir + "/") ? p.slice(texdir.length + 1) : (await invoke("copy_into", { src: p, dir: texdir })) || p;
    const stem = base(rel).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "-");
    blocks.push(`\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${rel}}\n  \\caption{\${}}\n  \\label{fig:${stem}}\n\\end{figure}\n`);
  }
  if (cur === o && !/graphicx/.test(tabText(o))) { // le paquet doit être chargé dans le préambule
    const m = /\\documentclass[^\n]*\n/.exec(tabText(o)); if (m) ed.insertAt(m.index + m[0].length, "\\usepackage{graphicx}\n");
  }
  ed.insert(blocks.join("\n"), true);
  status("ok", paths.length > 1 ? tr("msg.imagesAdded", { n: paths.length }) : tr("msg.imageAdded", { name: base(paths[0]) }));
  if (!texdir) status("ok", tr("msg.imageUnsaved"));
}

// ---------- compilation
async function compile(t = cur, online = false) {
  clearTimeout(timer);
  if (busy) { again = t; return; }
  const o = own(t);
  busy = true; o.compiling = true; files = 0; mb = 0; line = ""; warns = []; $("prog").classList.add("on"); status("busy", tr("msg.compiling"));
  try {
    // un fichier inclus modifié doit être sur le disque pour que \input le voie
    if (t !== o && t.dirty && t.path) { await invoke("write_file", { path: t.path, text: tabText(t) }); t.dirty = false; renderTabs(); }
    const buf = await invoke("compile", { id: o.id, path: o.path, text: tabText(o), online });
    o.pdf = buf; o.ok = true; o.log = ""; o.sync = null; o.warns = warns.slice(); o.diag = o.warns;
    if (files > 5) { exp.f = files; exp.mb = Math.max(mb, 1); localStorage.exp = JSON.stringify(exp); }
    if (own(cur) === o) await render(buf, o);
  } catch (e) {
    o.ok = false; o.log = String(e); o.warns = warns.slice();
    o.diag = [...parseErrors(o.log).filter((x) => x.line).map((x) => ({ kind: "error", ...x })), ...o.warns];
  }
  busy = false; o.compiling = false; $("prog").classList.remove("on", "det"); showDl();
  if (own(cur) === o) { statusFor(o); showLog(o); applyMarks(); refreshData(true); }
  if (again) { const a = again; again = null; compile(a); }
}
const compileNow = async (t) => { while (busy) await new Promise((r) => setTimeout(r, 100)); await compile(t); return own(t).ok; };

async function exportPdf(t, dest = null) {
  if (!(await compileNow(t))) return;
  const o = own(t), r = await invoke("export_pdf", { id: o.id, name: stem(o), dir: dir(o.path), dest });
  if (r) status("ok", tr("msg.pdfSaved", { name: base(r) }));
}

// ---------- bouton Compile ("Autocompile on" quand l'auto-compilation est active) et mode Visual
const acUI = () => { $("acs").classList.toggle("on", autoOn); $("acs").setAttribute("aria-checked", autoOn); };
const setAutoCompile = (on) => { autoOn = on; localStorage.auto = on ? "1" : "0"; acUI(); invoke("set_check", { id: "auto", on }); if (on) compile(cur); };
$("acs").onclick = () => setAutoCompile(!autoOn);
let visualOn = localStorage.visual === "1";
const setVisual = (on) => {
  visualOn = on; localStorage.visual = on ? "1" : "0";
  if (on && !$("katexcss")) document.head.append(Object.assign(document.createElement("link"), { id: "katexcss", rel: "stylesheet", href: "katex/katex.min.css" })); // KaTeX seulement si Visual est utilisé
  ed.setVisual(on);
  $("mcode").classList.toggle("on", !on); $("mvis").classList.toggle("on", on); ed.focus();
};
$("mcode").onclick = () => setVisual(false); $("mvis").onclick = () => setVisual(true);

// ---------- menu natif (macOS) → actions
const acts = {
  new: () => newTab(),
  open: async () => { const p = await invoke("open_dialog"); if (p.length) openPaths(p); },
  close: () => closeTab(cur),
  save: () => save(cur),
  save_as: () => saveAs(cur),
  autosave: () => setAutoSave(!saveOn),
  spell: () => setSpellCheck(!spellOn),
  addword: () => { const w = ed.cursor().word; if (w) ed.spellAdd(w); },
  save_all: async () => { for (const t of tabs) if (t.dirty || !t.path) { show(t); if (!(await save(t))) return; } },
  export: () => exportPdf(cur),
  both: async () => { if (cur.path || (await saveAs(cur))) { await save(cur); exportPdf(cur, cur.path.replace(/\.tex$/i, "") + ".pdf"); } },
  reveal: () => cur.path && invoke("reveal", { path: cur.path }),
  undo: () => ed.undo(), redo: () => ed.redo(), find: () => ed.find(), find_next: () => ed.next(), find_prev: () => ed.prev(),
  goto: () => ed.gotoLine(), comment: () => ed.comment(),
  compile: () => compile(cur),
  sync: syncToPdf,
  main: () => { main = main === cur ? null : cur; localStorage.mainPath = main?.path || ""; renderTabs(); status("ok", main ? tr("msg.mainSet", { name: main.name }) : tr("msg.mainCleared")); compile(cur); },
  auto: () => setAutoCompile(!autoOn),
  visual: () => setVisual(!visualOn),
  outline: () => setOutline(!outOn),
  guide: () => openGuide(), latexref: () => openLatexRef(), keys: () => openGuide("#keys"),
  prefs: () => openPrefs(), pdfpane: () => togglePdfPane(),
  move_up: () => ed.moveUp(), move_down: () => ed.moveDown(), dup_line: () => ed.dupLine(),
  slang_auto: () => setSpellMode("auto"), slang_en: () => setSpellMode("en"), slang_fr: () => setSpellMode("fr"),
  ...Object.fromEntries(LANGS.map(([c]) => ["lang_" + c, () => setLanguage(c)])),
  ...Object.fromEntries(["article", "icml", "neurips", "ieee", "beamer", "cv", "letter"].map((id) => ["tpl_" + id, () => newFromTemplate(id)])),
  keep: () => setKeep(!keepOn),
  theme: () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"),
  ...Object.fromEntries(THEMES.map((n) => ["theme_" + n, () => setTheme(n)])),
  zoom_in: () => setFs(fs + 1), zoom_out: () => setFs(fs - 1), zoom_0: () => setFs(13),
  next_tab: () => step(1), prev_tab: () => step(-1),
  quit,
};
listen("menu", (e) => acts[e.payload]?.());
listen("open-paths", (e) => openPaths(e.payload));
$("run").onclick = () => compile(cur);
$("add").onclick = () => newTab();
win.onCloseRequested((e) => { e.preventDefault(); quit(); });
window.__TAURI__.webview.getCurrentWebview().onDragDropEvent((e) => {
  if (e.payload.type !== "drop") return;
  const tex = e.payload.paths.filter((x) => /\.tex$/i.test(x)), img = e.payload.paths.filter((x) => /\.(png|jpe?g|pdf)$/i.test(x));
  if (tex.length) openPaths(tex);
  if (img.length) insertImages(img);
});
addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSpell(); if ($("prefs").classList.contains("on")) { closePrefs(); return; } if ($("guide").classList.contains("on")) closeGuide(); else $("err").classList.remove("on"); } });
addEventListener("beforeunload", saveSession);

// ---------- séparateur éditeur / PDF: libre de 0 à 100 % (au-delà de 97 % le PDF se replie et le code prend toute la fenêtre)
let split = +localStorage.split || 50, rt, prevSplit = 50;
const rerender = () => $("pv").clientWidth > 60 && cur && own(cur).pdf && render(own(cur).pdf, own(cur));
function setSplit(p) {
  split = Math.max(0, Math.min(100, p)); localStorage.split = Math.round(split);
  const cr = split >= 97, cl = split <= 3;
  $("ed").style.display = cl ? "none" : ""; $("right").style.display = cr ? "none" : "";
  $("ed").style.flex = cr ? "1 1 0" : `${split} 1 0`; $("right").style.flex = cl ? "1 1 0" : `${100 - split} 1 0`; // la police ne change pas: le texte occupe la largeur disponible
  $("bar").classList.toggle("edge", cr || cl);
  clearTimeout(rt); rt = setTimeout(rerender, 150);
}
const togglePdfPane = () => { if (split >= 97 || split <= 3) setSplit(prevSplit < 97 && prevSplit > 3 ? prevSplit : 50); else { prevSplit = split; setSplit(100); } };
const bar = $("bar");
bar.onpointerdown = (e) => { bar.setPointerCapture(e.pointerId); bar.classList.add("on"); if (split > 3 && split < 97) prevSplit = split; };
bar.onpointermove = (e) => {
  if (!bar.classList.contains("on")) return;
  const m = $("ed").parentElement.getBoundingClientRect(), ob = $("outline").classList.contains("off") ? m.left : $("obar").getBoundingClientRect().right;
  setSplit(((e.clientX - ob) / (m.right - ob)) * 100);
};
bar.onpointerup = () => bar.classList.remove("on");
bar.ondblclick = () => setSplit(50);
new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rerender, 150); }).observe($("pv"));

// ---------- préférences, langue, modèles
let tabSz = +localStorage.tab || 4, wrapOn = localStorage.wrap !== "0", ligOn = localStorage.lig !== "0", closeOn = localStorage.close !== "0", spellMode = localStorage.spellLang || "auto";
const applyEditorPrefs = () => { ed.setPrefs({ tab: tabSz, wrap: wrapOn }); ed.setAutoClose(closeOn); document.documentElement.style.setProperty("--lig", ligOn ? "normal" : "none"); };
const setKeep = (on) => { keepOn = on; localStorage.keep = on ? "1" : "0"; invoke("set_keep", { keep: on }); invoke("set_check", { id: "keep", on }); };
const setSpellMode = (m) => { spellMode = m; localStorage.spellLang = m; $("slsel").value = m; ed.spellLang(m); invoke("set_slang_check", { mode: m }); };
$("slsel").onchange = () => setSpellMode($("slsel").value);
ed.onSpellLang((l) => ($("slang").textContent = spellOn ? l : ""));

async function setLanguage(c) {
  localStorage.lang = c; await loadLang(c); document.documentElement.lang = curLang(); applyI18n();
  invoke("set_menu_labels", { labels: menuLabels() }); invoke("set_lang_check", { code: curLang() });
  setTitle(); pos(ed.state()); words(); buildOutline(); if (cur) { statusFor(own(cur)); showLog(own(cur)); renderTabs(); }
  if ($("guide").classList.contains("on")) { $("gbody").replaceChildren(); openGuide(); }
  if ($("prefs").classList.contains("on")) openPrefs();
}
async function newFromTemplate(id) { const { TEMPLATES } = await import("./templates.js"); newTab(TEMPLATES[id]); }

const THEME_IDS = ["system", "light", "light-header", "intellij", "islands-light", "fleet-light", "dark", "darcula", "islands-dark", "fleet-dark", "hc"];
function openPrefs() {
  const b = $("pbody"), mk = (tag, txt, cls) => Object.assign(document.createElement(tag), { textContent: txt ?? "", className: cls ?? "" });
  b.replaceChildren(mk("h1", tr("prefs.title")));
  const sect = (k) => b.append(mk("h2", tr(k)));
  const row = (label, ctl, tip) => { const r = mk("div", "", "prow"), l = mk("span", label); if (tip) l.append(mk("small", tip)); r.append(l, ctl); b.append(r); };
  const sw = (get, set) => { const x = mk("button", "", "tog"); x.append(mk("i", "", "trk")); x.setAttribute("role", "switch"); const paint = () => { x.classList.toggle("on", !!get()); x.setAttribute("aria-checked", !!get()); }; paint(); x.onclick = () => { set(!get()); paint(); }; return x; };
  const sel = (opts, val, set) => { const x = mk("select"); opts.forEach(([v, n]) => { const o = mk("option", n); o.value = v; x.append(o); }); x.value = val; x.onchange = () => set(x.value); return x; };
  const num = (val, min, max, set) => { const x = mk("input"); x.type = "number"; x.min = min; x.max = max; x.value = val; x.onchange = () => set(Math.min(max, Math.max(min, +x.value || val))); return x; };

  sect("prefs.general");
  row(tr("prefs.language"), sel(LANGS, curLang(), (v) => setLanguage(v)), tr("prefs.languageTip"));
  row(tr("prefs.theme"), sel(THEME_IDS.map((i) => [i, tr("menu.theme_" + i)]), themeName, (v) => setTheme(v)));
  sect("prefs.editor");
  row(tr("prefs.fontSize"), num(fs, 8, 32, (v) => setFs(v)));
  row(tr("prefs.tabSize"), sel([[2, "2"], [4, "4"], [8, "8"]], tabSz, (v) => { tabSz = +v; localStorage.tab = v; applyEditorPrefs(); }));
  row(tr("prefs.wrap"), sw(() => wrapOn, (v) => { wrapOn = v; localStorage.wrap = v ? "1" : "0"; applyEditorPrefs(); }), tr("prefs.wrapTip"));
  row(tr("prefs.ligatures"), sw(() => ligOn, (v) => { ligOn = v; localStorage.lig = v ? "1" : "0"; applyEditorPrefs(); }));
  row(tr("prefs.autoClose"), sw(() => closeOn, (v) => { closeOn = v; localStorage.close = v ? "1" : "0"; applyEditorPrefs(); }));
  sect("prefs.compile");
  row(tr("prefs.autocompile"), sw(() => autoOn, setAutoCompile));
  row(tr("prefs.autosave"), sw(() => saveOn, setAutoSave));
  row(tr("prefs.keep"), sw(() => keepOn, setKeep));
  sect("prefs.spelling");
  row(tr("prefs.spellOn"), sw(() => spellOn, setSpellCheck));
  row(tr("prefs.spellLang"), sel([["auto", tr("ui.langAuto")], ["en", "English"], ["fr", "Français"]], spellMode, setSpellMode));
  const words_ = ed.spellWords(), box = mk("div", "", "pwords");
  b.append(mk("h2", tr("prefs.userDict")));
  if (!words_.length) box.append(mk("small", tr("prefs.userDictEmpty")));
  words_.forEach((w) => { const c = mk("span", w), x = mk("b", "×"); x.onclick = () => { ed.spellRemove(w); c.remove(); }; c.append(x); box.append(c); });
  b.append(box);
  sect("prefs.window");
  row(tr("prefs.outline"), sw(() => outOn, setOutline));
  row(tr("prefs.visual"), sw(() => visualOn, setVisual));
  const reset = mk("button", tr("prefs.reset")); let armed = 0;
  reset.onclick = () => {
    if (!armed) { armed = 1; reset.textContent = tr("prefs.resetAsk"); setTimeout(() => { armed = 0; reset.textContent = tr("prefs.reset"); }, 5000); return; }
    const keep = { session: localStorage.session, guideSeen: "1", lang: localStorage.lang }; localStorage.clear(); for (const k in keep) if (keep[k]) localStorage[k] = keep[k]; location.reload();
  };
  const rr = mk("div", "", "prow"); rr.style.borderBottom = "0"; rr.append(reset); b.append(rr);
  $("prefs").classList.add("on");
}
const closePrefs = () => { $("prefs").classList.remove("on"); $("pbody").replaceChildren(); };
$("px").onclick = closePrefs; $("prefs").addEventListener("mousedown", (e) => { if (e.target === $("prefs")) closePrefs(); });

// ---------- démarrage
await loadLang(localStorage.lang || detectLang()); document.documentElement.lang = curLang(); applyI18n();
invoke("set_menu_labels", { labels: menuLabels() }); invoke("set_lang_check", { code: curLang() });
applyEditorPrefs(); setSplit(split); $("slsel").value = spellMode; ed.spellLang(spellMode); invoke("set_slang_check", { mode: spellMode });
invoke("set_keep", { keep: keepOn });
acUI(); saveUI(); spellUI(); if (saveOn) invoke("set_check", { id: "autosave", on: true });
if (!autoOn) invoke("set_check", { id: "auto", on: false });
if (!spellOn) invoke("set_check", { id: "spell", on: false });
if (!keepOn) invoke("set_check", { id: "keep", on: false });
await restore();
if (spellOn) ed.setSpell(true, showSpellMenu); // dictionnaire (~200 Ko) chargé seulement si la vérification est active
$("outline").classList.toggle("off", !outOn); $("tsb").classList.toggle("on", outOn); buildOutline(); refreshData(true);
if (!localStorage.guideSeen) { localStorage.guideSeen = "1"; openGuide(); } // première ouverture: présenter le guide
setVisual(visualOn);
main = tabs.find((t) => t.path && t.path === localStorage.mainPath) || null; renderTabs();
const pend = await invoke("take_pending"); if (pend.length) openPaths(pend);
{ const dbg = localStorage._open; if (dbg) { localStorage.removeItem("_open"); acts[dbg]?.(); } } // crochet de test: ouvre une action au démarrage
