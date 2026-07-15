import sharp from "sharp";
import { normalizeImage } from "../server/imagePipeline.ts";

// A big, mis-oriented JPEG carrying metadata (the kind of raw phone upload we store today).
const raw = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 30, g: 90, b: 60 } } })
  .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "loc:test" } } })
  .jpeg({ quality: 92 })
  .toBuffer();
const before = await sharp(raw).metadata();

const norm = await normalizeImage(raw);
const dataUrl = `data:image/webp;base64,${norm.thumb.toString("base64")}`;
const after = await sharp(norm.thumb).metadata();

console.log("RAW   :", before.format, `${before.width}x${before.height}`, (raw.length/1024).toFixed(0)+"KB", "exif?", !!before.exif, "orient", before.orientation);
console.log("THUMB :", after.format, `${after.width}x${after.height}`, (norm.thumb.length/1024).toFixed(1)+"KB", "exif?", !!after.exif, "orient", after.orientation ?? "stripped");
console.log("DATAURL:", dataUrl.slice(0,30)+"…", "total", (dataUrl.length/1024).toFixed(1)+"KB  (was up to 7000KB raw)");
console.log(after.format==="webp" && !after.exif && Math.max(after.width,after.height)<=256 ? "✅ webp, EXIF stripped, <=256px avatar" : "❌ check failed");
