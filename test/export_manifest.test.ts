import assert from "node:assert/strict";
import test from "node:test";
import { buildReadyAssetCsv, creatorExportSchema } from "../src/export_manifest.js";

test("the delivery manifest includes ready assets and holds back active jobs", () => {
  const request = creatorExportSchema.parse({
    creatorId: "creator_42",
    exportId: "weekly-drop",
    assets: [
      {
        assetId: "ready_1",
        title: "Launch, recut",
        sourceUrl: "https://media.example.com/ready.mp4",
        processing: { jobId: "job_ready", status: "ready" },
      },
      {
        assetId: "active_1",
        title: "Behind the scenes",
        sourceUrl: "https://media.example.com/active.mp4",
        processing: { jobId: "job_active", status: "processing" },
      },
    ],
  });

  const csv = buildReadyAssetCsv(request);

  assert.match(csv, /"ready_1","Launch, recut"/);
  assert.doesNotMatch(csv, /active_1/);
  assert.equal(csv.trim().split("\n").length, 2);
});
