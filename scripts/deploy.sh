#!/usr/bin/env bash
# Co-latro frontend — publish the static build (dist/) to the MinIO bucket `co-latro-frontend`.
# Invoked by CI on push to main. nginx on the poker-api VM serves the bucket contents.
#
# Env (provided by CI as Actions secrets):
#   MINIO_ENDPOINT    e.g. https://minio.pdlab.dev
#   MINIO_ACCESS_KEY / MINIO_SECRET_KEY
#   MINIO_BUCKET      target bucket (default co-latro-frontend)
set -euo pipefail

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT unset}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY unset}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY unset}"
BUCKET="${MINIO_BUCKET:-co-latro-frontend}"

if [[ ! -d dist ]]; then
  echo "ERROR: dist/ not found — run 'bun run build' first." >&2
  exit 1
fi

# Ensure the MinIO client is available (vendor a local copy if the runner lacks it).
MC=mc
if ! command -v mc >/dev/null 2>&1; then
  echo "==> mc not found; downloading a local copy"
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o ./mc
  chmod +x ./mc
  MC=./mc
fi

echo "==> Configuring MinIO alias"
"$MC" alias set colatro "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"

# Make sure the bucket exists (idempotent).
"$MC" mb --ignore-existing "colatro/${BUCKET}"

echo "==> Mirroring dist/ -> colatro/${BUCKET}"
# --overwrite updates changed files; --remove deletes bucket objects no longer in dist/
# so stale hashed assets don't accumulate.
"$MC" mirror --overwrite --remove dist/ "colatro/${BUCKET}"

echo "==> Published $(find dist -type f | wc -l | tr -d ' ') files to ${BUCKET}."
