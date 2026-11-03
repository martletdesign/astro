// The deployer supplies the other family's base URL; no public host is assumed.
export function peerDashboardURL(base, route) {
  if (!base) return null;
  let url;
  try { url = new URL(base); } catch { throw new Error('NIGHTJAR_PEER_URL must be an absolute HTTP(S) base URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('NIGHTJAR_PEER_URL must be an HTTP(S) base URL without credentials, query or fragment');
  url.pathname = url.pathname.replace(/\/$/, '') + `/examples/dashboard-${route}/`;
  return url.href;
}
