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
// Metro uses the "exports" field by default from Expo SDK 50+, but the file
// extension must be resolvable. Ensure .ts / .tsx are in sourceExts.
config.resolver.sourceExts = [
  ...new Set([...config.resolver.sourceExts, "ts", "tsx", "mts", "cts"]),
];

// Disable package.json "exports" field resolution for workspace packages because
// Metro cannot import raw .ts source from the exports map without the transformer.
// Instead we let Metro fall through to the main / index file resolution.
// Metro 0.80+ supports unstable_enablePackageExports. We turn it off here so the
// resolver looks at the symlinked src files via nodeModulesPaths.
config.resolver.unstable_enablePackageExports = false;

// Pin react and react-native to the mobile app's local copies so metro never
// resolves the root workspace's React (19.2.0) when the mobile app needs 19.1.0.
// Without this, packages in the monorepo root resolve a different React instance,
// causing the "Invalid hook call / useContext of null" crash on web.
config.resolver.extraNodeModules = {
  "react": path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
};

module.exports = config;
