
#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

source_dir="${1:?Usage: ftp-upload.sh SOURCE_DIR}"

: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"

if [[ ! -d "$source_dir" ]]; then
  echo "Source directory missing" >&2
  exit 1
fi

# Private temporary directory for credentials.
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

# Configure lftp to authenticate using the supplied credentials.
# The password is not printed to GitHub Actions logs.
export LFTP_PASSWORD="$FTP_PASSWORD"

lftp -u "$FTP_USER","$FTP_PASSWORD" \
  -p "${FTP_PORT:-21}" \
  "ftp://$FTP_HOST" <<EOF
set cmd:fail-exit yes
set net:timeout 20
set net:max-retries 2
set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ssl:verify-certificate yes
set ftp:passive-mode yes

mirror --reverse --verbose=0 --parallel=2 "$source_dir" "$FTP_DIR"

bye
EOF
