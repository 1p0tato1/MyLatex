// node list.test.mjs
import assert from "node:assert";
import { EditorState } from "@codemirror/state";
import { continueItem } from "./list.js";

const run = (doc, anchor = doc.length) => {
  let out = null;
  continueItem({ state: EditorState.create({ doc, selection: { anchor } }), dispatch: (tr) => (out = tr.state.doc.toString()) });
  return out;
};
assert.equal(run("  \\item un"), "  \\item un\n  \\item ");
assert.equal(run("  \\item "), "  ");
assert.equal(run("  \\itemsep"), null);
assert.equal(run("texte"), null);
assert.equal(run("\\item un", 2), null);
console.log("ok");
