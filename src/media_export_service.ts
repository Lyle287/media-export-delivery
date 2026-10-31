import { createServer } from "node:http";
import { ZodError } from "zod";
import { deliverCreatorExport } from "./creator_export.js";
import { creatorExportSchema } from "./export_manifest.js";
import { InfraiError } from "./infrai.js";

const port = Number(process.env.PORT ?? 3000);

function json(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/creator-exports") {
    json(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = creatorExportSchema.parse(await readBody(request));
    json(response, 201, await deliverCreatorExport(input));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid export request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    console.error(error);
    json(response, 502, { error: "Export delivery failed" });
  }
});

server.listen(port, () => console.log(`Media export service listening on http://localhost:${port}`));
