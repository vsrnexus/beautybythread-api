// /api/schedule.js
export default async function handler(req, res) {
  setCors(res);
  const { branchId, staffId, from, to } = req.query;
  if (!branchId || !staffId || !from || !to) return res.status(400).json({ error: "branchId, staffId, from, to required" });
  try {
    const base = process.env.PHOREST_BASE || "https://eu.phorest.com/third-party-api-server/api";
    const auth = "Basic " + Buffer.from(`${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`).toString("base64");
    const url = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff/${staffId}/rosters?startDate=${from}&endDate=${to}`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (!r.ok) return res.status(r.status).json({ error: `Phorest error ${r.status}` });
    const raw = await r.json();
    const rosters = Array.isArray(raw) ? raw : (raw._embedded?.rosters || raw.rosters || []);
    const rows = rosters.map(item => {
      const start = item.startTime || item.start || "";
      const end   = item.endTime   || item.end   || "";
      const dt    = item.startDate || item.date  || item.day  || "";
      const working = (item.working !== undefined) ? item.working : !!(start && end);
      const dateLabel = dt ? new Date(dt).toLocaleDateString(undefined, { weekday:"short", day:"2-digit", month:"short" }) : "";
      return { dateLabel, status: working ? "WORKING" : "NON_WORKING", timeIn: start || "-- -- --", timeOut: end || "-- -- --", remarks: item.holiday ? "HOLIDAY" : (item.notes || item.remark || "") };
    });
    res.status(200).json({ rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load schedule" });
  }
}
function setCors(res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");}
