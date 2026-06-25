/**
 * Blockchain Webhook Handler
 * Cloudflare Worker for handling blockchain webhook POST requests
 * Compatible with Wrangler 4.62.0 and Node.js 20+
 *
 * This webhook handler receives blockchain event notifications from services like:
 * - Alchemy (Ethereum, Polygon, etc.)
 * - Infura (Ethereum infrastructure)
 * - Moralis (Web3 platform)
 * - QuickNode (Multi-chain nodes)
 *
 * Common use cases:
 * - Track Ethereum (ETH) transactions
 * - Monitor smart contract events
 * - Process on-chain activity in real-time
 * - Store blockchain data for analytics
 *
 * For more information about "Open ETH" and Ethereum integration,
 * see BLOCKCHAIN_GUIDE.md in the project root.
 */

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/webhook") {
      // Require API key authentication
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }

      // Only accept POST requests
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      // Parse and validate the JSON body
      let data;
      try {
        data = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      // Store the webhook payload in D1
      const timestamp = new Date().toISOString();
      try {
        await env.DB.prepare(
          "INSERT INTO BlockchainWebhooks (data, timestamp) VALUES (?, ?)"
        )
          .bind(JSON.stringify(data), timestamp)
          .run();
      } catch (error) {
        console.error("Database insert failed:", error);
        return Response.json(
          { error: "Failed to store webhook data" },
          { status: 500 }
        );
      }

      return Response.json({ success: true, timestamp }, { status: 201 });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
