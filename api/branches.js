// /api/branches.js
export default async function handler(req, res) {
  setCors(res);
  try {
    const base = process.env.PHOREST_BASE || "https://eu.phorest.com/third-party-api-server/api";
    const auth = "Basic " + Buffer.from(`${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`).toString("base64");
    const url = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) return res.status(r.status).json({ error: `Phorest error ${r.status}` });
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data._embedded?.branches || data.branches || []);
    res.status(200).json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load branches" });
  }
}
function setCors(res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");}
