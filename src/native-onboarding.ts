import { REST, Routes } from "discord.js";

// ─── Sensitive roles that must NEVER be assigned by native onboarding ─────────
// Discord's Community Onboarding can attach role_ids to prompt options.
// These roles must only be assigned by the custom verification workflow.
export const DEFAULT_PROHIBITED_ROLES = [
  "Verified Member",
  "Teen Member",
  "18+ Member",
  "Minor 13-17",
  "Minor 13–17",
  "Adult 18+",
  "Verified",
  "Staff",
  "Admin",
  "Administrator",
  "Moderator",
  "Mod"
];

export interface NativeOnboardingPromptOption {
  id?: string;
  title: string;
  description?: string;
  emoji?: { id?: string; name: string };
  role_ids?: string[];
  channel_ids?: string[];
}

export interface NativeOnboardingPrompt {
  id?: string;
  title: string;
  options: NativeOnboardingPromptOption[];
  single_select: boolean;
  required: boolean;
  in_onboarding: boolean;
  type: number; // 0 = multiple choice
}

export interface NativeOnboardingConfig {
  prompts: NativeOnboardingPrompt[];
  default_channel_ids: string[];
  enabled: boolean;
  mode: number; // 0 = default, 1 = advanced
}

export interface OnboardingResult {
  success: boolean;
  message: string;
  /**
   * The raw Discord API response body from the PUT request.
   * Used for read-back verification. Never contains bot tokens.
   */
  data?: any;
  /**
   * The current onboarding state fetched after the PUT (read-back verification).
   * Confirms the live Discord state matches what was submitted.
   */
  readBack?: any;
  /**
   * Structured error detail when success is false.
   * httpStatus and rawBody are included so the caller can report
   * the exact Discord API failure without swallowing it.
   */
  error?: {
    httpStatus: number | string;
    rawBody: string;
  };
}

export class NativeOnboardingProvisioner {
  private rest: REST;
  private guildId: string;

  constructor(token: string, guildId: string) {
    this.rest = new REST({ version: "10" }).setToken(token);
    this.guildId = guildId;
  }

  /**
   * Builds the standard 3-question gaming community native onboarding prompts.
   *
   * Attaches preference role_ids to options when optionToRoleId is provided, while
   * maintaining channel_ids pointing at #verify so Discord API requirements are satisfied.
   *
   * @param verifyChannelId  The Discord channel ID of #verify (must exist before calling)
   * @param optionToRoleId   Optional mapping of option title (lowercase) -> Discord role ID
   */
  public buildStandardGamingPrompts(
    verifyChannelId: string = "0",
    optionToRoleId?: Map<string, string>
  ): NativeOnboardingPrompt[] {
    const makeOption = (title: string, description: string) => {
      const mappedRoleId = optionToRoleId?.get(title.toLowerCase().trim());
      return {
        id: "0",
        title,
        description,
        role_ids: mappedRoleId ? [mappedRoleId] : ([] as string[]),
        channel_ids: (verifyChannelId && verifyChannelId !== "0") ? [verifyChannelId] : ([] as string[])
      };
    };

    return [
      {
        id: "0",
        title: "Which games do you play?",
        single_select: false,
        required: true,
        in_onboarding: true,
        type: 0,
        options: [
          makeOption("Apex Legends", "FPS / Battle Royale"),
          makeOption("Monster Hunter Wilds", "Action RPG / Hunting"),
          makeOption("Palworld", "Survival / Creature Collector"),
          makeOption("Minecraft", "Sandbox / Survival"),
          makeOption("Valorant", "Tactical FPS"),
          makeOption("Fortnite", "Battle Royale / Creative"),
          makeOption("PUBG", "Battle Royale"),
          makeOption("Warframe", "Co-op Action RPG"),
          makeOption("Destiny 2", "Looter Shooter"),
          makeOption("Helldivers 2", "Co-op Galactic Shooter"),
          makeOption("GTA Online", "Open World Multiplayer"),
          makeOption("Other", "Other multiplayer title")
        ]
      },
      {
        id: "0",
        title: "Which platform do you use?",
        single_select: false,
        required: true,
        in_onboarding: true,
        type: 0,
        options: [
          makeOption("PC", "Steam, Epic, Battlenet, etc."),
          makeOption("PlayStation", "PS4 / PS5"),
          makeOption("Xbox", "Xbox One / Series X|S"),
          makeOption("Mobile", "iOS / Android"),
          makeOption("Nintendo Switch", "Switch")
        ]
      },
      {
        id: "0",
        title: "What type of gaming experience do you prefer?",
        single_select: false,
        required: true,
        in_onboarding: true,
        type: 0,
        options: [
          makeOption("Competitive", "Ranked climb and intense gameplay"),
          makeOption("Casual", "Relaxed gameplay with friends"),
          makeOption("Co-op", "Working together on missions"),
          makeOption("Survival", "Base building, resource gathering"),
          makeOption("RPG", "Character progression and lore"),
          makeOption("Horror", "Spooky and survival co-op"),
          makeOption("Social gaming", "Hangouts, party games and chill VCs")
        ]
      }
    ] as any;
  }

  /**
   * Validates that no prompt option assigns a sensitive or unauthorized role via native onboarding.
   * Enforces fail-closed security:
   * 1. If any option has role_ids and the role mapping is not provided -> FAILS CLOSED.
   * 2. If any role_id cannot be resolved against the guild -> FAILS CLOSED.
   * 3. If any resolved role is in prohibitedRoles -> REJECTS with explicit error.
   *
   * @param prompts           Prompts to validate
   * @param roleIdToName      Map of role ID → role name from the actual guild
   * @param additionalRoles   Optional additional prohibited role names
   */
  public validateNoSensitiveRoles(
    prompts: NativeOnboardingPrompt[],
    roleIdToName?: Map<string, string>,
    additionalRoles: string[] = []
  ): void {
    const prohibited = [...DEFAULT_PROHIBITED_ROLES, ...additionalRoles].map(r => r.toLowerCase().trim());

    for (const prompt of prompts) {
      for (const option of prompt.options) {
        if (!option.role_ids || option.role_ids.length === 0) continue;

        // Fail-closed requirement 1: role map must be provided if role_ids exist
        if (!roleIdToName) {
          throw new Error(
            `[ONBOARDING_GUARD] Fail-closed: Option "${option.title}" in prompt "${prompt.title}" has role_ids, ` +
            `but roleIdToName mapping was not provided. Cannot verify role security.`
          );
        }

        for (const roleId of option.role_ids) {
          // Fail-closed requirement 2: role ID must be resolvable against actual guild
          if (!roleIdToName.has(roleId)) {
            throw new Error(
              `[ONBOARDING_GUARD] Fail-closed: Role ID "${roleId}" in option "${option.title}" cannot be resolved ` +
              `against the guild roles. Untrusted or stale role ID.`
            );
          }

          const resolvedName = (roleIdToName.get(roleId) || "").toLowerCase().trim();
          // Prohibited role check:
          if (prohibited.includes(resolvedName)) {
            throw new Error(
              `[ONBOARDING_GUARD] Prohibited role assignment: Native onboarding option "${option.title}" in prompt ` +
              `"${prompt.title}" references prohibited role "${roleIdToName.get(roleId)}" (id: ${roleId}). ` +
              `Sensitive roles must only be assigned by the custom verification workflow.`
            );
          }
        }
      }
    }
  }

  /**
   * Fetches the current native onboarding configuration from Discord.
   * Logs ONBOARDING_FETCH_STARTED and ONBOARDING_FETCH_SUCCESS / failure.
   * Never swallows errors — the raw error detail is returned in the result.
   */
  public async getOnboarding(): Promise<{ ok: boolean; data?: any; httpStatus?: number | string; rawBody?: string }> {
    console.log(`[ONBOARDING_FETCH_STARTED] GET /guilds/${this.guildId}/onboarding`);
    try {
      const data = await this.rest.get(Routes.guildOnboarding(this.guildId));
      console.log(`[ONBOARDING_FETCH_SUCCESS] Retrieved ${(data as any)?.prompts?.length ?? 0} prompt(s) from Discord.`);
      return { ok: true, data };
    } catch (err: any) {
      const httpStatus = err.status ?? "NETWORK_ERROR";
      let rawBody = "(no body)";
      try { rawBody = JSON.stringify(err.rawError ?? err.message); } catch { /* ignore */ }
      console.error(`[ONBOARDING_FETCH_FAILED] HTTP ${httpStatus} — ${rawBody}`);
      return { ok: false, httpStatus, rawBody };
    }
  }

  /**
   * Syncs native onboarding configuration to Discord via PUT.
   *
   * Requires the bot to have MANAGE_GUILD and MANAGE_ROLES permissions.
   * Requires the server to have Community mode enabled.
   *
   * Steps:
   *   1. Validate no sensitive roles in prompts (guard)
   *   2. Log ONBOARDING_UPDATE_STARTED
   *   3. PUT /guilds/{id}/onboarding
   *   4. Log ONBOARDING_UPDATE_SUCCESS or ONBOARDING_UPDATE_FAILED with exact HTTP detail
   *   5. Read-back via GET and compare prompt count
   *
   * NOTE: Discord Community Onboarding completion is NOT observable via gateway events.
   * member.pending covers Membership Screening (rules modal) only.
   * This method configures the native question flow; it does NOT enable Rules Screening —
   * that must be configured separately in Server Settings → Safety Setup.
   *
   * @param defaultChannelIds  Channel IDs Discord shows new members by default
   * @param enabled            Whether to enable the onboarding flow (requires Community)
   * @param roleIdToName       Optional role ID→name map for sensitive-role guard
   */
  public async syncOnboarding(
    defaultChannelIds: string[],
    enabled: boolean = false,
    roleIdToName?: Map<string, string>,
    optionToRoleId?: Map<string, string>
  ): Promise<OnboardingResult> {
    const verifyChannelId = defaultChannelIds[0] ?? "0";
    const prompts = this.buildStandardGamingPrompts(verifyChannelId, optionToRoleId);

    // ── Re-use existing Discord prompt & option IDs if already registered ──
    // Discord requires unique IDs on PUT. If updating existing prompts, their real snowflake
    // IDs must be preserved; for new prompts, unique placeholder indices are accepted.
    const existing = await this.getOnboarding();
    const existingPrompts: any[] = (existing.ok && existing.data?.prompts) ? existing.data.prompts : [];

    prompts.forEach((p, pIdx) => {
      const matchP = existingPrompts.find(ep => ep.title.toLowerCase() === p.title.toLowerCase());
      p.id = matchP?.id ?? String(pIdx);

      p.options.forEach((o, oIdx) => {
        if (matchP?.options) {
          const matchO = matchP.options.find((eo: any) => eo.title.toLowerCase() === o.title.toLowerCase());
          o.id = matchO?.id ?? `${pIdx}_${oIdx}`;
        } else {
          o.id = `${pIdx}_${oIdx}`;
        }
      });
    });

    // ── Guard: reject before any API call if sensitive roles are present ──────
    try {
      this.validateNoSensitiveRoles(prompts, roleIdToName);
    } catch (guardErr: any) {
      console.error(`[ONBOARDING_UPDATE_FAILED] ${guardErr.message}`);
      return {
        success: false,
        message: guardErr.message,
        error: { httpStatus: "GUARD_REJECTED", rawBody: guardErr.message }
      };
    }

    const payload: NativeOnboardingConfig = {
      prompts,
      default_channel_ids: defaultChannelIds,
      enabled,
      mode: 0
    };

    console.log(
      `[ONBOARDING_UPDATE_STARTED] PUT /guilds/${this.guildId}/onboarding — ` +
      `${prompts.length} prompt(s), enabled=${enabled}, ` +
      `default_channel_ids=[${defaultChannelIds.join(", ")}]`
    );

    let putResult: any;
    let savedWithDisabledState = false;
    try {
      putResult = await this.rest.put(Routes.guildOnboarding(this.guildId), { body: payload });
      console.log(`[ONBOARDING_UPDATE_SUCCESS] Discord accepted the onboarding PUT.`);
    } catch (err: any) {
      const httpStatus = err.status ?? "NETWORK_ERROR";
      let rawBody = "(no body)";
      try { rawBody = JSON.stringify(err.rawError ?? err.message); } catch { /* ignore */ }

      // If Discord rejected solely because server requirements to activate onboarding are not met (code 350000),
      // retry with enabled: false to safely persist the full question structure in Discord Server Settings.
      if (err?.rawError?.code === 350000 && enabled) {
        console.warn(`[ONBOARDING_UPDATE_NOTICE] Discord code 350000: Server requirements to activate onboarding live are not yet complete (e.g. need at least 7 default channels). Retrying PUT with enabled=false to persist prompt configuration...`);
        try {
          payload.enabled = false;
          putResult = await this.rest.put(Routes.guildOnboarding(this.guildId), { body: payload });
          savedWithDisabledState = true;
          console.log(`[ONBOARDING_UPDATE_SUCCESS] Successfully saved onboarding prompts with enabled=false in Discord Server Settings.`);
        } catch (retryErr: any) {
          const retryStatus = retryErr.status ?? "NETWORK_ERROR";
          let retryRawBody = "(no body)";
          try { retryRawBody = JSON.stringify(retryErr.rawError ?? retryErr.message); } catch { /* ignore */ }
          console.error(`[ONBOARDING_UPDATE_FAILED] HTTP ${retryStatus} — ${retryRawBody}`);
          return {
            success: false,
            message: `Discord rejected the onboarding update: HTTP ${retryStatus} — ${retryRawBody}`,
            error: { httpStatus: retryStatus, rawBody: retryRawBody }
          };
        }
      } else {
        // Log full detail; token is never in rawError or rawBody
        console.error(`[ONBOARDING_UPDATE_FAILED] HTTP ${httpStatus} — ${rawBody}`);
        return {
          success: false,
          message: `Discord rejected the onboarding update: HTTP ${httpStatus} — ${rawBody}`,
          error: { httpStatus, rawBody }
        };
      }
    }

    // ── Read-back verification: confirm live Discord state matches submission ──
    console.log(`[ONBOARDING_FETCH_STARTED] Read-back GET /guilds/${this.guildId}/onboarding`);
    const readBackResult = await this.getOnboarding();
    let readBackOk = false;
    if (readBackResult.ok && readBackResult.data) {
      const livePromptCount = (readBackResult.data.prompts ?? []).length;
      const expectedCount = prompts.length;
      readBackOk = livePromptCount === expectedCount;
      if (readBackOk) {
        console.log(`[ONBOARDING_FETCH_SUCCESS] Read-back verified: ${livePromptCount}/${expectedCount} prompts live on Discord.`);
      } else {
        console.warn(
          `[ONBOARDING_FETCH_SUCCESS] Read-back mismatch: expected ${expectedCount} prompt(s), ` +
          `Discord returned ${livePromptCount}. Manual verification required.`
        );
      }
    } else {
      console.warn(`[ONBOARDING_FETCH_FAILED] Read-back GET failed after successful PUT. Cannot confirm live state.`);
    }

    return {
      success: true,
      message: readBackOk
        ? (savedWithDisabledState
            ? `Native onboarding prompts successfully saved and verified on Discord (${prompts.length} questions, ${prompts.reduce((acc, p) => acc + p.options.length, 0)} options). Note: Onboarding is saved in configured mode (enabled=false) until server default channel requirements are fulfilled in Server Settings.`
            : `Native onboarding synced and verified on Discord (${prompts.length} prompts live).`)
        : `Native onboarding PUT succeeded but read-back could not confirm live state. Check Server Settings → Onboarding.`,
      data: putResult,
      readBack: readBackResult.data
    };
  }
}

