# Independently stored head: local nonproduction rehearsal

This adapter implements the existing `readHead` and `compareAndSwapHead` callbacks with a separate bare Git repository. It has no network transport. `mode: 'production'` always fails, and a repository with any configured remote is rejected. No GitHub branch, ruleset, credential, R2 object, or publication is changed. This is an executable storage and recovery rehearsal, not a protected production authority.

Run from the repository root:

```sh
node --test tests/local-head-authority.test.mjs
```

The test creates disposable local bare repositories outside archive storage and removes them afterward. It verifies durable reopen, create-only bootstrap, expected-value CAS, six competing processes (exactly one may advance the same prior head), interrupted reconciliation and idempotent retry, wrong identities, absent pins, remote rejection, and unanchored history substitution. Registry and attestation callbacks in the reconciliation test remain simulated. There is no package publication or live signature verification.

For an isolated manual rehearsal, initialize an empty local bare repository with `git init --bare /absolute/nonproduction/authority.git`. Pass `{mode:'nonproduction', authorityPath:'/absolute/nonproduction/authority.git', family:'martlet', framework:'astro'}` to `initializeLocalHeadAuthority`. Retain its returned `anchorCommit` separately and pass it to `localHeadAuthority` with the same configuration. The returned callbacks fit `reconcileVerifiedRelease` directly. Initialization creates a null bootstrap head exactly once. Each advance records the checkpoint SHA-256, prior commit, identity and increasing sequence in a one-file commit; `git update-ref` compares the actual prior commit atomically. Losing writers leave harmless unreachable objects and return false, allowing callers to reread and review. No history is deleted during retry.

The anchor proves lineage to the selected bootstrap; it does **not** establish the newest head. A privileged local writer can reset the branch to an old valid commit. The tests explicitly demonstrate that a separately retained expected-current digest detects that rollback. A local Git directory does not establish independent permissions, immutability, retention or an authenticated production transport.

## Preconditions for any future production adapter

1. Select an existing authorized authority repository/branch or separately authorize a missing authority. Do not create another package/catalog authority. Keep the pinned bootstrap and expected-current head outside archive-publisher control.
2. Use a dedicated writer identity unavailable to the ordinary archive publisher. Audit effective main/authority branch protections and bypass actors, including administrators, applications, actions tokens, repository deletion and credential administration. Non-force updates alone are not independent protection.
3. Protect history against update/deletion and ensure only the trusted verifier can advance it after checking exact immutable-release attestation, registry bytes, complete archive, catalog and promotion history. Establish retention and recovery for repository deletion or credential compromise.
4. For a GitHub implementation, create each candidate commit with the observed authority tip as its sole parent, then use a non-force ref update. A competing advance must cause rejection, never a force update. Verify the new ref and record after success. Verify effective protection and distinct actor permissions live; configuration assertions cannot supply that evidence.
5. Rehearse actual identity isolation, denied rollback/deletion, concurrent writers, interrupted updates and externally pinned retrieval in a separately authorized nonproduction remote. Record the limits of any administrator bypass. Only a separately reviewed production adapter may activate remote writes.

A future GitHub non-force transport is deliberately not implemented here: the current session cannot establish independently protected writer isolation merely by accepting caller-supplied booleans. The existing production publication gate remains disabled until those external controls and live recovery have been demonstrated.
