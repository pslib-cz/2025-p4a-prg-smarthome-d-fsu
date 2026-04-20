#!/usr/bin/env bash
# Regenerate the D-FSU self-signed CA + broker cert.
#
# Run from ha-config/certs/. Produces dfsu-ca.{key,crt} and broker.{key,crt}.
# The CA key stays local (gitignored); dfsu-ca.crt gets pasted into firmware
# and shipped to the broker alongside broker.{key,crt}.
set -euo pipefail

cd "$(dirname "$0")"

# Git Bash on Windows auto-converts args starting with `/` into Windows paths,
# which mangles openssl's `-subj /CN=...`. Disable for this script.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

# Override via env for non-LAN deployments. CN must match whatever name the
# firmware's mqttHost resolves to — IP or hostname, they both need a matching
# SAN entry or the WiFiClientSecure handshake fails.
BROKER_CN=${BROKER_CN:-homeassistant.local}
BROKER_IP=${BROKER_IP:-192.168.1.10}
DAYS=${DAYS:-3650}

# --- CA ---
# Regenerate if either half is missing — an orphaned key alone can't sign,
# and an orphaned cert without its key is just a public file.
#
# Python 3.14 (HA stable) enforces X.509 extensions on CA certs: without an
# explicit basicConstraints=CA:TRUE + keyUsage=keyCertSign the TLS stack
# rejects the chain with "CA cert does not include key usage extension". So
# we generate the CA with those extensions pinned.
if [[ ! -f dfsu-ca.key || ! -f dfsu-ca.crt ]]; then
    rm -f dfsu-ca.key dfsu-ca.crt
    openssl genrsa -out dfsu-ca.key 4096
    cat > ca.cnf <<'EOF'
[req]
distinguished_name = dn
x509_extensions    = v3_ca
prompt             = no

[dn]
CN = D-FSU Root CA

[v3_ca]
basicConstraints       = critical, CA:TRUE
keyUsage               = critical, keyCertSign, cRLSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always
EOF
    openssl req -x509 -new -nodes -key dfsu-ca.key -sha256 -days "$DAYS" \
        -config ca.cnf -out dfsu-ca.crt
    rm -f ca.cnf
    echo "generated new CA"
else
    echo "reusing existing CA (delete dfsu-ca.key to force regen)"
fi

# --- Broker cert ---
openssl genrsa -out broker.key 2048

cat > broker.csr.cnf <<EOF
[req]
default_bits = 2048
prompt = no
distinguished_name = dn
req_extensions = v3_req

[dn]
CN = $BROKER_CN

[v3_req]
basicConstraints = CA:FALSE
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[alt_names]
DNS.1 = $BROKER_CN
DNS.2 = homeassistant
DNS.3 = mosquitto
DNS.4 = dfsu-mosquitto
DNS.5 = localhost
IP.1  = $BROKER_IP
IP.2  = 127.0.0.1
EOF

openssl req -new -key broker.key -out broker.csr -config broker.csr.cnf
openssl x509 -req -in broker.csr -CA dfsu-ca.crt -CAkey dfsu-ca.key \
    -CAcreateserial -out broker.crt -days "$DAYS" -sha256 \
    -extensions v3_req -extfile broker.csr.cnf

rm -f broker.csr broker.csr.cnf dfsu-ca.srl

echo
echo "Done."
echo "Paste this into d-fsu-esp-firmware/src/net/ca_cert.h between R\"CERT(...)CERT\":"
echo
cat dfsu-ca.crt
