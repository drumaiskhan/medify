#!/usr/bin/env bash
# Verify that the expected Git commit stamp is actually present at the FTPS
# account's deployment root. This distinguishes a failed FTPS upload/root
# mismatch from a healthy but stale Passenger app.
set -euo pipefail
set +x
umask 077

expected="${1:?Usage: ftp-verify-commit.sh EXPECTED_SHA}"
[[ "$expected" =~ ^[[:xdigit:]]{40}$ ]] || { echo 'Invalid expected Git SHA' >&2; exit 1; }
: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"
FTP_PORT="${FTP_PORT:-21}"

private_dir="$(mktemp -d)"
trap 'rm -rf "$private_dir"' EXIT

escape_lftp() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s' "$value"
}

host="$(escape_lftp "$FTP_HOST")"
username="$(escape_lftp "$FTP_USER")"
password="$(escape_lftp "$FTP_PASSWORD")"
remote_dir="${FTP_DIR%/}"
[[ -n "$remote_dir" ]] || remote_dir='/'
remote_path="${remote_dir%/}/deployed-commit.txt"
remote_path="$(escape_lftp "$remote_path")"
local_path="$(escape_lftp "$private_dir/deployed-commit.txt")"

cat > "$private_dir/verify.lftp" <<EOF
set cmd:fail-exit yes
set net:timeout 20
set net:max-retries 2
set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ftp:passive-mode yes
# Temporary workaround for the cPanel FTPS server certificate; fix the CA chain.
set ssl:verify-certificate no
open -p $FTP_PORT -u "$username","$password" "ftp://$host"
get "$remote_path" -o "$local_path"
bye
EOF
chmod 600 "$private_dir/verify.lftp"
lftp -f "$private_dir/verify.lftp"
actual="$(tr -d '\r\n' < "$private_dir/deployed-commit.txt")"
if [[ "$actual" != "$expected" ]]; then
  echo "::error::FTPS commit stamp mismatch: expected $expected, FTP contains $actual. Verify API_FTP_DIR points to /home2/medschoolpro/medify-api."
  exit 1
fi
echo "Verified FTP deployment root contains commit $actual"
