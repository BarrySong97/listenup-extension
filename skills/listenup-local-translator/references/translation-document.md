# Translation document version 1

Create one complete JSON object with this shape:

```json
{
  "version": 1,
  "videoId": "VIDEO_ID_FROM_SUBTITLE_GET",
  "sourceTrackId": "TRACK_ID_FROM_SUBTITLE_GET",
  "sourceRevision": "REVISION_FROM_SUBTITLE_GET",
  "targetLanguage": {
    "code": "es",
    "displayName": "Español"
  },
  "generator": "local-ai",
  "segments": [
    {
      "id": "tr-000001",
      "sourceSegmentIds": ["SOURCE_SEGMENT_ID"],
      "text": "Texto traducido"
    }
  ]
}
```

## Field rules

- `version` must be the number `1`.
- `videoId`, `sourceTrackId`, and `sourceRevision` must exactly match the latest `subtitle get` output.
- `targetLanguage.code` must be a valid BCP 47 tag and differ from the source language.
- `targetLanguage.displayName` must be readable and non-empty.
- `generator` is optional; use a short non-sensitive identifier without credentials or model prompts.
- Every translation segment `id` must be non-empty and unique within the document.
- Every `text` must be a non-empty translation, not commentary or a fenced code block.
- Every `sourceSegmentIds` array must be non-empty and use only IDs from the exported source.

## Ordering and coverage

Every source segment must be represented at least once, with no reversal or partial overlap.

Default one-to-one mapping:

```json
[
  { "id": "tr-1", "sourceSegmentIds": ["s-1"], "text": "…" },
  { "id": "tr-2", "sourceSegmentIds": ["s-2"], "text": "…" }
]
```

Merge only adjacent source lines when one target-language unit requires them:

```json
[
  { "id": "tr-1", "sourceSegmentIds": ["s-1", "s-2"], "text": "…" },
  { "id": "tr-2", "sourceSegmentIds": ["s-3"], "text": "…" }
]
```

Split one source line by repeating the exact same single source ID in consecutive translation segments:

```json
[
  { "id": "tr-1a", "sourceSegmentIds": ["s-1"], "text": "…" },
  { "id": "tr-1b", "sourceSegmentIds": ["s-1"], "text": "…" },
  { "id": "tr-2", "sourceSegmentIds": ["s-2"], "text": "…" }
]
```

Invalid mappings include:

- skipping any source ID;
- reversing source order;
- referencing non-adjacent IDs in one translated segment;
- partially overlapping ranges such as `[s-1, s-2]` followed by `[s-2, s-3]`;
- repeating a multi-source range to simulate a split;
- using IDs or a revision from an older export.

The CLI enforces these rules transactionally. Never bypass a validation failure by editing SQLite.
