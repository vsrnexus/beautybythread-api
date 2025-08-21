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

    const urls = [
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staffMembers`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`, // fallback (filter client-side)
    ];

    let last = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: auth, Accept: "application/json" },
        });
        if (r.ok) {
          const data = await r.json();
          const raw =
            data._embedded?.staff ||
            data._embedded?.staffMembers ||
            data.staff ||
            data.staffMembers ||
            (Array.isArray(data) ? data : []);

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
        const body = await r.text().catch(() => "");
        last = { phase: "http", status: r.status, url, body };
      } catch (e) {
        last = {
          phase: "network",
          url,
          message: String(e?.message || e),
          code: e?.cause?.code || e?.code,
        };
      }
    }

    return res.status(502).json({ error: "staff_failed", details: last });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "staff_exception", details: String(e) });
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
