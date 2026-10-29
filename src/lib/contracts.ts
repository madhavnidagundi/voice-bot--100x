import { z } from "zod";
export const messageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();
export const chatSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(17),
    style: z.enum(["brief", "detail", "example"]).default("brief"),
  })
  .strict()
  .refine((v) => v.messages.at(-1)?.role === "user", "End with a question")
  .refine(
    (v) => v.messages.reduce((s, m) => s + m.content.length, 0) <= 18000,
    "Conversation is too long",
  )
  .refine(
    (v) =>
      v.messages.every(
        (m, i) => m.role === (i % 2 === 0 ? "user" : "assistant"),
      ),
    "Invalid conversation order",
  );
export const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
  followUps: z.array(z.string().trim().min(5).max(140)).max(3),
});
export const speakSchema = z
  .object({
    text: z.string().min(1).max(2400),
    token: z.string().min(10).max(256),
    part: z.number().int().min(0).max(5).optional(),
  })
  .strict();
export type ChatMessage = z.infer<typeof messageSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type AnswerStyle = "brief" | "detail" | "example";
export type Turn = ChatMessage & { id: string; token?: string };
export const STARTERS = [
  {
    label: "My story",
    question: "What should we know about your life story in a few sentences?",
    icon: "story",
  },
  {
    label: "My superpower",
    question: "What's your number one superpower?",
    icon: "spark",
  },
  {
    label: "Room to grow",
    question: "What are the top three areas you'd like to grow in?",
    icon: "growth",
  },
  {
    label: "Behind the scenes",
    question: "What misconception do your coworkers have about you?",
    icon: "people",
  },
  {
    label: "Pushing limits",
    question: "How do you push your boundaries and limits?",
    icon: "arrow",
  },
] as const;
