import "server-only";

export function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  console.error("[api]", err);
  return Response.json({ error: message }, { status });
}
