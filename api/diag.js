// Minimal no-crash function to confirm routes execute.
export const config = { runtime: "nodejs18.x" };

export default async function handler(req, res) {
  try {
    res.status(200).json({ ok: true, route: "diag", ts: Date.now() });
  } catch (e) {
    // even this won't throw; always return JSON
    res.status(200).json({ ok: false, error: String(e) });
  }
}
