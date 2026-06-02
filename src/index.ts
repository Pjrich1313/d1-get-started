export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/landmarks") {
      const sinceDate =
        url.searchParams.get("since") ?? "2024-01-01T00:00:00";

      const { results } = await env.DB.prepare(
        "SELECT id, name, location, description, created_at FROM Landmarks WHERE created_at >= ? ORDER BY created_at ASC"
      )
        .bind(sinceDate)
        .all();

      return Response.json({ landmarks: results });
    }

    return Response.json(
      { error: "Unauthorized - interaction is disabled" },
      { status: 401 }
    );
  },
} satisfies ExportedHandler<Env>;
