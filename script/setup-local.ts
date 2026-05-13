import { existsSync, copyFileSync } from "fs";
import { spawnSync } from "child_process";

const envPath = ".env";
const envExamplePath = ".env.example";

if (!existsSync(envExamplePath)) {
  console.error("Missing .env.example. Cannot bootstrap local environment.");
  process.exit(1);
}

if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example");
} else {
  console.log(".env already exists. Skipping copy.");
}

console.log("Next steps:");
console.log("1) Edit .env and set SESSION_SECRET (required).");
console.log("2) Ensure PostgreSQL is running and DATABASE_URL is correct.");

const dockerCheck = spawnSync("docker", ["--version"], { stdio: "ignore", shell: true });
if (dockerCheck.status === 0) {
  console.log("3) Run: npm run db:up");
  console.log("4) Run: npm run db:migrate");
  console.log("5) Run: npm run dev");
} else {
  console.log("3) Docker is not installed, so `npm run db:up` will not work yet.");
  console.log("4) Either install Docker Desktop or point DATABASE_URL at an existing PostgreSQL instance.");
  console.log("5) Run: npm run db:check");
  console.log("6) Run: npm run db:migrate");
  console.log("7) Run: npm run dev");
}
