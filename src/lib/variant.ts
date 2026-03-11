export type AppVariant = "classic" | "aero";

export const APP_VARIANT: AppVariant = (
  typeof __APP_VARIANT__ !== "undefined" ? __APP_VARIANT__ : "classic"
) as AppVariant;

export const IS_AERO = APP_VARIANT === "aero";

export const APP_TITLE = IS_AERO ? "LocalLLM For FraniumOS" : "LocalLLM";
