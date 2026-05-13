import assert from "node:assert/strict";
import { filterMemoryEntries, getVisibleMemoryEntries, validateMemoryMedia } from "../client/src/pages/memoryBookUtils";

const entries = [
  {
    id: "1",
    type: "gift_message",
    content: "Happy birthday",
    authorName: "Grandma",
    photoUrl: null,
    videoUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    gift: { senderName: "Grandma", message: "Happy birthday", photoUrl: null },
  },
  {
    id: "2",
    type: "note",
    content: "First day of school",
    authorName: "Dad",
    photoUrl: null,
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    createdAt: "2026-01-02T00:00:00.000Z",
    gift: null,
  },
] as any;

const filteredByType = filterMemoryEntries(entries, "note", "");
assert.equal(filteredByType.length, 1);
assert.equal(filteredByType[0].id, "2");

const filteredByQuery = filterMemoryEntries(entries, "all", "grandma");
assert.equal(filteredByQuery.length, 1);
assert.equal(filteredByQuery[0].id, "1");

const paged = getVisibleMemoryEntries(entries, 1);
assert.equal(paged.length, 1);
assert.equal(paged[0].id, "1");

assert.equal(validateMemoryMedia("https://example.com/photo.jpg", ""), null);
assert.equal(validateMemoryMedia("", "https://youtube.com/watch?v=abc123"), null);
assert.ok(validateMemoryMedia("not-a-url", "") !== null);
assert.ok(validateMemoryMedia("", "https://example.com/video.mp4") !== null);

console.log("memory utils tests passed");

