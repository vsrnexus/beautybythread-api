// /api/staff.js
// Usage examples:
//   /api/staff?branchId=3Fm4UFyHCqo7WM6GTTG_QA
//   /api/staff?accountId=14069
//   /api/staff?accountId=14069&includeInactive=1
//   /api/staff?branchId=...&raw=1
export default async function handler(req, res) {
  setCors(res);

  const { branchId: qBranchId, accountId, includeInactive, raw } = req.query;

  try {
    const bases = [
      process.env.PHOREST_BASE,
      "https://api-gateway-eu.phorest.com/third-party-api-server/api",
      "https://api-gateway-us.phorest.com/third-party-api-server/api",
    ].filter(Boolean);

    const auth =
      "Basic " +
      Buffer.from(
        `${process.env.PHOREST_USERNAME}:${process.env.PHOREST_PASSWORD}`
      ).toString("base64");

    const base = bases[0]; // we already validated which one works for you

    // 1) Resolve branchId from accountId if needed
    let branchId = qBranchId;
    if (!branchId && accountId) {
      const branchesUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch`;
      const branches = await getAllPages(branchesUrl, auth);
      const match = branches.find(
        (b) => String(b.accountId) === String(accountId)
      );
      if (!match) {
        return res
          .status(404)
          .json({ error: "No branch found for accountId", accountId });
      }
      branchId = match.branchId;
    }

    if (!branchId) {
      return res
        .status(400)
        .json({ error: "Provide branchId or accountId" });
    }

    // 2) Try staff endpoints for the specific branch
    const candidateUrls = [
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branches/${branchId}/staff`,
      `${base}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staffMembers`,
    ];

    let lastErr = null;
    for (const url of candidateUrls) {
      try {
        const items = await getAllPages(url, auth); // handles HAL pagination
        const normalized = normalizeStaff(items, { includeInactive, branchId });
        if (raw) return res.status(200).json({ list: normalized, raw: items });
        return res.status(200).json(normalized);
      } catch (e) {
        lastErr = { url, message: String(e?.message || e) };
      }
    }

    // 3) Fallback: GET all staff and filter by branch
    try {
      const allUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`;
      const items = await getAllPages(allUrl, auth);
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

function normalizeStaff(items, opts) {
  const { includeInactive, branchId, filterByBranch } = opts || {};
  const arr = Array.isArray(items)
    ? items
    : items?._embedded?.staff ||
      items?._embedded?.staffMembers ||
      items?.staff ||
      items?.staffMembers ||
      [];

  const filtered = (filterByBranch ? arr : arr).filter((s) => {
    if (filterByBranch) {
      const bId = s.branchId || s.branch?.id || s.branch?.branchId || s.branch;
      if (bId && String(bId) !== String(branchId)) return false;
    }
    if (!includeInactive && (s.active === false)) return false;
    return true;
  });

  return filtered.map((s) => ({
    id: s.staffId || s.id,
    name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
    role: s.role || s.jobTitle || "",
    active: s.active ?? true,
    branchId:
      s.branchId || s.branch?.id || s.branch?.branchId || branchId || null,
  }));
}

async function getAllPages(startUrl, auth) {
  let url = startUrl;
  const out = [];
  const seen = new Set();

  while (url && !seen.has(url)) {
    seen.add(url);
    const r = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} at ${url} :: ${body.slice(0, 200)}`);
    }
    const data = await r.json();

    // accumulate page items
    const pageItems =
      (data && (data._embedded?.staff || data._embedded?.staffMembers)) ||
      data?.staff ||
      data?.staffMembers ||
      (Array.isArray(data) ? data : []);

    if (Array.isArray(pageItems)) out.push(...pageItems);

    // follow HAL next link
    const next =
      data?._links?.next?.href ||
      data?.links?.next?.href ||
      data?.next ||
      null;

    url = next ? absoluteUrl(startUrl, next) : null;
  }
  return out;
}

function absoluteUrl(baseUrl, maybeRel) {
  try {
    return new URL(maybeRel, baseUrl).toString();
  } catch {
    return null;
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
