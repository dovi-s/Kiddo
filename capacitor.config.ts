import type { CapacitorConfig } from "@capacitor/cli";

// Native wrapper (iOS + Android) around the EXISTING web app — so the native
// app looks identical to the web app's mobile view, because it IS the web app
// in a native shell. App Store / Play Store distribution + native plugins
// (push, biometric, etc.) without re-implementing the UI in React Native.
//
// TWO MODES:
//  • DEV PREVIEW (current): `server.url` points at the running web server, so the
//    shell loads the full app (client + API same-origin) over your LAN. Fastest
//    way to see it native. Requires `npm run dev` running and the phone on the
//    same Wi-Fi. Update the IP if your LAN IP changes (ipconfig → IPv4).
//  • SHIP: delete the whole `server` block, run the web build (-> dist/public),
//    `npx cap sync`, and point the client's API base at your deployed backend.
// Server URL is env-driven so the SAME project builds for dev and prod:
//   • dev preview:  unset  -> loads the LAN web server (cleartext OK)
//   • production:   set CAP_SERVER_URL=https://your-deployed-domain  (https)
// For a fully-bundled store build instead, set CAP_SERVER_URL="" and the shell
// loads the bundled dist/public (then point the web client's API at the
// deployed backend — see CAPACITOR_BUILD.md).
const serverUrl = process.env.CAP_SERVER_URL ?? "http://192.168.1.66:5000";

const config: CapacitorConfig = {
  appId: "com.kiddo.app",
  appName: "Kiddo",
  webDir: "dist/public",
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: serverUrl.startsWith("http://") } }
    : {}),
};

export default config;
