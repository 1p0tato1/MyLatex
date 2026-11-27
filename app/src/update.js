// Nouvelle version publiée sur GitHub ? Renvoie son numéro, sinon null (hors ligne, erreur: silencieux).
export const isNewer = (latest, current) => latest.localeCompare(current, undefined, { numeric: true }) > 0;
export async function newVersion(current) {
  try {
    const r = await fetch("https://api.github.com/repos/1p0tato1/MyLatex/releases/latest");
    const v = r.ok && (await r.json()).tag_name?.replace(/^v/, "");
    return v && isNewer(v, current) ? v : null;
  } catch { return null; }
}
