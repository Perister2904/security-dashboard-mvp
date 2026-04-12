# What To Run

This is the real deployment command reference for `asset-population`.

## 1. On The Server

```powershell
cd C:\asset-population
Set-ExecutionPolicy Bypass -Scope Process -Force
.\Server_Setup.ps1
```

After setup completes:

```powershell
cd C:\asset-population
.\Verify_Setup.ps1
pip install -r requirements.txt
```

## 2. On Each Windows Client

```powershell
cd C:\asset-population
Set-ExecutionPolicy Bypass -Scope Process -Force
.\Client_Join.ps1
```

After reboot:

```powershell
cd C:\asset-population
.\Verify_Setup.ps1 -IsClient
```

## 3. Run A Real Scan

```powershell
cd C:\asset-population
python Asset_Scanner.py --domain meezan.local --dc-ip 192.168.18.100 --username svc_scanner --password YOUR_PASSWORD --output C:\scans\assets.json
```

Or use environment variables:

```powershell
$env:AD_DOMAIN="meezan.local"
$env:AD_DC_IP="192.168.18.100"
$env:AD_USERNAME="svc_scanner"
$env:AD_PASSWORD="YOUR_PASSWORD"
python Asset_Scanner.py --output C:\scans\assets.json
```

## 4. Push Results To The Dashboard

Edit `Push_To_Dashboard.ps1` and set the dashboard API endpoint, then run:

```powershell
.\Push_To_Dashboard.ps1 -Verbose
```

## 5. Schedule Real Scans

```powershell
.\Schedule_Scanner.ps1
```

## Notes

- `Asset_Scanner.py` no longer supports demo mode.
- This folder no longer contains fake asset generators or sample asset datasets.
- If you see JSON output files here, they were produced by a real scan in the local environment and can be deleted/regenerated as needed.
