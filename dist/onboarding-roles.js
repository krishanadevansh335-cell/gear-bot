import { DEFAULT_PROHIBITED_ROLES } from "./native-onboarding.js";
export const ONBOARDING_MAPPING_RULES = [
    // 1. Game Question
    { question: "Which games do you play?", option: "Apex Legends", roleName: "Apex Squad", category: "game", color: "#E74C3C" },
    { question: "Which games do you play?", option: "Palworld", roleName: "Palworld Crew", category: "game", color: "#3498DB" },
    { question: "Which games do you play?", option: "Minecraft", roleName: "Minecraft Crew", category: "game", color: "#2ECC71" },
    { question: "Which games do you play?", option: "Valorant", roleName: "Valorant Squad", category: "game", color: "#FD4556" },
    { question: "Which games do you play?", option: "Fortnite", roleName: "Fortnite Crew", category: "game", color: "#9B59B6" },
    { question: "Which games do you play?", option: "PUBG", roleName: "PUBG Squad", category: "game", color: "#F39C12" },
    { question: "Which games do you play?", option: "Warframe", roleName: "Warframe Crew", category: "game", color: "#1ABC9C" },
    { question: "Which games do you play?", option: "Destiny 2", roleName: "Destiny 2 Crew", category: "game", color: "#546E7A" },
    { question: "Which games do you play?", option: "Helldivers 2", roleName: "Helldivers Crew", category: "game", color: "#F1C40F" },
    { question: "Which games do you play?", option: "GTA Online", roleName: "GTA Online Crew", category: "game", color: "#27AE60" },
    { question: "Which games do you play?", option: "Monster Hunter Wilds", roleName: "Monster Hunter Crew", category: "game", color: "#D35400" },
    { question: "Which games do you play?", option: "Other", roleName: "Other Games", category: "game", color: "#7F8C8D" },
    // 2. Platform Question
    { question: "Which platform do you use?", option: "PC", roleName: "PC Gamer", category: "platform", color: "#34495E" },
    { question: "Which platform do you use?", option: "PlayStation", roleName: "PlayStation Gamer", category: "platform", color: "#003791" },
    { question: "Which platform do you use?", option: "Xbox", roleName: "Xbox Gamer", category: "platform", color: "#107C10" },
    { question: "Which platform do you use?", option: "Mobile", roleName: "Mobile Gamer", category: "platform", color: "#E91E63" },
    { question: "Which platform do you use?", option: "Nintendo Switch", roleName: "Nintendo Switch Gamer", category: "platform", color: "#E60012" },
    // 3. Gaming Experience Question
    { question: "What type of gaming experience do you prefer?", option: "Competitive", roleName: "Competitive", category: "experience", color: "#C0392B" },
    { question: "What type of gaming experience do you prefer?", option: "Casual", roleName: "Casual Gamer", category: "experience", color: "#16A085" },
    { question: "What type of gaming experience do you prefer?", option: "Co-op", roleName: "Co-op Gamer", category: "experience", color: "#2980B9" },
    { question: "What type of gaming experience do you prefer?", option: "Survival", roleName: "Survival Gamer", category: "experience", color: "#8E44AD" },
    { question: "What type of gaming experience do you prefer?", option: "RPG", roleName: "RPG Gamer", category: "experience", color: "#D68910" },
    { question: "What type of gaming experience do you prefer?", option: "Horror", roleName: "Horror Gamer", category: "experience", color: "#4A235A" },
    { question: "What type of gaming experience do you prefer?", option: "Social gaming", roleName: "Social Gamer", category: "experience", color: "#117864" }
];
/**
 * Resolves onboarding rules against existing Discord roles and bot hierarchy
 */
export function resolveOnboardingRoleMapping(rolesList, botHighestPosition) {
    const roleMapByName = new Map();
    for (const r of rolesList) {
        roleMapByName.set(r.name.toLowerCase().trim(), r);
    }
    const prohibitedLower = DEFAULT_PROHIBITED_ROLES.map((r) => r.toLowerCase().trim());
    const items = [];
    const missingRoles = [];
    const unassignableRoles = [];
    const prohibitedRoles = [];
    const optionToRoleId = new Map();
    for (const rule of ONBOARDING_MAPPING_RULES) {
        const existing = roleMapByName.get(rule.roleName.toLowerCase().trim());
        const isSensitive = prohibitedLower.includes(rule.roleName.toLowerCase().trim());
        if (isSensitive) {
            prohibitedRoles.push(rule.roleName);
            items.push({
                question: rule.question,
                option: rule.option,
                roleName: rule.roleName,
                roleId: existing?.id,
                position: existing?.position,
                exists: Boolean(existing),
                assignable: false,
                isSensitive: true,
                status: "PROHIBITED",
                notes: "Sensitive role blocked from native onboarding assignment"
            });
            continue;
        }
        if (!existing) {
            missingRoles.push(rule.roleName);
            items.push({
                question: rule.question,
                option: rule.option,
                roleName: rule.roleName,
                exists: false,
                assignable: false,
                isSensitive: false,
                status: "MISSING",
                notes: "Role does not exist in Discord guild"
            });
            continue;
        }
        const assignable = existing.position < botHighestPosition;
        if (!assignable) {
            unassignableRoles.push(rule.roleName);
            items.push({
                question: rule.question,
                option: rule.option,
                roleName: rule.roleName,
                roleId: existing.id,
                position: existing.position,
                exists: true,
                assignable: false,
                isSensitive: false,
                status: "UNASSIGNABLE",
                notes: `Role position (${existing.position}) is >= bot role position (${botHighestPosition})`
            });
            continue;
        }
        optionToRoleId.set(rule.option.toLowerCase(), existing.id);
        items.push({
            question: rule.question,
            option: rule.option,
            roleName: rule.roleName,
            roleId: existing.id,
            position: existing.position,
            exists: true,
            assignable: true,
            isSensitive: false,
            status: "READY",
            notes: "Role verified and assignable"
        });
    }
    const ready = missingRoles.length === 0 && unassignableRoles.length === 0 && prohibitedRoles.length === 0;
    return {
        ready,
        items,
        missingRoles,
        unassignableRoles,
        prohibitedRoles,
        optionToRoleId
    };
}
//# sourceMappingURL=onboarding-roles.js.map