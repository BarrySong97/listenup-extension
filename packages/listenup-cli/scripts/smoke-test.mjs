#!/usr/bin/env node
/**
 * @purpose 在正式 Desktop SQLite 的临时备份上验证 npm CLI 完整读写往返。
 * @role    发布前真实数据库 smoke test；证明 dry-run 无写入且 commit 可回读。
 * @deps    sqlite3、node:child_process、node:fs、已生成的 npm/bin/listenup.mjs
 * @gotcha  只写 mkdtemp 创建的数据库副本，输出不包含字幕正文或数据库凭据。
 */
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFlag = process.argv.indexOf("--source-db");
const sourceDatabase = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : undefined;
if (!sourceDatabase) {
  throw new Error("usage: pnpm smoke -- --source-db /absolute/path/to/listenup.sqlite");
}
const cliFlag = process.argv.indexOf("--cli");
const configuredCli = cliFlag >= 0 ? process.argv[cliFlag + 1] : undefined;
readFileSync(sourceDatabase);

const temporaryRoot = mkdtempSync(join(tmpdir(), "listenup-cli-smoke-"));
const database = join(temporaryRoot, "listenup.sqlite");
const documentPath = join(temporaryRoot, "translation.json");
const cli = configuredCli ?? join(packageRoot, "npm/bin/listenup.mjs");

function run(args) {
  const output = execFileSync(cli, [...args, "--db", database, "--json"], {
    encoding: "utf8",
  });
  const parsed = JSON.parse(output);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.error));
  return parsed.data;
}

try {
  execFileSync("sqlite3", [sourceDatabase, `.backup '${database}'`]);
  const info = run(["info"]);
  const videos = run(["video", "list"]);
  if (!Array.isArray(videos) || videos.length === 0) {
    throw new Error("source database has no cached videos for the smoke test");
  }

  const source = run(["subtitle", "get", videos[0].videoId]);
  if (!source.segments.length) throw new Error("selected source track has no segments");
  const existing = run(["translation", "list", source.videoId]);
  const existingCodes = new Set(
    existing.map((translation) => translation.languageCode.toLowerCase())
  );
  const targetCode = ["eo", "la", "is", "sw"].find(
    (code) =>
      code !== source.languageCode.toLowerCase() && !existingCodes.has(code)
  );
  if (!targetCode) throw new Error("could not select an isolated smoke target language");

  const document = {
    version: 1,
    videoId: source.videoId,
    sourceTrackId: source.trackId,
    sourceRevision: source.revision,
    targetLanguage: { code: targetCode, displayName: "CLI smoke test" },
    generator: "listenup-cli-smoke",
    segments: source.segments.map((segment, index) => ({
      id: `smoke-${String(index + 1).padStart(6, "0")}`,
      sourceSegmentIds: [segment.id],
      text: `Smoke translation ${index + 1}`,
    })),
  };
  writeFileSync(documentPath, `${JSON.stringify(document)}\n`, { mode: 0o600 });

  const beforeDryRun = run(["translation", "list", source.videoId]);
  const dryRun = run(["translation", "apply", documentPath, "--dry-run"]);
  const afterDryRun = run(["translation", "list", source.videoId]);
  if (dryRun.committed || JSON.stringify(beforeDryRun) !== JSON.stringify(afterDryRun)) {
    throw new Error("dry-run changed the temporary database");
  }

  const committed = run(["translation", "apply", documentPath, "--commit"]);
  const roundtrip = run([
    "translation",
    "get",
    source.videoId,
    "--language",
    targetCode,
  ]);
  if (
    !committed.committed ||
    roundtrip.sourceRevision !== source.revision ||
    roundtrip.segments.length !== document.segments.length
  ) {
    throw new Error("committed translation did not roundtrip exactly");
  }

  console.log(
    JSON.stringify({
      ok: true,
      databaseSchema: info.schema,
      sourceLanguage: source.languageCode,
      targetLanguage: targetCode,
      sourceRevision: source.revision,
      translatedSegmentCount: roundtrip.segments.length,
      dryRunPreservedDatabase: true,
      committedRoundtrip: true,
    })
  );
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}
