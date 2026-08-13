import assert from "node:assert/strict";
import test from "node:test";

import { calculateCrap } from "../src/crap-score.ts";

test("calculates CRAP from complexity and fractional coverage", () => {
  assert.equal(calculateCrap(4, 0.5), 6);
  assert.equal(calculateCrap(1, 1), 1);
  assert.equal(calculateCrap(3, 0), 12);
});

test("returns null when coverage is unavailable", () => {
  assert.equal(calculateCrap(4, null), null);
});

test("rejects invalid inputs", () => {
  assert.throws(() => calculateCrap(0, 0.5), /complexity/i);
  assert.throws(() => calculateCrap(2, 1.1), /coverage/i);
});
