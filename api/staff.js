// /api/staff.js
// Usage: /api/staff?branchId=14069
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

    // Phorest variations we’ve seen in the wild:
    const urls = [
      // 1) most common
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
      // 2) plural “branches”
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
      // 3) alternative collection name
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staffMembers`,
      // 4) search endpoint (falls back to all staff and we filter by branch)
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`,
    ];

    let lastErr = null;
    for (const url of urls) {
      const r = await fetch(url, {
        headers: {
          Authorization: auth,
          Accept: "application/json",
        },
      });

      if (r.ok) {
        const data = await r.json();

        // normalize shapes
        const raw =
          data._embedded?.staff ||
          data._embedded?.staffMembers ||
          data.staff ||
          data.staffMembers ||
          (Array.isArray(data) ? data : []);

        // If we fetched all staff (case #4), filter by branchId when available.
        const filtered = raw.filter((s) => {
          const bId =
            s.branchId || s.branch?.id || s.branch?.branchId || s.branch;
          return !bId || String(bId) === String(branchId);
        });

        const list = (filtered.length ? filtered : raw).map((s) => ({
          id: s.staffId || s.id,
          name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
          role: s.role || s.jobTitle || "",
          active: s.active ?? true,
        }));

        return res.status(200).json(list);
      }

      // keep exact error text so we can see what Phorest says
      const text = await r.text().catch(() => "");
      lastErr = { status: r.status, attemptedUrl: url, body: text };
    }

    return res
      .status(502)
      .json({ error: "Phorest staff fetch failed", details: lastErr });
  } catch (err) {
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
