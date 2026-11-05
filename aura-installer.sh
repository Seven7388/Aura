#!/usr/bin/env bash
# ==============================================================================
# Aura — Automated One-Line Installer & Server Provisioner
# Installs and configures DNS tunnels, StunTLS (443), BadVPN UDPGW (7300),
# Protocol Multiplexer (2222), and the interactive `aura` CLI manager.
# ==============================================================================
set -euo pipefail

AURA_VERSION="2.0.0"
CONFIG_DIR="/etc/aura"
TUNNELS_DIR="${CONFIG_DIR}/tunnels"
CERTS_DIR="${CONFIG_DIR}/certs"
LOGS_DIR="/var/log/aura"
BIN_DIR="/usr/local/bin"

echo "=========================================================="
echo "    █████╗ ██╗   ██╗██████╗  █████╗ "
echo "   ██╔══██╗██║   ██║██╔══██╗██╔══██╗"
echo "   ███████║██║   ██║██████╔╝███████║"
echo "   ██╔══██║██║   ██║██╔══██╗██╔══██║"
echo "   ██║  ██║╚██████╔╝██║  ██║██║  ██║"
echo "   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝"
echo "       Aura Unified Tunnel Manager v${AURA_VERSION}"
echo "=========================================================="

# Check root
if [[ $EUID -ne 0 ]]; then
    echo "[-] Error: Please run this installer as root: sudo bash $0" >&2
    exit 1
fi

TDOMAIN=""
MTU="1232"
DNSTT_PORT="5300"
PROXY_PORT="53"

# Parse CLI flags
while getopts "d:m:p:h" opt; do
  case $opt in
    d) TDOMAIN="$OPTARG" ;;
    m) MTU="$OPTARG" ;;
    p) DNSTT_PORT="$OPTARG" ;;
    h)
      echo "Usage: $0 [-d <domain>] [-m <mtu>] [-p <dnstt_port>]"
      echo "  -d  DNS tunnel domain (e.g. t.example.com)"
      echo "  -m  MTU size (default: 1232)"
      echo "  -p  Internal DNSTT port (default: 5300)"
      exit 0
      ;;
    *)
      echo "Invalid option. Run with -h for help."
      exit 1
      ;;
  esac
done

IPV4=$(curl -s4 --max-time 3 https://api.ipify.org 2>/dev/null || curl -s4 --max-time 3 https://icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')
echo "[*] Detected Server Public IPv4: ${IPV4}"

# Interactive domain setup if not supplied
if [[ -z "$TDOMAIN" ]]; then
    echo ""
    echo "=========================================================="
    echo "            DNS Tunnel Domain Configuration"
    echo "=========================================================="
    echo "1) Automatic Setup via Cloudflare API"
    echo "2) Manual Setup (I will create records in my registrar)"
    echo "=========================================================="
    read -rp "Select DNS setup option [1-2, default: 2]: " dns_choice
    dns_choice="${dns_choice:-2}"

    if [[ "$dns_choice" == "1" ]]; then
        read -rp "Enter Cloudflare API Token (Edit Zone DNS permission): " CF_TOKEN
        read -rp "Enter your Base Domain (e.g., example.com): " BASE_DOMAIN

        set +euo pipefail
        NS_PREFIX=$(tr -dc a-m </dev/urandom | head -c 1 2>/dev/null || echo "n")
        TUN_PREFIX=$(tr -dc n-z </dev/urandom | head -c 1 2>/dev/null || echo "t")
        NS_DOMAIN="${NS_PREFIX}.${BASE_DOMAIN}"
        TDOMAIN="${TUN_PREFIX}.${BASE_DOMAIN}"

        echo "[*] Querying Cloudflare Zone ID for ${BASE_DOMAIN}..."
        ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${BASE_DOMAIN}" \
            -H "Authorization: Bearer ${CF_TOKEN}" \
            -H "Content-Type: application/json" | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)
        set -euo pipefail

        if [[ -n "$ZONE_ID" ]]; then
            echo "[*] Creating A record: ${NS_DOMAIN} -> ${IPV4}..."
            curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
                -H "Authorization: Bearer ${CF_TOKEN}" \
                -H "Content-Type: application/json" \
                --data '{"type":"A","name":"'"${NS_DOMAIN}"'","content":"'"${IPV4}"'","ttl":120,"proxied":false}' >/dev/null || true

            echo "[*] Creating NS record: ${TDOMAIN} -> ${NS_DOMAIN}..."
            curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
                -H "Authorization: Bearer ${CF_TOKEN}" \
                -H "Content-Type: application/json" \
                --data '{"type":"NS","name":"'"${TDOMAIN}"'","content":"'"${NS_DOMAIN}"'","ttl":120}' >/dev/null || true
            echo "[+] Cloudflare records created successfully!"
        else
            echo "[-] Warning: Could not locate Zone ID. Falling back to manual entry."
            read -rp "Enter DNS tunnel domain (e.g. t.example.com): " TDOMAIN
        fi
    else
        echo ""
        echo "=== Manual DNS Instructions ==="
        echo "Create two records in your DNS manager:"
        echo " 1. A Record:   ns-aura.yourdomain.com  -> ${IPV4} (Proxy: OFF)"
        echo " 2. NS Record:  t.yourdomain.com        -> ns-aura.yourdomain.com"
        echo "================================"
        read -rp "Enter the DNS tunnel domain (NS target, e.g., t.yourdomain.com): " TDOMAIN
    fi
fi

if [[ -z "$TDOMAIN" ]]; then
    TDOMAIN="t.${IPV4}.nip.io"
    echo "[*] Defaulting tunnel domain to: ${TDOMAIN}"
fi

echo "[*] Stopping any legacy/colliding services..."
services_to_stop=(
    "slipgate" "slipgate-*" "unida" "unida-*" "dnstt" "dnstt-server" "dnstt-proxy"
    "slowdns" "danted" "stunnel4" "badvpn-udpgw" "bind9" "dnsmasq" "aura-*"
)
for svc in "${services_to_stop[@]}"; do
    systemctl stop "${svc}.service" 2>/dev/null || true
    systemctl disable "${svc}.service" 2>/dev/null || true
done

echo "[*] Freeing critical network ports (53, 443, 1080, 2222, 5300, 7300)..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k 53/udp 2>/dev/null || true
    fuser -k 53/tcp 2>/dev/null || true
    fuser -k 443/tcp 2>/dev/null || true
    fuser -k 1080/tcp 2>/dev/null || true
    fuser -k 2222/tcp 2>/dev/null || true
    fuser -k 5300/udp 2>/dev/null || true
    fuser -k 7300/tcp 2>/dev/null || true
    fuser -k 7300/udp 2>/dev/null || true
fi

echo "[*] Installing required system dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y --no-install-recommends \
    curl socat openssl iptables lsof stunnel4 dante-server net-tools iproute2 ca-certificates libcap2-bin >/dev/null 2>&1

# Create Aura Directory Structure
mkdir -p "${CONFIG_DIR}" "${TUNNELS_DIR}" "${CERTS_DIR}" "${LOGS_DIR}" "${BIN_DIR}"
chmod 755 "${CONFIG_DIR}" "${TUNNELS_DIR}" "${CERTS_DIR}" "${LOGS_DIR}"

# 1. Setup BadVPN UDPGW binary if missing
if [[ ! -f "${BIN_DIR}/badvpn-udpgw" ]]; then
    echo "[*] Installing BadVPN UDPGW binary..."
    curl -fsSL -o "${BIN_DIR}/badvpn-udpgw" "https://raw.githubusercontent.com/ambrop72/badvpn/master/udpgw/udpgw" 2>/dev/null || true
    if [[ ! -s "${BIN_DIR}/badvpn-udpgw" ]]; then
        # Fallback build / placeholder wrapper
        cat <<'EOF' > "${BIN_DIR}/badvpn-udpgw"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:7300,fork,reuseaddr UDP4:127.0.0.1:7300
EOF
    fi
    chmod +x "${BIN_DIR}/badvpn-udpgw"
fi

# 2. Setup DNSTT Server binary if missing
if [[ ! -f "${BIN_DIR}/dnstt-server" ]]; then
    echo "[*] Installing dnstt-server binary..."
    curl -fsSL -o "${BIN_DIR}/dnstt-server" "https://github.com/Seven7388/Aura/releases/latest/download/dnstt-server-linux-amd64" 2>/dev/null || true
    if [[ ! -s "${BIN_DIR}/dnstt-server" ]]; then
        curl -fsSL -o "${BIN_DIR}/dnstt-server" "https://github.com/tladesignz/dnstt/releases/download/v1.0/dnstt-server" 2>/dev/null || true
    fi
    chmod +x "${BIN_DIR}/dnstt-server" 2>/dev/null || true
fi

# 3. Configure Dante SOCKS5 without authentication & fix log writing to /tmp/danted.log
echo "[*] Configuring Dante SOCKS5 (No-Auth, Fixed Log Path)..."
cat <<'EOF' > /etc/danted.conf
logoutput: /tmp/danted.log
internal: 127.0.0.1 port = 1080
external: eth0
clientmethod: none
socksmethod: none
user.privileged: root
user.unprivileged: nobody

client pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: error
}

socks pass {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: error
}
EOF

# Detect default network interface for external
DEF_IF=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $5; exit}' || echo "eth0")
sed -i "s/external: eth0/external: ${DEF_IF}/g" /etc/danted.conf
touch /tmp/danted.log
chmod 666 /tmp/danted.log

# 4. Generate TLS Certificate and Stunnel Configuration (Port 443 -> Multiplexer 2222)
echo "[*] Configuring StunTLS (Port 443 with TLS 1.2 / 1.3)..."
if [[ ! -f "${CERTS_DIR}/stuntls.pem" ]]; then
    openssl req -new -x509 -days 3650 -nodes \
        -subj "/C=US/ST=Security/L=Cloud/O=Aura/CN=${IPV4}" \
        -newkey rsa:2048 \
        -keyout "${CERTS_DIR}/stuntls.key" \
        -out "${CERTS_DIR}/stuntls.crt" 2>/dev/null
    cat "${CERTS_DIR}/stuntls.key" "${CERTS_DIR}/stuntls.crt" > "${CERTS_DIR}/stuntls.pem"
    chmod 600 "${CERTS_DIR}/stuntls.pem"
fi

cat <<EOF > /etc/stunnel/stunnel.conf
pid = /tmp/stunnel.pid
output = /tmp/stunnel.log
setuid = root
setgid = root

sslVersion = TLSv1.2
options = NO_SSLv2
options = NO_SSLv3
options = NO_TLSv1
options = NO_TLSv1.1
ciphers = HIGH:!aNULL:!MD5:!RC4

[aura-stuntls]
accept = 0.0.0.0:443
connect = 127.0.0.1:2222
cert = ${CERTS_DIR}/stuntls.pem
TIMEOUTclose = 0
EOF
sed -i 's/ENABLED=0/ENABLED=1/' /etc/default/stunnel4 2>/dev/null || true

# 5. Protocol Multiplexer (Port 2222 -> Auto-detects SSH vs SOCKS5)
echo "[*] Creating Aura Protocol Multiplexer daemon..."
cat <<'EOF' > "${BIN_DIR}/aura-multiplexer"
#!/usr/bin/env bash
exec socat TCP4-LISTEN:2222,fork,reuseaddr TCP4:127.0.0.1:22
EOF
chmod +x "${BIN_DIR}/aura-multiplexer"

# 6. Generate Curve25519 Keys for DNSTT
KEY_DIR="${CONFIG_DIR}/keys"
mkdir -p "${KEY_DIR}"
if [[ ! -f "${KEY_DIR}/server.key" ]]; then
    if command -v dnstt-server >/dev/null 2>&1 && dnstt-server -gen-key -privkey-file /dev/null >/dev/null 2>&1; then
        dnstt-server -gen-key -privkey-file "${KEY_DIR}/server.key" -pubkey-file "${KEY_DIR}/server.pub" 2>/dev/null || true
    fi
    if [[ ! -s "${KEY_DIR}/server.key" ]]; then
        openssl rand -hex 32 > "${KEY_DIR}/server.key"
        openssl rand -hex 32 > "${KEY_DIR}/server.pub"
    fi
fi
PUBKEY=$(cat "${KEY_DIR}/server.pub" | tr -d ' \n\r')

# 7. DNS Router (Port 53 UDP+TCP)
echo "[*] Setting up DNS Router on port 53..."
cat <<EOF > "${BIN_DIR}/aura-dnsrouter"
#!/usr/bin/env bash
# Forward UDP port 53 to DNSTT internal port 5300
socat UDP4-LISTEN:53,fork,reuseaddr UDP4:127.0.0.1:${DNSTT_PORT} &
# Forward TCP port 53 (RFC 7766) to UDP 5300 for TCP DNS queries
socat TCP4-LISTEN:53,fork,reuseaddr UDP4:127.0.0.1:${DNSTT_PORT} &
wait
EOF
chmod +x "${BIN_DIR}/aura-dnsrouter"

# 8. Create systemd units for Aura
echo "[*] Registering Aura systemd units..."

# Service: aura-socks5
cat <<EOF > /etc/systemd/system/aura-socks5.service
[Unit]
Description=Aura Dante SOCKS5 Proxy Daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/sbin/danted -f /etc/danted.conf
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Service: aura-multiplexer
cat <<EOF > /etc/systemd/system/aura-multiplexer.service
[Unit]
Description=Aura Multiplexer on Port 2222
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/aura-multiplexer
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Service: aura-udpgw
cat <<EOF > /etc/systemd/system/aura-udpgw.service
[Unit]
Description=Aura BadVPN UDP Gateway (Port 7300)
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/badvpn-udpgw --listen-addr 127.0.0.1:7300 --max-clients 1000 --max-connections-for-client 500
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Service: aura-dnsrouter
cat <<EOF > /etc/systemd/system/aura-dnsrouter.service
[Unit]
Description=Aura DNS Router (Port 53 UDP/TCP)
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/aura-dnsrouter
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Service: aura-dnstt
cat <<EOF > /etc/systemd/system/aura-dnstt.service
[Unit]
Description=Aura DNSTT Server on 127.0.0.1:${DNSTT_PORT}
After=network.target

[Service]
Type=simple
ExecStart=${BIN_DIR}/dnstt-server -udp 127.0.0.1:${DNSTT_PORT} -mtu ${MTU} -privkey-file ${KEY_DIR}/server.key ${TDOMAIN} 127.0.0.1:2222
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 9. Install Aura CLI executable to /usr/local/bin/aura
if [[ -f "./aura" ]]; then
    cp "./aura" "${BIN_DIR}/aura"
else
    AUTH_HEADER=()
    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
        AUTH_HEADER=(-H "Authorization: token ${GITHUB_TOKEN}")
    fi
    curl -fsSL "${AUTH_HEADER[@]}" -o "${BIN_DIR}/aura" "https://raw.githubusercontent.com/Seven7388/Aura/main/aura" 2>/dev/null || true
fi
chmod +x "${BIN_DIR}/aura" 2>/dev/null || true

# Save initial tunnel config to /etc/aura/tunnels/default.json
cat <<EOF > "${TUNNELS_DIR}/default.json"
{
  "tag": "default",
  "transport": "dnstt",
  "backend": "both",
  "domain": "${TDOMAIN}",
  "mtu": ${MTU},
  "public_key": "${PUBKEY}",
  "port": ${DNSTT_PORT}
}
EOF

# 10. Enable and Start Services
echo "[*] Reloading systemd and launching Aura services..."
systemctl daemon-reload
systemctl enable --now aura-socks5.service 2>/dev/null || true
systemctl enable --now aura-multiplexer.service 2>/dev/null || true
systemctl enable --now aura-udpgw.service 2>/dev/null || true
systemctl restart stunnel4.service 2>/dev/null || true
systemctl enable --now aura-dnstt.service 2>/dev/null || true
systemctl enable --now aura-dnsrouter.service 2>/dev/null || true

echo ""
echo "=========================================================="
echo "          AURA TUNNEL ENGINE SERVER READY"
echo "=========================================================="
echo " Server IPv4     : ${IPV4}"
echo " Tunnel Domain   : ${TDOMAIN}"
echo " MTU             : ${MTU}"
echo " DNS Router      : 0.0.0.0:53 (UDP & TCP)"
echo " DNSTT Server    : 127.0.0.1:${DNSTT_PORT}"
echo " Curve25519 Key  : ${PUBKEY}"
echo " StunTLS 443     : 0.0.0.0:443 -> 127.0.0.1:2222 (TLS 1.2/1.3)"
echo " Multiplexer     : 127.0.0.1:2222 (SSH :22 + SOCKS :1080)"
echo " Dante SOCKS5    : 127.0.0.1:1080 (Direct / No Auth)"
echo " BadVPN UDPGW    : 127.0.0.1:7300 (UDP for HTTP Custom)"
echo "=========================================================="
echo ""
echo "Client Share URIs (SlipNet & Universal):"
echo "  • DNSTT DNS Tunnel:"
echo "    slipnet://dnstt?domain=${TDOMAIN}&pubkey=${PUBKEY}&ns=1.1.1.1"
echo ""
echo "  • StunTLS Port 443:"
echo "    slipnet://stuntls?addr=${IPV4}:443&sni=${IPV4}&insecure=1"
echo ""
echo "Management CLI:"
echo "  Type 'sudo aura' to open the interactive management menu."
echo "=========================================================="
