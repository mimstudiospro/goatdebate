import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const card = readFileSync(new URL("../components/DebateCard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../components/DebatePage.tsx", import.meta.url), "utf8");

describe("quippy copy", () => {
  it("uses Hiram's tagline verbatim as the hero tagline", () => {
    expect(app).toContain("The Greatest GOAT Debate Website of All Time");
    expect(indexHtml).toContain("The Greatest GOAT Debate Website of All Time");
  });

  it("keeps the quippy microcopy in place", () => {
    expect(app).toContain("No refunds on bad takes");
    expect(card).toContain("No votes yet — the floor is yours. End this argument.");
    expect(card).toContain("Your vote breaks it");
    expect(page).toContain("Locked in — tap to switch sides");
    expect(page).toContain("no judgment");
    expect(page).toContain("go start an argument");
    expect(page).toContain("you've picked your side");
  });
});
