// Pure policy checks. GitHub rulesets must independently protect these checks.
export function branchAllowed(base, head, sameRepository = true) {
  if (!sameRepository || !head) return false;
  if (base === 'main') return /^(release|hotfix)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(head);
  if (base === 'develop') return head === 'main' || /^(feature|release|hotfix)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(head);
  return false;
}

export function parseReleaseTag(tag) {
  const m = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag);
  if (!m || (m[4] && m[4].split('.').some(x => /^\d+$/.test(x) && x.length > 1 && x[0] === '0'))) {
    throw new Error('Invalid release tag');
  }
  return { version: tag.slice(1), distTag: m[4] ? 'next' : 'latest' };
}

export function checkRelease({tag, packageVersion, sourceVersion, onMainFirstParent, registryState, protectedTag}) {
  const parsed = parseReleaseTag(tag);
  if (parsed.version !== packageVersion || parsed.version !== sourceVersion) throw new Error('Version mismatch');
  if (onMainFirstParent !== true || protectedTag !== true) throw new Error('Production ancestry or tag protection unverified');
  if (registryState !== 'absent') throw new Error('Version already published or registry state unknown');
  return parsed;
}
