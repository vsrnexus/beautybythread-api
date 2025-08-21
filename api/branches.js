// /api/branches.js
export default async function handler(req, res) {
  setCors(res);
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
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch`,
    ];

    let last = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: auth, Accept: "application/json" },
        });
        if (r.ok) {
          const data = await r.json();
          const list = Array.isArray(data)
            ? data
            : data._embedded?.branches || data.branches || data._embedded?.branch || [];
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
    return res.status(502).json({ error: "branches_failed", details: last });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "branches_exception", details: String(e) });
  }
}
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
