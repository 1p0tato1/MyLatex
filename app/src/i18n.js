// Traductions: chargées à la demande (anglais + langue active seulement). Voir tools/build-lang.py pour ajouter une langue.
export const LANGS = [["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"]];
let en = {}, cur = {}, code = "en";
const get = async (c) => (await fetch(`lang/${c}.json`)).json();
export async function loadLang(c) {
  if (!LANGS.some((l) => l[0] === c)) c = "en";
  if (!Object.keys(en).length) en = await get("en");
  cur = c === "en" ? en : await get(c); code = c;
}
export const lang = () => code;
export const detectLang = () => { const n = (navigator.language || "en").slice(0, 2); return LANGS.some((l) => l[0] === n) ? n : "en"; };
// t("key", { n, name… }): {x} remplacés; si `n` est fourni, utilise key.one (n = 1) ou key.other
export function t(k, v) {
  let key = k; if (v && v.n !== undefined) { const f = k + (v.n === 1 ? ".one" : ".other"); if (cur[f] !== undefined || en[f] !== undefined) key = f; }
  let s = cur[key] ?? en[key] ?? k;
  return v ? s.replace(/\{(\w+)\}/g, (m, x) => (v[x] !== undefined ? v[x] : m)) : s;
}
// applique data-i18n (texte) et data-i18n-title (infobulle) à tout le document
export function apply(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n)));
  root.querySelectorAll("[data-i18n-title]").forEach((e) => (e.title = t(e.dataset.i18nTitle)));
}
// libellés de menu natifs: { id: texte } pour toutes les clés "menu.*"
export const menuLabels = () => { const o = {}; for (const k of new Set([...Object.keys(en), ...Object.keys(cur)])) if (k.startsWith("menu.")) o[k.slice(5)] = t(k); return o; };
