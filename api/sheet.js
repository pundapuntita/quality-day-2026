export default async function handler(req, res) {
  const sheetId = '13ekBJwhxXbAyvr3OpZd8mf8BTPPn-XIRN7Ntgs9G4Ug';
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch Google Sheet' });
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set headers for caching and proxying
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate'); // Cache for 10 seconds on CDN
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow local development fetches
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
