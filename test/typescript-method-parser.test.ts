import assert from "node:assert/strict";
import test from "node:test";

import { parseTypeScriptMethods } from "../src/typescript-method-parser.ts";

test("finds functions, methods, and named arrow functions", () => {
  const source = `
export function topLevel(value: number) {
  if (value > 0 && value < 10) return value;
  return 0;
}

export const choose = (ready: boolean) => ready ? 1 : 2;

class Greeter {
  constructor(private prefix: string) {}

  select = (ready: boolean) => ready ? 1 : 2;

  greet(name: string) {
    return this.prefix + name;
  }

  get label() {
    return this.prefix;
  }
}
`;

  const methods = parseTypeScriptMethods("src/sample.ts", source);

  assert.deepEqual(
    methods.map(({ name, className, complexity }) => ({ name, className, complexity })),
    [
      { name: "topLevel", className: null, complexity: 3 },
      { name: "choose", className: null, complexity: 2 },
      { name: "select", className: "Greeter", complexity: 2 },
      { name: "greet", className: "Greeter", complexity: 1 },
      { name: "label", className: "Greeter", complexity: 1 },
    ],
  );
});

test("counts TypeScript control-flow constructs but not nested function branches", () => {
  const source = `
function complicated(values?: number[]) {
  const safe = values ?? [];
  for (const value of safe) {
    if (value > 10 || value < 0) continue;
    switch (value) {
      case 1: break;
      case 2: break;
      default: break;
    }
  }
  try { return safe.length ? 1 : 0; } catch { return 0; }
  function nested(flag: boolean) { return flag ? 1 : 0; }
}
`;

  const [outer, nested] = parseTypeScriptMethods("src/sample.ts", source);

  assert.equal(outer.name, "complicated");
  assert.equal(outer.complexity, 10);
  assert.equal(nested.name, "nested");
  assert.equal(nested.complexity, 2);
});

test("ignores declarations, constructors, and anonymous callbacks", () => {
  const source = `
declare function ambient(value: string): void;
interface Worker { run(): void }
abstract class Base { abstract work(): void }
class Job { constructor() {} }
[1, 2].map((value) => value + 1);
`;

  assert.deepEqual(parseTypeScriptMethods("src/sample.ts", source), []);
});

test("parses TSX without treating JSX expressions as methods", () => {
  const source = `
export function Badge({ active }: { active: boolean }) {
  return <span>{active ? "on" : "off"}</span>;
}
`;

  const methods = parseTypeScriptMethods("src/badge.tsx", source);
  assert.equal(methods.length, 1);
  assert.equal(methods[0].name, "Badge");
  assert.equal(methods[0].complexity, 2);
});
