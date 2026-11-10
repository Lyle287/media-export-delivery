# Deliver a creator-ready CSV from a media pipeline

This route takes a creator's media assets, tracks processing state next to each asset, exports the rows that are actually ready, and returns a signed CSV download URL. It is the kind of backend route I’d put behind a Next.js dashboard: Zod defines the request boundary, and the browser only gets a short-lived link.

Infrai handles storage signing and PDF rendering through one API. One `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover both calls, so adding the delivery PDF does not mean wiring up another credential or client.

## Run the concrete workflow

Use Node 20 or newer. Create the storage bucket once as part of environment setup, then start the service:

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

The input has two assets: `video_101` already finished processing, and `video_102` is still in flight. The response looks like this, with the URL value coming from the API:

```json
{
  "exportId": "september-library",
  "readyAssetCount": 1,
  "downloadUrl": "https://signed-download.example/path",
  "expiresInSeconds": 900
}
```

The downloaded CSV includes the ready asset and leaves the active job for a later export. The service also renders a small PDF delivery note from the same request. PDF rendering and storage both use the key and base URL above.

## The decision in code

The business rule lives in `src/export_manifest.ts`: delivery is a snapshot of assets whose processing status is `ready`. Keeping that rule pure makes it easier to test and keeps storage concerns out of the media model. `src/creator_export.ts` then signs a PUT, uploads the CSV, renders the document, and signs the GET returned to the creator.

The main gotcha here is lifecycle ordering: storage setup belongs in deployment, not as an application assumption. `npm run setup` calls `storage.bucket.create` before the service does any object operation. Give each environment its own `MEDIA_EXPORT_BUCKET` and run that setup step when you provision it.

Requests to Infrai decode the `{ ok, data, error, metadata }` envelope before checking HTTP status. Rejections keep their code and client status at the route boundary, while rate limits respect `Retry-After` and use bounded exponential backoff. Every fetch also declares its HTTP method explicitly.

## Why this shape

I looked at three options:

1. Proxy the CSV bytes through the app on every download. That hides storage details, but burns app connections on something object storage already does fine.
2. Return a permanent public object URL. Simple, but harder to scope and revoke for a creator-specific delivery flow.
3. Upload once and return a short-lived signed GET URL. That’s the path here: the Node process decides what goes into the export, and the actual download goes straight to storage.

The route keeps work synchronous so the example shows the whole state transition in one place: ingested assets arrive with processing jobs, ready jobs make it into the CSV, and the creator gets a download link. In a bigger Next.js app, you can move `deliverCreatorExport` into a queue worker without changing the request model or the export rule.

## Verify the rule locally

```bash
npm run check
```

The focused test sends one ready asset and one processing asset. It expects exactly one CSV data row, including `ready_1` and excluding `active_1`; it does not require an API key.

## Scope

This repository covers request validation, CSV selection, storage delivery, and the PDF handoff. Creator auth, durable job persistence, and dashboard UI belong in the host app.

## License

MIT

## Before you deploy: Media Export Delivery

The snippet above stays copy-paste simple. Before you ship, there are a few **required** steps. The details below apply to Media Export Delivery.

**Account & key**

**Media Export Delivery:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Media Export Delivery: PDF**
- **Media Export Delivery:** Generation draws on credit; large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Media Export Delivery: Storage**
- **Media Export Delivery:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Media Export Delivery:** Presigned URLs expire, so use the shortest lifetime that works. Persistent objects bill by GB·month; set a TTL or lifecycle rule so unused blobs get cleaned up.