import { pathToFileURL } from 'node:url';

// The lookup is deliberately limited to this exact repository and tag. A
// failed or malformed request is not evidence that a release is absent.
export async function releaseAbsent(fetcher, { repository, tag, token }) {
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9_.-]+$/.test(repository ?? '') ||
      !/^v[0-9A-Za-z.-]+$/.test(tag ?? '') || !token) throw Error('Invalid release lookup identity');
  let response;
  try {
    response = await fetcher(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`, {
      headers: {Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'nightjar-release-guard'},
      redirect: 'error', signal: AbortSignal.timeout(15000)
    });
  } catch { throw Error('Release lookup failed; absence is unknown'); }
  if (response?.status !== 404) throw Error(`Release exists or lookup failed (HTTP ${response?.status ?? 'unknown'})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await releaseAbsent(fetch, {repository:process.env.GITHUB_REPOSITORY, tag:process.env.RELEASE_TAG, token:process.env.GH_TOKEN});
}
