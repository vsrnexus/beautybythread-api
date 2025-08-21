import axios from "axios";

export default async function handler(req, res) {
  const { branchId } = req.query;

  if (!branchId) {
    return res.status(400).json({ error: "branchId is required" });
  }

  try {
    const response = await axios.get(
      `${process.env.PHOREST_BASE}/business/${process.env.PHOREST_BUSINESS_ID}/branch/${branchId}/staff`,
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
