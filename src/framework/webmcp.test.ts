import { describe, expect, it, vi } from "vitest";
import { BOARD_TOOLS } from "../../shared/board-tools";
import { registerBoardWebMcp, type ModelContextLike } from "./webmcp";

describe("board WebMCP bridge", () => {
  it("registers the shared catalog with safety annotations and authenticated executors", async () => {
    const registered: any[] = [];
    const modelContext: ModelContextLike = {
      registerTool(tool, options) {
        registered.push({ tool, options });
      },
    };
    const execute = vi.fn(async (name: string, input: Record<string, unknown>) => ({ name, input, ok: true }));
    const controller = new AbortController();

    await registerBoardWebMcp(modelContext, execute, controller.signal);

    expect(registered).toHaveLength(BOARD_TOOLS.length);
    expect(registered.map(({ tool }) => tool.name)).toEqual(BOARD_TOOLS.map((tool) => tool.name));
    expect(registered.find(({ tool }) => tool.name === "get_board").tool.annotations).toMatchObject({
      readOnlyHint: true,
      consequentialHint: false,
      untrustedContentHint: true,
    });
    expect(registered.find(({ tool }) => tool.name === "cancel_round").tool.annotations).toMatchObject({
      readOnlyHint: false,
      consequentialHint: true,
    });

    const output = await registered.find(({ tool }) => tool.name === "set_submissions").tool.execute({ open: true });
    expect(JSON.parse(output)).toEqual({ name: "set_submissions", input: { open: true }, ok: true });
    expect(execute).toHaveBeenCalledWith("set_submissions", { open: true }, undefined);
    expect(registered.every(({ options }) => options.signal === controller.signal)).toBe(true);
  });
});
