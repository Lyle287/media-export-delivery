import { buildDeliveryNote, buildReadyAssetCsv, type CreatorExport } from "./export_manifest.js";
import { infrai } from "./infrai.js";

const bucket = process.env.MEDIA_EXPORT_BUCKET ?? "creator-media-exports";

export type ExportDelivery = {
  exportId: string;
  readyAssetCount: number;
  downloadUrl: string;
  expiresInSeconds: number;
};

export async function deliverCreatorExport(input: CreatorExport): Promise<ExportDelivery> {
  const csv = buildReadyAssetCsv(input);
  const readyAssetCount = input.assets.filter((asset) => asset.processing.status === "ready").length;
  const objectKey = `exports/${input.creatorId}/${input.exportId}.csv`;
  const idempotencyKey = `creator-export-${input.exportId}`;

  const upload = await infrai.storage.object.presign(bucket, objectKey, {
    op: "put",
    expires_seconds: 300,
    content_type: "text/csv; charset=utf-8",
    idempotency_key: idempotencyKey,
  });

  const uploadResponse = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "text/csv; charset=utf-8" },
    body: csv,
  });
  if (!uploadResponse.ok) throw new Error(`CSV upload returned ${uploadResponse.status}`);

  await infrai.pdf.generate({
    markdown: buildDeliveryNote(input, readyAssetCount),
    page_size: "A4",
    orientation: "portrait",
    store: true,
  });

  const expiresInSeconds = 900;
  const download = await infrai.storage.object.presign(bucket, objectKey, {
    op: "get",
    expires_seconds: expiresInSeconds,
    response_disposition: `attachment; filename="${input.exportId}.csv"`,
    idempotency_key: `${idempotencyKey}-download`,
  });

  return { exportId: input.exportId, readyAssetCount, downloadUrl: download.url, expiresInSeconds };
}
