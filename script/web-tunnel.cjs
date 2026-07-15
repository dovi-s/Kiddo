/* eslint-disable no-console */
// web:tunnel — expose the local web dev server (default :5000) over a Cloudflare
// quick tunnel so you can open the site on your phone. Prints a fresh
// https://<random>.trycloudflare.com URL and STAYS ATTACHED (Ctrl+C to stop).
//
// Run it in its OWN terminal, alongside `npm run dev`. Notes:
//   - Quick-tunnel URLs are ephemeral: you get a NEW one every run, and the link
//     dies when this process stops (or the machine sleeps). That's normal.
//   - Make sure the dev server is up first (`npm run dev`), or the tunnel proxies
//     to a dead port.
//   - Port override: `npm run web:tunnel 5000` or set PORT / CLOUDFLARED_PATH.
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const port = process.env.PORT || process.argv[2] || "5000";

// Resolve cloudflared: explicit file paths first (Windows installs it here),
// then fall back to `cloudflared` on PATH (mac/linux/winget).
const filePaths = [
  process.env.CLOUDFLARED_PATH,
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
  "C:\\Program Files\\cloudflared\\cloudflared.exe",
].filter(Boolean);
const exe =
  filePaths.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  }) || "cloudflared";

console.log(`[web:tunnel] exposing http://localhost:${port} via a Cloudflare quick tunnel`);
console.log("[web:tunnel] keep `npm run dev` running in another terminal. Ctrl+C here to stop the tunnel.");
console.log("[web:tunnel] look for the https://<random>.trycloudflare.com URL below, then open it on your phone.\n");

// --protocol http2 forces the TCP transport instead of cloudflared's default
// QUIC (UDP 7844). On networks that block/throttle QUIC, the default silently
// retry-loops ("control stream encountered a failure while serving") and the
// tunnel keeps dying within hours — http2 is reliable there. (Diagnosed
// 2026-06-19 after every quick tunnel kept dropping with that exact error.)
const child = spawn(exe, ["tunnel", "--url", `http://localhost:${port}`, "--protocol", "http2", "--no-autoupdate"], {
  stdio: "inherit",
  shell: false,
});

child.on("error", (err) => {
  if (err && err.code === "ENOENT") {
    console.error(
      "\n[web:tunnel] cloudflared not found. Install it (winget install --id Cloudflare.cloudflared) " +
        "or set CLOUDFLARED_PATH to the cloudflared.exe path.",
    );
  } else {
    console.error("[web:tunnel] failed to start cloudflared:", err);
  }
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => {
  try {
    child.kill();
  } catch {}
  process.exit(0);
});
