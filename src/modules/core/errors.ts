export class ApiError extends Error {
  constructor(public code: string, public status: number,
              message: string, public details?: unknown) { super(message); }
}

export const err = (code: string, status: number, message: string, details?: unknown) =>
  new ApiError(code, status, message, details);

export function toResponse(e: unknown): Response {
  const a = e instanceof ApiError ? e : err('internal', 500, 'Internal error');
  if (!(e instanceof ApiError)) console.error(e);
  return Response.json({ error: { code: a.code, message: a.message, details: a.details ?? {} } },
                       { status: a.status });
}
