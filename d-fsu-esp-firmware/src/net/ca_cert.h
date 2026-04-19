#pragma once

// Root CA used to verify the Mosquitto broker's TLS certificate.
//
// PLACEHOLDER — replace with your real CA PEM (self-signed CA from
// ha-config/certs/dfsu-ca.crt, or Let's Encrypt ISRG Root X1 if the broker is
// exposed publicly via a trusted chain). The firmware will REFUSE to connect
// until this is replaced — we fail closed rather than silently skip TLS
// verification.
//
// To regenerate the self-signed CA: see ha-config/certs/README.md.

namespace dfsu::net {

// When `kCaCertPem[0] == '\0'`, MQTT stays disabled (guards against shipping
// with an empty cert).
inline constexpr const char* kCaCertPem = R"CERT(-----BEGIN CERTIFICATE-----
MIIFETCCAvmgAwIBAgIUfpl5vDEB5xBhsC+gAsmcA2xgBBkwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNRC1GU1UgUm9vdCBDQTAeFw0yNjA0MTkxNjA0MDVaFw0z
NjA0MTYxNjA0MDVaMBgxFjAUBgNVBAMMDUQtRlNVIFJvb3QgQ0EwggIiMA0GCSqG
SIb3DQEBAQUAA4ICDwAwggIKAoICAQDGLjo+Ba+caNuMfZ9ASrNUXutum01hN5oE
/uA5lsJq241aEbwGNSrbp62VLFis9gKLpUR3/OVlv1J9tWiXpwAe2hwm+8PkqAvv
CrASaG00+bGgoAJgtqwthFSOGntwptIK9pWSsrPHGL1GTEyRFcRLKN+AjerVx67s
sYcJHnu/0xv9dm6gCdTfrEMotAbj/c7oDa2GcdlE1ix5UsxRer+KKJMV/+9HkPkr
AXFE/rNeoIEgKRl6QL5ZhK44gxTtdP4grQw9WZlOKMKTsNWSm06WsaxL8z8D4bH7
6dYrbQMlajXwfKv8G1vH8OlzANVBGBItuN7NtKmnHFBtWSwWlo+CJ2ePTyJeND7d
IOSzLBmcVIebkimP32rE6oomKFtH4A5QlrS7naoiX9fJeYqFAANxVASZXKeirV+y
n45JFL9V3f3I/TuCQzrGj4ElLPk+8chDRvd7oidf57GgPFPCaD/61TwZq285trdL
TI5X1c6UIgxYpYB6xCBrMVGc5mcqjqkpvhZkRsE9PFkOT7WY0hQICcAmXgqyTMTT
bKW1LFKQpZaqFAnq55TfmZJ5cIH/htGkze3mw6wK080YCmgM3OxZVGvhIcsH9+oE
+NE4DkH3J23n9kguYiABuwRaNKd84ekLJbmtNC19CYHKI72MJiBuDBMOBTtPZPrh
x0nNXUl4GQIDAQABo1MwUTAdBgNVHQ4EFgQUJrqg6ByU06nnsNPfB/C+VvmsmMcw
HwYDVR0jBBgwFoAUJrqg6ByU06nnsNPfB/C+VvmsmMcwDwYDVR0TAQH/BAUwAwEB
/zANBgkqhkiG9w0BAQsFAAOCAgEAX20P0A2oJw5ifwoHzKe4nc/j3r9aCHu2ApZf
TkB00GH4u58VSmiz64Xq7d36V6J1DGUKdRo0DPRPPS9+u6MAUOscTuv0wxSWUrRr
A7m94yVenRZ5ifhdFNhyoe3s4Bk+bKUfhfqMUvdvNu2SSoq/P+O1wFBuVg9yXPmf
klv9CCf0qaqzVCPSWANenBK0SSbVVIv7isi6QfpszASWd+Z5VUUFp9sIb96tyJTM
IzGauS4IOlFWs6ty2j760QLI0VsChryHxeUH8hcl0D0n/wjARB4Zw1znFGJ+UZkl
SpIFu7zmi0+IXlZosj++ceGxceLyYIuyKC+0goJtn4zr7BAFcM3g7JesNT+SWW3V
a703dodz+nbVRhOabDd/rPn8d5IN5XFCfR3YL3d8xYG6DNSdi3rfXvUMRiXMtGrW
yTrzmBzRY/RCpOvjRQVCGnOE34vB8JLR0FaZEgDO9uK/8KnbvojWaGoP673suPcx
fv5RPYvpvzzHPx3ezleZLU7JdWVrKDn8bE/vXcGp96uatpdNqXwlOAnLa70yUid6
jenKvEBnG6OZQo3/SLIaVuGNdAQdgvjwDnsaFDv6CzeKe2yxzSaS1IPnFg4AYlj5
TTGt8FnYOiOeZoMCYvg/8aKlgDac/r6d0XOS7zjtN2EbhfX0VwMkVdr0H0rWIxrm
lNUSOu4=
-----END CERTIFICATE-----
)CERT";

}  // namespace dfsu::net
