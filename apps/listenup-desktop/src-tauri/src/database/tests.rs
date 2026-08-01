// @purpose 验证 SQLite 字幕缓存幂等性，以及 AI 翻译合并、拆分、顺序与覆盖约束。
// @role    database 模块的单元级集成测试。
// @deps    super、domain
// @gotcha  使用单连接内存 SQLite，避免不同连接各自拥有独立数据库。

use super::*;
use crate::domain::{TranslationDocument, TranslationDocumentSegment, TranslationLanguage};

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
