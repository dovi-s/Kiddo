/* eslint-disable no-console */
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(process.cwd(), "apps", "mobile", "src", "screens", "GifterFlowScreen.tsx");
const stockChoicesPath = path.join(process.cwd(), "packages", "utils", "src", "index.ts");
const outDir = path.join(process.cwd(), "artifacts", "mobile-contracts");
const reportPath = path.join(outDir, "gifter-logo-contract.json");

function includes(source, needle) {
  return source.includes(needle);
}

function regex(source, pattern) {
  return pattern.test(source);
}

function extractOnboardingTickers(source) {
  const match = source.match(/export const onboardingStockChoices:[\s\S]*?\[([\s\S]*?)\];/);
  if (!match) return [];
  const tickers = [];
  const tickerPattern = /ticker:\s*"([^"]+)"/g;
  let tickerMatch;
  while ((tickerMatch = tickerPattern.exec(match[1]))) {
    tickers.push(tickerMatch[1]);
  }
  return tickers;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  const source = readFileSync(sourcePath, "utf8");
  const stockChoiceSource = readFileSync(stockChoicesPath, "utf8");
  const tickers = extractOnboardingTickers(stockChoiceSource);

  const checks = [
    {
      name: "mobile-gifter-uses-shared-stock-universe",
      ok: includes(source, "onboardingStockChoices.map((choice)"),
      detail: "stock cards should render from onboardingStockChoices",
    },
    {
      name: "mobile-gifter-stock-card-renders-logo-component",
      ok: regex(source, /<StockLogo\s+ticker=\{choice\.ticker\}/),
      detail: "stock picker cards should use StockLogo, not a letter-only badge",
    },
    {
      name: "mobile-gifter-stock-card-has-button-test-id",
      ok: includes(source, "testID={`button-stock-${choice.ticker}`}"),
      detail: "each stock card should expose a stable button testID",
    },
    {
      name: "mobile-stock-logo-has-wrapper-test-id",
      ok: includes(source, "testID={`stock-logo-${upper}`}"),
      detail: "logo wrapper should expose stock-logo-{TICKER}",
    },
    {
      name: "mobile-stock-logo-has-image-test-id",
      ok: includes(source, "testID={`stock-logo-image-${upper}`}"),
      detail: "remote logo image should expose stock-logo-image-{TICKER}",
    },
    {
      name: "mobile-stock-logo-has-fallback-test-id",
      ok: includes(source, "testID={`stock-logo-fallback-${upper}`}"),
      detail: "fallback badge should expose stock-logo-fallback-{TICKER}",
    },
    {
      name: "mobile-stock-logo-uses-company-logo-service",
      ok: includes(source, "https://assets.parqet.com/logos/symbol/${upper}?format=jpg"),
      detail: "mobile logo component should load real company logos",
    },
    {
      name: "mobile-stock-cards-show-shares-line",
      ok: includes(source, "About {sharesFor(amount, choice.ticker, quotes)} shares"),
      detail: "stock cards should keep the amount-aware shares line",
    },
    {
      name: "mobile-stock-cards-use-market-quote-endpoint",
      ok: includes(source, "apiGetMarketQuotes"),
      detail: "mobile stock estimates should use /api/market/quotes instead of local price constants",
    },
    {
      name: "mobile-stock-cards-explain-estimated-price",
      ok: includes(source, "Estimated price. Final shares may change."),
      detail: "share-count UI should include visible estimated-price microcopy",
    },
    {
      name: "mobile-stock-universe-found",
      ok: tickers.length >= 8,
      detail: "contract should validate the shared stock universe",
    },
  ];

  for (const ticker of tickers) {
    if (!/^[A-Z.]+$/.test(ticker)) {
      checks.push({
        name: `mobile-stock-ticker-${ticker}-valid`,
        ok: false,
        detail: "ticker should be uppercase so generated testIDs stay stable",
      });
    }
  }

  const failures = checks.filter((check) => !check.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    sourcePath,
    stockChoicesPath,
    tickers,
    checks,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Mobile gifter logo contract complete. ${checks.length - failures.length}/${checks.length} checks passed.`);
  console.log(`Report: ${reportPath}`);

  if (failures.length) {
    console.log("Failures:");
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.detail}`);
    }
    process.exit(1);
  }
}

main();
