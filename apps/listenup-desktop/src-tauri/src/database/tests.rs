// @purpose 验证 SQLite migration 兼容、字幕幂等性与翻译映射约束。
// @role    database 模块的单元级集成测试。
// @deps    super、domain
// @gotcha  migration 兼容测试使用磁盘临时库，其余用单连接内存库。

use super::*;
use crate::domain::{TranslationDocument, TranslationDocumentSegment, TranslationLanguage};

#[tokio::test]
async fn repairs_the_known_legacy_migration_checksum_when_schema_is_complete() {
    let unique = format!(
        "listenup-legacy-migration-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    let database_path = std::env::temp_dir().join(format!("{unique}.sqlite"));
    let database = SubtitleDatabase::connect(&database_path).await.unwrap();
    sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
        .bind(LEGACY_INITIAL_MIGRATION_CHECKSUM)
        .bind(INITIAL_MIGRATION_VERSION)
        .execute(&database.pool)
        .await
        .unwrap();
    database.pool.close().await;

    let repaired = SubtitleDatabase::connect(&database_path).await.unwrap();
    let checksum: Vec<u8> =
        sqlx::query_scalar("SELECT checksum FROM _sqlx_migrations WHERE version = ?")
            .bind(INITIAL_MIGRATION_VERSION)
            .fetch_one(&repaired.pool)
            .await
            .unwrap();
    let current = MIGRATOR
        .iter()
        .find(|migration| migration.version == INITIAL_MIGRATION_VERSION)
        .unwrap();
    assert_eq!(checksum, current.checksum.as_ref());
    repaired.pool.close().await;
    let _ = std::fs::remove_file(database_path);
}

fn snapshot() -> SourceSnapshot {
    SourceSnapshot {
        video_id: "video-ja".into(),
        title: "Japanese lesson".into(),
        language_code: "ja".into(),
        display_name: "日本語".into(),
        kind: "manual".into(),
        vss_id: ".ja".into(),
        is_default: true,
        segments: vec![
            SourceSnapshotSegment {
                source_id: "youtube-0".into(),
                start_time_ms: 0,
                end_time_ms: 1_000,
                text: "おはよう".into(),
            },
            SourceSnapshotSegment {
                source_id: "youtube-1".into(),
                start_time_ms: 1_000,
                end_time_ms: 2_000,
                text: "ございます".into(),
            },
            SourceSnapshotSegment {
                source_id: "youtube-2".into(),
                start_time_ms: 2_000,
                end_time_ms: 3_000,
                text: "今日は晴れです".into(),
            },
        ],
    }
}

fn document(
    source: &StoredSourceTrack,
    segments: Vec<TranslationDocumentSegment>,
) -> TranslationDocument {
    TranslationDocument {
        version: 1,
        video_id: source.video_id.clone(),
        source_track_id: source.track_id.clone(),
        source_revision: source.revision.clone(),
        target_language: TranslationLanguage {
            code: "zh-CN".into(),
            display_name: "简体中文".into(),
        },
        generator: Some("user-ai".into()),
        segments,
    }
}

#[tokio::test]
async fn stores_the_same_source_revision_idempotently() {
    let database = SubtitleDatabase::connect_memory().await.unwrap();
    let first = database.store_source(snapshot()).await.unwrap();
    let second = database.store_source(snapshot()).await.unwrap();

    assert_eq!(first.track_id, second.track_id);
    assert_eq!(first.revision, second.revision);
    assert_eq!(database.list_videos().await.unwrap().len(), 1);
    assert_eq!(second.segments.len(), 3);
}

#[tokio::test]
async fn stores_and_reads_a_translation_that_merges_adjacent_sources() {
    let database = SubtitleDatabase::connect_memory().await.unwrap();
    let source = database.store_source(snapshot()).await.unwrap();
    let translation = document(
        &source,
        vec![
            TranslationDocumentSegment {
                id: "zh-0".into(),
                source_segment_ids: vec![
                    source.segments[0].id.clone(),
                    source.segments[1].id.clone(),
                ],
                text: "早上好".into(),
            },
            TranslationDocumentSegment {
                id: "zh-1".into(),
                source_segment_ids: vec![source.segments[2].id.clone()],
                text: "今天天气晴朗".into(),
            },
        ],
    );

    let dry_run = database
        .apply_translation(&translation, false)
        .await
        .unwrap();
    assert!(!dry_run.committed);
    assert!(database
        .list_translations(&source.video_id)
        .await
        .unwrap()
        .is_empty());

    database
        .apply_translation(&translation, true)
        .await
        .unwrap();
    let view = database
        .subtitle_view(Some(&source.video_id), Some("zh-CN"))
        .await
        .unwrap()
        .unwrap();
    let stored = view.translation.unwrap();
    assert_eq!(stored.segments.len(), 2);
    assert_eq!(stored.segments[0].source_segment_ids.len(), 2);
    assert_eq!(stored.segments[0].source_text, "おはよう ございます");
}

#[tokio::test]
async fn accepts_splits_but_rejects_crossing_and_incomplete_mappings() {
    let database = SubtitleDatabase::connect_memory().await.unwrap();
    let source = database.store_source(snapshot()).await.unwrap();
    let split = document(
        &source,
        vec![
            TranslationDocumentSegment {
                id: "split-0a".into(),
                source_segment_ids: vec![source.segments[0].id.clone()],
                text: "早上".into(),
            },
            TranslationDocumentSegment {
                id: "split-0b".into(),
                source_segment_ids: vec![source.segments[0].id.clone()],
                text: "好".into(),
            },
            TranslationDocumentSegment {
                id: "split-1".into(),
                source_segment_ids: vec![
                    source.segments[1].id.clone(),
                    source.segments[2].id.clone(),
                ],
                text: "今天是晴天".into(),
            },
        ],
    );
    assert!(database.apply_translation(&split, false).await.is_ok());

    let crossing = document(
        &source,
        vec![
            TranslationDocumentSegment {
                id: "cross-0".into(),
                source_segment_ids: vec![
                    source.segments[0].id.clone(),
                    source.segments[1].id.clone(),
                ],
                text: "早上好".into(),
            },
            TranslationDocumentSegment {
                id: "cross-1".into(),
                source_segment_ids: vec![
                    source.segments[1].id.clone(),
                    source.segments[2].id.clone(),
                ],
                text: "今天天气晴朗".into(),
            },
        ],
    );
    assert!(database
        .apply_translation(&crossing, false)
        .await
        .unwrap_err()
        .starts_with("source_order_invalid"));

    let incomplete = document(
        &source,
        vec![TranslationDocumentSegment {
            id: "only-one".into(),
            source_segment_ids: vec![source.segments[0].id.clone()],
            text: "早上好".into(),
        }],
    );
    assert!(database
        .apply_translation(&incomplete, false)
        .await
        .unwrap_err()
        .starts_with("source_coverage_incomplete"));
}
