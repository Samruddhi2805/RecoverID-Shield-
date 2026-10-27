export * from "./types";
export * from "./crypto";
export * from "./abis";

export const DEFAULT_CONFIG = {
  THRESHOLD: 2,
  GUARDIAN_COUNT: 3,
  DEFAULT_DELAY_SECONDS: 86400, // 24 hours
  LOCAL_DEV_DELAY_SECONDS: 60, // 1 minute for local dev testing
  LOCAL_CHAIN_ID: 31337,
  SEPOLIA_CHAIN_ID: 11155111
};
