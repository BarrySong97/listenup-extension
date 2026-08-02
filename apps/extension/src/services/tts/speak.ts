/**
 * @purpose 用浏览器内置 speechSynthesis 朗读文本，支持美音/英音。
 * @role    Explain 卡片音标胶囊的点击行为。
 * @deps    Web Speech API
 * @gotcha  依赖系统已安装的 voices，缺对应语音时会退化成默认音；每次朗读前先 cancel
 */
export type Accent = "us" | "uk";

const LANG_CODE: Record<Accent, string> = {
  us: "en-US",
  uk: "en-GB",
};

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === "undefined") return undefined;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()))
  );
}

export function speak(text: string, accent: Accent): void {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_CODE[accent];
  utter.rate = 0.95;
  const voice = pickVoice(utter.lang);
  if (voice) utter.voice = voice;
  speechSynthesis.speak(utter);
}

export function cancelSpeak(): void {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
}
