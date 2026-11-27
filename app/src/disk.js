// Fichier modifié ailleurs (git pull, autre éditeur) ? disk = contenu actuel, base = dernier contenu lu/écrit, mine = texte de l'onglet.
export const norm = (s) => s.replace(/\r\n?/g, "\n"); // CodeMirror n'a que des \n
export const diskState = (disk, base, mine) => (disk == null || disk === base ? "same" : norm(disk) === mine ? "synced" : "changed");
// plus petit remplacement transformant a en b (le curseur et l'annulation survivent au rechargement)
export function diff(a, b) {
  let from = 0, end = 0;
  while (from < a.length && from < b.length && a[from] === b[from]) from++;
  while (end < a.length - from && end < b.length - from && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  return { from, to: a.length - end, insert: b.slice(from, b.length - end) };
}
