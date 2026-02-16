// test/index.spec.ts
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("D1 Beverages Worker", () => {
  beforeAll(async () => {
    // Initialize the database with test data
    // Use batch for better performance with multiple inserts
    await env.DB.exec(`DROP TABLE IF EXISTS Customers`);
    await env.DB.exec(
      `CREATE TABLE IF NOT EXISTS Customers (CustomerId INTEGER PRIMARY KEY, CompanyName TEXT, ContactName TEXT)`
    );

    // Use batch() for efficient multiple inserts
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(1, "Alfreds Futterkiste", "Maria Anders"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(4, "Around the Horn", "Thomas Hardy"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(11, "Bs Beverages", "Victoria Ashworth"),
      env.DB.prepare(
        `INSERT INTO Customers (CustomerID, CompanyName, ContactName) VALUES (?, ?, ?)`
      ).bind(13, "Bs Beverages", "Random Name"),
    ]);

    await env.DB.batch([
      env.DB.prepare(`DROP TABLE IF EXISTS BlockchainWebhooks`),
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS BlockchainWebhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
      ),
    ]);
  });

  it("responds with default message for root path (unit style)", async () => {
    const request = new IncomingRequest("http://example.com");
    // Create an empty context to pass to `worker.fetch()`.
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("responds with default message for root path (integration style)", async () => {
    const response = await SELF.fetch("https://example.com");
    expect(await response.text()).toMatchInlineSnapshot(
      `"Call /api/beverages to see everyone who works at Bs Beverages"`
    );
  });

  it("returns beverages data from database (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/api/beverages");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]).toHaveProperty("CompanyName", "Bs Beverages");
    expect(data[0]).toHaveProperty("ContactName");
    expect(data[0]).toHaveProperty("CustomerId");
  });

  it("returns beverages data from database (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/api/beverages");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });

  it("handles blockchain webhook posts through the main worker", async () => {
    const request = new IncomingRequest("http://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "test", value: 42 }),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("pamela");
    expect(body).toHaveProperty("webhookId");

    const { results } = await env.DB.prepare(
      "SELECT data FROM BlockchainWebhooks WHERE id = ?"
    )
      .bind(body.webhookId)
      .all();

    expect(results.length).toBe(1);
    expect(JSON.parse(results[0].data)).toMatchObject({ event: "test", value: 42 });
  });

  it("rejects non-POST webhook requests through the main worker", async () => {
    const response = await SELF.fetch("https://example.com/webhook");
    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data.error).toContain("Method not allowed");
  });
});
