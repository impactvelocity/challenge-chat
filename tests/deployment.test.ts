import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Cloudflare deployment routing configuration", () => {
  it("routes the REST and MCP APIs to the Worker instead of the SPA fallback", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(["/api/*", "/mcp"]));
  });

  it("keeps production resources and live mode separate from local development", () => {
    const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
    expect(config.d1_databases[0].database_id).toBeUndefined();
    expect(config.vars.APP_MODE).toBe("demo");
    expect(config.env.production.vars.APP_MODE).toBe("live");
    expect(config.env.production.d1_databases[0].database_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(config.env.production.durable_objects.bindings[0].class_name).toBe("LiveSessionCoordinator");
  });
});
