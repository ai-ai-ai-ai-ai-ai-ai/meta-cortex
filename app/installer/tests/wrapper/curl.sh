#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$WRAPPER_DOWNLOAD_LOG"
case "${WRAPPER_DOWNLOAD_FAILURE:-}" in
    yes) exit 22 ;;
esac
url=''
output=''
while [ "$#" -gt 0 ]; do
    case "$1" in
        https://*) url=$1 ;;
        --output) shift; output=$1 ;;
    esac
    shift
done
version=${url##*/download/v}
version=$(printf '%s' "$url" | sed 's|.*/download/v||;s|/.*||')
cat > "$output" <<'INSTALLER'
#!/bin/sh
set -eu
case "${META_CORTEX_INSTALL_DIR:-}${CARGO_DIST_FORCE_INSTALL_DIR:-}${META_CORTEX_DOWNLOAD_URL:-}${INSTALLER_DOWNLOAD_URL:-}" in
    '') ;;
    *) exit 99 ;;
esac
cat > "$META_CORTEX_UNMANAGED_INSTALL/meta-cortex" <<'BINARY'
#!/bin/sh
case "$1" in
    --version) printf 'meta-cortex %s\n' "RELEASE" ;;
    *) printf 'cwd=%s\n' "$PWD"; printf 'arg=%s\n' "$@"; exit "${WRAPPER_BINARY_EXIT:-0}" ;;
esac
BINARY
chmod +x "$META_CORTEX_UNMANAGED_INSTALL/meta-cortex"
INSTALLER
sed -i.bak "s/RELEASE/$version/g" "$output"
rm "$output.bak"
