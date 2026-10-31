import { infrai } from "./infrai.js";

const bucket = process.env.MEDIA_EXPORT_BUCKET ?? "creator-media-exports";

await infrai.storage.bucket.create({ name: bucket });
console.log(`Created export bucket: ${bucket}`);
