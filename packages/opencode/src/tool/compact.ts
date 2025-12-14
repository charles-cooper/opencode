import z from "zod"
import { Tool } from "./tool"
import { SessionCompaction } from "../session/compaction"
import { Session } from "../session"

export const CompactTool = Tool.define("compact", {
  description: `Trigger context compaction to free up context window space. Compaction summarizes the conversation, clears history, and continues seamlessly - the user sees no interruption but you get fresh context.

BE AGGRESSIVE with compaction - use it early and often. After 3-5 turns, if ANY of the following apply, compact immediately:

Use this tool when:
1. Exploration phase complete (read files, searched code, gathered context) - compact before implementation
2. Implementation done - compact before testing/verification
3. Any tool output over 100 lines that you've already processed
4. Failed attempts or errors you've already learned from
5. Phase transition (design to implementation or vice versa)
6. Going in circles (repeating attempts, stuck in debug loop)
7. Large file contents, search results, or command outputs polluting context

Do NOT compact when:
1. Mid-implementation of a specific change
2. Unresolved error you're actively debugging
3. Under 3 turns in the conversation

Principle: Context is precious. Compact aggressively once information is processed - but ensure the summary captures all details needed to continue (error messages, file paths, code patterns, what worked/didn't work).`,
  parameters: z.object({
    reason: z.string().describe("Why compaction would help at this point"),
  }),
  async execute(params, ctx) {
    const session = await Session.get(ctx.sessionID)
    if (!session) {
      return {
        title: "Compaction failed",
        metadata: { reason: params.reason },
        output: "Session not found",
      }
    }

    // Find the current user message to get model info
    const msgs = await Session.messages({ sessionID: ctx.sessionID })
    const lastUserMsg = msgs.findLast((m) => m.info.role === "user")
    if (!lastUserMsg || lastUserMsg.info.role !== "user") {
      return {
        title: "Compaction failed",
        metadata: { reason: params.reason },
        output: "No user message found",
      }
    }

    await SessionCompaction.create({
      sessionID: ctx.sessionID,
      agent: lastUserMsg.info.agent,
      model: lastUserMsg.info.model,
      trigger: "model",
    })

    return {
      title: "Compaction scheduled",
      metadata: { reason: params.reason },
      output: `Compaction triggered: ${params.reason}. The context will be compacted and the conversation will continue seamlessly.`,
    }
  },
})
