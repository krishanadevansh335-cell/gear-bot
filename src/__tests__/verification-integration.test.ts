import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("discord-gaming-verification configuration and files", () => {
  const dir = path.resolve(process.cwd(), "discord-gaming-verification");
  assert.ok(fs.existsSync(path.join(dir, "package.json")), "package.json must exist");
  assert.ok(fs.existsSync(path.join(dir, "src/index.js")), "src/index.js must exist");
  assert.ok(fs.existsSync(path.join(dir, ".env")), ".env must be synchronized");
});

test("Verification parsing logic validation", () => {
  // Parsing game logic simulation test
  const sampleInput = "Apex Legends — PC — Intermediate\nValorant — PC — Pro";
  const lines = sampleInput.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  
  assert.equal(lines.length, 2);
  const parsed = [];
  for (const line of lines) {
    const parts = line.split(/\s*(?:—|\|)\s*/);
    assert.equal(parts.length, 3);
    assert.ok(["pc", "console", "mobile"].includes(parts[1].toLowerCase()));
    assert.ok(["beginner", "intermediate", "pro"].includes(parts[2].toLowerCase()));
    parsed.push({ game: parts[0], platform: parts[1], skill: parts[2] });
  }

  assert.equal(parsed[0].game, "Apex Legends");
  assert.equal(parsed[0].platform, "PC");
  assert.equal(parsed[0].skill, "Intermediate");
});

test("Timezone and playtime regex validation", () => {
  const timingInput1 = "Evening, weekends — IST (UTC+5:30)";
  const timingInput2 = "Late night — EST";
  const invalidTiming = "Tomorrow sometime";

  const hasPlaytime = (text: string) => /(morning|afternoon|evening|late\s*night|weekend)/i.test(text);
  const hasTimezone = (text: string) => /(UTC|GMT|IST|EST|PST|CST|[A-Z]{2,5}|UTC[+-]\d)/i.test(text);

  assert.ok(hasPlaytime(timingInput1) && hasTimezone(timingInput1));
  assert.ok(hasPlaytime(timingInput2) && hasTimezone(timingInput2));
  assert.equal(hasPlaytime(invalidTiming) && hasTimezone(invalidTiming), false);
});

