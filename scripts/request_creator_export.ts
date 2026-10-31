const response = await fetch("http://localhost:3000/creator-exports", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    creatorId: "creator_42",
    exportId: "september-library",
    assets: [
      {
        assetId: "video_101",
        title: "Studio tour",
        sourceUrl: "https://media.example.com/video_101.mp4",
        processing: { jobId: "job_801", status: "ready" },
      },
      {
        assetId: "video_102",
        title: "Editing notes",
        sourceUrl: "https://media.example.com/video_102.mp4",
        processing: { jobId: "job_802", status: "processing" },
      },
    ],
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));

export {};
