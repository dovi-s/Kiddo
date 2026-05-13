import fs from "fs";
import path from "path";

type Rule = {
  id: string;
  description: string;
  file: string;
  pattern: RegExp;
  severity?: "error" | "warn";
};

const ROOT = process.cwd();

const rules: Rule[] = [
  {
    id: "plus-one-child-settings",
    description: "Kiddo Plus should be described as one-child coverage in Settings",
    file: "client/src/pages/Settings.tsx",
    pattern: /Kiddo Plus is for one child/i,
  },
  {
    id: "family-all-funds-settings",
    description: "Family should be described as account-wide in Settings",
    file: "client/src/pages/Settings.tsx",
    pattern: /Kiddo Family is for multiple children/i,
  },
  {
    id: "free-no-normal-platform-fee-settings",
    description: "Free tier should state there is no normal Kiddo platform fee",
    file: "client/src/pages/Settings.tsx",
    pattern: /no Kiddo platform fee on normal gifts/i,
  },
  {
    id: "processing-fee-gift-checkout",
    description: "Gift checkout should show processing fee baseline",
    file: "client/src/pages/GiftCheckout.tsx",
    pattern: /2\.9%\s*\+\s*\$0\.30|0\.8%\s*\(max\s*\$5\)/i,
  },
  {
    id: "starter-family-activate-investing",
    description: "Activate Investing should use Kiddo Plus and Family language",
    file: "client/src/pages/ActivateInvesting.tsx",
    pattern: /Kiddo Plus or Kiddo Family/i,
  },
  {
    id: "sipc-market-loss-activate-investing",
    description: "SIPC disclaimer should include market-loss caveat",
    file: "client/src/pages/ActivateInvesting.tsx",
    pattern: /does not protect against market losses/i,
  },
  {
    id: "sipc-footer",
    description: "Footer should contain FINRA/SIPC and non-FDIC investment disclaimer",
    file: "client/src/components/layout/Footer.tsx",
    pattern: /FINRA\/SIPC|Not FDIC insured/i,
  },
  {
    id: "faq-fee-breakdown",
    description: "FAQ should include processing and large gift fee breakdown",
    file: "client/src/pages/FAQ.tsx",
    pattern: /payment processing.*Gifts of \$1,000/i,
  },
];

const read = (file: string) => {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
};

let failures = 0;
let warnings = 0;

console.log("Kiddo copy consistency audit");
console.log("=".repeat(32));

for (const rule of rules) {
  const text = read(rule.file);
  if (text == null) {
    failures += 1;
    console.log(`ERROR [missing-file] ${rule.file}`);
    continue;
  }

  const passed = rule.pattern.test(text);
  if (passed) {
    console.log(`PASS  [${rule.id}] ${rule.file}`);
    continue;
  }

  if ((rule.severity || "error") === "warn") {
    warnings += 1;
    console.log(`WARN  [${rule.id}] ${rule.description}`);
  } else {
    failures += 1;
    console.log(`ERROR [${rule.id}] ${rule.description}`);
  }
}

console.log("-".repeat(32));
console.log(`Summary: ${rules.length - failures - warnings} pass, ${warnings} warn, ${failures} error`);

if (failures > 0) {
  process.exit(1);
}
