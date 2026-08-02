// @purpose 管理 Desktop SQLite 字幕库、迁移兼容，持久化原字幕与用户 AI 翻译。
// @role    Native Messaging 写入、Tauri 查询和 listenup CLI 的共享数据访问层。
// @deps    sqlx、sha2、domain、migrations
// @gotcha  已发布 migration 不可改写；仅对已知旧 checksum 且 schema 完整的数据库做元数据修复。

use crate::domain::{validate_translation_document, TranslationDocument, TranslationSourceSegment};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};
use std::str::FromStr;
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

static MIGRATOR: Migrator = sqlx::migrate!();
const INITIAL_MIGRATION_VERSION: i64 = 20_260_801_000_000;
const LEGACY_INITIAL_MIGRATION_CHECKSUM: &[u8] = &[
    0x6f, 0xa3, 0x54, 0x2a, 0x5d, 0xe4, 0x39, 0x7f, 0xd9, 0xbb, 0xdf, 0x45, 0xbb, 0x86, 0x04, 0xe7,
    0x6c, 0x0d, 0x32, 0x2e, 0x6e, 0x6d, 0xdd, 0xfb, 0x60, 0x65, 0x5b, 0x84, 0x49, 0x74, 0x05, 0x8a,
    0xa7, 0x96, 0x99, 0x38, 0x4f, 0xe6, 0x99, 0xca, 0xec, 0x15, 0xde, 0xbb, 0x0b, 0x83, 0x8c, 0xb9,
];
const INITIAL_SCHEMA_OBJECTS: &[&str] = &[
    "videos",
    "source_tracks",
    "source_revisions",
    "source_segments",
    "translation_sets",
    "translation_segments",
    "translation_segment_sources",
    "idx_source_tracks_video",
    "idx_source_segments_revision_ordinal",
    "idx_translation_sets_revision",
    "idx_translation_sources_segment",
];

#[cfg(test)]
mod tests;

#[derive(Clone)]
pub struct SubtitleDatabase {
    pool: SqlitePool,
    path: PathBuf,
}

#[derive(Clone, Default)]
pub struct DatabaseState(pub Option<SubtitleDatabase>);

#[derive(Clone, Debug)]
pub struct SourceSnapshotSegment {
    pub source_id: String,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub text: String,
}

#[derive(Clone, Debug)]
pub struct SourceSnapshot {
    pub video_id: String,
    pub title: String,
    pub language_code: String,
    pub display_name: String,
    pub kind: String,
    pub vss_id: String,
    pub is_default: bool,
    pub segments: Vec<SourceSnapshotSegment>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredSourceSegment {
    pub id: String,
    pub ordinal: i64,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredSourceTrack {
    pub video_id: String,
    pub title: String,
    pub track_id: String,
    pub revision: String,
    pub language_code: String,
    pub display_name: String,
    pub kind: String,
    pub vss_id: String,
    pub is_default: bool,
    pub segments: Vec<StoredSourceSegment>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranslationSummary {
    pub language_code: String,
    pub display_name: String,
    pub generator: Option<String>,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredTranslationSegment {
    pub id: String,
    pub ordinal: i64,
    pub source_segment_ids: Vec<String>,
    pub start_time_ms: i64,
    pub end_time_ms: i64,
    pub source_text: String,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredTranslation {
    pub language_code: String,
    pub display_name: String,
    pub generator: Option<String>,
    pub segments: Vec<StoredTranslationSegment>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleView {
    pub source: StoredSourceTrack,
    pub translations: Vec<TranslationSummary>,
    pub translation: Option<StoredTranslation>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VideoSummary {
    pub video_id: String,
    pub title: String,
    pub language_code: String,
    pub display_name: String,
    pub source_revision: String,
    pub last_seen_at: String,
    pub translation_languages: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTranslationResult {
    pub committed: bool,
    pub video_id: String,
    pub source_revision: String,
    pub target_language_code: String,
    pub translated_segment_count: usize,
}

struct SourceContext {
    source: StoredSourceTrack,
}

impl SubtitleDatabase {
    pub async fn connect(path: impl AsRef<Path>) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .busy_timeout(Duration::from_secs(5));
        Self::connect_with_options(path, options, 5).await
    }

    pub async fn connect_ephemeral() -> Result<Self, String> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")
            .map_err(|error| error.to_string())?
            .foreign_keys(true);
        Self::connect_with_options(PathBuf::from(":memory:"), options, 1).await
    }

    #[cfg(test)]
    async fn connect_memory() -> Result<Self, String> {
        Self::connect_ephemeral().await
    }

    async fn connect_with_options(
        path: PathBuf,
        options: SqliteConnectOptions,
        max_connections: u32,
    ) -> Result<Self, String> {
        let pool = SqlitePoolOptions::new()
            .max_connections(max_connections)
            .connect_with(options)
            .await
            .map_err(|error| error.to_string())?;
        repair_known_initial_migration_checksum(&pool).await?;
        MIGRATOR
            .run(&pool)
            .await
            .map_err(|error| error.to_string())?;
        Ok(Self { pool, path })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub async fn store_source(
        &self,
        snapshot: SourceSnapshot,
    ) -> Result<StoredSourceTrack, String> {
        validate_source_snapshot(&snapshot)?;
        let track_id = stable_id(
            "track",
            &[
                &snapshot.video_id,
                &snapshot.language_code,
                &snapshot.kind,
                &snapshot.vss_id,
            ],
        );
        let segments: Vec<StoredSourceSegment> = snapshot
            .segments
            .iter()
            .enumerate()
            .map(|(ordinal, segment)| StoredSourceSegment {
                id: stable_id(
                    "segment",
                    &[
                        &track_id,
                        &ordinal.to_string(),
                        &segment.source_id,
                        &segment.start_time_ms.to_string(),
                        &segment.end_time_ms.to_string(),
                        &segment.text,
                    ],
                ),
                ordinal: ordinal as i64,
                start_time_ms: segment.start_time_ms,
                end_time_ms: segment.end_time_ms,
                text: segment.text.clone(),
            })
            .collect();
        let revision_parts: Vec<String> = segments
            .iter()
            .flat_map(|segment| {
                [
                    segment.id.clone(),
                    segment.start_time_ms.to_string(),
                    segment.end_time_ms.to_string(),
                    segment.text.clone(),
                ]
            })
            .collect();
        let revision_refs: Vec<&str> = std::iter::once(track_id.as_str())
            .chain(revision_parts.iter().map(String::as_str))
            .collect();
        let revision = stable_id("revision", &revision_refs);

        let mut transaction = self.pool.begin().await.map_err(|error| error.to_string())?;
        sqlx::query(
            "INSERT INTO videos (video_id, title, current_track_id, last_seen_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(video_id) DO UPDATE SET
               title = excluded.title,
               current_track_id = excluded.current_track_id,
               last_seen_at = CURRENT_TIMESTAMP",
        )
        .bind(&snapshot.video_id)
        .bind(&snapshot.title)
        .bind(&track_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            "INSERT INTO source_tracks
               (track_id, video_id, language_code, display_name, kind, vss_id, is_default, current_revision_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(track_id) DO UPDATE SET
               display_name = excluded.display_name,
               is_default = excluded.is_default,
               current_revision_id = excluded.current_revision_id,
               updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&track_id)
        .bind(&snapshot.video_id)
        .bind(&snapshot.language_code)
        .bind(&snapshot.display_name)
        .bind(&snapshot.kind)
        .bind(&snapshot.vss_id)
        .bind(snapshot.is_default)
        .bind(&revision)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            "INSERT INTO source_revisions (revision_id, track_id) VALUES (?, ?)
             ON CONFLICT(revision_id) DO NOTHING",
        )
        .bind(&revision)
        .bind(&track_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        for segment in &segments {
            sqlx::query(
                "INSERT INTO source_segments
                   (revision_id, segment_id, ordinal, start_time_ms, end_time_ms, text)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(revision_id, segment_id) DO NOTHING",
            )
            .bind(&revision)
            .bind(&segment.id)
            .bind(segment.ordinal)
            .bind(segment.start_time_ms)
            .bind(segment.end_time_ms)
            .bind(&segment.text)
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
        }
        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;

        Ok(StoredSourceTrack {
            video_id: snapshot.video_id,
            title: snapshot.title,
            track_id,
            revision,
            language_code: snapshot.language_code,
            display_name: snapshot.display_name,
            kind: snapshot.kind,
            vss_id: snapshot.vss_id,
            is_default: snapshot.is_default,
            segments,
        })
    }

    pub async fn subtitle_view(
        &self,
        video_id: Option<&str>,
        target_language: Option<&str>,
    ) -> Result<Option<SubtitleView>, String> {
        let Some(source) = self.get_source(video_id).await? else {
            return Ok(None);
        };
        let translations = self
            .list_translations_for_revision(&source.revision)
            .await?;
        let translation = match target_language {
            Some(language) => self.get_translation_for_source(&source, language).await?,
            None => None,
        };
        Ok(Some(SubtitleView {
            source,
            translations,
            translation,
        }))
    }

    pub async fn list_videos(&self) -> Result<Vec<VideoSummary>, String> {
        let rows: Vec<(String, String, String, String, String, String)> = sqlx::query_as(
            "SELECT v.video_id, v.title, st.language_code, st.display_name,
                    st.current_revision_id, v.last_seen_at
             FROM videos v
             JOIN source_tracks st ON st.track_id = v.current_track_id
             WHERE st.current_revision_id IS NOT NULL
             ORDER BY v.last_seen_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        let mut videos = Vec::with_capacity(rows.len());
        for (video_id, title, language_code, display_name, revision, last_seen_at) in rows {
            let translation_languages = self
                .list_translations_for_revision(&revision)
                .await?
                .into_iter()
                .map(|translation| translation.language_code)
                .collect();
            videos.push(VideoSummary {
                video_id,
                title,
                language_code,
                display_name,
                source_revision: revision,
                last_seen_at,
                translation_languages,
            });
        }
        Ok(videos)
    }

    pub async fn get_source(
        &self,
        video_id: Option<&str>,
    ) -> Result<Option<StoredSourceTrack>, String> {
        let row: Option<(
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            String,
            i64,
        )> = if let Some(video_id) = video_id {
            sqlx::query_as(
                "SELECT v.video_id, v.title, st.track_id, st.current_revision_id,
                            st.language_code, st.display_name, st.kind, st.vss_id, st.is_default
                     FROM videos v JOIN source_tracks st ON st.track_id = v.current_track_id
                     WHERE v.video_id = ? AND st.current_revision_id IS NOT NULL",
            )
            .bind(video_id)
            .fetch_optional(&self.pool)
            .await
        } else {
            sqlx::query_as(
                "SELECT v.video_id, v.title, st.track_id, st.current_revision_id,
                            st.language_code, st.display_name, st.kind, st.vss_id, st.is_default
                     FROM videos v JOIN source_tracks st ON st.track_id = v.current_track_id
                     WHERE st.current_revision_id IS NOT NULL
                     ORDER BY v.last_seen_at DESC LIMIT 1",
            )
            .fetch_optional(&self.pool)
            .await
        }
        .map_err(|error| error.to_string())?;
        let Some((
            video_id,
            title,
            track_id,
            revision,
            language_code,
            display_name,
            kind,
            vss_id,
            is_default,
        )) = row
        else {
            return Ok(None);
        };
        let segment_rows: Vec<(String, i64, i64, i64, String)> = sqlx::query_as(
            "SELECT segment_id, ordinal, start_time_ms, end_time_ms, text
             FROM source_segments WHERE revision_id = ? ORDER BY ordinal",
        )
        .bind(&revision)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        let segments = segment_rows
            .into_iter()
            .map(
                |(id, ordinal, start_time_ms, end_time_ms, text)| StoredSourceSegment {
                    id,
                    ordinal,
                    start_time_ms,
                    end_time_ms,
                    text,
                },
            )
            .collect();
        Ok(Some(StoredSourceTrack {
            video_id,
            title,
            track_id,
            revision,
            language_code,
            display_name,
            kind,
            vss_id,
            is_default: is_default != 0,
            segments,
        }))
    }

    pub async fn list_translations(
        &self,
        video_id: &str,
    ) -> Result<Vec<TranslationSummary>, String> {
        let source = self
            .get_source(Some(video_id))
            .await?
            .ok_or_else(|| format!("video_not_found: {video_id}"))?;
        self.list_translations_for_revision(&source.revision).await
    }

    pub async fn export_translation(
        &self,
        video_id: &str,
        target_language: &str,
    ) -> Result<Option<TranslationDocument>, String> {
        let source = self
            .get_source(Some(video_id))
            .await?
            .ok_or_else(|| format!("video_not_found: {video_id}"))?;
        let row: Option<(String, String, Option<String>)> = sqlx::query_as(
            "SELECT target_language_code, target_display_name, generator
             FROM translation_sets
             WHERE source_revision_id = ? AND lower(target_language_code) = lower(?)",
        )
        .bind(&source.revision)
        .bind(target_language)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        let Some((language_code, display_name, generator)) = row else {
            return Ok(None);
        };
        let translation = self
            .get_translation_for_source(&source, &language_code)
            .await?
            .ok_or_else(|| {
                "translation_corrupt: translation metadata has no segments".to_string()
            })?;
        Ok(Some(TranslationDocument {
            version: 1,
            video_id: source.video_id,
            source_track_id: source.track_id,
            source_revision: source.revision,
            target_language: crate::domain::TranslationLanguage {
                code: language_code,
                display_name,
            },
            generator,
            segments: translation
                .segments
                .into_iter()
                .map(|segment| crate::domain::TranslationDocumentSegment {
                    id: segment.id,
                    source_segment_ids: segment.source_segment_ids,
                    text: segment.text,
                })
                .collect(),
        }))
    }

    pub async fn apply_translation(
        &self,
        document: &TranslationDocument,
        commit: bool,
    ) -> Result<ApplyTranslationResult, String> {
        let context = self.source_context(&document.video_id).await?;
        let source_refs: Vec<TranslationSourceSegment> = context
            .source
            .segments
            .iter()
            .map(|segment| TranslationSourceSegment {
                id: segment.id.clone(),
                ordinal: segment.ordinal,
            })
            .collect();
        let validation = validate_translation_document(
            document,
            &context.source.video_id,
            &context.source.track_id,
            &context.source.revision,
            &context.source.language_code,
            &source_refs,
        )?;
        let result = ApplyTranslationResult {
            committed: commit,
            video_id: context.source.video_id.clone(),
            source_revision: context.source.revision.clone(),
            target_language_code: validation.canonical_target_language.clone(),
            translated_segment_count: document.segments.len(),
        };
        if !commit {
            return Ok(result);
        }

        let translation_id = stable_id(
            "translation",
            &[
                &context.source.revision,
                &validation.canonical_target_language,
            ],
        );
        let source_by_id: std::collections::HashMap<&str, &StoredSourceSegment> = context
            .source
            .segments
            .iter()
            .map(|segment| (segment.id.as_str(), segment))
            .collect();
        let mut transaction = self.pool.begin().await.map_err(|error| error.to_string())?;
        sqlx::query(
            "DELETE FROM translation_sets
             WHERE source_revision_id = ? AND lower(target_language_code) = lower(?)",
        )
        .bind(&context.source.revision)
        .bind(&validation.canonical_target_language)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        sqlx::query(
            "INSERT INTO translation_sets
               (translation_id, source_revision_id, target_language_code, target_display_name, generator)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&translation_id)
        .bind(&context.source.revision)
        .bind(&validation.canonical_target_language)
        .bind(document.target_language.display_name.trim())
        .bind(document.generator.as_deref())
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
        for (ordinal, segment) in document.segments.iter().enumerate() {
            sqlx::query(
                "INSERT INTO translation_segments (translation_id, segment_id, ordinal, text)
                 VALUES (?, ?, ?, ?)",
            )
            .bind(&translation_id)
            .bind(&segment.id)
            .bind(ordinal as i64)
            .bind(segment.text.trim())
            .execute(&mut *transaction)
            .await
            .map_err(|error| error.to_string())?;
            for source_id in &segment.source_segment_ids {
                let source = source_by_id[source_id.as_str()];
                sqlx::query(
                    "INSERT INTO translation_segment_sources
                       (translation_id, translation_segment_id, source_revision_id, source_segment_id, source_ordinal)
                     VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&translation_id)
                .bind(&segment.id)
                .bind(&context.source.revision)
                .bind(source_id)
                .bind(source.ordinal)
                .execute(&mut *transaction)
                .await
                .map_err(|error| error.to_string())?;
            }
        }
        transaction
            .commit()
            .await
            .map_err(|error| error.to_string())?;
        Ok(result)
    }

    pub async fn delete_translation(
        &self,
        video_id: &str,
        target_language: &str,
        commit: bool,
    ) -> Result<bool, String> {
        let source = self
            .get_source(Some(video_id))
            .await?
            .ok_or_else(|| format!("video_not_found: {video_id}"))?;
        let exists: Option<(String,)> = sqlx::query_as(
            "SELECT translation_id FROM translation_sets
             WHERE source_revision_id = ? AND lower(target_language_code) = lower(?)",
        )
        .bind(&source.revision)
        .bind(target_language)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        if commit && exists.is_some() {
            sqlx::query(
                "DELETE FROM translation_sets
                 WHERE source_revision_id = ? AND lower(target_language_code) = lower(?)",
            )
            .bind(&source.revision)
            .bind(target_language)
            .execute(&self.pool)
            .await
            .map_err(|error| error.to_string())?;
        }
        Ok(exists.is_some())
    }

    async fn source_context(&self, video_id: &str) -> Result<SourceContext, String> {
        let source = self
            .get_source(Some(video_id))
            .await?
            .ok_or_else(|| format!("video_not_found: {video_id}"))?;
        Ok(SourceContext { source })
    }

    async fn list_translations_for_revision(
        &self,
        revision: &str,
    ) -> Result<Vec<TranslationSummary>, String> {
        let rows: Vec<(String, String, Option<String>, String)> = sqlx::query_as(
            "SELECT target_language_code, target_display_name, generator, updated_at
             FROM translation_sets WHERE source_revision_id = ?
             ORDER BY target_display_name COLLATE NOCASE",
        )
        .bind(revision)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        Ok(rows
            .into_iter()
            .map(
                |(language_code, display_name, generator, updated_at)| TranslationSummary {
                    language_code,
                    display_name,
                    generator,
                    updated_at,
                },
            )
            .collect())
    }

    async fn get_translation_for_source(
        &self,
        source: &StoredSourceTrack,
        target_language: &str,
    ) -> Result<Option<StoredTranslation>, String> {
        let metadata: Option<(String, String, String, Option<String>)> = sqlx::query_as(
            "SELECT translation_id, target_language_code, target_display_name, generator
             FROM translation_sets
             WHERE source_revision_id = ? AND lower(target_language_code) = lower(?)",
        )
        .bind(&source.revision)
        .bind(target_language)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        let Some((translation_id, language_code, display_name, generator)) = metadata else {
            return Ok(None);
        };
        let rows: Vec<(String, i64, String, String, i64, i64, String)> = sqlx::query_as(
            "SELECT ts.segment_id, ts.ordinal, ts.text, ss.segment_id,
                    ss.start_time_ms, ss.end_time_ms, ss.text
             FROM translation_segments ts
             JOIN translation_segment_sources tss
               ON tss.translation_id = ts.translation_id
              AND tss.translation_segment_id = ts.segment_id
             JOIN source_segments ss
               ON ss.revision_id = tss.source_revision_id
              AND ss.segment_id = tss.source_segment_id
             WHERE ts.translation_id = ?
             ORDER BY ts.ordinal, tss.source_ordinal",
        )
        .bind(&translation_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;
        let mut segments: Vec<StoredTranslationSegment> = Vec::new();
        for (id, ordinal, text, source_id, start_time_ms, end_time_ms, source_text) in rows {
            if let Some(current) = segments.last_mut().filter(|segment| segment.id == id) {
                current.source_segment_ids.push(source_id);
                current.end_time_ms = end_time_ms;
                current.source_text.push(' ');
                current.source_text.push_str(&source_text);
            } else {
                segments.push(StoredTranslationSegment {
                    id,
                    ordinal,
                    source_segment_ids: vec![source_id],
                    start_time_ms,
                    end_time_ms,
                    source_text,
                    text,
                });
            }
        }
        Ok(Some(StoredTranslation {
            language_code,
            display_name,
            generator,
            segments,
        }))
    }
}

async fn repair_known_initial_migration_checksum(pool: &SqlitePool) -> Result<(), String> {
    let migrations_table_exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;
    if migrations_table_exists == 0 {
        return Ok(());
    }

    let applied: Option<(Vec<u8>, bool)> =
        sqlx::query_as("SELECT checksum, success FROM _sqlx_migrations WHERE version = ?")
            .bind(INITIAL_MIGRATION_VERSION)
            .fetch_optional(pool)
            .await
            .map_err(|error| error.to_string())?;
    let Some((checksum, success)) = applied else {
        return Ok(());
    };
    if checksum != LEGACY_INITIAL_MIGRATION_CHECKSUM {
        return Ok(());
    }
    if !success {
        return Err("legacy_migration_incomplete: initial subtitle migration failed".into());
    }

    let placeholders = (0..INITIAL_SCHEMA_OBJECTS.len())
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");
    let object_count_sql = format!(
        "SELECT COUNT(*) FROM sqlite_schema WHERE name IN ({placeholders}) AND sql IS NOT NULL"
    );
    let mut object_count_query = sqlx::query_scalar::<_, i64>(&object_count_sql);
    for object in INITIAL_SCHEMA_OBJECTS {
        object_count_query = object_count_query.bind(object);
    }
    let object_count = object_count_query
        .fetch_one(pool)
        .await
        .map_err(|error| error.to_string())?;
    if object_count != INITIAL_SCHEMA_OBJECTS.len() as i64 {
        return Err(
            "legacy_migration_schema_mismatch: refusing to repair migration metadata".into(),
        );
    }

    let current = MIGRATOR
        .iter()
        .find(|migration| migration.version == INITIAL_MIGRATION_VERSION)
        .ok_or_else(|| "initial_migration_missing: embedded migration not found".to_string())?;
    let mut transaction = pool.begin().await.map_err(|error| error.to_string())?;
    sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ? AND checksum = ?")
        .bind(current.checksum.as_ref())
        .bind(INITIAL_MIGRATION_VERSION)
        .bind(LEGACY_INITIAL_MIGRATION_CHECKSUM)
        .execute(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn validate_source_snapshot(snapshot: &SourceSnapshot) -> Result<(), String> {
    if snapshot.video_id.trim().is_empty() || snapshot.language_code.trim().is_empty() {
        return Err("source_identity_invalid: video and language are required".into());
    }
    if !matches!(snapshot.kind.as_str(), "manual" | "asr") {
        return Err("source_kind_invalid: expected manual or asr".into());
    }
    if snapshot.segments.is_empty() {
        return Err("source_empty: refusing to replace the cache with no subtitles".into());
    }
    if snapshot.segments.iter().any(|segment| {
        segment.text.trim().is_empty()
            || segment.start_time_ms < 0
            || segment.end_time_ms < segment.start_time_ms
    }) {
        return Err("source_segment_invalid: text and time range must be valid".into());
    }
    Ok(())
}

fn stable_id(namespace: &str, parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    for part in parts {
        hasher.update([0]);
        hasher.update(part.as_bytes());
    }
    format!("{namespace}_{}", &format!("{:x}", hasher.finalize())[..24])
}
