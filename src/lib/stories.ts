import { z } from "zod";
export const storySchema = z
  .object({
    id: z.string().min(1).max(80),
    topic: z.enum(["challenge", "failure", "teamwork", "learning"]),
    title: z.string().min(1).max(140),
    situation: z.string().min(10).max(1200),
    action: z.string().min(10).max(1600),
    outcome: z.string().min(10).max(1200),
    lesson: z.string().min(10).max(1000),
    source: z.string().min(5).max(300),
    approved: z.literal(true),
  })
  .strict();
export type PersonalStory = z.infer<typeof storySchema>;
export function approvedStories(input: unknown): PersonalStory[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).flatMap((value) => {
    const result = storySchema.safeParse(value);
    return result.success ? [result.data] : [];
  });
}
