export type AgentContext = Record<string, unknown>;

export type AgentToolRunParams<TInput> = {
  input: TInput;
  context: AgentContext;
  state: unknown;
};

export type AgentToolResult<TData = unknown> = {
  summary: string;
  data?: TData;
};

export type AgentTool<TInput = unknown, TData = unknown> = {
  name: string;
  description: string;
  run: (params: AgentToolRunParams<TInput>) => Promise<AgentToolResult<TData>>;
};

export type AgentPlanStep<TInput = unknown> = {
  tool: string;
  input: TInput;
  continueOnError?: boolean;
};

export type AgentExecutedStep = {
  id: string;
  tool: string;
  description: string;
  input: unknown;
  output?: string;
  data?: unknown;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export type AgentExecuteOptions<TResult, TInput = unknown> = {
  label: string;
  tools: AgentTool[];
  plan: AgentPlanStep<TInput>[];
  context?: AgentContext;
  initialResult: TResult;
  reducer: (state: TResult, step: AgentExecutedStep) => TResult;
};

export async function executeAgent<TResult, TInput = unknown>(
  options: AgentExecuteOptions<TResult, TInput>,
): Promise<{ result: TResult; steps: AgentExecutedStep[] }> {
  const { label, tools, plan, context = {}, initialResult, reducer } = options;
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  const steps: AgentExecutedStep[] = [];
  let state = initialResult;

  for (const [index, step] of plan.entries()) {
    const tool = toolMap.get(step.tool);
    const stepId = `${label}-${index + 1}`;
    const startedAt = new Date();

    if (!tool) {
      const finishedAt = new Date();
      const executed: AgentExecutedStep = {
        id: stepId,
        tool: step.tool,
        description: `Missing tool ${step.tool}`,
        input: step.input,
        error: `Tool ${step.tool} not registered`,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      };
      steps.push(executed);
      if (!step.continueOnError) {
        break;
      }
      continue;
    }

    try {
      const result = await tool.run({
        input: step.input,
        context,
        state,
      });
      const finishedAt = new Date();
      const executed: AgentExecutedStep = {
        id: stepId,
        tool: tool.name,
        description: tool.description,
        input: step.input,
        output: result.summary,
        data: result.data,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      };
      steps.push(executed);
      state = reducer(state, executed);
    } catch (error) {
      const finishedAt = new Date();
      const executed: AgentExecutedStep = {
        id: stepId,
        tool: tool.name,
        description: tool.description,
        input: step.input,
        error:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unknown agent error",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      };
      steps.push(executed);
      if (!step.continueOnError) {
        break;
      }
    }
  }

  return { result: state, steps };
}
