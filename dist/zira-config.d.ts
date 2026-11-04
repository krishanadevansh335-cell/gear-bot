export interface ZiraItemSpec {
    name: string;
    targetRoleName: string;
    emoji?: string;
    description?: string;
}
export interface ZiraPanelSpec {
    id: string;
    title: string;
    channelName: string;
    type: "select_menu" | "buttons";
    multiSelect: boolean;
    items: ZiraItemSpec[];
}
export declare const ZIRA_PANELS: ZiraPanelSpec[];
export declare const ZIRA_RESTRICTED_ROLES: string[];
export interface ResolvedZiraItem {
    panelId: string;
    panelTitle: string;
    optionName: string;
    targetRoleName: string;
    roleId?: string;
    position?: number;
    exists: boolean;
    status: "READY" | "MISSING" | "RESTRICTED";
    notes?: string;
}
export interface ZiraResolutionReport {
    ready: boolean;
    items: ResolvedZiraItem[];
    missingRoles: string[];
    restrictedViolations: string[];
    panels: ZiraPanelSpec[];
}
export declare function resolveZiraPanels(rolesList: Array<{
    id: string;
    name: string;
    position: number;
}>): ZiraResolutionReport;
