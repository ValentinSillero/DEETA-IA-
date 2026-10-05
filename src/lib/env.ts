import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL no está configurada"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET debe tener al menos 32 caracteres"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL debe ser una URL válida"),
});

const optionalSecret = z.preprocess((value) => value === "" ? undefined : value, z.string().min(20).optional());
const optionalText = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const positiveInteger = (fallback: number) => z.preprocess(
  (value) => value === undefined || value === "" ? fallback : Number(value),
  z.number().int().positive(),
);

const aiEnvSchema = z.object({
  OPENAI_API_KEY: optionalSecret,
  OPENAI_MODEL: optionalText.default("gpt-5.4-mini"),
  DEETA_AI_TIMEOUT_MS: positiveInteger(15_000),
  DEETA_AI_REQUESTS_PER_MINUTE: positiveInteger(8),
  DEETA_AI_MONTHLY_LIMIT: positiveInteger(100),
});

function readServerEnv() {
  return serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  });
}

export class ServerConfigurationError extends Error {
  constructor(public readonly issues: string[]) {
    super("Configuración incompleta: " + issues.join(", "));
    this.name = "ServerConfigurationError";
  }
}

export function isServerConfigured() {
  return readServerEnv().success;
}

export function getServerConfigurationIssues() {
  const result = readServerEnv();
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message);
}

export function getServerEnv() {
  const result = readServerEnv();
  if (!result.success) {
    throw new ServerConfigurationError(
      result.error.issues.map((issue) => issue.path.join(".") + ": " + issue.message),
    );
  }
  return result.data;
}

export function getAiConfiguration() {
  const result = aiEnvSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    DEETA_AI_TIMEOUT_MS: process.env.DEETA_AI_TIMEOUT_MS,
    DEETA_AI_REQUESTS_PER_MINUTE: process.env.DEETA_AI_REQUESTS_PER_MINUTE,
    DEETA_AI_MONTHLY_LIMIT: process.env.DEETA_AI_MONTHLY_LIMIT,
  });
  if (!result.success) {
    return { available: false as const, issues: result.error.issues.map((issue) => issue.message) };
  }
  const apiKey = result.data.OPENAI_API_KEY;
  if (!apiKey) {
    return { available: false as const, issues: ["OPENAI_API_KEY no está configurada"] };
  }
  return { available: true as const, ...result.data, OPENAI_API_KEY: apiKey };
}
