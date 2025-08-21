// /api/staff.js
// Usage: /api/staff?branchId=BRANCH_ID
export default async function handler(req, res) {
  setCors(res);

  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "branchId required" });

  try {
    const base =
      process.env.PHOREST_BASE ||
      "https://eu.phorest.com/third-party-api-server/api";

    const auth =
      "Basic " +
      Buffer.from(
        `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
      ).toString("base64");

    // Some Phorest deployments use /branch/, others /branches/
    const candidates = [
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
    ];

    let lastErr = null;
    for (const url of candidates) {
      const r = await fetch(url, { headers: { Authorization: auth } });

      if (r.ok) {
        const data = await r.json();
        // normalize possible shapes
        const raw =
          (data && (data._embedded?.staff || data._embedded?.staffMembers)) ||
          data.staff ||
          data.staffMembers ||
          data;

        const list = Array.isArray(raw) ? raw : [];
        const mapped = list.map((s) => ({
          id: s.staffId || s.id,
          name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
          role: s.role || s.jobTitle || "",
          active: s.active ?? true,
        }));
        return res.status(200).json(mapped);
      }

      // capture exact error text for debugging
      const text = await r.text().catch(() => "");
      lastErr = { status: r.status, url, body: text };
    }

    return res
      .status(502)
      .json({ error: "Phorest staff fetch failed", details: lastErr });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Server error fetching staff", details: String(err) });
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
