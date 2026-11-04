import test from "node:test";
import assert from "node:assert/strict";
import { DiscordProvisioner } from "../provisioner.js";
test("Provisioner Preflight checks missing bot permissions", async () => {
    const mockGuild = {
        members: {
            fetchMe: async () => ({
                permissions: {
                    has: (perm) => false
                },
                roles: {
                    highest: { name: "TestBotRole", position: 5 }
                }
            })
        }
    };
    const mockDiscordService = {
        getGuild: () => mockGuild
    };
    const provisioner = new DiscordProvisioner(mockDiscordService);
    const preflight = await provisioner.checkPreflight();
    assert.equal(preflight.canManageRoles, false);
    assert.equal(preflight.canManageChannels, false);
    assert.equal(preflight.canViewChannels, false);
    assert.equal(preflight.missingBotPermissions.length, 3);
});
test("Provisioner aborts with FAILED status if preflight permissions missing", async () => {
    const mockGuild = {
        channels: {
            fetch: async () => new Map(),
            cache: new Map()
        },
        roles: {
            fetch: async () => new Map(),
            cache: new Map(),
            everyone: { id: "everyone_123" }
        },
        members: {
            fetchMe: async () => ({
                permissions: {
                    has: (perm) => false
                },
                roles: {
                    highest: { name: "TestBotRole", position: 1 }
                }
            })
        }
    };
    const mockDiscordService = {
        getGuild: () => mockGuild
    };
    const provisioner = new DiscordProvisioner(mockDiscordService);
    const report = await provisioner.provisionServer(false);
    assert.equal(report.status, "FAILED");
    assert.ok(report.summary.includes("Bot is missing mandatory guild permissions"));
    assert.equal(report.requiredManualActions.length, 1);
});
test("Minor/Adult isolation audit identifies permission leaks", async () => {
    const mockMinorChannel = {
        name: "minor-lfg",
        id: "minor_ch_1",
        parent: { name: "MINOR COMMUNITY" },
        permissionsFor: (role) => ({
            has: () => (role.name === "Adult 18+" ? true : false) // Simulated leak!
        })
    };
    const mockGuild = {
        channels: {
            fetch: async () => new Map(),
            cache: new Map([["minor_ch_1", mockMinorChannel]])
        },
        roles: {
            fetch: async () => new Map(),
            cache: new Map([
                ["adult_role_id", { name: "Adult 18+", id: "adult_role_id" }],
                ["minor_role_id", { name: "Minor 13-17", id: "minor_role_id" }]
            ]),
            everyone: { id: "everyone_123", name: "@everyone" }
        },
        members: {
            fetchMe: async () => ({
                permissions: {
                    has: () => true
                },
                roles: {
                    highest: { name: "AdminBotRole", position: 10 }
                }
            })
        }
    };
    const mockDiscordService = {
        getGuild: () => mockGuild
    };
    const provisioner = new DiscordProvisioner(mockDiscordService);
    const report = await provisioner.provisionServer(true);
    const minorAudit = report.accessAudit.find((a) => a.channelName === "minor-lfg");
    assert.ok(minorAudit, "minor-lfg audit must exist");
    assert.equal(minorAudit.isolationCompliant, false, "Must flag leak when Adult has access to minor channel");
    assert.ok(minorAudit.isolationNotes?.includes("CRITICAL LEAK"), "Must provide alert note for isolation leak");
});
//# sourceMappingURL=provisioner.test.js.map