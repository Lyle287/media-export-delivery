import { z } from "zod";

export const creatorExportSchema = z.object({
  creatorId: z.string().min(1),
  exportId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  assets: z.array(
    z.object({
      assetId: z.string().min(1),
      title: z.string().min(1),
      sourceUrl: z.string().url(),
      processing: z.object({
        jobId: z.string().min(1),
        status: z.enum(["ingested", "processing", "ready", "failed"]),
      }),
    }),
  ).min(1),
}).strict();

export type CreatorExport = z.infer<typeof creatorExportSchema>;

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildReadyAssetCsv(input: CreatorExport): string {
  const header = ["asset_id", "title", "source_url", "job_id", "status"];
  const rows = input.assets
    .filter((asset) => asset.processing.status === "ready")
    .map((asset) => [
      asset.assetId,
      asset.title,
      asset.sourceUrl,
      asset.processing.jobId,
      asset.processing.status,
    ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function buildDeliveryNote(input: CreatorExport, exportedCount: number): string {
  return [
    `# Creator export ${input.exportId}`,
    "",
    `Creator: ${input.creatorId}`,
    `Assets received: ${input.assets.length}`,
    `Ready assets exported: ${exportedCount}`,
  ].join("\n");
}
