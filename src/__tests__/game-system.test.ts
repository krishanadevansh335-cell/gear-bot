import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GameDatabase } from "../game-db.js";

test("Game Database initializes SQLite tables and seeds full catalog", () => {
  const testDbPath = path.resolve(process.cwd(), "data/test-gaming.db");
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new GameDatabase(testDbPath);
  db.seedCategoriesAndGames();

  const categories = db.getAllCategories();
  assert.equal(categories.length, 6, "Must seed 6 game categories");

  const allGames = db.getAllGames();
  assert.ok(allGames.length >= 80, `Must seed full catalog of games, found: ${allGames.length}`);

  // Check specific games from prompt
  const apex = db.getGameBySlug("apex-legends");
  assert.ok(apex, "Apex Legends must be seeded");
  assert.equal(apex.role_name, "Apex Squad");
  assert.equal(apex.category_id, "fps_competitive");

  const mhWilds = db.getGameBySlug("monster-hunter-wilds");
  assert.ok(mhWilds, "Monster Hunter Wilds must be seeded");
  assert.equal(mhWilds.category_id, "rpg_adventure");

  const lethal = db.getGameBySlug("lethal-company");
  assert.ok(lethal, "Lethal Company must be seeded");
  assert.equal(lethal.category_id, "coop_horror");

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test("Member game profile recording and player count increments", () => {
  const testDbPath = path.resolve(process.cwd(), "data/test-gaming-profiles.db");
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new GameDatabase(testDbPath);
  db.seedCategoriesAndGames();

  let apex = db.getGameBySlug("apex-legends")!;
  assert.equal(apex.member_count, 0);

  db.recordMemberGame("user_101", "apex-legends", "PC", "Pro");
  db.recordMemberGame("user_102", "apex-legends", "Console", "Intermediate");

  apex = db.getGameBySlug("apex-legends")!;
  assert.equal(apex.member_count, 2, "Member count must increment to 2");

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});

test("Dynamic game request queue and resolution workflow", () => {
  const testDbPath = path.resolve(process.cwd(), "data/test-gaming-requests.db");
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new GameDatabase(testDbPath);
  db.seedCategoriesAndGames();

  // 1. Submit request
  const req = db.createGameRequest("Silksong", "rpg_adventure", "user_101");
  assert.equal(req.game_name, "Silksong");
  assert.equal(req.status, "pending");

  const pending = db.getPendingRequests();
  assert.ok(pending.some((r) => r.game_name === "Silksong"));

  // 2. Moderator approves request
  const resolved = db.resolveGameRequest(req.id, "approved", "mod_999", "Approved for release");
  assert.equal(resolved?.status, "approved");
  assert.equal(resolved?.moderator_id, "mod_999");

  const pendingAfter = db.getPendingRequests();
  assert.equal(pendingAfter.some((r) => r.id === req.id), false);

  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
});
