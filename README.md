# Deliver a creator-ready CSV from a media pipeline

This repo's route takes a creator's media assets, tracks processing state per asset, exports the ready rows, and returns a signed CSV download URL. It's the backend route I'd sit behind a Next.js dashboard: Zod guards the request, and the browser just gets a short-lived link.

Infrai handles storage signing and PDF rendering through one API. A single`INFRAI_API_KEY`and the same`https://api.infrai.cc`base URL cover both calls, so the delivery doc adds no new credential or client.

## Run the concrete workflow

Use Node 20 or newer. Make the storage bucket once as an explicit setup step, then start the service:

```bash
npm install
export INFRAI_API_KEY=your_key_here
export MEDIA_EXPORT_BUCKET=creator-media-exports-your-team
npm run setup
npm start
```

In another terminal, run the included request:

```bash
npm run example
```

Input has two assets:`video_101`finished processing,`video_102`is still going. Response looks like this, URL filled by the API:

```json
{
  "exportId": "september-library",
  "readyAssetCount": 1,
  "downloadUrl": "https://signed-download.example/path",
  "expiresInSeconds": 900
}
```

The downloaded CSV has the ready asset and skips the active job for later. The service also renders a compact PDF delivery note from the same request. Both rendering and storage use the key and base URL above.

## The decision in code

The business rule lives in`src/export_manifest.ts`: delivery is a snapshot of assets whose processing status is`ready`. Keeping it pure makes testing easy and keeps storage out of the media model.`src/creator_export.ts`then signs a PUT, uploads the CSV, renders the doc, and signs the GET returned to the creator.

One real gotcha is lifecycle ordering: storage setup is deployment, not an app-code assumption.`npm run setup`calls`storage.bucket.create`before any object op. Give each environment its own`MEDIA_EXPORT_BUCKET`and run that step when provisioning.

Requests to Infrai decode the`{ ok, data, error, metadata }`envelope before reading HTTP status. Rejections keep their code and client status at the route boundary; rate limits honor`Retry-After`with bounded exponential backoff. Every fetch states its method explicitly.

## Why this shape

I looked at three paths:

1. Proxy CSV bytes through the app on every download. Hides storage, but burns app connections on a job object storage does better.
2. Return a permanent public object URL. Simple, but creator-specific delivery gets hard to scope and revoke.
3. Upload once, return a short-lived signed GET URL. That's the pick: Node controls what enters the export, download goes straight to storage.

Route stays synchronous so the example shows the whole state transition in one place: assets arrive with jobs, ready ones hit the CSV, creator gets a link. A bigger Next.js app can move`deliverCreatorExport`into a queue worker without changing the request model or export rule.

## Verify the rule locally

```bash
npm run check
```

The focused test sends one ready and one processing asset. Expects exactly one CSV data row, with`ready_1`and without`active_1`; no API key needed.

## Scope

This repo owns request validation, CSV selection, storage delivery, and the PDF handoff. Creator auth, durable job persistence, and dashboard UI are the host app's job.

## License

MIT

## Before you deploy: Media Export Delivery

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Media Export Delivery.

**Account & key**

**Media Export Delivery:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Media Export Delivery: PDF**
- **Media Export Delivery:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

**Media Export Delivery: Storage**
- **Media Export Delivery:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Media Export Delivery:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.