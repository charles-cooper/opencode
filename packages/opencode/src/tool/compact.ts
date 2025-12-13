import z from "zod"
import { Tool } from "./tool"
import { SessionCompaction } from "../session/compaction"
import { Session } from "../session"

export const CompactTool = Tool.define("compact", {
  description: `Trigger context compaction to free up context window space. Compaction summarizes the conversation, clears history, and continues seamlessly - the user sees no interruption but you get fresh context.

Use this tool when:
1. Phase transition (design to implementation or vice versa)
2. Artifact capture (wrote doc/code that captures discussion)
3. Long conversation with many tool calls AND about to load significant new content
4. Natural breakpoint (completed unit of work, starting something different)
5. Going in circles (repeating attempts, stuck in debug loop)

Do NOT compact when:
1. Mid-decision or mid-implementation
2. Open questions or unresolved ambiguity
3. Short conversation with no phase transition

Principle: Compact when value is crystallized into artifacts and you need context for something different.`,
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
