// Video/audio metadata strip — the moving-image counterpart to imagePipeline.ts
// (which strips EXIF/GPS from photos via sharp). sharp can't touch video/audio, so
// this uses ffmpeg to remove container + per-stream metadata (notably the GPS/location
// atom a phone bakes into a home video) WITHOUT re-encoding the media — `-c copy` keeps
// the original codecs, so it's fast and lossless: the parent's voice/video is byte-for-
// byte the same, just stripped of the coordinates that say where it was filmed.
//
// DORMANT-SAFE BY DESIGN. ffmpeg is NOT a hard dependency. `ffmpeg-static` (the bundled
// binary) and `fluent-ffmpeg` (the wrapper) are loaded via optional dynamic import — the
// exact pattern transcribeAudioBuffer uses for `openai`. When they're absent, this returns
// the ORIGINAL buffer with `stripped: false`, so nothing breaks and the upload still
// succeeds (raw, as today). Activate by:
//     npm install ffmpeg-static fluent-ffmpeg
// then it auto-engages on the next upload. The route audits `metadataStripped: <stripped>`
// so you can SEE in the audit log whether a given upload was cleaned or passed through.
//
// FAIL-OPEN on any error (return the original) — a metadata-strip hiccup must never cost a
// parent their irreplaceable memory. The audit's `stripped:false` makes a silent failure
// visible rather than blocking the upload.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export type StripResult = { buffer: Buffer; stripped: boolean };

// Optional dynamic import via a variable spec so the bundler/tsc never tries to resolve
// these packages at build time (they may not be installed). Mirrors routes.ts's openai load.
async function importOptional(spec: string): Promise<any | null> {
  try {
    const mod: any = await import(/* @vite-ignore */ spec).catch(() => null);
    return mod ? (mod.default ?? mod) : null;
  } catch {
    return null;
  }
}

// Allow only a short alphanumeric extension into the temp filename (defense against any
// path tricks riding in via the parsed ext); ffmpeg infers the real format from content.
function safeExt(ext: string): string {
  const e = String(ext || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return e.slice(0, 5) || "bin";
}

export async function stripMediaMetadata(input: Buffer, ext: string): Promise<StripResult> {
  const ffmpegPath = await importOptional("ffmpeg-static");
  const ffmpeg = await importOptional("fluent-ffmpeg");
  // Not installed yet → honest pass-through (current behavior). No crash, no broken upload.
  if (!ffmpeg || !ffmpegPath || typeof ffmpeg !== "function") {
    return { buffer: input, stripped: false };
  }
  try {
    ffmpeg.setFfmpegPath(ffmpegPath);
  } catch {
    return { buffer: input, stripped: false };
  }

  const e = safeExt(ext);
  const id = crypto.randomUUID();
  const inPath = path.join(os.tmpdir(), `kiddo-media-in-${id}.${e}`);
  const outPath = path.join(os.tmpdir(), `kiddo-media-out-${id}.${e}`);
  try {
    await fs.writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        // -map_metadata -1: drop all container metadata (incl. the ©xyz/location atom).
        // -map_metadata:s -1: drop per-stream metadata too. -c copy: no re-encode (lossless,
        // fast). -map 0: keep every original stream (video+audio+subs) so nothing is lost.
        .outputOptions(["-map", "0", "-map_metadata", "-1", "-map_metadata:s", "-1", "-c", "copy"])
        .on("end", () => resolve())
        .on("error", (err: unknown) => reject(err))
        .save(outPath);
    });
    const out = await fs.readFile(outPath);
    // Guard against a degenerate/empty output — keep the original if the strip produced junk.
    if (!out || out.length === 0) return { buffer: input, stripped: false };
    return { buffer: out, stripped: true };
  } catch {
    return { buffer: input, stripped: false }; // fail-OPEN: never lose the memory
  } finally {
    fs.unlink(inPath).catch(() => {});
    fs.unlink(outPath).catch(() => {});
  }
}
