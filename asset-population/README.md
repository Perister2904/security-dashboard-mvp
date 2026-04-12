# Asset Population

This directory is now real-data only.

Its purpose is to:
- prepare an Active Directory lab or deployment
- join Windows clients to the domain
- scan real AD computers over LDAP and WinRM
- optionally push those real scan results into the dashboard backend

It does not contain demo generators, fake datasets, sample asset payloads, or test asset seed scripts anymore.

## Core Files

- `Asset_Scanner.py`: real AD-backed scanner
- `Server_Setup.ps1`: prepares the server / domain controller workflow
- `Client_Join.ps1`: joins Windows clients to the domain
- `Verify_Setup.ps1`: validates the real deployment path
- `Schedule_Scanner.ps1`: schedules recurring real scans
- `Push_To_Dashboard.ps1`: pushes real scan results to the dashboard API
- `WHAT_TO_RUN.md`: short command reference
- `REAL_DEPLOYMENT_GUIDE.md`: detailed real deployment guide
- `REAL_AD_DEPLOYMENT.md`: AD-specific deployment notes

## Required Inputs

The scanner now requires real AD connection values, either through CLI flags or environment variables:

- `AD_DOMAIN`
- `AD_DC_IP`
- `AD_USERNAME`
- `AD_PASSWORD`

Example:

```powershell
pip install -r requirements.txt
python Asset_Scanner.py --domain meezan.local --dc-ip 192.168.18.100 --username svc_scanner --password YOUR_PASSWORD --output C:\scans\assets.json
```

## Generated Outputs

Generated files such as live scan JSON and logs are not kept as source files in this folder anymore. Run the scanner to generate fresh outputs in your environment.
