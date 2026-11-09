param([string]$Adapter = "Ethernet 2", [switch]$Apply)

$ErrorActionPreference = "Stop"

Write-Host "Adapter:" -ForegroundColor Cyan
Get-NetAdapter -Name $Adapter | Format-List Name, InterfaceDescription, MacAddress, LinkSpeed, Status

Write-Host "Power management now:" -ForegroundColor Cyan
Get-NetAdapterPowerManagement -Name $Adapter | Format-List Name, WakeOnMagicPacket, WakeOnPattern

Write-Host "Wake-related advanced properties now:" -ForegroundColor Cyan
Get-NetAdapterAdvancedProperty -Name $Adapter | Where-Object { $_.DisplayName -match "Wake|Energy|Green|Shutdown" } | Format-Table DisplayName, DisplayValue

Write-Host "Fast Startup (HiberbootEnabled, 1 = on):" -ForegroundColor Cyan
(Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power").HiberbootEnabled

if (-not $Apply) {
  Write-Host "`nNothing changed. Run again with -Apply from an administrator PowerShell to:" -ForegroundColor Yellow
  Write-Host "  - allow the adapter to wake the PC, magic packet only"
  Write-Host "  - turn on 'Wake on Magic Packet' and 'Shutdown Wake-On-Lan' if the driver has them"
  Write-Host "  - turn off 'Energy Efficient Ethernet' and 'Green Ethernet' if present"
  Write-Host "  - turn off Fast Startup (hibernation itself stays on)"
  return
}

Set-NetAdapterPowerManagement -Name $Adapter -WakeOnMagicPacket Enabled -WakeOnPattern Disabled
foreach ($name in "Wake on Magic Packet", "Shutdown Wake-On-Lan") {
  $property = Get-NetAdapterAdvancedProperty -Name $Adapter -DisplayName $name -ErrorAction SilentlyContinue
  if ($property) { Set-NetAdapterAdvancedProperty -Name $Adapter -DisplayName $name -DisplayValue "Enabled" }
}
foreach ($name in "Energy Efficient Ethernet", "Green Ethernet") {
  $property = Get-NetAdapterAdvancedProperty -Name $Adapter -DisplayName $name -ErrorAction SilentlyContinue
  if ($property) { Set-NetAdapterAdvancedProperty -Name $Adapter -DisplayName $name -DisplayValue "Disabled" }
}
Set-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name HiberbootEnabled -Value 0
Write-Host "`nDone. Now enable Wake on LAN and turn off ErP/EuP in the BIOS." -ForegroundColor Green
