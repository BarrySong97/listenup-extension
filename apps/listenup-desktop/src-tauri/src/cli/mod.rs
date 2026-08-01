// @purpose 提供 listenup CLI 的安全命令面，让外部 AI 读取原字幕并校验、提交完整译文。
// @role    独立 CLI binary 与 database/domain 共享层之间的参数解析和输出适配。
// @deps    clap、database、domain、serde_json
// @gotcha  apply/delete 默认 dry-run；只有显式 --commit 才能修改数据库，不提供任意 SQL。

use crate::{database::SubtitleDatabase, domain::TranslationDocument};
use clap::{Args, Parser, Subcommand, ValueEnum};
use serde::Serialize;
use serde_json::{json, Value};
use std::{io::Read, path::PathBuf};

#[derive(Clone, Copy, Debug, Serialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
enum Environment {
    Prod,
    Dev,
}

#[derive(Debug, Parser)]
#[command(
    name = "listenup",
    version,
    about = "Read and manage ListenUp Desktop subtitles"
)]
struct Cli {
    #[arg(long, global = true, value_name = "PATH")]
    db: Option<PathBuf>,
    #[arg(long, global = true, value_enum, default_value_t = Environment::Prod)]
    env: Environment,
    #[arg(long, global = true)]
    json: bool,
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Info,
    Video(VideoArgs),
    Subtitle(SubtitleArgs),
    Translation(TranslationArgs),
}

#[derive(Debug, Args)]
struct VideoArgs {
    #[command(subcommand)]
    command: VideoCommand,
}

#[derive(Debug, Subcommand)]
enum VideoCommand {
    List,
}

#[derive(Debug, Args)]
struct SubtitleArgs {
    #[command(subcommand)]
    command: SubtitleCommand,
}

#[derive(Debug, Subcommand)]
enum SubtitleCommand {
    Get { video_id: String },
}

#[derive(Debug, Args)]
struct TranslationArgs {
    #[command(subcommand)]
    command: TranslationCommand,
}

#[derive(Debug, Subcommand)]
enum TranslationCommand {
    List {
        video_id: String,
    },
    Get {
        video_id: String,
        #[arg(long)]
        language: String,
    },
    Apply {
        #[arg(value_name = "FILE")]
        file: String,
        #[arg(long)]
        commit: bool,
        #[arg(long, conflicts_with = "commit")]
        dry_run: bool,
    },
    Delete {
        video_id: String,
        #[arg(long)]
        language: String,
        #[arg(long)]
        commit: bool,
        #[arg(long, conflicts_with = "commit")]
        dry_run: bool,
    },
}

pub async fn run() -> i32 {
    let cli = match Cli::try_parse() {
        Ok(cli) => cli,
        Err(error) => {
            let _ = error.print();
            return error.exit_code();
        }
    };
    match execute(&cli).await {
        Ok(data) => {
            print_success(data, cli.json);
            0
        }
        Err(message) => {
            print_error(&message, cli.json);
            1
        }
    }
}

async fn execute(cli: &Cli) -> Result<Value, String> {
    let path = resolve_database_path(cli.db.as_ref(), cli.env)?;
    let database = SubtitleDatabase::connect(&path)
        .await
        .map_err(|error| format!("database_open_failed: {error}"))?;
    match &cli.command {
        Command::Info => Ok(json!({
            "databasePath": database.path(),
            "environment": cli.env,
            "schema": "subtitle-library-v1",
        })),
        Command::Video(args) => match args.command {
            VideoCommand::List => serde_json::to_value(database.list_videos().await?)
                .map_err(|error| format!("serialization_failed: {error}")),
        },
        Command::Subtitle(args) => match &args.command {
            SubtitleCommand::Get { video_id } => database
                .get_source(Some(video_id))
                .await?
                .map(|source| serde_json::to_value(source).map_err(|error| error.to_string()))
                .transpose()?
                .ok_or_else(|| format!("video_not_found: {video_id}")),
        },
        Command::Translation(args) => match &args.command {
            TranslationCommand::List { video_id } => {
                serde_json::to_value(database.list_translations(video_id).await?)
                    .map_err(|error| format!("serialization_failed: {error}"))
            }
            TranslationCommand::Get { video_id, language } => database
                .export_translation(video_id, language)
                .await?
                .map(|document| serde_json::to_value(document).map_err(|error| error.to_string()))
                .transpose()?
                .ok_or_else(|| format!("translation_not_found: {language}")),
            TranslationCommand::Apply { file, commit, .. } => {
                let document = read_translation_document(file)?;
                serde_json::to_value(database.apply_translation(&document, *commit).await?)
                    .map_err(|error| format!("serialization_failed: {error}"))
            }
            TranslationCommand::Delete {
                video_id,
                language,
                commit,
                ..
            } => {
                let found = database
                    .delete_translation(video_id, language, *commit)
                    .await?;
                Ok(json!({
                    "committed": commit,
                    "found": found,
                    "videoId": video_id,
                    "targetLanguageCode": language,
                }))
            }
        },
    }
}

fn resolve_database_path(
    explicit_path: Option<&PathBuf>,
    environment: Environment,
) -> Result<PathBuf, String> {
    if let Some(path) = explicit_path {
        return Ok(path.clone());
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "home_not_found: HOME is not set; pass --db explicitly".to_string())?;
    let identifier = match environment {
        Environment::Prod => "com.listenup.desktop",
        Environment::Dev => "com.listenup.desktop.dev",
    };
    Ok(home
        .join("Library/Application Support")
        .join(identifier)
        .join("listenup.sqlite"))
}

fn read_translation_document(path: &str) -> Result<TranslationDocument, String> {
    let contents = if path == "-" {
        let mut contents = String::new();
        std::io::stdin()
            .read_to_string(&mut contents)
            .map_err(|error| format!("translation_file_read_failed: {error}"))?;
        contents
    } else {
        std::fs::read_to_string(path)
            .map_err(|error| format!("translation_file_read_failed: {error}"))?
    };
    serde_json::from_str(&contents).map_err(|error| format!("translation_json_invalid: {error}"))
}

fn print_success(data: Value, compact: bool) {
    let output = json!({ "ok": true, "data": data, "warnings": [] });
    if compact {
        println!("{}", serde_json::to_string(&output).unwrap());
    } else {
        println!("{}", serde_json::to_string_pretty(&output).unwrap());
    }
}

fn print_error(message: &str, compact: bool) {
    let code = message.split(':').next().unwrap_or("unknown_error");
    let output = json!({
        "ok": false,
        "error": { "code": code, "message": message },
    });
    let serialized = if compact {
        serde_json::to_string(&output)
    } else {
        serde_json::to_string_pretty(&output)
    }
    .unwrap();
    eprintln!("{serialized}");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        database::{SourceSnapshot, SourceSnapshotSegment},
        domain::{TranslationDocumentSegment, TranslationLanguage},
    };

    #[test]
    fn explicit_database_path_overrides_environment() {
        let path = PathBuf::from("/tmp/listenup-cli-test.sqlite");
        assert_eq!(
            resolve_database_path(Some(&path), Environment::Dev).unwrap(),
            path
        );
    }

    #[test]
    fn write_commands_are_dry_run_without_commit() {
        let cli = Cli::try_parse_from([
            "listenup",
            "translation",
            "apply",
            "translation.json",
            "--json",
        ])
        .unwrap();
        let Command::Translation(TranslationArgs {
            command: TranslationCommand::Apply { commit, .. },
        }) = cli.command
        else {
            panic!("unexpected command");
        };
        assert!(!commit);
        assert!(cli.json);
    }

    #[tokio::test]
    async fn cli_roundtrip_uses_dry_run_and_explicit_commit() {
        let unique = format!(
            "listenup-cli-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let database_path = std::env::temp_dir().join(format!("{unique}.sqlite"));
        let document_path = std::env::temp_dir().join(format!("{unique}.json"));
        let database = SubtitleDatabase::connect(&database_path).await.unwrap();
        let source = database
            .store_source(SourceSnapshot {
                video_id: "cli-video".into(),
                title: "CLI video".into(),
                language_code: "en".into(),
                display_name: "English".into(),
                kind: "manual".into(),
                vss_id: ".en".into(),
                is_default: true,
                segments: vec![SourceSnapshotSegment {
                    source_id: "source-0".into(),
                    start_time_ms: 0,
                    end_time_ms: 1_000,
                    text: "Good morning".into(),
                }],
            })
            .await
            .unwrap();
        let document = TranslationDocument {
            version: 1,
            video_id: source.video_id.clone(),
            source_track_id: source.track_id.clone(),
            source_revision: source.revision.clone(),
            target_language: TranslationLanguage {
                code: "zh-CN".into(),
                display_name: "简体中文".into(),
            },
            generator: Some("cli-test".into()),
            segments: vec![TranslationDocumentSegment {
                id: "translated-0".into(),
                source_segment_ids: vec![source.segments[0].id.clone()],
                text: "早上好".into(),
            }],
        };
        std::fs::write(&document_path, serde_json::to_vec(&document).unwrap()).unwrap();
        let database_arg = database_path.to_string_lossy().into_owned();
        let document_arg = document_path.to_string_lossy().into_owned();

        let dry_run = Cli::try_parse_from([
            "listenup",
            "--db",
            &database_arg,
            "translation",
            "apply",
            &document_arg,
        ])
        .unwrap();
        assert_eq!(execute(&dry_run).await.unwrap()["committed"], false);
        assert!(database
            .list_translations("cli-video")
            .await
            .unwrap()
            .is_empty());

        let commit = Cli::try_parse_from([
            "listenup",
            "--db",
            &database_arg,
            "translation",
            "apply",
            &document_arg,
            "--commit",
        ])
        .unwrap();
        assert_eq!(execute(&commit).await.unwrap()["committed"], true);

        let mut invalid_document = document.clone();
        invalid_document.segments[0].text.clear();
        std::fs::write(
            &document_path,
            serde_json::to_vec(&invalid_document).unwrap(),
        )
        .unwrap();
        assert!(execute(&commit)
            .await
            .unwrap_err()
            .starts_with("translation_segment_text_empty"));
        std::fs::write(&document_path, serde_json::to_vec(&document).unwrap()).unwrap();

        let get = Cli::try_parse_from([
            "listenup",
            "--db",
            &database_arg,
            "translation",
            "get",
            "cli-video",
            "--language",
            "zh-CN",
        ])
        .unwrap();
        assert_eq!(
            execute(&get).await.unwrap()["segments"][0]["text"],
            "早上好"
        );

        let delete_dry_run = Cli::try_parse_from([
            "listenup",
            "--db",
            &database_arg,
            "translation",
            "delete",
            "cli-video",
            "--language",
            "zh-CN",
        ])
        .unwrap();
        assert_eq!(execute(&delete_dry_run).await.unwrap()["committed"], false);
        assert_eq!(
            database.list_translations("cli-video").await.unwrap().len(),
            1
        );

        let delete_commit = Cli::try_parse_from([
            "listenup",
            "--db",
            &database_arg,
            "translation",
            "delete",
            "cli-video",
            "--language",
            "zh-CN",
            "--commit",
        ])
        .unwrap();
        assert_eq!(execute(&delete_commit).await.unwrap()["committed"], true);
        assert!(database
            .list_translations("cli-video")
            .await
            .unwrap()
            .is_empty());

        database
            .store_source(SourceSnapshot {
                video_id: "cli-video".into(),
                title: "CLI video updated".into(),
                language_code: "en".into(),
                display_name: "English".into(),
                kind: "manual".into(),
                vss_id: ".en".into(),
                is_default: true,
                segments: vec![SourceSnapshotSegment {
                    source_id: "source-0".into(),
                    start_time_ms: 0,
                    end_time_ms: 1_000,
                    text: "Good evening".into(),
                }],
            })
            .await
            .unwrap();
        assert!(execute(&commit)
            .await
            .unwrap_err()
            .starts_with("stale_source_revision"));

        drop(database);
        let _ = std::fs::remove_file(document_path);
        let _ = std::fs::remove_file(database_path);
    }
}
