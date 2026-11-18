import type { CorsOptions } from "cors";

export function resolveServerHost(environment: NodeJS.ProcessEnv = process.env) {
  const configuredHost = environment.HOST?.trim();
  if (configuredHost) return configuredHost;
  return environment.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
}

export function createCorsOptions(
  environment: NodeJS.ProcessEnv = process.env
): CorsOptions {
  const allowedOrigins = new Set(
    (environment.CORS_ORIGINS || "")
      .split(",")
      .map(origin => origin.trim())
      .filter(Boolean)
  );

  return {
    origin(origin, callback) {
      callback(null, Boolean(origin && allowedOrigins.has(origin)));
    },
  };
}
