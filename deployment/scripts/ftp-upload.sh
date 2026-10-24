
#!/usr/bin/env bash
set -euo pipefail

source_dir="${1:?Usage: ftp-upload.sh SOURCE_DIR}"

: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory missing" >&2
  exit 1
fi

set +x
umask 077

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

# Store credentials in a temporary private .netrc file.
printf 'machine %s login %s password %s\n' \
  "$FTP_HOST" "$FTP_USER" "$FTP_PASSWORD" \
  > "$temp_dir/.netrc"

chmod 600 "$temp_dir/.netrc"

# Explicit FTPS with certificate verification.
HOME="$temp_dir" lftp -f /dev/stdin <<EOF
set cmd:fail-exit yes
set net:timeout 20
set net:max-retries 2
set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ssl:verify-certificate yes
set ftp:passive-mode yes

open -p ${FTP_PORT:-21} ftp://$FTP_HOST

mirror --reverse --verbose=0 --parallel=2 "$source_dir" "$FTP_DIR"

bye
EOF
