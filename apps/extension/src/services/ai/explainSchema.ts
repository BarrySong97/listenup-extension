/**
 * @purpose Explain 结果的 zod schema 与推导类型（词性、音标、释义、要点）。
 * @role    AI 返回内容的校验契约，UI 只信通过校验的数据。
 * @deps    zod
 * @gotcha  detailExplain 限定 1~4 条；改 schema 要同步 prompt，否则模型输出会一直校验失败
 */
import { z } from "zod";

export const ExplainPhoneticsSchema = z.object({
  us: z.string(),
  uk: z.string(),
});

export const ExplainResultSchema = z.object({
  partOfSpeech: z.string(),
  phonetics: ExplainPhoneticsSchema,
  meaningExplain: z.string(),
  detailExplain: z.array(z.string()).min(1).max(4),
});

export type ExplainPhonetics = z.infer<typeof ExplainPhoneticsSchema>;
export type ExplainResult = z.infer<typeof ExplainResultSchema>;
