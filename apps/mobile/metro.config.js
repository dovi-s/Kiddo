// Metro config for Kora mobile. Monorepo-aware resolver.
// The @kora/* workspace packages live in <root>/packages/ and are symlinked
// from <root>/node_modules/@kora/. Metro must watch those folders and know to
// look at the root node_modules when resolving workspace deps.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root and the packages directory so Metro picks up changes.
config.watchFolders = [repoRoot];

// Tell Metro where to look for node_modules when a local resolution fails.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

// The @kora/* packages export TypeScript source files directly ("./src/index.ts").
config.resolver.sourceExts = [
  ...new Set([...config.resolver.sourceExts, "ts", "tsx", "mts", "cts"]),
];

// Let Metro fall through to main/index for workspace packages (raw .ts source).
config.resolver.unstable_enablePackageExports = false;

// ── Single-React enforcement (fixes "Invalid hook call / more than one copy of
//    React") ──────────────────────────────────────────────────────────────────
// The monorepo holds TWO reacts: apps/mobile/node_modules/react (19.1.0 — the
// Expo SDK 54 version react-native 0.81.5 expects) and the web app's root react
// (19.2.0). After `expo install` added react-navigation / @tanstack/react-query /
// reanimated, those deps HOISTED to the repo root and resolve the root react
// (19.2.0), while the app's own modules resolve the local 19.1.0 — two React
// instances in one bundle, which React rejects with "Invalid hook call."
//
// extraNodeModules alone does NOT fix this: it's a *fallback*, only consulted when
// normal resolution fails, so a root-hoisted dep that finds root/react fine never
// hits it. We instead intercept EVERY import of react / react-dom / react-native
// (and subpaths like "react/jsx-runtime") and redirect it to one canonical copy:
// the app-local 19.1.0 react (correct for Expo 54 / RN 0.81.5) and the single root
// react-native. After changing this, run `npm run mobile:reset` to clear the Metro
// cache before `npm run mobile:dev`.
const singletons = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
  "react-native": path.resolve(repoRoot, "node_modules/react-native"),
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const pkg of Object.keys(singletons)) {
    if (moduleName === pkg || moduleName.startsWith(pkg + "/")) {
      const subpath = moduleName.slice(pkg.length); // "" or "/some/subpath"
      return context.resolveRequest(context, singletons[pkg] + subpath, platform);
    }
  }
  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

// Belt-and-suspenders fallback (resolveRequest above is the primary mechanism).
config.resolver.extraNodeModules = {
  react: singletons.react,
  "react-dom": singletons["react-dom"],
  "react-native": singletons["react-native"],
};

module.exports = config;
