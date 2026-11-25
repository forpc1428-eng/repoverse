// The OAuth Client ID is PUBLIC (it appears in every GitHub sign-in URL), so it is fine in code.
// It can still be overridden with the GITHUB_CLIENT_ID environment variable.
// The client SECRET is never in code: it only lives in Vercel's environment variables.
export const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23ctIGSrZo73s0r8DX'
