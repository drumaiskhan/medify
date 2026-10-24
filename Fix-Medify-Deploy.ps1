$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\ABC\Desktop\medify'
Set-Location $repo

$ftpPath = 'deployment/scripts/ftp-upload.sh'
$workflowPath = '.github/workflows/deploy.yml'
$serverPath = 'backend/server.js'
foreach ($p in @($ftpPath,$workflowPath,$serverPath)) { if (!(Test-Path $p)) { throw "Missing $p" } }

function Save-Utf8([string]$path, [string]$value) {
  [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $path), $value, [System.Text.UTF8Encoding]::new($false))
}

$ftp = Get-Content $ftpPath -Raw
if ($ftp -notmatch 'mirror --reverse') { throw 'Expected lftp mirror command not found; stopped.' }
if ($ftp -notmatch 'mirror --reverse --transfer-all') {
  $ftp = $ftp.Replace('mirror --reverse --verbose=0', 'mirror --reverse --transfer-all --verbose=0')
  Save-Utf8 $ftpPath $ftp
}

$server = Get-Content $serverPath -Raw
if ($server -notmatch '"/api/deployed-commit"') {
  $marker = '  require("./admin-content").installAdminContent(app, pool);'
  if (!$server.Contains($marker)) { throw 'Expected admin-content registration missing; stopped.' }
  $route = @'
  app.get("/api/deployed-commit", (req, res) => {
    const fs = require("node:fs");
    const path = require("node:path");
    try {
      const commit = fs.readFileSync(path.join(__dirname, "deployed-commit.txt"), "utf8").trim();
      if (!/^[0-9a-f]{40}$/.test(commit)) return res.status(503).json({ error: "Deployment stamp invalid" });
      res.json({ commit });
    } catch (_) {
      res.status(503).json({ error: "Deployment stamp unavailable" });
    }
  });
'@
  $server = $server.Replace($marker, $marker + "`n" + $route)
  Save-Utf8 $serverPath $server
}

$workflow = Get-Content $workflowPath -Raw
if ($workflow -notmatch 'Write deployed commit stamp') {
  $anchor = '      - name: Deploy backend via explicit FTPS'
  if (!$workflow.Contains($anchor)) { throw 'Expected deployment workflow step missing; stopped.' }
  $stamp = @'
      - name: Write deployed commit stamp
        run: |
          printf '%s\n' "$GITHUB_SHA" > "$RUNNER_TEMP/medify-api/deployed-commit.txt"

'@
  $workflow = $workflow.Replace($anchor, $stamp + $anchor)
}
if ($workflow -notmatch 'Verify exact deployed commit') {
  $anchor = '      - name: Deployment completed'
  if (!$workflow.Contains($anchor)) { throw 'Expected completion workflow step missing; stopped.' }
  $check = @'
      - name: Verify exact deployed commit
        env:
          EXPECTED_SHA: ${{ github.sha }}
        run: |
          set -euo pipefail
          for attempt in $(seq 1 18); do
            response="$(curl --insecure --silent --show-error --max-time 15 https://site.med-ify.live/api/deployed-commit || true)"
            if echo "$response" | python3 -c 'import json,os,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("commit")==os.environ["EXPECTED_SHA"] else 1)' 2>/dev/null; then
              echo "Verified live API is running commit $EXPECTED_SHA"
              exit 0
            fi
            echo "Attempt $attempt/18: live API has not reported the expected commit yet"
            sleep 10
          done
          echo "ERROR: Live Medify API did not serve commit $EXPECTED_SHA"
          exit 1

'@
  $workflow = $workflow.Replace($anchor, $check + $anchor)
}
Save-Utf8 $workflowPath $workflow

Write-Host 'Updated FTP forced upload, deployed commit route, and GitHub Actions verification.' -ForegroundColor Green
Write-Host 'Review changes with: git diff --check; git diff --stat'
Write-Host 'Then: git add backend/server.js deployment/scripts/ftp-upload.sh .github/workflows/deploy.yml'
Write-Host 'Then: git commit -m "Force Medify backend uploads and verify live commit"'
Write-Host 'Then: git push origin main'
