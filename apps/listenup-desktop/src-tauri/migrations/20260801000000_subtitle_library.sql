-- @purpose 创建 Desktop 持久字幕库，保存原字幕修订、AI 翻译及翻译到原句的映射。
-- @role    GUI 与 listenup CLI 共用的 SQLite 数据模型。
-- @deps    sqlx migrations
-- @gotcha  翻译只能引用同一 source_revision 的连续原句；更强校验由 Rust domain 层执行。

CREATE TABLE videos (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  current_track_id TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE source_tracks (
  track_id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'asr')),
  vss_id TEXT NOT NULL,
  is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
  current_revision_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, language_code, kind, vss_id)
);

CREATE TABLE source_revisions (
  revision_id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES source_tracks(track_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE source_segments (
  revision_id TEXT NOT NULL REFERENCES source_revisions(revision_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  start_time_ms INTEGER NOT NULL,
  end_time_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (revision_id, segment_id),
  UNIQUE (revision_id, ordinal)
);

CREATE TABLE translation_sets (
  translation_id TEXT PRIMARY KEY,
  source_revision_id TEXT NOT NULL REFERENCES source_revisions(revision_id) ON DELETE CASCADE,
  target_language_code TEXT NOT NULL,
  target_display_name TEXT NOT NULL,
  generator TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_revision_id, target_language_code)
);

CREATE TABLE translation_segments (
  translation_id TEXT NOT NULL REFERENCES translation_sets(translation_id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (translation_id, segment_id),
  UNIQUE (translation_id, ordinal)
);

CREATE TABLE translation_segment_sources (
  translation_id TEXT NOT NULL,
  translation_segment_id TEXT NOT NULL,
  source_revision_id TEXT NOT NULL,
  source_segment_id TEXT NOT NULL,
  source_ordinal INTEGER NOT NULL,
  PRIMARY KEY (translation_id, translation_segment_id, source_segment_id),
  FOREIGN KEY (translation_id, translation_segment_id)
    REFERENCES translation_segments(translation_id, segment_id) ON DELETE CASCADE,
  FOREIGN KEY (source_revision_id, source_segment_id)
    REFERENCES source_segments(revision_id, segment_id) ON DELETE CASCADE
);

CREATE INDEX idx_source_tracks_video ON source_tracks(video_id);
CREATE INDEX idx_source_segments_revision_ordinal ON source_segments(revision_id, ordinal);
CREATE INDEX idx_translation_sets_revision ON translation_sets(source_revision_id);
CREATE INDEX idx_translation_sources_segment
  ON translation_segment_sources(translation_id, translation_segment_id, source_ordinal);
