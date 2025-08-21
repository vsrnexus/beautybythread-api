// /api/staff.js (diagnostic-safe)
// Examples:
//   /api/staff?branchId=3Fm4UFyHCqo7WM6GTTG_QA
//   /api/staff?accountId=14069
//   /api/staff?accountId=14069&includeInactive=1
export default async function handler(req, res) {
  setCors(res);

  const { branchId: qBranchId, accountId, includeInactive } = req.query;

  const base =
    process.env.PHOREST_BASE ||
    "https://api-gateway-eu.phorest.com/third-party-api-server/api";

  const auth =
    "Basic " +
    Buffer.from(
      `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
    ).toString("base64");

  // tiny helper that never throws
  async function getJson(url) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: auth, Accept: "application/json" },
      });
      const text = await r.text(); // read once
      if (!r.ok) {
        return { ok: false, status: r.status, url, body: text };
      }
      try {
        return { ok: true, status: r.status, url, data: JSON.parse(text) };
      } catch (e) {
        return { ok: false, status: r.status, url, body: text, note: "JSON parse failed" };
      }
    } catch (e) {
      return { ok: false, status: 0, url, err: String(e) };
    }
  }

  // 1) Resolve branchId (if they gave only accountId)
  let branchId = qBranchId || null;
  if (!branchId && accountId) {
    const branchesUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch`;
    const br = await getJson(branchesUrl);
    if (!br.ok) {
      return res.status(502).json({
        ok: false,
        step: "fetch-branches",
        details: br,
      });
    }
    const list =
      br.data?._embedded?.branches ||
      br.data?.branches ||
      (Array.isArray(br.data) ? br.data : []);
    const match = list.find((b) => String(b.accountId) === String(accountId));
    if (!match) {
      return res.status(404).json({
        ok: false,
        step: "map-accountId->branchId",
        details: { message: "No branch matched this accountId", accountId, list: list.map(x => ({accountId:x.accountId, branchId:x.branchId, name:x.name})) }
      });
    }
    branchId = match.branchId || match.id;
  }

  if (!branchId && !accountId) {
    return res.status(400).json({
      ok: false,
      details: "Provide branchId or accountId",
    });
  }

  // 2) Try branch-scoped staff endpoints
  const candidates = [
    `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
    `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
    `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staffMembers`,
  ];

  for (const url of candidates) {
    const st = await getJson(url);
    if (!st.ok) {
      // try next candidate; if last one also fails we’ll send details below
      if (url !== candidates[candidates.length - 1]) continue;

      return res.status(st.status || 502).json({
        ok: false,
        step: "fetch-staff",
        details: st,
      });
    }

    const arr =
      st.data?._embedded?.staff ||
      st.data?._embedded?.staffMembers ||
      st.data?.staff ||
      st.data?.staffMembers ||
      (Array.isArray(st.data) ? st.data : []);

    const filtered = arr.filter((s) => {
      if (includeInactive != "1" && s.active === false) return false;
      return true;
    });

    const normalized = filtered.map((s) => ({
      id: s.staffId || s.id,
      name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
      role: s.role || s.jobTitle || "",
      active: s.active ?? true,
      branchId:
        s.branchId || s.branch?.id || s.branch?.branchId || branchId || null,
    }));

    return res.status(200).json({ ok: true, branchId, count: normalized.length, staff: normalized });
  }

  // 3) Fallback: fetch all staff and filter by branchId
  const allUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`;
  const all = await getJson(allUrl);
  if (!all.ok) {
    return res.status(all.status || 502).json({
      ok: false,
      step: "fetch-all-staff",
      details: all,
    });
  }
  const raw =
    all.data?._embedded?.staff ||
    all.data?.staff ||
    (Array.isArray(all.data) ? all.data : []);
  const filtered = raw.filter((s) => {
    const bId =
      s.branchId || s.branch?.id || s.branch?.branchId || s.branch;
    if (bId && branchId && String(bId) !== String(branchId)) return false;
    if (includeInactive != "1" && s.active === false) return false;
    return true;
  });
  const normalized = filtered.map((s) => ({
    id: s.staffId || s.id,
    name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
    role: s.role || s.jobTitle || "",
    active: s.active ?? true,
    branchId:
      s.branchId || s.branch?.id || s.branch?.branchId || branchId || null,
  }));

  return res.status(200).json({ ok: true, branchId, count: normalized.length, staff: normalized });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
