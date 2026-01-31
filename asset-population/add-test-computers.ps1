Import-Module ActiveDirectory
Write-Host "Adding Ubuntu computer to AD..." -ForegroundColor Cyan
New-ADComputer -Name "UBUNTU-CLIENT" -SAMAccountName "UBUNTU-CLIENT$" -Path "CN=Computers,DC=meezan,DC=local" -Enabled $true -ErrorAction SilentlyContinue
New-ADComputer -Name "WINDOWS-CLIENT-2" -SAMAccountName "WINDOWS-CLIENT-2$" -Path "CN=Computers,DC=meezan,DC=local" -Enabled $true -ErrorAction SilentlyContinue
Write-Host "Listing all computers:" -ForegroundColor Green
Get-ADComputer -Filter * | Select-Object Name, Enabled
