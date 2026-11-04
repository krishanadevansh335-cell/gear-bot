import { loadConfig, validateDiscordConfig } from "./config.js";
import { DiscordService } from "./discord-service.js";
import { BotArchitectureProvisioner } from "./bot-architecture-provisioner.js";

async function main() {
  const args = process.argv.slice(2);
  const previewOnly = args.includes("--preview");

  console.log(`\n======================================================`);
  console.log(` BOT ROLE & CHANNEL PERMISSION ARCHITECTURE PROVISIONER`);
  console.log(` Mode: ${previewOnly ? "PREVIEW (Dry-Run / Read-Only)" : "LIVE EXECUTION"}`);
  console.log(`======================================================\n`);

  const config = loadConfig();
  const validation = validateDiscordConfig(config);
  if (!validation.valid) {
    console.error("Config validation failed:", validation.error);
    process.exit(1);
  }

  const discord = new DiscordService(config);
  try {
    await discord.connect();
    const guild = discord.getGuild();
    const provisioner = new BotArchitectureProvisioner(guild);

    // ── Batch 1: Bot Administrator Role Remediation ──────────────────────────
    console.log(`\n[BATCH 1: BOT ADMINISTRATOR ROLE REMEDIATION]`);
    const remediationResults = await provisioner.remediateBotAdministratorRoles(previewOnly);
    console.log(`| Bot Name | Role ID | Position | Action | Status | Notes |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- | :--- |`);
    for (const res of remediationResults) {
      const statusIcon = res.success ? "✔ PASS" : "✖ MANUAL REQUIRED";
      console.log(`| ${res.botName} | \`${res.roleId}\` | ${res.position} | ${res.action} | ${statusIcon} | ${res.notes} |`);
    }

    // ── Batch 2: Category & Channel Architecture ─────────────────────────────
    console.log(`\n[BATCH 2: CATEGORY & CHANNEL ARCHITECTURE]`);
    const channelActions = await provisioner.provisionCategoriesAndChannels(previewOnly);
    for (const act of channelActions) {
      const icon = act.action === "create" ? "➕ CREATE" : act.action === "rename" ? "✏️ RENAME" : act.action === "reparent" ? "📦 REPARENT" : "✔ VERIFIED";
      console.log(` ${icon} [${act.type.toUpperCase()}] ${act.name} ${act.id ? `(\`${act.id}\`)` : ""} ${act.categoryName ? `in [${act.categoryName}]` : ""} ${act.notes ? `— ${act.notes}` : ""}`);
    }

    // ── Batch 3: Bot-to-Channel Least Privilege Overwrites ───────────────────
    console.log(`\n[BATCH 3: BOT-TO-CHANNEL LEAST PRIVILEGE OVERWRITES]`);
    const overwriteActions = await provisioner.configureBotChannelOverwrites(previewOnly);
    console.log(`| Channel | Bot Name | Allowed Permissions | Status | Notes |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const ow of overwriteActions) {
      const icon = ow.success ? "✔ PASS" : "✖ FAIL";
      console.log(`| #${ow.channelName} | ${ow.botName} | ${ow.allowedPerms.join(", ")} | ${icon} | ${ow.notes || ""} |`);
    }

    // ── Summary & Manual Actions ─────────────────────────────────────────────
    const manualActions = remediationResults
      .filter((r) => !r.success && r.action === "manual_required")
      .map((r) => `De-escalate role "${r.roleName}" (Pos ${r.position}) for ${r.botName} in Discord Server Settings → Roles.`);

    console.log(`\n======================================================`);
    console.log(` PROVISIONING SUMMARY:`);
    console.log(` • Bot Role Remediations: ${remediationResults.filter((r) => r.success).length}/${remediationResults.length} completed`);
    console.log(` • Channel Architecture Actions: ${channelActions.length} evaluated`);
    console.log(` • Bot Channel Overwrites: ${overwriteActions.filter((o) => o.success).length}/${overwriteActions.length} applied`);

    if (manualActions.length > 0) {
      console.log(`\n[REQUIRED SERVER OWNER ACTIONS IN DISCORD CLIENT]`);
      manualActions.forEach((act, idx) => console.log(` ${idx + 1}. ${act}`));
    }
    console.log(`======================================================\n`);

    process.exit(0);
  } catch (err: any) {
    console.error("Fatal error during architecture provisioning:", err.message);
    process.exit(1);
  }
}

main();
