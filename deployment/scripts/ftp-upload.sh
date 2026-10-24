
@'
#!/usr/bin/env bash
set -euo pipefail

source_dir="${1:?Usage: ftp-upload.sh SOURCE_DIR}"

: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"

[[ -d "$source_dir" ]] || {
  echo "Source directory missing" >&2
  exit 1
}

# Avoid printing secrets.
set +x

# Create a private lftp configuration file.
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
chmod 700 "$temp_dir"

# Escape credentials for lftp quoted strings.
escape_lftp() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

host="$(escape_lftp "$FTP_HOST")"
username="$(escape_lftp "$FTP_USER")"
password="$(escape_lftp "$FTP_PASSWORD")"
remote_dir="$(escape_lftp "$FTP_DIR")"
local_dir="$(escape_lftp "$source_dir")"

cat > "$temp_dir/deploy.lftp" <<EOF
set cmd:fail-exit yes
set net:timeout 20
set net:max-retries 2
set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ssl:verify-certificate yes
set ftp:passive-mode yes

open -p ${FTP_PORT:-21} -u "$username","$password" "ftp://$host"

mirror --reverse --verbose=0 --parallel=2 "$local_dir" "$remote_dir"

bye
EOF

chmod 600 "$temp_dir/deploy.lftp"

lftp -f "$temp_dir/deploy.lftp"
'@ | Set-Content -Path ".\deployment\scripts\ftp-upload.sh" -Encoding ascii
