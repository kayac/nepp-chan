export const ENVIRONMENTS = {
  local: {
    api: "http://localhost:8787",
    web: "http://localhost:5173",
    lp: "http://localhost:5174",
    gaMeasurementId: undefined,
  },
  dev: {
    api: "https://dev-api.nepp-chan.ai",
    web: "https://dev-web.nepp-chan.ai",
    lp: "https://dev.nepp-chan.ai",
    gaMeasurementId: undefined,
  },
  prd: {
    api: "https://api.nepp-chan.ai",
    web: "https://web.nepp-chan.ai",
    lp: "https://nepp-chan.ai",
    gaMeasurementId: "G-FMW4FP326K",
  },
} as const;

export type EnvName = keyof typeof ENVIRONMENTS;

export const resolveEnvironment = (name: string | undefined) => {
  const envName = name ?? "local";
  if (!(envName in ENVIRONMENTS)) {
    throw new Error(`不明な環境名です: ${envName}`);
  }

  return ENVIRONMENTS[envName as EnvName];
};
