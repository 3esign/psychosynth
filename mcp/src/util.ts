// Read a fetch Response body as JSON, falling back to text, then null.
// Used for both free API calls and paid (x402) responses, which may return
// JSON on success and JSON or text on error/402.
export async function readBodySafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}
