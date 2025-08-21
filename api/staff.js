// /api/staff.js
export default async function handler(req, res) {
  setCors(res);
  const { branchId } = req.query;
  if (!branchId) return res.status(400).json({ error: "branchId required" });
  try {
    const base = process.env.PHOREST_BASE || "https://eu.phorest.com/third-party-api-server/api";
    const auth = "Basic " + Buffer.from(`${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`).toString("base64");
    const url = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) return res.status(r.status).json({ error: `Phorest error ${r.status}` });
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data._embedded?.staff || data.staff || []);
    res.status(200).json(list.map(s => ({ id: s.staffId || s.id, name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim() })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load staff" });
  }
}
function setCors(res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");}
