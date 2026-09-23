#!/usr/bin/env bash
# Pushes the checked-out commit to the GitHub mirror as `master`.
#
#   .azure-pipelines/mirror.sh <key-file>
#
# This repository lives on Azure Repos and is checked out as a submodule of
# the-test-cabinet. GitHub holds a copy under the same name, so a clone of the
# superproject's GitHub mirror resolves the submodule's relative URL there.
# Nothing else pushes to the mirror, which is why the push is forced: the mirror
# follows Azure, whatever it held before.
#
# <key-file> is the private half of a deploy key with write access to the
# mirror, which the pipeline keeps as a secure file. The checkout must hold the
# full history, because GitHub refuses a push from a shallow clone.
set -euo pipefail

readonly MIRROR="git@github.com:TheClockwyrks/test-suites.git"
# https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
readonly GITHUB_HOST_KEY="github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"

if [[ $# -ne 1 ]]; then
	echo "usage: .azure-pipelines/mirror.sh <key-file>" >&2
	exit 1
fi
readonly KEY_FILE="$1"

cd "$(git rev-parse --show-toplevel)"

# ssh refuses a key that others can read, and a secure file is downloaded
# world-readable.
chmod 600 "$KEY_FILE"

known_hosts="$(mktemp)"
trap 'rm -f "$known_hosts"' EXIT
echo "$GITHUB_HOST_KEY" >"$known_hosts"

GIT_SSH_COMMAND="ssh -i '$KEY_FILE' -o IdentitiesOnly=yes -o UserKnownHostsFile='$known_hosts' -o StrictHostKeyChecking=yes" \
	git push --force "$MIRROR" "HEAD:refs/heads/master"

echo "Mirrored $(git rev-parse --short HEAD) to master"
