/**
 * @module @carpentry/ai
 * @description AI Agent — ReAct (Reason+Act) loop with tool calling, memory, and step limits
 * @patterns Strategy (tool selection), Chain of Responsibility (step pipeline), Observer (step events)
 * @principles SRP (orchestration only), OCP (add tools without modifying agent)
 */

import type { AICompletionOptions, AIMessage, IAIProvider } from "./providers.js";

// ── Tool Definition ───────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  parameters?: Record<string, { type: string; description?: string; required?: boolean }>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ── Agent Step ────────────────────────────────────────────

export type StepType = "thought" | "action" | "observation" | "final_answer";

export interface AgentStep {
  type: StepType;
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  timestamp: number;
}

// ── Agent Config ──────────────────────────────────────────

export interface AgentConfig {
  /** AI provider for reasoning */
  provider: IAIProvider;
  /** Available tools */
  tools: AgentTool[];
  /** System prompt (default: built-in ReAct prompt) */
  systemPrompt?: string;
  /** Maximum reasoning steps before forced stop (default: 10) */
  maxSteps?: number;
  /** AI completion options */
  completionOptions?: AICompletionOptions;
  /** Step callback (for streaming/logging) */
  onStep?: (step: AgentStep) => void;
}

// ── Default System Prompt ─────────────────────────────────

function buildSystemPrompt(tools: AgentTool[]): string {
  const toolDescs = tools
    .map((t) => {
      const params = t.parameters
        ? Object.entries(t.parameters)
            .map(([k, v]) => `    - ${k} (${v.type}): ${v.description ?? ""}`)
            .join("\n")
        : "    (no parameters)";
      return `  ${t.name}: ${t.description}\n${params}`;
    })
    .join("\n\n");

  return `You are a helpful AI agent that can use tools to answer questions.

Available tools:
${toolDescs}

To use a tool, respond with exactly this format:
THOUGHT: <your reasoning>
ACTION: <tool_name>
ARGS: <JSON object of arguments>

After receiving an observation, continue reasoning or provide a final answer:
FINAL_ANSWER: <your answer to the user>

Always think step by step. Use tools when needed. Provide a FINAL_ANSWER when done.`;
}

// ── Response Parser ───────────────────────────────────────

function parseAgentResponse(text: string): {
  thought?: string;
  action?: string;
  args?: Record<string, unknown>;
  finalAnswer?: string;
} {
  const result: {
    thought?: string;
    action?: string;
    args?: Record<string, unknown>;
    finalAnswer?: string;
  } = {};

  const thoughtMatch = text.match(/THOUGHT:\s*(.+?)(?=ACTION:|FINAL_ANSWER:|$)/s);
  /**
   * @param {unknown} thoughtMatch
   */
  if (thoughtMatch) result.thought = thoughtMatch[1].trim();

  const actionMatch = text.match(/ACTION:\s*(\S+)/);
  /**
   * @param {unknown} actionMatch
   */
  if (actionMatch) result.action = actionMatch[1].trim();

  const argsMatch = text.match(/ARGS:\s*(\{[^}]*\})/);
  /**
   * @param {unknown} argsMatch
   */
  if (argsMatch) {
    try {
      result.args = JSON.parse(argsMatch[1]);
    } catch {
      result.args = {};
    }
  }

  const finalMatch = text.match(/FINAL_ANSWER:\s*(.+)$/s);
  /**
   * @param {unknown} finalMatch
   */
  if (finalMatch) result.finalAnswer = finalMatch[1].trim();

  return result;
}

// ── Agent ─────────────────────────────────────────────────

/**
 * AI Agent with ReAct (Reason + Act) loop.
 *
 * @example
 * ```ts
 * const agent = new Agent({
 *   provider: new AnthropicProvider({ apiKey }),
 *   tools: [
 *     { name: 'search', description: 'Search the web', execute: async (args) => '...' },
 *     { name: 'calculator', description: 'Do math', execute: async (args) => String(eval(args.expr)) },
 *   ],
 * });
 *
 * const result = await agent.run('What is the population of France times 2?');
 * console.log(result.answer); // "The population of France is ~67M, so 67M * 2 = 134M"
 * console.log(result.steps);  // [thought, action, observation, thought, final_answer]
 * ```
 */
export class Agent {
  private readonly config: AgentConfig;
  private readonly toolMap: Map<string, AgentTool>;
  private readonly maxSteps: number;

  constructor(config: AgentConfig) {
    this.config = config;
    this.maxSteps = config.maxSteps ?? 10;
    this.toolMap = new Map(config.tools.map((t) => [t.name, t]));
  }

  /**
   * Run the agent on a user query. Returns the final answer and all reasoning steps.
   */
  async run(query: string): Promise<AgentResult> {
    const steps: AgentStep[] = [];
    const systemPrompt = this.config.systemPrompt ?? buildSystemPrompt(this.config.tools);
    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: query },
    ];

    for (let i = 0; i < this.maxSteps; i++) {
      const response = await this.config.provider.complete(messages, this.config.completionOptions);
      const parsed = parseAgentResponse(response.content);

      if (parsed.thought)
        this.recordStep(steps, { type: "thought", content: parsed.thought, timestamp: Date.now() });

      if (parsed.finalAnswer) {
        this.recordStep(steps, {
          type: "final_answer",
          content: parsed.finalAnswer,
          timestamp: Date.now(),
        });
        return { answer: parsed.finalAnswer, steps, tokenUsage: response.usage };
      }

      if (parsed.action) {
        await this.handleToolAction(
          steps,
          messages,
          response.content,
          parsed.action,
          parsed.args ?? {},
        );
        continue;
      }

      // No action or final answer — treat raw response as final
      return { answer: response.content, steps, tokenUsage: response.usage };
    }

    return {
      answer: "Agent reached maximum step limit without a final answer.",
      steps,
      maxStepsReached: true,
    };
  }

  /** Record a step and fire the onStep callback */
  private recordStep(steps: AgentStep[], step: AgentStep): void {
    steps.push(step);
    this.config.onStep?.(step);
  }

  /** Execute a tool action: record the action step, run the tool, record the observation */
  private async handleToolAction(
    steps: AgentStep[],
    messages: AIMessage[],
    rawResponse: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    this.recordStep(steps, {
      type: "action",
      content: `${toolName}(${JSON.stringify(args)})`,
      toolName,
      toolArgs: args,
      timestamp: Date.now(),
    });
    const observation = await this.executeTool(toolName, args);
    this.recordStep(steps, { type: "observation", content: observation, timestamp: Date.now() });
    messages.push({ role: "assistant", content: rawResponse });
    messages.push({ role: "user", content: `OBSERVATION: ${observation}` });
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.toolMap.get(name);
    if (!tool)
      return `Error: Tool "${name}" not found. Available: ${[...this.toolMap.keys()].join(", ")}`;
    try {
      return await tool.execute(args);
    } catch (error) {
      return `Error executing ${name}: ${(error as Error).message}`;
    }
  }

  /** Get registered tool names */
  getToolNames(): string[] {
    return [...this.toolMap.keys()];
  }
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  tokenUsage?: { inputTokens: number; outputTokens: number };
  maxStepsReached?: boolean;
}
