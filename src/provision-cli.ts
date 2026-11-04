import { loadConfig } from "./config.js";
import { DiscordService } from "./discord-service.js";
import { DiscordProvisioner } from "./provisioner.js";
import { NativeOnboardingProvisioner } from "./native-onboarding.js";
import { resolveOnboardingRoleMapping } from "./onboarding-roles.js";
import { resolveZiraPanels } from "./zira-config.js";

async function main() {
  const args = process.argv.slice(2);
  const previewOnly = args.includes("--preview");

  console.log(`[Provisioner] Initializing Discord Server Provisioning... (Preview mode: ${previewOnly})`);
  const config = loadConfig();
  const discord = new DiscordService(config);

  try {
    await discord.connect();
    console.log(`[Provisioner] Bot connected to Discord successfully.`);
    const provisioner = new DiscordProvisioner(discord);
    const report = await provisioner.provisionServer(previewOnly);

    console.log(`\n======================================================`);
    console.log(` PROVISIONING STATUS: [${report.status}]`);
    console.log(`======================================================`);
    console.log(`Summary: ${report.summary}`);

    console.log(`\n[1. PREFLIGHT AUDIT]`);
    console.log(` - ManageRoles:    ${report.preflight.canManageRoles ? "PASS" : "FAIL"}`);
    console.log(` - ManageChannels: ${report.preflight.canManageChannels ? "PASS" : "FAIL"}`);
    console.log(` - ViewChannel:    ${report.preflight.canViewChannels ? "PASS" : "FAIL"}`);
    console.log(` - Bot Highest Role: ${report.preflight.botHighestRole.name} (Position: ${report.preflight.botHighestRole.position})`);

    console.log(`\n[2. RESOURCE SUMMARY]`);
    console.log(` - Existing: ${report.existingResources.categories.length} categories, ${report.existingResources.channels.length} channels, ${report.existingResources.roles.length} roles`);
    if (report.createdResources.roles.length > 0) {
      console.log(` - Created Roles:      ${report.createdResources.roles.join(", ")}`);
    }
    if (report.createdResources.categories.length > 0) {
      console.log(` - Created Categories: ${report.createdResources.categories.join(", ")}`);
    }
    if (report.createdResources.channels.length > 0) {
      console.log(` - Created Channels:   ${report.createdResources.channels.join(", ")}`);
    }

    if (report.successfulOverwrites.length > 0) {
      console.log(`\n[3. SUCCESSFUL PERMISSIONS CONFIGURED]`);
      report.successfulOverwrites.forEach((item) => console.log(` ✔ ${item}`));
    }

    if (report.failedOperations.length > 0) {
      console.log(`\n[4. FAILED OPERATIONS (${report.failedOperations.length})]`);
      report.failedOperations.forEach((f) => {
        console.log(` ✖ [${f.action.toUpperCase()}] Target: ${f.target}`);
        if (f.error) {
          console.log(`    Error Code: ${f.error.code} | Message: ${f.error.message}`);
          if (f.error.route) console.log(`    Route: ${f.error.route}`);
        }
      });
    }

    console.log(`\n[5. MINOR / ADULT ACCESS SEPARATION AUDIT]`);
    let isolationPassed = true;
    for (const audit of report.accessAudit) {
      const statusIcon = audit.isolationCompliant ? "✔ PASS" : "✖ LEAK/FAIL";
      console.log(` ${statusIcon} #${audit.channelName} (Cat: ${audit.category})`);
      console.log(`    Access: @everyone=${audit.access.everyone} | Teen=${audit.access.minor} | 18+=${audit.access.adult} | Verified=${audit.access.verified} | Staff=${audit.access.staff}`);
      if (!audit.isolationCompliant) {
        isolationPassed = false;
        console.log(`    ALERT: ${audit.isolationNotes}`);
      }
    }

    if (previewOnly) {
      console.log(`\n[TARGET ACCESS SPECIFICATION (APPLIED ON LIVE PROVISION)]`);
      console.log(` - #verify, #rules:`);
      console.log(`       @everyone=ALLOW, Bot=ALLOW (Public Onboarding)`);
      console.log(` - #introductions, #ask-mods:`);
      console.log(`       Verified Member=ALLOW, Staff=ALLOW, Bot=ALLOW, @everyone=DENY`);
      console.log(` - #minor-community, #minor-lfg, #minor-voice:`);
      console.log(`       Teen Member=ALLOW, Staff=ALLOW, Bot=ALLOW, 18+ Member=DENY, Verified-only=DENY, @everyone=DENY`);
      console.log(` - #adult-community, #adult-lfg, #adult-voice:`);
      console.log(`       18+ Member=ALLOW, Staff=ALLOW, Bot=ALLOW, Teen Member=DENY, Verified-only=DENY, @everyone=DENY`);
      console.log(` - #mod-alerts:`);
      console.log(`       Staff=ALLOW, Bot=ALLOW, Server Owner=ALLOW, Teen=DENY, 18+=DENY, Verified=DENY, @everyone=DENY`);
    }

    if (report.requiredManualActions.length > 0) {
      console.log(`\n[6. REQUIRED MANUAL ACTIONS]`);
      report.requiredManualActions.forEach((action, idx) => {
        console.log(` ${idx + 1}. ${action}`);
      });
    }

    // ── Section 7: Native Community Onboarding Sync ──────────────────────────
    console.log(`\n[7. NATIVE COMMUNITY ONBOARDING ROLE MAPPING AUDIT]`);

    // Collect default channel IDs: #verify and #rules must be included
    const guild = discord.getGuild();
    await guild.channels.fetch();
    const verifyChannel = Array.from(guild.channels.cache.values()).find((c: any) => c.name === "verify");
    const rulesChannel  = Array.from(guild.channels.cache.values()).find((c: any) => c.name === "rules");
    const defaultChannelIds: string[] = [
      ...(verifyChannel ? [verifyChannel.id] : []),
      ...(rulesChannel  ? [rulesChannel.id]  : [])
    ];

    await guild.roles.fetch();
    const roleIdToName = new Map<string, string>();
    guild.roles.cache.forEach((r: any) => roleIdToName.set(r.id, r.name));

    const rolesList = Array.from(guild.roles.cache.values()).map((r: any) => ({
      id: r.id,
      name: r.name,
      position: r.position
    }));
    const me = await guild.members.fetchMe();
    const botHighestPosition = me.roles.highest.position;

    const mappingResolution = resolveOnboardingRoleMapping(rolesList, botHighestPosition);

    console.log(`Mapping Status: ${mappingResolution.ready ? "READY (All 24 preference roles verified)" : "PENDING (Missing roles detected)"}`);
    console.log(`Bot Highest Role: ${me.roles.highest.name} (Position: ${botHighestPosition})\n`);

    console.log(`| Question | Option | Discord Role Name | Role ID | Assignment Status |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const item of mappingResolution.items) {
      const roleIdDisplay = item.roleId || "(missing - will be created)";
      const statusIcon = item.status === "READY" ? "✔ READY" : `✖ ${item.status}`;
      console.log(`| ${item.question} | ${item.option} | ${item.roleName} | ${roleIdDisplay} | ${statusIcon} |`);
    }

    if (mappingResolution.missingRoles.length > 0) {
      console.log(`\n ℹ Notice: ${mappingResolution.missingRoles.length} preference role(s) are missing from the server.`);
      if (previewOnly) {
        console.log(`   [PREVIEW] In live provisioning, these 24 preference roles will be created safely below the bot role (${me.roles.highest.name}) before onboarding is synchronized.`);
      }
    }

    if (defaultChannelIds.length === 0) {
      console.warn(`[ONBOARDING_UPDATE_FAILED] Cannot sync onboarding: #verify and #rules channels were not found. Run provisioner first to create them.`);
    } else {
      if (!previewOnly) {
        if (!mappingResolution.ready) {
          console.error(`\n ✖ Cannot synchronize onboarding options: Missing preference roles. Run full provisioner to initialize roles.`);
          report.status = "PARTIAL SUCCESS";
          report.summary += " [Onboarding role mapping incomplete: roles missing]";
        } else {
          const onboardingProvisioner = new NativeOnboardingProvisioner(config.discordToken, guild.id);
          const onboardingResult = await onboardingProvisioner.syncOnboarding(
            defaultChannelIds,
            true,           // enabled=true — requires Community mode on the server
            roleIdToName,
            mappingResolution.optionToRoleId
          );

          if (onboardingResult.success) {
            console.log(` ✔ ${onboardingResult.message}`);
            if (onboardingResult.readBack) {
              const livePrompts = onboardingResult.readBack.prompts ?? [];
              console.log(` ℹ Read-back: ${livePrompts.length} prompt(s) confirmed live on Discord.`);
              console.log(` ℹ Onboarding enabled on server: ${onboardingResult.readBack.enabled ?? "(unknown)"}`);
            }
          } else {
            console.error(` ✖ ONBOARDING SYNC FAILED: ${onboardingResult.message}`);
            if (report.status === "FULL SUCCESS") {
              report.status = "PARTIAL SUCCESS";
              report.summary += " [DEGRADED: Native onboarding sync failed — see Section 7 above.]";
            }
          }
        }
      } else {
        // Preview mode: describe what would be sent without making the API call
        console.log(`\n [PREVIEW] Would PUT /guilds/${guild.id}/onboarding with 3 prompts and mapped role_ids for all 24 options:`);
        for (const item of mappingResolution.items) {
          console.log(`   • Option "${item.option}" → Role "${item.roleName}"`);
        }
        console.log(`   default_channel_ids: [${defaultChannelIds.join(", ")}]`);
        console.log(`   enabled: true`);
        console.log(`   NOTE: Rules Screening is NOT configured by this step.`);
        console.log(`         Configure it manually: Server Settings → Safety Setup → Rules Screening.`);
      }
    }

    // ── Section 8: Zira Button Role Configuration & Mapping Audit ────────────
    console.log(`\n[8. ZIRA BUTTON ROLE CONFIGURATION & MAPPING AUDIT]`);
    const ziraReport = resolveZiraPanels(rolesList);
    console.log(`Zira Integration Status: ${ziraReport.ready ? "READY (All roles resolved)" : "PENDING (Missing roles detected)"}`);

    const ziraRole = guild.roles.cache.find((r: any) => r.name.toLowerCase() === "zira");
    if (ziraRole) {
      console.log(`Zira Role: ${ziraRole.name} (Position: ${ziraRole.position})`);
      if (ziraRole.position < botHighestPosition) {
        console.log(` ✔ Hierarchy Check: Zira (pos ${ziraRole.position}) is safely positioned below bot role ${me.roles.highest.name} (pos ${botHighestPosition})`);
      } else {
        console.warn(` ✖ Hierarchy Warning: Zira (pos ${ziraRole.position}) is above bot role (pos ${botHighestPosition})`);
      }
    } else {
      console.log(` ℹ Notice: Zira bot role not found in guild cache.`);
    }

    console.log(`\n| Panel | Selection Option | Discord Role Name | Role ID | Status |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const item of ziraReport.items) {
      const roleIdDisplay = item.roleId || "(missing)";
      const statusIcon = item.status === "READY" ? "✔ READY" : `✖ ${item.status}`;
      console.log(`| ${item.panelTitle} | ${item.optionName} | ${item.targetRoleName} | ${roleIdDisplay} | ${statusIcon} |`);
    }

    if (ziraReport.missingRoles.length > 0) {
      console.log(`\n ℹ Notice: ${ziraReport.missingRoles.length} role(s) for Zira panels are currently missing:`);
      ziraReport.missingRoles.forEach((r) => console.log(`   • ${r}`));
    }

    if (ziraReport.restrictedViolations.length > 0) {
      console.error(`\n ✖ SECURITY CRITICAL: Zira configuration contains restricted roles:`);
      ziraReport.restrictedViolations.forEach((r) => console.log(`   • ${r}`));
    }

    console.log(`\n [ZIRA SETUP GUIDE - MANUAL DASHBOARD CONFIGURATION]`);
    console.log(` 1. Open Zira Dashboard: https://dashboard.zira.bot`);
    console.log(` 2. Navigate to: Configuration → Button Roles`);
    console.log(` 3. Target Channel: #choose-roles (Do NOT post in #verify)`);
    console.log(` 4. Create the 4 panels using the verified role IDs listed above:`);
    console.log(`    • Panel 1 (Games): Select Menu / Multi-select (12 games)`);
    console.log(`    • Panel 2 (Platform): Multi-select buttons (5 platforms)`);
    console.log(`    • Panel 3 (Preferences): Multi-select buttons (7 styles)`);
    console.log(`    • Panel 4 (Notifications): Opt-in buttons (5 notification types)`);
    console.log(` 5. Security Rule: NEVER add Verified Member, Teen Member, 18+ Member, or Staff roles to Zira.`);

    // ── Print updated status after onboarding ────────────────────────────────
    console.log(`\n======================================================`);
    console.log(` FINAL STATUS: [${report.status}]`);

    if (report.requiredManualActions.length > 0) {
      console.log(`\n[REQUIRED MANUAL ACTIONS]`);
      report.requiredManualActions.forEach((action, idx) => {
        console.log(` ${idx + 1}. ${action}`);
      });
    }
    console.log(`======================================================\n`);

    if (!previewOnly && report.status === "FAILED") {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error(`[Provisioner] Fatal Error:`, err.message);
    process.exit(1);
  }
}

main();
