#!/bin/sh
# Cargo rustc wrapper for the local Meta-Cortex S3 compiler cache.
set -eu

credentials_dir="${META_CORTEX_HOME:-$HOME/.meta-cortex}/credentials"
SCCACHE_ENDPOINT="https://$(cat "$credentials_dir/sccache-host")"
SCCACHE_BUCKET=$(cat "$credentials_dir/sccache-bucket")
AWS_ACCESS_KEY_ID=$(cat "$credentials_dir/sccache-access-key")
AWS_SECRET_ACCESS_KEY=$(cat "$credentials_dir/sccache-secret-key")
export SCCACHE_ENDPOINT SCCACHE_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export SCCACHE_REGION=us-east-1 SCCACHE_S3_USE_SSL=true
export SCCACHE_S3_KEY_PREFIX=meta-cortex/

exec sccache "$@"
