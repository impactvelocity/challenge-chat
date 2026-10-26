import { useEffect } from "react";
import { api } from "../api";
import { BOARD_TOOLS, type BoardToolName } from "../../shared/board-tools";

interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    consequentialHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: Record<string, unknown>, context?: { signal?: AbortSignal }): Promise<string>;
}

export interface ModelContextLike {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void> | void;
}

export async function registerBoardWebMcp(
  modelContext: ModelContextLike,
  execute: (name: BoardToolName, input: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
): Promise<void> {
  await Promise.all(BOARD_TOOLS.map(async (tool) => {
    await modelContext.registerTool({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: {
        readOnlyHint: tool.readOnly,
        consequentialHint: "consequential" in tool && Boolean(tool.consequential),
        untrustedContentHint: "untrustedOutput" in tool && Boolean(tool.untrustedOutput),
      },
      execute: async (input, context) => JSON.stringify(await execute(tool.name, input ?? {}, context?.signal)),
    }, { signal });
  }));
}

/** Registers same-origin, owner-authenticated tools without putting an API token in the browser bundle. */
export function BoardWebMcp({ enabled, channelId }: { enabled: boolean; channelId: string }) {
  useEffect(() => {
    if (!enabled) return;
    const currentDocument = document as Document & { modelContext?: ModelContextLike };
    const currentNavigator = navigator as Navigator & { modelContext?: ModelContextLike };
    const modelContext = currentDocument.modelContext ?? currentNavigator.modelContext;
    if (!modelContext) return;
    const controller = new AbortController();
    void registerBoardWebMcp(modelContext, (name, input, signal) => api.boardTool(name, input, signal), controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted) console.warn("Could not register Challenge.chat WebMCP tools", error);
      });
    return () => controller.abort();
  }, [enabled, channelId]);
  return null;
}
