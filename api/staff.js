// /api/staff.js
// Examples:
//   /api/staff?branchId=3Fm4UFyHCqo7WM6GTTG_QA
//   /api/staff?accountId=14069
//   /api/staff?accountId=14069&includeInactive=1
//   /api/staff?accountId=14069&raw=1
export default async function handler(req, res) {
  setCors(res);

  const { branchId: qBranchId, accountId, includeInactive, raw } = req.query;

  try {
    const base =
      process.env.PHOREST_BASE ||
      "https://api-gateway-eu.phorest.com/third-party-api-server/api";

    const auth =
      "Basic " +
      Buffer.from(
        `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
      ).toString("base64");

    // 1) Resolve branchId from accountId (numeric) if needed
    let branchId = qBranchId;
    if (!branchId && accountId) {
      const branches = await getAllBranches(base, auth);
      const match = branches.find(
        (b) => String(b.accountId) === String(accountId)
      );
      if (!match) {
        return res
          .status(404)
          .json({ error: "No branch found for accountId", accountId });
      }
      branchId = match.branchId; // <- this is the long Phorest branchId
    }

    if (!branchId) {
      return res
        .status(400)
        .json({ error: "Provide branchId or accountId" });
    }

    // 2) Try staff endpoints for that branchId
    const candidateUrls = [
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staffMembers`,
    ];

    let lastErr = null;
    for (const url of candidateUrls) {
      try {
        const items = await getAllStaffPages(url, auth);
        const normalized = normalizeStaff(items, {
          includeInactive,
          branchId,
        });
        if (raw) return res.status(200).json({ list: normalized, raw: items });
        return res.status(200).json(normalized);
      } catch (e) {
        lastErr = { url, message: String(e?.message || e) };
      }
    }

    // 3) Fallback: fetch all staff and filter by branchId
    try {
      const allUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`;
      const items = await getAllStaffPages(allUrl, auth);
      const normalized = normalizeStaff(items, {
        includeInactive,
        branchId,
        filterByBranch: true,
      });
      if (raw) return res.status(200).json({ list: normalized, raw: items });
      return res.status(200).json(normalized);
    } catch (e) {
      return res
        .status(502)
        .json({ error: "staff_failed", details: lastErr || String(e) });
    }
  } catch (e) {
    return res
      .status(500)
      .json({ error: "staff_exception", details: String(e) });
  }
}

/** Fetch ALL branches with pagination (_embedded.branches + _links.next) */
async function getAllBranches(base, auth) {
  const startUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch`;
  const out = [];
  let url = startUrl;
  const seen = new Set();

  while (url && !seen.has(url)) {
    seen.add(url);
    const r = await fetch(url, {
      headers: { Authorization: au
