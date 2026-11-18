import { randomBytes } from "node:crypto";

const developmentJwtSecret = randomBytes(32).toString("hex");

export function getJwtSecret(environment: NodeJS.ProcessEnv = process.env) {
  const configuredSecret = environment.JWT_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (
    environment.NODE_ENV === "development" ||
    environment.NODE_ENV === "test"
  ) {
    return developmentJwtSecret;
  }

  throw new Error("JWT_SECRET must be configured outside development and test.");
}
