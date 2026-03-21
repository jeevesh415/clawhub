/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPackageReadme, fetchPackages } from "./packageApi";

describe("fetchPackages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("preserves search filters when using /packages/search", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://registry.example");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

    await fetchPackages({
      q: "demo",
      family: "code-plugin",
      executesCode: true,
      capabilityTag: "tools",
      limit: 12,
      isOfficial: true,
    });

    const requestUrl = fetchMock.mock.calls[0]?.[0];
    if (typeof requestUrl !== "string") {
      throw new Error("Expected fetch to be called with a string URL");
    }
    const url = new URL(requestUrl);
    expect(url.pathname).toBe("/api/v1/packages/search");
    expect(url.searchParams.get("q")).toBe("demo");
    expect(url.searchParams.get("family")).toBe("code-plugin");
    expect(url.searchParams.get("executesCode")).toBe("true");
    expect(url.searchParams.get("capabilityTag")).toBe("tools");
    expect(url.searchParams.get("limit")).toBe("12");
    expect(url.searchParams.get("isOfficial")).toBe("true");
  });

  it("falls back across supported README variants", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://registry.example");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response("lowercase readme", { status: 200 }));

    const result = await fetchPackageReadme("demo-plugin", "1.0.0");

    expect(result).toBe("lowercase readme");
    const firstRequest = fetchMock.mock.calls[0]?.[0];
    const secondRequest = fetchMock.mock.calls[1]?.[0];
    if (typeof firstRequest !== "string" || typeof secondRequest !== "string") {
      throw new Error("Expected fetch calls to use string URLs");
    }
    const first = new URL(firstRequest);
    const second = new URL(secondRequest);
    expect(first.searchParams.get("path")).toBe("README.md");
    expect(second.searchParams.get("path")).toBe("readme.md");
    expect(second.searchParams.get("version")).toBe("1.0.0");
  });
});
