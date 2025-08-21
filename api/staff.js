// ... inside the for (const url of candidates) loop, after building `normalized`
if (normalized.length > 0 || req.query.tryAll !== "1") {
  // normal behavior: return the branch-scoped result
  return res
    .status(200)
    .json({ ok: true, branchId, count: normalized.length, staff: normalized });
}

// If you pass tryAll=1 AND branch result is empty, fall back to all-staff-and-filter
const allUrl = `${base}/business/${process.env.PHOREST_BUSINESS_ID}/staff`;
const all = await getJson(allUrl);
if (!all.ok) {
  return res.status(all.status || 502).json({
    ok: false,
    step: "fetch-all-staff-fallback",
    details: all,
  });
}
const rawAll =
  all.data?._embedded?.staff ||
  all.data?.staff ||
  (Array.isArray(all.data) ? all.data : []);
const filtered = rawAll.filter((s) => {
  const bId = s.branchId || s.branch?.id || s.branch?.branchId || s.branch;
  if (bId && String(bId) !== String(branchId)) return false;
  if (req.query.includeInactive !== "1" && s.active === false) return false;
  return true;
});

const normalizedFallback = filtered.map((s) => ({
  id: s.staffId || s.id,
  name: `${s.firstName ?? ""} ${s.surname ?? s.lastName ?? ""}`.trim(),
  role: s.role || s.jobTitle || "",
  active: s.active ?? true,
  branchId: s.branchId || s.branch?.id || s.branch?.branchId || branchId || null,
}));

return res.status(200).json({
  ok: true,
  branchId,
  count: normalizedFallback.length,
  staff: normalizedFallback,
  note: "fallback: all-staff filtered by branchId",
});
