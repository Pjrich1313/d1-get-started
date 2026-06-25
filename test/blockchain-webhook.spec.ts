// test/blockchain-webhook.spec.ts
import {
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src/blockchain-webhook.js";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const samplePayload = {
  network: "ethereum",
  event: "transaction",
  txHash: "0x1234abcd",
  blockNumber: 12345678,
};

function makeMockEnv(overrides?: Partial<Env>): Env {
  return {
    API_KEY: "test-api-key-12345",
    DB: {
      prepare: () => ({
        bind: () => ({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    },
    ...overrides,
  } as unknown as Env;
}

describe("Blockchain Webhook Worker", () => {
  it("stores webhook data and returns 201 on valid POST", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect((body as { success: boolean }).success).toBe(true);
    expect(typeof (body as { timestamp: string }).timestamp).toBe("string");
  });

  it("returns 401 when API key is missing", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized - invalid or missing API key",
    });
  });

  it("returns 401 when API key is wrong", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "wrong-key",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(401);
  });

  it("returns 405 for GET requests to /webhook", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: "Method not allowed",
    });
  });

  it("returns 400 for invalid JSON body", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: "not valid json {{{",
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("returns 500 when database insert fails", async () => {
    const env = makeMockEnv({
      DB: {
        prepare: () => ({
          bind: () => ({
            run: vi.fn().mockRejectedValue(new Error("DB connection failed")),
          }),
        }),
      } as unknown as D1Database,
    });

    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "test-api-key-12345",
      },
      body: JSON.stringify(samplePayload),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to store webhook data",
    });
  });

  it("returns 404 for unknown paths", async () => {
    const env = makeMockEnv();
    const request = new IncomingRequest("http://example.com/other", {
      method: "GET",
      headers: { "X-API-Key": "test-api-key-12345" },
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});
