#!/usr/bin/env bash
# Run this policy from the trusted main checkout before executing release code.
set -euo pipefail

[[ "${RELEASE_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Use a full 40-character lowercase commit SHA" >&2
  exit 1
}
git cat-file -e "${RELEASE_COMMIT}^{commit}"
git merge-base --is-ancestor "$RELEASE_COMMIT" refs/remotes/origin/main || {
  echo "The selected release must already be in main" >&2
  exit 1
}
git checkout --detach "$RELEASE_COMMIT"
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
