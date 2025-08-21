export const config = { runtime: "nodejs18.x" };

// Examples:
//   /api/staff?branchId=3Fm4UFyHCqo7WM6GTTG_QA
//   /api/staff?accountId=14069
//   /api/staff?accountId=14069&includeInactive=1
//   /api/staff?branchId=...&tryAll=1&raw=1
export default async function handler(req, res) {
  setCors(res);
  try {
    const q = req.query || {};
    const includeInactive = q.includeInactive === "1";
    const tryAll = q.tryAll === "1";
    const rawWanted = q.raw === "1";

    const base =
      process.env.PHOREST_BASE ||
      "https://api-gateway-eu.phorest.com/third-party-api-server/api";

    const businessId = process.env.PHOREST_BUSINESS_ID || "";
    const username = process.env.PHOREST_USERNAME || "";
    const password = process.env.PHOREST_PASSWORD || "";
    const auth =
      "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

    if (!businessId || !username || !password) {
      return json(res, 500, {
        ok: false,
        step: "env-check",
        details: { businessId: !!businessId, username: !!username, password: !!password }
      });
    }

    // Resolve branchId (if only accountId was given)
    let branchId = q.branchId || null;
    if (!branchId && q.accountId) {
      const branchesUrl = `${base}/business/${businessId}/branch`;
      const br = await safeGet(branchesUrl, auth);
      if (!br.ok) return json(res, br.status || 502, { ok: false, step: "fetch-branches", details: br });
      const list = extractBranches(br.data);
      const match = list.find(b => String(b.accountId) === String(q.accountId));
      if (!match) {
        return json(res, 404, {
          ok: false,
          step: "map-accountId->branchId",
          details: { accountId: q.accountId, branchesSeen: list.map(b => ({accountId:b.accountId, branchId:b.branchId, name:b.name})) }
        });
      }
      branchId = match.branchId || match.id || null;
    }

    if (!branchId && !q.accountId) {
      return json(res, 400, { ok: false, details: "Provide branchId or accountId" });
    }

    // 1) Try the branch-scoped staff endpoints
    const candidates = [
      `${base}/business/${businessId}/branch/${branchId}/staff`,
      `${base}/business/${businessId}/branches/${branchId}/staff`,
      `${base}/business/${businessId}/branch/${branchId}/staffMembers`,
    ];

    for (const url of candidates) {
      const r = await safeGet(url, auth);
      if (!r.ok) {
        // If last candidate fails and you didn't ask for fallback, return detailed error
        if (url === candidates[candidates.length - 1] && !tryAll) {
          return json(res, r.status || 502, { ok: false, step: "fetch-staff", details: r });
        }
        // otherwise try next or fall through to fallback
        continue;
      }

      const list = normalizeStaff(extractStaff(r.data), { includeInactive, branchId });
      if (rawWanted) return json(res, 200, { ok: true, route: "branch-staff", branchId, count: list.length, staff: list, raw: r.data });
      if (list.length > 0 || !tryAll) return json(res, 200, { ok: true, route: "branch-staff", branchId, count: list.length, staff: list });
      // if list empty *and* tryAll=1 → continue to fallback
      break;
    }

    // 2) Fallback: all-staff for business, then filter by branch
    const allUrl = `${base}/business/${businessId}/staff`;
    const all = await safeGet(allUrl, auth);
    if (!all.ok) return json(res, all.status || 502, { ok: false, step: "fetch-all-staff", details: all });

    const rawAll = extractStaff(all.data);
    const filtered = rawAll.filter(s => {
      const bId = s.branchId || s.branch?.id || s.branch?.branchId || s.branch;
      if (bId && branchId && String(bId) !== String(branchId)) return false;
      if (!includeInactive && s.active === false) return false;
      return true;
    });
    const list = normalizeStaff(filtered, { includeInactive, branchId });
    if (rawWanted) return json(res, 200, { ok: true, route: "all-staff-fallback", branchId, count: list.length, staff: list, raw: all.data });
    return json(res, 200, { ok: true, route: "all-staff-fallback", branchId, count: list.length, staff: list });

  } catch (e) {
    // absolutely no crashes: always a JSON
    return json(res, 200, { ok: false, step: "top-level-catch", error: String(e) });
  }
}

/* ---------- helpers ---------- */

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, body) {
  try {
    res.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
  } catch {
    // last resort
    res.status(200).end('{"ok":false,"error":"resp_fail"}');
  }
}

async function safeGet(url, auth) {
  try {
    const r = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const text = await r.text(); // read once, re-usable below
    if (!r.ok) return { ok: false, status: r.status, url, body: text };
    try { return { ok: true, status: r.status, url, data: JSON.parse(text) }; }
    catch { return { ok: false, status: r.status, url, body: text, note: "json-parse-failed" }; }
  } catch (e) {
    return { ok: false, status: 0, url, err: String(e) };
  }
}

function extractBranches(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload._embedded?.branches || payload.branches || [];
}

function extractStaff(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return (
    payload._embedded?.staff ||
    payload._embedded?.staffMembers ||
    payload.staff ||
    payload.staffMembers ||
    []
  );
}

function normalizeStaff(arr, opts = {}) {
  const { includeInactive, branchId } = opts;
  return (arr || [])
    .filter(s => includeInactive || s.active !== false)
    .map(s => ({
      id: s.staffId || s.id,
      name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
      role: s.role || s.jobTitle || "",
      active: s.active ?? true,
      branchId: s.branchId || s.branch?.id || s.branch?.branchId || branchId || null,
    }));
}
