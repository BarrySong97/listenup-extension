/**
 * @purpose 锁定 YouTube 原始音轨语言解析，防止把当前配音或音轨数组首项误当原语。
 * @role    originalAudioLanguage 的 Node 内建测试。
 * @deps    node:test、node:assert、originalAudioLanguage
 * @gotcha  多配音响应必须只采用 audioIsDefault=true，音轨 id 的数字后缀不是 BCP 47 一部分。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  getAudioTrackLanguageCode,
  getOriginalAudioLanguageCode,
  matchesLanguageCode,
} from "./originalAudioLanguage.ts";

test("extracts the original language instead of the first dubbed audio track", () => {
  const languageCode = getOriginalAudioLanguageCode({
    adaptiveFormats: [
      {
        audioTrack: {
          id: "pt-BR.10",
          audioIsDefault: false,
        },
      },
      {
        audioTrack: {
          id: "en-US.4",
          audioIsDefault: true,
        },
      },
    ],
  });

  assert.equal(languageCode, "en-US");
});

test("prefers an explicit audio language code when YouTube provides one", () => {
  assert.equal(
    getAudioTrackLanguageCode({
      id: "opaque.4",
      languageCode: "ja-JP",
      audioIsDefault: true,
    }),
    "ja-JP"
  );
});

test("returns null for an unparseable audio track id", () => {
  assert.equal(
    getAudioTrackLanguageCode({
      id: "251;opaque-audio-track",
      audioIsDefault: true,
    }),
    null
  );
});

test("matches regional caption and audio language variants case-insensitively", () => {
  assert.equal(matchesLanguageCode("en", "en-US", true), true);
  assert.equal(matchesLanguageCode("PT-br", "pt-BR", true), true);
  assert.equal(matchesLanguageCode("en", "en-US", false), false);
});
