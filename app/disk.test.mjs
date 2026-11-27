import assert from "node:assert";
import { diskState, diff } from "./src/disk.js";
assert.equal(diskState("a", "a", "mine"), "same");
assert.equal(diskState(null, "a", "mine"), "same"); // fichier supprimé: on peut le recréer
assert.equal(diskState("b", "a", "a"), "changed");
assert.equal(diskState("x\r\ny", "a", "x\ny"), "synced");
for (const [a, b] of [["", "abc"], ["abc", ""], ["aaa", "aaaa"], ["one two", "one 2 two"], ["same", "same"]]) {
  const c = diff(a, b);
  assert.equal(a.slice(0, c.from) + c.insert + a.slice(c.to), b);
}
console.log("ok");
