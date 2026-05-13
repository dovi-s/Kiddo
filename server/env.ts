import { config } from "dotenv";
import { z } from "zod";

let loaded = false;

const CORE_ENV_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "NODE_ENV",
] as const;

const OPTIONAL_RUNTIME_KEYS = [
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_SECRET_KEY",
  "VITE_STRIPE_PUBLISHABLE_KEY",
] as const;

const PRODUCTION_RECOMMENDED_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(24),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
});

function isPlaceholderSessionSecret(value: string | undefined) {
  return value === "replace-with-a-long-random-secret";
}

function stripEmptyEnvValues(keys: readonly string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value.trim() === "") {
      delete process.env[key];
    }
  }
}

export function loadEnv() {
  if (loaded) return;
  loaded = true;

  config({ path: ".env", quiet: true });
  stripEmptyEnvValues([...CORE_ENV_KEYS, ...OPTIONAL_RUNTIME_KEYS]);
  if (isPlaceholderSessionSecret(process.env.SESSION_SECRET)) delete process.env.SESSION_SECRET;

  // Fallback for users who keep real local values in .env.example.
  config({ path: ".env.example", override: false, quiet: true });
  stripEmptyEnvValues([...CORE_ENV_KEYS, ...OPTIONAL_RUNTIME_KEYS]);
  if (isPlaceholderSessionSecret(process.env.SESSION_SECRET)) delete process.env.SESSION_SECRET;

  // Corporate proxies/SSL interception can break local TLS chains.
  // In local development only, default to permissive TLS toggles unless explicitly set.
  if (process.env.NODE_ENV !== "production") {
    if (!process.env.ALLOW_INSECURE_DEV_TLS) {
      process.env.ALLOW_INSECURE_DEV_TLS = "1";
    }
    if (!process.env.STRIPE_ALLOW_INSECURE_TLS) {
      process.env.STRIPE_ALLOW_INSECURE_TLS = "1";
    }
  }

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV || "development",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    VITE_STRIPE_PUBLISHABLE_KEY: process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${issues}`);
  }

  const missingProdKeys = PRODUCTION_RECOMMENDED_KEYS.filter((key) => !String(process.env[key] || "").trim());
  if (parsed.data.NODE_ENV === "production" && missingProdKeys.length) {
    throw new Error(`Production environment is missing required keys: ${missingProdKeys.join(", ")}`);
  }

  if (parsed.data.NODE_ENV !== "production" && missingProdKeys.length) {
    console.warn(
      `[env] Missing optional development keys: ${missingProdKeys.join(", ")}. Some payment flows will stay unavailable locally.`,
    );
  }
}

loadEnv();
