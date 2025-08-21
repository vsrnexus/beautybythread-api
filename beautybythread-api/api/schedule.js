import axios from "axios";

export default async function handler(req, res) {
  const { branchId, staffId, date } = req.query;

  if (!branchId || !staffId || !date) {
    return res.status(400).json({ error: "branchId, staffId, and date are required" });
  }

  try {
    const response = await axios.get(
      `${process.env.PHOREST_BASE}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff/${staffId}/schedule?date=${date}`,
      {
        auth: {
          username: process.env.PHOREST_USERNAME,
          password: process.env.PHOREST_PASSWORD
        }
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
