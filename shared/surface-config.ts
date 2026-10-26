import { z } from "zod";

const slug = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const settingValue = z.union([z.boolean(), z.number().finite(), z.string().max(500), z.null()]);

export const OverlayConfigSchema = z.object({
  theme: slug,
  settings: z.record(slug, z.record(slug, settingValue)).refine((value) => Object.keys(value).length <= 32, "Too many theme settings"),
  elements: z.record(slug, z.boolean()).refine((value) => Object.keys(value).length <= 64, "Too many overlay elements"),
}).refine((value) => JSON.stringify(value).length <= 32_000, "Overlay configuration is too large");

export type OverlayConfig = z.infer<typeof OverlayConfigSchema>;

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  theme: "broadcast",
  settings: {},
  elements: {},
};

export const SessionSettingsSchema = z.object({
  autoNext: z.boolean(),
  autoNextSecs: z.number().int().min(5).max(300),
  aiTitles: z.boolean(),
  publicPage: z.boolean(),
  twitchLogin: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/).nullable(),
});

export type SessionSettings = z.infer<typeof SessionSettingsSchema>;

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  autoNext: true,
  autoNextSecs: 45,
  aiTitles: true,
  publicPage: true,
  twitchLogin: null,
};
