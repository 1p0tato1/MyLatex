// Entrée dans une liste: crée un nouvel \item ; sur un \item vide, le retire (sortie de liste).
export function continueItem({ state, dispatch }) {
  const sel = state.selection.main, line = state.doc.lineAt(sel.head);
  const m = /^([ \t]*)\\item(?![a-zA-Z])(\s*\[[^\]]*\])?[ \t]*/.exec(line.text);
  if (!sel.empty || state.selection.ranges.length > 1 || !m || sel.head < line.from + m[0].length) return false;
  const empty = !m[2] && m[0].length === line.length;
  const changes = empty ? { from: line.from + m[1].length, to: line.to } : { from: sel.head, insert: `\n${m[1]}\\item ` };
  const anchor = empty ? line.from + m[1].length : sel.head + changes.insert.length;
  dispatch(state.update({ changes, selection: { anchor }, scrollIntoView: true, userEvent: "input" }));
  return true;
}
