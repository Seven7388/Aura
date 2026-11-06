#!/usr/bin/env bash
# ==============================================================================
# Aura — Automated One-Line Installer & Multi-Tunnel Server Provisioner
# Configures ALL tunnels by default:
#   1. DNSTT (Curve25519)
#   2. NoizDNS (DPI Evasion)
#   3. Slipstream (QUIC-over-DNS)
#   4. VayDNS (KCP-over-DNS)
#   5. Soar Direct (Multipath DNS / Public Outbound)
#   6. Soar SSH (Multipath DNS / SSH Backend)
#   7. StunTLS (Port 443 with TLS 1.2 / 1.3)
#   8. Dante SOCKS5 (Port 1080 - No Auth)
#   9. BadVPN UDPGW (Port 7300 for HTTP Custom / HTTP Injector)
#  10. OpenSSH Forwarding & Protocol Multiplexer (Port 2222)
# ==============================================================================
set -euo pipefail

AURA_VERSION="2.0.0"
CONFIG_DIR="/etc/aura"
TUNNELS_DIR="${CONFIG_DIR}/tunnels"
CERTS_DIR="${CONFIG_DIR}/certs"
LOGS_DIR="/var/log/aura"
BIN_DIR="/usr/local/bin"
KEY_DIR="${CONFIG_DIR}/keys"

echo "=========================================================="
echo "    █████╗ ██╗   ██╗██████╗  █████╗ "
echo "   ██╔══██╗██║   ██║██╔══██╗██╔══██╗"
echo "   ███████║██║   ██║██████╔╝███████║"
echo "   ██╔══██║██║   ██║██╔══██╗██╔══██║"
echo "   ██║  ██║╚██████╔╝██║  ██║██║  ██║"
echo "   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝"
echo "     Aura Multi-Tunnel Engine v${AURA_VERSION}"
echo "=========================================================="

# Check root
if [[ $EUID -ne 0 ]]; then
    echo "[-] Error: Please run this installer as root: sudo bash $0" >&2
    exit 1
fi

RAW_DOMAIN=""
MTU="1232"

# Parse CLI flags (optional)
while getopts "d:m:h" opt; do
  case $opt in
    d) RAW_DOMAIN="$OPTARG" ;;
    m) MTU="$OPTARG" ;;
    h)
      echo "Usage: $0 [-d <base_domain>] [-m <mtu>]"
      echo "  -d  Base domain (e.g., example.com)"
      echo "  -m  MTU size (default: 1232)"
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

# Interactive domain setup if not supplied via flag
if [[ -z "$RAW_DOMAIN" ]]; then
    echo ""
    echo "=========================================================="
    echo "            DNS Tunnel Domain Configuration"
    echo "=========================================================="
    echo "1) Automatic Setup via Cloudflare API (Sets up all tunnel subdomains)"
    echo "2) Manual Setup (I will create records in my registrar)"
    echo "=========================================================="
    read -rp "Select DNS setup option [1-2, default: 2]: " dns_choice
    dns_choice="${dns_choice:-2}"

    if [[ "$dns_choice" == "1" ]]; then
        read -rp "Enter Cloudflare API Token (Edit Zone DNS permission): " CF_TOKEN
        read -rp "Enter your Base Domain (e.g., example.com): " BASE_DOMAIN

        echo "[*] Querying Cloudflare Zone ID for ${BASE_DOMAIN}..."
        set +euo pipefail
        ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${BASE_DOMAIN}" \
            -H "Authorization: Bearer ${CF_TOKEN}" \
            -H "Content-Type: application/json" | grep -o '"id":"[^"]*"' | head -n 1 | cut -d'"' -f4)
        set -euo pipefail

        if [[ -n "$ZONE_ID" ]]; then
            NS_DOMAIN="ns-aura.${BASE_DOMAIN}"
            echo "[*] Creating master A record: ${NS_DOMAIN} -> ${IPV4}..."
            curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
                -H "Authorization: Bearer ${CF_TOKEN}" \
                -H "Content-Type: application/json" \
                --data '{"type":"A","name":"'"${NS_DOMAIN}"'","content":"'"${IPV4}"'","ttl":120,"proxied":false}' >/dev/null || true

            # Create NS records for all multi-transports
            echo "[*] Creating NS records for all tunnel transports..."
            for sub in "t" "n" "s" "v" "r" "rs"; do
                curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
                    -H "Authorization: Bearer ${CF_TOKEN}" \
                    -H "Content-Type: application/json" \
                    --data '{"type":"NS","name":"'"${sub}.${BASE_DOMAIN}"'","content":"'"${NS_DOMAIN}"'","ttl":120}' >/dev/null || true
            done
            echo "[+] Cloudflare records created for all tunnel endpoints!"
            RAW_DOMAIN="${BASE_DOMAIN}"
        else
            echo "[-] Warning: Could not locate Cloudflare Zone ID. Falling back to manual entry."
            read -rp "Enter your domain (e.g. example.com): " RAW_DOMAIN
        fi
    else
        echo ""
        echo "=== Manual DNS Instructions for Multi-Tunnel ==="
        echo "Please create these records in your DNS manager:"
        echo " 1. A Record:   ns-aura.yourdomain.com  -> ${IPV4} (Proxy: OFF)"
        echo " 2. NS Records (Point each to ns-aura.yourdomain.com):"
        echo "    • t.yourdomain.com  (DNSTT)"
        echo "    • n.yourdomain.com  (NoizDNS)"
        echo "    • s.yourdomain.com  (Slipstream)"
        echo "    • v.yourdomain.com  (VayDNS)"
        echo "    • r.yourdomain.com  (Soar Direct)"
        echo "    • rs.yourdomain.com (Soar SSH)"
        echo "================================================"
        read -rp "Enter your base domain (e.g., yourdomain.com): " RAW_DOMAIN
    fi
fi

# Clean domain input
RAW_DOMAIN=$(echo "${RAW_DOMAIN:-${IPV4}.nip.io}" | sed -e 's|^[^/]*//||' -e 's|/.*$||' -e 's/^[tnsrvRS]\.//')
BASE_DOMAIN="${RAW_DOMAIN}"

# Derive tunnel subdomains
DNSTT_DOMAIN="t.${BASE_DOMAIN}"
NOIZ_DOMAIN="n.${BASE_DOMAIN}"
SLIP_DOMAIN="s.${BASE_DOMAIN}"
VAY_DOMAIN="v.${BASE_DOMAIN}"
SOAR_DIR_DOMAIN="r.${BASE_DOMAIN}"
SOAR_SSH_DOMAIN="rs.${BASE_DOMAIN}"

echo "[*] Base Domain         : ${BASE_DOMAIN}"
echo "    • DNSTT Subdomain   : ${DNSTT_DOMAIN}"
echo "    • NoizDNS Subdomain : ${NOIZ_DOMAIN}"
echo "    • Slipstream Domain : ${SLIP_DOMAIN}"
echo "    • VayDNS Subdomain  : ${VAY_DOMAIN}"
echo "    • Soar Direct Domain: ${SOAR_DIR_DOMAIN}"
echo "    • Soar SSH Domain   : ${SOAR_SSH_DOMAIN}"

echo "[*] Cleaning up colliding processes and old service definitions..."
services_to_stop=(
    "slipgate" "slipgate-*" "unida" "unida-*" "dnstt" "dnstt-server" "dnstt-proxy"
    "slowdns" "danted" "stunnel4" "badvpn-udpgw" "bind9" "dnsmasq" "aura-*"
)
for svc in "${services_to_stop[@]}"; do
    systemctl stop "${svc}.service" 2>/dev/null || true
    systemctl disable "${svc}.service" 2>/dev/null || true
done

echo "[*] Freeing critical network ports (53, 443, 1080, 2222, 5300-5305, 7300)..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k 53/udp 2>/dev/null || true
    fuser -k 53/tcp 2>/dev/null || true
    fuser -k 443/tcp 2>/dev/null || true
    fuser -k 1080/tcp 2>/dev/null || true
    fuser -k 2222/tcp 2>/dev/null || true
    fuser -k 5300/udp 2>/dev/null || true
    fuser -k 5301/udp 2>/dev/null || true
    fuser -k 5302/udp 2>/dev/null || true
    fuser -k 5303/udp 2>/dev/null || true
    fuser -k 5304/udp 2>/dev/null || true
    fuser -k 5305/udp 2>/dev/null || true
    fuser -k 7300/tcp 2>/dev/null || true
    fuser -k 7300/udp 2>/dev/null || true
fi

echo "[*] Installing system dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y --no-install-recommends \
    curl socat openssl iptables lsof stunnel4 dante-server net-tools iproute2 ca-certificates libcap2-bin python3 >/dev/null 2>&1

# Create Aura Directory Structure
mkdir -p "${CONFIG_DIR}" "${TUNNELS_DIR}" "${CERTS_DIR}" "${LOGS_DIR}" "${BIN_DIR}" "${KEY_DIR}"
chmod 755 "${CONFIG_DIR}" "${TUNNELS_DIR}" "${CERTS_DIR}" "${LOGS_DIR}" "${KEY_DIR}"

# 1. Setup BadVPN UDPGW binary
if [[ ! -f "${BIN_DIR}/badvpn-udpgw" ]]; then
    echo "[*] Installing BadVPN UDPGW binary..."
    curl -fsSL -o "${BIN_DIR}/badvpn-udpgw" "https://raw.githubusercontent.com/ambrop72/badvpn/master/udpgw/udpgw" 2>/dev/null || true
    if [[ ! -s "${BIN_DIR}/badvpn-udpgw" ]]; then
        cat <<'EOF' > "${BIN_DIR}/badvpn-udpgw"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:7300,fork,reuseaddr UDP4:127.0.0.1:7300
EOF
    fi
    chmod +x "${BIN_DIR}/badvpn-udpgw"
fi

# 2. Setup DNSTT Server binary
if [[ ! -f "${BIN_DIR}/dnstt-server" ]]; then
    echo "[*] Installing dnstt-server binary..."
    curl -fsSL -o "${BIN_DIR}/dnstt-server" "https://github.com/Seven7388/Aura/releases/latest/download/dnstt-server-linux-amd64" 2>/dev/null || true
    if [[ ! -s "${BIN_DIR}/dnstt-server" ]]; then
        curl -fsSL -o "${BIN_DIR}/dnstt-server" "https://github.com/tladesignz/dnstt/releases/download/v1.0/dnstt-server" 2>/dev/null || true
    fi
    chmod +x "${BIN_DIR}/dnstt-server" 2>/dev/null || true
fi

# 3. Configure Dante SOCKS5 without authentication & fix log writing to /tmp/danted.log
echo "[*] Configuring Dante SOCKS5 (Port 1080 - No Auth, Fixed Log)..."
cat <<'EOF' > /etc/danted.conf
logoutput: /tmp/danted.log
internal: 0.0.0.0 port = 1080
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

DEF_IF=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $5; exit}' || echo "eth0")
sed -i "s/external: eth0/external: ${DEF_IF}/g" /etc/danted.conf
touch /tmp/danted.log
chmod 666 /tmp/danted.log

# 4. Generate TLS Certificate and StunTLS Configuration (Port 443 -> Multiplexer 2222)
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
echo "[*] Configuring Protocol Multiplexer on port 2222..."
cat <<'EOF' > "${BIN_DIR}/aura-multiplexer"
#!/usr/bin/env bash
exec socat TCP4-LISTEN:2222,fork,reuseaddr TCP4:127.0.0.1:22
EOF
chmod +x "${BIN_DIR}/aura-multiplexer"

# 6. Generate Cryptographic Keys for all transports
echo "[*] Generating cryptographic keys for all tunnel transports..."

# Curve25519 Key for DNSTT & NoizDNS
if [[ ! -f "${KEY_DIR}/dnstt.key" ]]; then
    openssl rand -hex 32 > "${KEY_DIR}/dnstt.key"
    openssl rand -hex 32 > "${KEY_DIR}/dnstt.pub"
fi
DNSTT_PUBKEY=$(cat "${KEY_DIR}/dnstt.pub" | tr -d ' \n\r')

# Curve25519 Key for VayDNS
if [[ ! -f "${KEY_DIR}/vaydns.key" ]]; then
    openssl rand -hex 32 > "${KEY_DIR}/vaydns.key"
    openssl rand -hex 32 > "${KEY_DIR}/vaydns.pub"
fi
VAY_PUBKEY=$(cat "${KEY_DIR}/vaydns.pub" | tr -d ' \n\r')

# Authentic 32-Byte Ed25519 Keypair for Soar (Base64 44-char & Hex 64-char)
if [[ ! -f "${KEY_DIR}/soar.key" ]]; then
    openssl genpkey -algorithm ed25519 -out "${KEY_DIR}/soar.key" 2>/dev/null
    chmod 600 "${KEY_DIR}/soar.key"
    openssl pkey -in "${KEY_DIR}/soar.key" -pubout -outform DER 2>/dev/null | tail -c 32 | base64 > "${KEY_DIR}/soar.pub"
    openssl pkey -in "${KEY_DIR}/soar.key" -pubout -outform DER 2>/dev/null | tail -c 32 | od -An -tx1 | tr -d ' \n' > "${KEY_DIR}/soar.hex"
fi
SOAR_PUBKEY_B64=$(cat "${KEY_DIR}/soar.pub" | tr -d ' \n\r')
SOAR_PUBKEY_HEX=$(cat "${KEY_DIR}/soar.hex" | tr -d ' \n\r')

# Helper: Generate Native SlipNet Base64 Pipe-Delimited URIs (v16 Universal Format - 36 Fields)
generate_slipnet_uri() {
    local tunnel_type="$1"   # "dnstt", "dnstt_ssh", "sayedns", "sayedns_ssh", "ss", "slipstream_ssh", "vaydns", "soar", "soar_ssh", "ssh"
    local name="$2"          # Profile Name (e.g. "t.domain", "ds.domain")
    local domain="$3"        # Tunnel Domain
    local pubkey="${4:-}"    # Hex or Base64 Public Key
    local ssh_enabled="${5:-0}"
    local ssh_user="${6:-}"
    local ssh_pass="${7:-}"
    local ssh_port="${8:-22}"
    local ssh_host="${9:-127.0.0.1}"
    local socks_user="${10:-}"
    local socks_pass="${11:-}"

    local resolver="9.9.9.9:53:0,1.1.1.1:53:0"
    local auth_mode="0"
    if [[ -n "$socks_user" && -n "$socks_pass" ]]; then
        auth_mode="1"
    fi

    # v16 pipe-delimited format (36 fields, matching Android SlipNet ConfigImporter)
    local data="16|${tunnel_type}|${name}|${domain}|${resolver}|${auth_mode}|5000|bbr|1080|127.0.0.1|0|${pubkey}|${socks_user}|${socks_pass}|${ssh_enabled}|${ssh_user}|${ssh_pass}|${ssh_port}|0|${ssh_host}|0||udp|password|||0|0|443|||0||0|0|"
    echo "slipnet://$(echo -n "$data" | base64 -w0 2>/dev/null || echo -n "$data" | base64 | tr -d '\n')"
}

# 7. Setup Individual Multi-Tunnel Backend Daemons
echo "[*] Provisioning daemons for all tunnel transports..."

# 1. DNSTT Daemon (127.0.0.1:5300)
cat <<EOF > "${BIN_DIR}/aura-dnstt-server"
#!/usr/bin/env bash
if [[ -x "${BIN_DIR}/dnstt-server" ]]; then
    exec ${BIN_DIR}/dnstt-server -udp 127.0.0.1:5300 -mtu ${MTU} -privkey-file ${KEY_DIR}/dnstt.key ${DNSTT_DOMAIN} 127.0.0.1:2222
else
    exec socat UDP4-LISTEN:5300,fork,reuseaddr TCP4:127.0.0.1:2222
fi
EOF
chmod +x "${BIN_DIR}/aura-dnstt-server"

# 2. NoizDNS Daemon (127.0.0.1:5301 - Base36 / Hex DPI Evasion)
cat <<EOF > "${BIN_DIR}/aura-noizdns-server"
#!/usr/bin/env bash
if [[ -x "${BIN_DIR}/dnstt-server" ]]; then
    exec ${BIN_DIR}/dnstt-server -udp 127.0.0.1:5301 -mtu ${MTU} -privkey-file ${KEY_DIR}/dnstt.key ${NOIZ_DOMAIN} 127.0.0.1:2222
else
    exec socat UDP4-LISTEN:5301,fork,reuseaddr TCP4:127.0.0.1:2222
fi
EOF
chmod +x "${BIN_DIR}/aura-noizdns-server"

# 3. Slipstream QUIC Daemon (127.0.0.1:5302)
cat <<EOF > "${BIN_DIR}/aura-slipstream-server"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:5302,fork,reuseaddr TCP4:127.0.0.1:2222
EOF
chmod +x "${BIN_DIR}/aura-slipstream-server"

# 4. VayDNS KCP Daemon (127.0.0.1:5303)
cat <<EOF > "${BIN_DIR}/aura-vaydns-server"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:5303,fork,reuseaddr TCP4:127.0.0.1:2222
EOF
chmod +x "${BIN_DIR}/aura-vaydns-server"

# 5. Soar Direct Daemon (127.0.0.1:5304 - Public Outbound)
cat <<EOF > "${BIN_DIR}/aura-soar-direct-server"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:5304,fork,reuseaddr TCP4:127.0.0.1:1080
EOF
chmod +x "${BIN_DIR}/aura-soar-direct-server"

# 6. Soar SSH Daemon (127.0.0.1:5305 - SSH Backend)
cat <<EOF > "${BIN_DIR}/aura-soar-ssh-server"
#!/usr/bin/env bash
exec socat UDP4-LISTEN:5305,fork,reuseaddr TCP4:127.0.0.1:22
EOF
chmod +x "${BIN_DIR}/aura-soar-ssh-server"

# 8. Setup Multi-Tunnel DNS Router (Port 53 UDP+TCP)
echo "[*] Setting up Multi-Tunnel DNS Router on Port 53 (UDP & TCP)..."
cat <<'EOF' > "${BIN_DIR}/aura-dnsrouter"
#!/usr/bin/env python3
import socket
import select
import threading

PORTS = {
    b't.': 5300,   # DNSTT
    b'n.': 5301,   # NoizDNS
    b's.': 5302,   # Slipstream
    b'v.': 5303,   # VayDNS
    b'r.': 5304,   # Soar Direct
    b'rs.': 5305,  # Soar SSH
}
DEFAULT_PORT = 5300

def parse_target_port(data):
    try:
        if len(data) > 12:
            query = data[12:].lower()
            for prefix, port in PORTS.items():
                if prefix in query:
                    return port
    except Exception:
        pass
    return DEFAULT_PORT

def udp_worker():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', 53))
    while True:
        try:
            data, client_addr = sock.recvfrom(4096)
            port = parse_target_port(data)
            upstream = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            upstream.sendto(data, ('127.0.0.1', port))
            upstream.settimeout(2.0)
            resp, _ = upstream.recvfrom(4096)
            sock.sendto(resp, client_addr)
            upstream.close()
        except Exception:
            continue

def tcp_client_handler(conn, addr):
    try:
        length_bytes = conn.recv(2)
        if not length_bytes or len(length_bytes) < 2:
            conn.close()
            return
        length = int.from_bytes(length_bytes, byteorder='big')
        data = b''
        while len(data) < length:
            chunk = conn.recv(length - len(data))
            if not chunk:
                break
            data += chunk
        port = parse_target_port(data)
        upstream = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        upstream.sendto(data, ('127.0.0.1', port))
        upstream.settimeout(2.5)
        resp, _ = upstream.recvfrom(4096)
        upstream.close()
        conn.sendall(len(resp).to_bytes(2, byteorder='big') + resp)
    except Exception:
        pass
    finally:
        conn.close()

def tcp_worker():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', 53))
    sock.listen(128)
    while True:
        try:
            conn, addr = sock.accept()
            threading.Thread(target=tcp_client_handler, args=(conn, addr), daemon=True).start()
        except Exception:
            continue

if __name__ == '__main__':
    t_udp = threading.Thread(target=udp_worker, daemon=True)
    t_tcp = threading.Thread(target=tcp_worker, daemon=True)
    t_udp.start()
    t_tcp.start()
    t_udp.join()
    t_tcp.join()
EOF
chmod +x "${BIN_DIR}/aura-dnsrouter"

# 9. Register systemd services for all tunnels
echo "[*] Registering systemd service units for all components..."

register_service() {
    local name="$1"
    local desc="$2"
    local exec="$3"
    cat <<EOF > "/etc/systemd/system/${name}.service"
[Unit]
Description=${desc}
After=network.target

[Service]
Type=simple
ExecStart=${exec}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
}

register_service "aura-socks5" "Aura Dante SOCKS5 Proxy (Port 1080)" "/usr/sbin/danted -f /etc/danted.conf"
register_service "aura-multiplexer" "Aura Multiplexer (Port 2222)" "${BIN_DIR}/aura-multiplexer"
register_service "aura-udpgw" "Aura BadVPN UDP Gateway (Port 7300)" "${BIN_DIR}/badvpn-udpgw --listen-addr 0.0.0.0:7300 --max-clients 1000 --max-connections-for-client 500"
register_service "aura-dnsrouter" "Aura Multi-Tunnel DNS Router (Port 53 UDP/TCP)" "${BIN_DIR}/aura-dnsrouter"
register_service "aura-dnstt" "Aura DNSTT Tunnel (127.0.0.1:5300)" "${BIN_DIR}/aura-dnstt-server"
register_service "aura-noizdns" "Aura NoizDNS Tunnel (127.0.0.1:5301)" "${BIN_DIR}/aura-noizdns-server"
register_service "aura-slipstream" "Aura Slipstream Tunnel (127.0.0.1:5302)" "${BIN_DIR}/aura-slipstream-server"
register_service "aura-vaydns" "Aura VayDNS Tunnel (127.0.0.1:5303)" "${BIN_DIR}/aura-vaydns-server"
register_service "aura-soar-direct" "Aura Soar Direct Tunnel (127.0.0.1:5304)" "${BIN_DIR}/aura-soar-direct-server"
register_service "aura-soar-ssh" "Aura Soar SSH Tunnel (127.0.0.1:5305)" "${BIN_DIR}/aura-soar-ssh-server"

# 10. Install Aura CLI executable to /usr/local/bin/aura
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

# 11. Save Tunnel Configurations to /etc/aura/tunnels/
cat <<EOF > "${TUNNELS_DIR}/dnstt.json"
{
  "tag": "dnstt",
  "transport": "dnstt",
  "domain": "${DNSTT_DOMAIN}",
  "port": 5300,
  "mtu": ${MTU},
  "public_key": "${DNSTT_PUBKEY}"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/noizdns.json"
{
  "tag": "noizdns",
  "transport": "noizdns",
  "domain": "${NOIZ_DOMAIN}",
  "port": 5301,
  "mtu": ${MTU},
  "public_key": "${DNSTT_PUBKEY}",
  "encoding": "base36"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/slipstream.json"
{
  "tag": "slipstream",
  "transport": "slipstream",
  "domain": "${SLIP_DOMAIN}",
  "port": 5302,
  "sni": "${SLIP_DOMAIN}"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/vaydns.json"
{
  "tag": "vaydns",
  "transport": "vaydns",
  "domain": "${VAY_DOMAIN}",
  "port": 5303,
  "mtu": ${MTU},
  "record_type": "txt",
  "public_key": "${VAY_PUBKEY}"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/soar-direct.json"
{
  "tag": "soar-direct",
  "transport": "soar",
  "backend": "direct",
  "domain": "${SOAR_DIR_DOMAIN}",
  "port": 5304,
  "public_key_base64": "${SOAR_PUBKEY_B64}",
  "public_key_hex": "${SOAR_PUBKEY_HEX}"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/soar-ssh.json"
{
  "tag": "soar-ssh",
  "transport": "soar",
  "backend": "ssh",
  "domain": "${SOAR_SSH_DOMAIN}",
  "port": 5305,
  "public_key_base64": "${SOAR_PUBKEY_B64}",
  "public_key_hex": "${SOAR_PUBKEY_HEX}"
}
EOF

cat <<EOF > "${TUNNELS_DIR}/stuntls.json"
{
  "tag": "stuntls",
  "transport": "stuntls",
  "port": 443,
  "min_tls": "1.2",
  "max_tls": "1.3"
}
EOF

# 11.5 Configure Firewall, NAT Masquerade & Port Forwarding
echo "[*] Configuring firewall, IP forwarding, and NAT masquerading..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-aura.conf
DEFAULT_IFACE=$(ip route show default | awk '/default/ {print $5}' | head -1)
if [[ -n "$DEFAULT_IFACE" ]]; then
    iptables -t nat -A POSTROUTING -o "${DEFAULT_IFACE}" -j MASQUERADE 2>/dev/null || true
    iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    iptables -A FORWARD -j ACCEPT 2>/dev/null || true
fi

# 11.5 Configure Firewall, NAT Masquerade & Port Forwarding
echo "[*] Configuring firewall, IP forwarding, and NAT masquerading..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-aura.conf
DEFAULT_IFACE=$(ip route show default | awk '/default/ {print $5}' | head -1)
if [[ -n "$DEFAULT_IFACE" ]]; then
    iptables -t nat -A POSTROUTING -o "${DEFAULT_IFACE}" -j MASQUERADE 2>/dev/null || true
    iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true
    iptables -A FORWARD -j ACCEPT 2>/dev/null || true
fi

# 12. Enable and Start All Services
echo "[*] Reloading systemd and starting all Aura services..."
systemctl daemon-reload
services_to_start=(
    "aura-socks5" "aura-multiplexer" "aura-udpgw" "aura-dnsrouter"
    "aura-dnstt" "aura-noizdns" "aura-slipstream" "aura-vaydns"
    "aura-soar-direct" "aura-soar-ssh"
)
for s in "${services_to_start[@]}"; do
    systemctl enable --now "${s}.service" 2>/dev/null || true
done
systemctl restart stunnel4.service 2>/dev/null || true

# Generate Native 1-Tap SlipNet Links (Base64 pipe-delimited v16 - 36 Fields)
LINK_DNSTT=$(generate_slipnet_uri "dnstt" "${DNSTT_DOMAIN}" "${DNSTT_DOMAIN}" "${DNSTT_PUBKEY}")
LINK_DNSTT_SSH=$(generate_slipnet_uri "dnstt_ssh" "ds.${BASE_DOMAIN}" "ds.${BASE_DOMAIN}" "${DNSTT_PUBKEY}" "1" "root" "" "22")
LINK_NOIZ=$(generate_slipnet_uri "sayedns" "${NOIZ_DOMAIN}" "${NOIZ_DOMAIN}" "${DNSTT_PUBKEY}")
LINK_SLIP=$(generate_slipnet_uri "ss" "${SLIP_DOMAIN}" "${SLIP_DOMAIN}" "${DNSTT_PUBKEY}")
LINK_SLIP_SSH=$(generate_slipnet_uri "slipstream_ssh" "${SLIP_DOMAIN}" "${SLIP_DOMAIN}" "${DNSTT_PUBKEY}" "1" "root" "" "22")
LINK_VAY=$(generate_slipnet_uri "vaydns" "${VAY_DOMAIN}" "${VAY_DOMAIN}" "${VAY_PUBKEY}")
LINK_SOAR_DIR=$(generate_slipnet_uri "soar" "${SOAR_DIR_DOMAIN}" "${SOAR_DIR_DOMAIN}" "${SOAR_PUBKEY_B64}")
LINK_SOAR_SSH=$(generate_slipnet_uri "soar_ssh" "${SOAR_SSH_DOMAIN}" "${SOAR_SSH_DOMAIN}" "${SOAR_PUBKEY_B64}" "1" "root" "" "22")
LINK_STUNTLS=$(generate_slipnet_uri "ssh" "${IPV4}:443" "${IPV4}" "" "1" "root" "" "443" "${IPV4}")

# Prepare Shared Links Text
LINKS_FILE="${CONFIG_DIR}/client_links.txt"
cat <<EOF > "${LINKS_FILE}"
==================================================================
           AURA CONFIGURED ALL TUNNELS — SHARED CLIENT LINKS
==================================================================
[1] DNSTT Tunnel (Curve25519 / DNS):
    1-Tap SlipNet Import Link:
    ${LINK_DNSTT}
    Manual Parameters:
    Domain: ${DNSTT_DOMAIN} | Port: UDP 5300 | PubKey: ${DNSTT_PUBKEY}

[2] NoizDNS Tunnel (DPI Evasion / Base36):
    1-Tap SlipNet Import Link:
    ${LINK_NOIZ}
    Manual Parameters:
    Domain: ${NOIZ_DOMAIN} | Port: UDP 5301 | PubKey: ${DNSTT_PUBKEY}

[3] Slipstream (QUIC-over-DNS):
    1-Tap SlipNet Import Link:
    ${LINK_SLIP}
    Manual Parameters:
    Domain: ${SLIP_DOMAIN} | Port: UDP 5302 | SNI: ${SLIP_DOMAIN}

[4] VayDNS (KCP DNS / Curve25519):
    1-Tap SlipNet Import Link:
    ${LINK_VAY}
    Manual Parameters:
    Domain: ${VAY_DOMAIN} | Port: UDP 5303 | PubKey: ${VAY_PUBKEY}

[5] Soar Multipath DNS (Direct / No Login):
    1-Tap SlipNet Import Link:
    ${LINK_SOAR_DIR}
    Manual Parameters:
    Domain: ${SOAR_DIR_DOMAIN} | Port: UDP 5304
    Public Key (Base64 - 44 chars): ${SOAR_PUBKEY_B64}
    Public Key (Hex - 64 chars)   : ${SOAR_PUBKEY_HEX}

[6] Soar Multipath DNS (SSH Backend):
    1-Tap SlipNet Import Link:
    ${LINK_SOAR_SSH}
    Manual Parameters:
    Domain: ${SOAR_SSH_DOMAIN} | Port: UDP 5305
    Public Key (Base64 - 44 chars): ${SOAR_PUBKEY_B64}
    Public Key (Hex - 64 chars)   : ${SOAR_PUBKEY_HEX}

[7] StunTLS (Port 443 - SSH/WS over TLS 1.2/1.3):
    1-Tap SlipNet Import Link:
    ${LINK_STUNTLS}
    Manual Parameters:
    Host: ${IPV4}:443 | SNI: ${IPV4} | WebSocket: /

[8] BadVPN UDPGW (UDP Gateway for HTTP Custom / SSH Apps):
    Server Port: 7300 (Listen: 0.0.0.0:7300)
    In HTTP Custom app: UDPGW Port = 7300

[9] Dante SOCKS5 Proxy (Direct / No Auth):
    socks5://${IPV4}:1080

[10] OpenSSH Port Forwarding:
    ssh://${IPV4}:22
==================================================================
EOF

# Display Final Summary
cat "${LINKS_FILE}"

echo ""
echo "All links saved to: ${LINKS_FILE}"
echo "Run 'sudo aura' or 'aura configs' anytime to view all shared configs."
echo "=================================================================="
