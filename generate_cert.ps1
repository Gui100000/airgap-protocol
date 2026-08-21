$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest(
    'CN=localhost, O=AirGap Protocol',
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$san = New-Object System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder
$san.AddDnsName('localhost')
$san.AddIpAddress([System.Net.IPAddress]::Parse('127.0.0.1'))
$req.CertificateExtensions.Add($san.Build())

$cert = $req.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddYears(5))
$pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, 'airgap')
[System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'cert.pfx'), $pfxBytes)

# Also export PEM certificate and private key if supported
$certPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), 'InsertLineBreaks') + "`n-----END CERTIFICATE-----`n"
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'cert.crt'), $certPem)

$keyBytes = $rsa.ExportPkcs8PrivateKey()
$keyPem = "-----BEGIN PRIVATE KEY-----`n" + [Convert]::ToBase64String($keyBytes, 'InsertLineBreaks') + "`n-----END PRIVATE KEY-----`n"
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'key.key'), $keyPem)

Write-Host "Certificates generated successfully: cert.pfx, cert.crt, key.key"
