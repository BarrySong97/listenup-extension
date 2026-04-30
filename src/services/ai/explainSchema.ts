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
