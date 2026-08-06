export type CheckRecord = Readonly<{ id: string; ok: boolean; detail: string }>;

export type InstallOptions = Readonly<{ home?: string; codexHome?: string; json?: boolean }>;
export type DoctorOptions = Readonly<{ home?: string; codexHome?: string; packageOnly?: boolean; json?: boolean }>;
export type StatusOptions = Readonly<{ home?: string; codexHome?: string; json?: boolean }>;
export type UninstallOptions = Readonly<{ home?: string; codexHome?: string; json?: boolean }>;

export type InstallReport = Readonly<{
  ok: boolean;
  version: string;
  surfaces: readonly string[];
  manifestPath: string;
  rollbackCommand: "riqor uninstall";
  checks: readonly CheckRecord[];
}>;

export type DoctorReport = Readonly<{
  ok: boolean;
  checks: readonly CheckRecord[];
  externalIssues: readonly string[];
}>;

export type StatusReport = Readonly<{
  version: string;
  pluginVersion: string;
  surfaces: Readonly<Record<string, string>>;
}>;

export type UninstallReport = Readonly<{
  ok: boolean;
  removed: readonly string[];
  restored: readonly string[];
}>;

export type MarketplaceState = "absent" | "current" | "legacy-compatible" | "conflict";
