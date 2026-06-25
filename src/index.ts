export default {
  async fetch(request, env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);

    // API key authentication for protected endpoints
    if (pathname.startsWith("/api/")) {
      const apiKey = request.headers.get("X-API-Key");

      if (!apiKey || apiKey !== env.API_KEY) {
        return Response.json(
          { error: "Unauthorized - invalid or missing API key" },
          { status: 401 }
        );
      }
    }

    if (pathname === "/api/webhook") {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let data;
      try {
        data = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

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

    if (pathname === "/api/landmarks") {
      const since = searchParams.get("since") ?? "2024-01-01T00:00:00";
      try {
        const { results } = await env.DB.prepare(
          "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ?"
        )
          .bind(since)
          .all();

        return Response.json(
          { landmarks: results },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      } catch (error) {
        console.error("Database query failed:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
