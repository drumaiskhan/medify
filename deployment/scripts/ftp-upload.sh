
PS C:\Users\ABC\Desktop\medify> Get-Content .\deployment\scripts\ftp-upload.sh
#!/usr/bin/env bash
set -euo pipefail
source_dir="${1:?Usage: ftp-upload.sh SOURCE_DIR}"
: "${FTP_HOST:?Missing FTP_HOST}"
: "${FTP_USER:?Missing FTP_USER}"
: "${FTP_PASSWORD:?Missing FTP_PASSWORD}"
: "${FTP_DIR:?Missing FTP_DIR}"
[[ -d "$source_dir" ]] || { echo "Source directory missing" >&2; exit 1; }
# Keep all credentials out of shell arguments and log output.
temp_home="$(mktemp -d)"
trap 'rm -rf "$temp_home"' EXIT
netrc="$temp_home/.netrc"
chmod 700 "$temp_home"
printf 'machine %s login %s password %s\n' "$FTP_HOST" "$FTP_USER" "$FTP_PASSWORD" > "$netrc"
# FTPS with certificate validation; no destructive --delete or mirror -R --delete.
# FTP_DIR is the directory visible to this FTP account (often /public_html).
HOME="$temp_home" lftp -f /dev/stdin <<EOF
set cmd:fail-exit yes
set ftp:ssl-force yes
set ftp:ssl-protect-data yes
set ssl:verify-certificate yes
open -p ${FTP_PORT:-21} ftp://$FTP_HOST
mirror --reverse --verbose=0 --parallel=2 "$source_dir" "$FTP_DIR"
bye
EOF
PS C:\Users\ABC\Desktop\medify>


















































































