// GET /api/config: public sign-in settings for the browser.
// The OAuth client ID is public by design; the client secret never leaves the server.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ clientId: process.env.GITHUB_CLIENT_ID || '' })
}
