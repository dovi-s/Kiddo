import "./server/env";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Create a .env file (see .env.example).");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: (() => {
    const url = new URL(process.env.DATABASE_URL!);
    const sslmode = url.searchParams.get("sslmode");
    url.searchParams.delete("sslmode");

    const port = Number(url.port || "5432");
    const ssl =
      process.env.PGSSLMODE === "disable"
        ? false
        : process.env.NODE_ENV === "production"
          ? sslmode === "no-verify"
            ? { rejectUnauthorized: false }
            : "require"
          : { rejectUnauthorized: false };

    return {
      host: url.hostname,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      ssl,
    };
  })(),
});
