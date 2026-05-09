import assert from "node:assert/strict";
import test from "node:test";
import { formatBatchZipName, uniqueZipName } from "../src/batch-zip.mjs";

test("formatBatchZipName uses Twitter Download prefix and ISO date", () => {
  const date = new Date("2026-05-09T13:42:00.000Z");
  assert.equal(formatBatchZipName(date), "Twitter Download - 2026-05-09.zip");
});

test("formatBatchZipName pads single-digit months and days", () => {
  const date = new Date("2026-01-03T00:00:00.000Z");
  assert.equal(formatBatchZipName(date), "Twitter Download - 2026-01-03.zip");
});

test("uniqueZipName returns the original name when not taken", () => {
  assert.equal(uniqueZipName("article.pdf", []), "article.pdf");
  assert.equal(uniqueZipName("article.pdf", ["other.pdf"]), "article.pdf");
});

test("uniqueZipName disambiguates collisions with a counter", () => {
  assert.equal(
    uniqueZipName("article.pdf", ["article.pdf"]),
    "article (2).pdf"
  );
  assert.equal(
    uniqueZipName("article.pdf", ["article.pdf", "article (2).pdf"]),
    "article (3).pdf"
  );
});

test("uniqueZipName handles names without an extension", () => {
  assert.equal(uniqueZipName("notes", ["notes"]), "notes (2)");
});
