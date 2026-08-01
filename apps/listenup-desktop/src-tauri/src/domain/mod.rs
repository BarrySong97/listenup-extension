// @purpose 定义可交给外部 AI 读写的翻译 JSON 契约，并校验句段映射与时间顺序。
// @role    GUI 数据库层与 listenup CLI 共用的纯领域逻辑。
// @deps    language-tags、serde
// @gotcha  允许合并/拆分连续原句，但不允许漏句、交叉引用、倒序或跨 source revision。

use language_tags::LanguageTag;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranslationLanguage {
    pub code: String,
    pub display_name: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranslationDocumentSegment {
    pub id: String,
    pub source_segment_ids: Vec<String>,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TranslationDocument {
    pub version: u8,
    pub video_id: String,
    pub source_track_id: String,
    pub source_revision: String,
    pub target_language: TranslationLanguage,
    pub generator: Option<String>,
    pub segments: Vec<TranslationDocumentSegment>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TranslationSourceSegment {
    pub id: String,
    pub ordinal: i64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TranslationValidation {
    pub canonical_target_language: String,
    pub segment_source_ordinals: Vec<Vec<i64>>,
}

pub fn validate_translation_document(
    document: &TranslationDocument,
    expected_video_id: &str,
    expected_track_id: &str,
    expected_revision: &str,
    source_language: &str,
    source_segments: &[TranslationSourceSegment],
) -> Result<TranslationValidation, String> {
    if document.version != 1 {
        return Err("unsupported_document_version: expected version 1".into());
    }
    if document.video_id != expected_video_id {
        return Err("video_mismatch: document does not target the requested video".into());
    }
    if document.source_track_id != expected_track_id {
        return Err(
            "source_track_mismatch: document does not target the current source track".into(),
        );
    }
    if document.source_revision != expected_revision {
        return Err("stale_source_revision: export the source again before translating".into());
    }

    let target_language =
        parse_language(&document.target_language.code, "target_language_invalid")?;
    let source_language = parse_language(source_language, "source_language_invalid")?;
    if target_language.eq_ignore_ascii_case(&source_language) {
        return Err("target_matches_source: choose a different target language".into());
    }
    if document.target_language.display_name.trim().is_empty() {
        return Err("target_display_name_empty: provide a readable language name".into());
    }
    if document.segments.is_empty() {
        return Err("translation_empty: provide at least one translated segment".into());
    }

    let source_by_id: HashMap<&str, i64> = source_segments
        .iter()
        .map(|segment| (segment.id.as_str(), segment.ordinal))
        .collect();
    let expected_sources: HashSet<&str> = source_by_id.keys().copied().collect();
    let mut covered_sources = HashSet::new();
    let mut translation_ids = HashSet::new();
    let mut segment_source_ordinals = Vec::with_capacity(document.segments.len());
    let mut previous_range: Option<(i64, i64)> = None;

    for segment in &document.segments {
        if segment.id.trim().is_empty() || !translation_ids.insert(segment.id.as_str()) {
            return Err("translation_segment_id_invalid: IDs must be non-empty and unique".into());
        }
        if segment.text.trim().is_empty() {
            return Err("translation_segment_text_empty: translated text cannot be empty".into());
        }
        if segment.source_segment_ids.is_empty() {
            return Err("translation_segment_sources_empty: every translated segment needs sourceSegmentIds".into());
        }

        let mut local_sources = HashSet::new();
        let mut ordinals = Vec::with_capacity(segment.source_segment_ids.len());
        for source_id in &segment.source_segment_ids {
            if !local_sources.insert(source_id.as_str()) {
                return Err(
                    "duplicate_source_reference: a translated segment cannot repeat a source ID"
                        .into(),
                );
            }
            let ordinal = source_by_id
                .get(source_id.as_str())
                .copied()
                .ok_or_else(|| format!("unknown_source_segment: {source_id}"))?;
            ordinals.push(ordinal);
            covered_sources.insert(source_id.as_str());
        }
        ordinals.sort_unstable();
        if ordinals.windows(2).any(|pair| pair[1] != pair[0] + 1) {
            return Err("non_contiguous_sources: each translated segment must reference adjacent source lines".into());
        }

        let range = (*ordinals.first().unwrap(), *ordinals.last().unwrap());
        if let Some(previous) = previous_range {
            let is_split_of_same_sources = range == previous;
            let moves_forward = range.0 > previous.1;
            if !is_split_of_same_sources && !moves_forward {
                return Err("source_order_invalid: translated segments cannot reorder or partially overlap source lines".into());
            }
        }
        previous_range = Some(range);
        segment_source_ordinals.push(ordinals);
    }

    if covered_sources != expected_sources {
        return Err("source_coverage_incomplete: every source segment must be represented".into());
    }

    Ok(TranslationValidation {
        canonical_target_language: target_language,
        segment_source_ordinals,
    })
}

fn parse_language(value: &str, error_code: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let parsed = trimmed
        .parse::<LanguageTag>()
        .map_err(|_| format!("{error_code}: expected a BCP-47 language tag"))?;
    Ok(parsed.to_string())
}
