#!/bin/sh
# Cargo rustc wrapper for the local Nook S3 compiler cache.
set -eu

cache_dir="$HOME/.nook/cache"
SCCACHE_ENDPOINT="https://$(cat "$cache_dir/sccache-host")"
SCCACHE_BUCKET=$(cat "$cache_dir/sccache-bucket")
AWS_ACCESS_KEY_ID=$(cat "$cache_dir/sccache-access-key")
AWS_SECRET_ACCESS_KEY=$(cat "$cache_dir/sccache-secret-key")
export SCCACHE_ENDPOINT SCCACHE_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export SCCACHE_REGION=us-east-1 SCCACHE_S3_USE_SSL=true
export SCCACHE_S3_KEY_PREFIX=meta-cortex/

exec sccache "$@"
