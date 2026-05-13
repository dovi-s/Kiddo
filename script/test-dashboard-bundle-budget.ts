/* eslint-disable no-console */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const assetsDir = path.resolve("dist", "public", "assets");
  const files = await readdir(assetsDir);
  const dashboardChunks = files.filter((name) => /^Dashboard-[\w-]+\.js$/.test(name));
  const trendChunks = files.filter((name) => /^DashboardTrendChart-[\w-]+\.js$/.test(name));
  const holdingChunks = files.filter((name) => /^HoldingDetailSheet-[\w-]+\.js$/.test(name));
  const vendorChartChunks = files.filter((name) => /^vendor-charts-[\w-]+\.js$/.test(name));

  if (dashboardChunks.length !== 1) {
    throw new Error(`Expected exactly one Dashboard route chunk, found ${dashboardChunks.length}: ${dashboardChunks.join(", ")}`);
  }
  if (trendChunks.length === 0) {
    throw new Error("Expected a lazy DashboardTrendChart chunk after build.");
  }
  if (holdingChunks.length === 0) {
    throw new Error("Expected a lazy HoldingDetailSheet chunk after build.");
  }
  if (vendorChartChunks.length === 0) {
    throw new Error("Expected vendor-charts chunk to remain split from Dashboard.");
  }

  const dashboardChunk = dashboardChunks[0];
  const content = await readFile(path.join(assetsDir, dashboardChunk), "utf-8");
  const forbidden = [
    { label: "recharts package code", pattern: /recharts/i },
    { label: "recharts surface markup", pattern: /recharts-surface/i },
    { label: "direct vendor-charts import", pattern: /import\s*(?:[^;]*?\s+from\s*)?["']\.\/vendor-charts-[^"']+["']/i },
  ];
  const matches = forbidden.filter((item) => item.pattern.test(content));
  if (matches.length > 0) {
    throw new Error(`Dashboard chunk ${dashboardChunk} appears to include chart code: ${matches.map((m) => m.label).join(", ")}`);
  }

  console.log("Dashboard bundle budget passed.");
  console.log(JSON.stringify({
    dashboardChunk,
    lazyChartChunks: trendChunks,
    lazyHoldingChunks: holdingChunks,
    vendorChartChunks,
  }, null, 2));
}

main().catch((err) => {
  console.error("Dashboard bundle budget failed:", err?.message || err);
  process.exit(1);
});
