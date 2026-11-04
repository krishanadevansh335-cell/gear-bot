import { test } from "node:test";
import assert from "node:assert";
import { BotArchitectureProvisioner } from "../bot-architecture-provisioner.js";
function makeCollection(entries) {
    const map = new Map(entries);
    return {
        get: (k) => map.get(k),
        has: (k) => map.has(k),
        values: () => map.values(),
        entries: () => map.entries(),
        forEach: (fn) => map.forEach(fn),
        find: (fn) => Array.from(map.values()).find(fn),
        filter: (fn) => Array.from(map.values()).filter(fn)
    };
}
test("BotArchitectureProvisioner identifies Administrator roles and enforces hierarchy check", async () => {
    const rolesCollection = makeCollection([
        ["r_gamer_gear", { id: "r_gamer_gear", name: "Gamer Gear", position: 46 }],
        ["r_wick", { id: "r_wick", name: "Wick", position: 49, managed: true, permissions: { has: () => true } }],
        ["r_xenon", { id: "r_xenon", name: "Xenon", position: 31, managed: true, permissions: { has: () => true } }]
    ]);
    const membersCollection = makeCollection([
        ["m_wick", {
                id: "m_wick",
                displayName: "Wick",
                user: { username: "Wick" },
                roles: {
                    highest: { name: "Wick", position: 49 },
                    cache: makeCollection([["r_wick", { id: "r_wick", name: "Wick", position: 49, managed: true, permissions: { has: () => true } }]])
                }
            }],
        ["m_xenon", {
                id: "m_xenon",
                displayName: "Xenon",
                user: { username: "Xenon" },
                roles: {
                    highest: { name: "Xenon", position: 31 },
                    cache: makeCollection([["r_xenon", { id: "r_xenon", name: "Xenon", position: 31, managed: true, permissions: { has: () => true } }]])
                }
            }]
    ]);
    const mockGuild = {
        roles: {
            fetch: async () => rolesCollection,
            cache: rolesCollection
        },
        members: {
            fetch: async () => membersCollection,
            fetchMe: async () => ({
                roles: { highest: { name: "Gamer Gear", position: 46 } }
            }),
            cache: membersCollection
        }
    };
    const provisioner = new BotArchitectureProvisioner(mockGuild);
    const results = await provisioner.remediateBotAdministratorRoles(true);
    // Wick is at pos 49 (above Gamer Gear at pos 46) -> manual required
    const wickResult = results.find((r) => r.botName === "Wick");
    assert.ok(wickResult);
    assert.strictEqual(wickResult.action, "manual_required");
    assert.strictEqual(wickResult.success, false);
    // Xenon is at pos 31 (below Gamer Gear at pos 46) -> can revoke
    const xenonResult = results.find((r) => r.botName === "Xenon");
    assert.ok(xenonResult);
    assert.strictEqual(xenonResult.action, "revoked");
    assert.strictEqual(xenonResult.success, true);
});
test("BotArchitectureProvisioner plans all 6 categories and channels in preview mode", async () => {
    const channelsCollection = makeCollection([
        ["ch_general", { id: "ch_general", name: "🌟general", type: 0, parentId: null }],
        ["ch_welcome", { id: "ch_welcome", name: "welcome", type: 0, parentId: null }]
    ]);
    const rolesCollection = makeCollection([
        ["r_verified", { id: "r_verified", name: "Verified Member" }],
        ["r_staff", { id: "r_staff", name: "Staff" }]
    ]);
    const mockGuild = {
        channels: {
            fetch: async () => channelsCollection,
            cache: channelsCollection
        },
        roles: {
            fetch: async () => rolesCollection,
            cache: rolesCollection,
            everyone: { id: "e_everyone", name: "@everyone" }
        },
        members: {
            fetchMe: async () => ({ id: "m_bot" })
        }
    };
    const provisioner = new BotArchitectureProvisioner(mockGuild);
    const actions = await provisioner.provisionCategoriesAndChannels(true);
    assert.ok(actions.length > 0);
    // Check categories created in preview
    const categories = actions.filter((a) => a.type === "category");
    assert.ok(categories.some((c) => c.name.includes("INFORMATION")));
    assert.ok(categories.some((c) => c.name.includes("COMMUNITY")));
    assert.ok(categories.some((c) => c.name.includes("GAMING")));
    assert.ok(categories.some((c) => c.name.includes("VOICE")));
    assert.ok(categories.some((c) => c.name.includes("BOT COMMANDS")));
    assert.ok(categories.some((c) => c.name.includes("STAFF & LOGS")));
    // Check channel rename preview for #🌟general -> #general-chat
    const generalRename = actions.find((a) => a.name === "general-chat" && a.action === "rename");
    assert.ok(generalRename);
});
//# sourceMappingURL=bot-architecture.test.js.map