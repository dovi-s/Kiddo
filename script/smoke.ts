/* eslint-disable no-console */
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000";

type Check = {
  name: string;
  run: () => Promise<void>;
};

async function expectStatus(path: string, expected: number) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (res.status !== expected) {
    throw new Error(`${path} expected ${expected}, got ${res.status}`);
  }
}

const checks: Check[] = [
  {
    name: "health",
    run: async () => {
      await expectStatus("/api/health", 200);
    },
  },
  {
    name: "deep health",
    run: async () => {
      await expectStatus("/api/health?deep=1", 200);
    },
  },
  {
    name: "unauth user endpoint",
    run: async () => {
      // /api/auth/user is a session-state query: returns 200 + null body
      // when not authenticated (rather than 401), so a logged-out visitor
      // doesn't trip the browser console on every public-page load.
      const res = await fetch(`${baseUrl}/api/auth/user`);
      if (res.status !== 200) {
        throw new Error(`Expected 200 from /api/auth/user, got ${res.status}`);
      }
      const body = await res.json();
      if (body !== null) {
        throw new Error(`Expected null body from unauth /api/auth/user, got ${JSON.stringify(body)}`);
      }
    },
  },
  {
    name: "stripe key endpoint",
    run: async () => {
      const res = await fetch(`${baseUrl}/api/stripe/publishable-key`);
      if (![200, 500].includes(res.status)) {
        throw new Error(`/api/stripe/publishable-key unexpected ${res.status}`);
      }
    },
  },
];

async function main() {
  console.log(`Running smoke checks against ${baseUrl}`);
  for (const check of checks) {
    process.stdout.write(`- ${check.name} ... `);
    await check.run();
    console.log("ok");
  }
  console.log("Smoke checks passed.");
}

main().catch((err) => {
  console.error("Smoke checks failed:", err.message);
  process.exit(1);
});

