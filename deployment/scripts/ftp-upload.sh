
#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

# Medify cPanel FTPS deployment
# Temporary workaround: certificate verification disabled

source_dir="${1:?Usage: ftp-upload.sh SOURCE_DIR}"

: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"

FTP_PORT="${FTP_PORT:-21}"

if [[ ! -d "$source_dir" ]]; then
  echo "Error: Source directory does not exist."
  exit 1
fi

# Create private temporary directory
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

# Escape values for lftp configuration
escape_lftp() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

host="$(escape_lftp "$FTP_HOST")"
username="$(escape_lftp "$FTP_USER")"
password="$(escape_lftp "$FTP_PASSWORD")"
local_dir="$(escape_lftp "$source_dir")"
remote_dir="$(escape_lftp "$FTP_DIR")"

# Create private configuration file
cat > "$temp_dir/deploy.lftp" <<EOF
set cmd:fail-exit yes
set net:timeout 20
set net:max-retries 2
set net:reconnect-interval-base 5

set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ftp:passive-mode yes

# TEMPORARY: bypass certificate verification
set ssl:verify-certificate no

open -p $FTP_PORT -u "$username","$password" "ftp://$host"

mirror --reverse --verbose=0 --parallel=2 "$local_dir" "$remote_dir"

bye
EOF

chmod 600 "$temp_dir/deploy.lftp"

echo "Starting Medify FTPS deployment..."

lftp -f "$temp_dir/deploy.lftp"

echo "Medify FTPS upload completed."
