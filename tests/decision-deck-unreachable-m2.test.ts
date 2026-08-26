import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contextMenu = readFileSync(
  resolve(process.cwd(), "src/components/home/ContextMenu.tsx"),
  "utf8",
);
const indexRoute = readFileSync(
  resolve(process.cwd(), "src/routes/index.tsx"),
  "utf8",
);

describe("M2 DecisionDeck launcher unreachable in V0.2 UI", () => {
  it("ContextMenu no longer offers one-by-one DecisionDeck entry", () => {
    expect(contextMenu).not.toContain("하나씩 정리하기");
    expect(contextMenu).not.toContain("Sort one by one");
    expect(contextMenu).not.toContain("onOpenDecisionDeck");
    expect(contextMenu).toContain("전체 기록");
    expect(contextMenu).toContain("onOpenAllRecords");
  });

  it("Capture route does not wire ContextMenu to openDecisionDeck", () => {
    expect(indexRoute).not.toContain("onOpenDecisionDeck=");
    expect(indexRoute).toContain("onOpenAllRecords=");
  });
});
