# Aura

Unified tunnel manager for Linux servers. Manages DNS tunnels (DNSTT, NoizDNS, Slipstream, VayDNS, Soar) and HTTPS proxies (NaiveProxy) with systemd services, multi-tunnel DNS routing, and user management. Designed for use with the [AuraNet](https://github.com/Sixbravo7388/AuraNet) Android VPN app.

[![oosmetrics](https://api.oosmetrics.com/api/v1/badge/achievement/12767996-2dd6-42ed-89a6-5f786c4662b4.svg)](https://oosmetrics.com/repo/Sixbravo7388/aura)

## Features

- **Multi-transport**: DNSTT/NoizDNS (DNS tunnels with Curve25519 encryption), Slipstream (QUIC-based DNS), VayDNS (KCP-based DNS with Curve25519), Soar (multipath DNS, built in), NaiveProxy (HTTPS with Caddy), StunTLS (SSH over TLS + WebSocket)
- **Dual backend**: Built-in SOCKS5 proxy or SSH forwarding (custom SSH port supported)
- **DNS routing**: Single-tunnel or multi-tunnel mode with domain-based dispatch
- **External routing**: Forward DNS queries for a domain to a custom port for user-managed protocols
- **WARP integration**: Optional Cloudflare WARP outbound routing (see [dnstun-ezpz](https://github.com/aleskxyz/dnstun-ezpz) for an alternative approach)
- **User management**: Multi-user SSH + SOCKS credentials (all users authenticate simultaneously), with bulk creation of up to 500 users per call
- **Live dashboard**: Real-time TUI with CPU, RAM, traffic sparklines, per-protocol connection stats, and tunnel status
- **Backup & restore**: Move a whole server (config, keys, certificates, users) as one file or as text to copy-paste
- **Diagnostics**: Built-in health checks for services, ports, keys, DNS resolution, and boot persistence
- **Interactive TUI + CLI**: Menu-driven setup or scriptable subcommands
- **Systemd integration**: Service creation, lifecycle, and logs
- **Auto-TLS**: Let's Encrypt via Caddy for NaiveProxy tunnels
- **Self-update**: Version checking and binary replacement from GitHub releases
- **Client sharing**: Generates `auranet://` URIs for one-tap app import

## Requirements

- **OS**: Linux (Ubuntu 20.04+, Debian 10+, or similar)
- **Domain**: DNS A record pointed at your server (required for DNS tunnels and NaiveProxy)
- **Ports**: 53/udp + 53/tcp (DNS tunnels), 443/tcp (NaiveProxy, StunTLS)

## Quick Start

**One-liner install:**

```bash
curl -fsSL https://raw.githubusercontent.com/Sixbravo7388/aura/main/install.sh | sudo bash
```

**Or build from source:**

```bash
git clone https://github.com/Sixbravo7388/aura.git
cd aura
make build
sudo ./aura install
```

**Offline install (SCP to server):**

Download the binaries you need from the [latest release](https://github.com/Sixbravo7388/aura/releases):

```bash
# On your local machine — download binaries
mkdir aura-bundle && cd aura-bundle
curl -LO https://github.com/Sixbravo7388/aura/releases/latest/download/aura-linux-amd64
curl -LO https://github.com/Sixbravo7388/aura/releases/latest/download/dnstt-server-linux-amd64
curl -LO https://github.com/Sixbravo7388/aura/releases/latest/download/slipstream-server-linux-amd64
curl -LO https://github.com/Sixbravo7388/aura/releases/latest/download/caddy-naive-linux-amd64

# SCP to server
scp * user@server:/tmp/aura/

# On the server
chmod +x /tmp/aura/*
sudo cp /tmp/aura/aura-linux-amd64 /usr/local/bin/aura
sudo aura install --bin-dir /tmp/aura
```

Then launch the interactive menu:

```bash
sudo aura
```

## CLI Usage

```
aura                        # Interactive TUI menu
aura install                # Install dependencies and configure server
aura uninstall              # Remove all services, configs, and binaries
aura update                 # Self-update and restart all services
aura restart                # Restart all services (DNS router, tunnels, SOCKS)
aura backup [file]          # Back up config, keys and users (file, or text to copy-paste)
aura restore [file]         # Restore a backup on this server ("-" reads stdin)
aura users                  # Manage SSH/SOCKS users and view configs
aura users add              # Add a single user
aura users bulk_add         # Add multiple users in one batch (random creds, up to 500)
aura users remove           # Remove a user
aura users list             # List users and their per-tunnel configs
aura users configs          # Show every auranet:// config (all tunnels and users, incl. no-login Soar)
aura stats                  # Live dashboard (CPU, RAM, traffic, connections, tunnels)
aura diag                   # Run diagnostics (services, ports, keys, DNS, boot status)
aura mtu [value]            # Set MTU for all DNSTT/NoizDNS/VayDNS tunnels at once

# Tunnel management
aura tunnel add             # Add tunnel(s) — supports multi-select and "both" backend
aura tunnel edit [tag]      # Edit tunnel settings (tag, MTU, keys)
aura tunnel remove [tag]    # Remove a tunnel
aura tunnel remove --all    # Remove all tunnels at once
aura tunnel start [tag]     # Start a tunnel
aura tunnel stop [tag]      # Stop a tunnel
aura tunnel status          # Show all tunnel statuses
aura tunnel status [tag]    # Show tunnel details (keys, MTU, port)
aura tunnel share [tag]     # Generate auranet:// URI for clients
aura tunnel logs [tag]      # View tunnel logs

# DNS routing
aura router status          # Show DNS routing config
aura router mode            # Switch between single/multi mode
aura router switch          # Change active tunnel (single mode)

# Configuration
aura config export          # Print config.json (no keys; use backup to move a server)
aura config import [path]   # Replace config.json (no keys)
aura config address [ip]    # Public IP or hostname for StunTLS/SSH/SOCKS5 configs ("auto" to detect)

# Internal (used by systemd services)
aura dnsrouter serve        # Start DNS router
aura socks serve            # Start built-in SOCKS5 proxy
aura stuntls serve          # Start StunTLS proxy
```

### Non-Interactive Examples

All commands support flags for scripting and automation. If any required flag is omitted, aura falls back to an interactive prompt.

```bash
# DNSTT tunnel
sudo aura tunnel add \
  --transport dnstt \
  --backend socks \
  --tag mydnstt \
  --domain t.example.com

# DNSTT tunnel with custom Curve25519 keys
sudo aura tunnel add \
  --transport dnstt \
  --backend socks \
  --tag mytunnel \
  --domain t.example.com \
  --private-key <64-char-hex> \
  --public-key <64-char-hex>   # optional, validated if provided

# DNSTT with both backends (creates mydnstt-socks + mydnstt-ssh)
sudo aura tunnel add \
  --transport dnstt \
  --backend both \
  --tag mydnstt \
  --domain t.example.com

# VayDNS tunnel (KCP + Curve25519)
sudo aura tunnel add \
  --transport vaydns \
  --backend socks \
  --tag myvaydns \
  --domain v.example.com

# VayDNS with all tuning parameters
sudo aura tunnel add \
  --transport vaydns \
  --backend both \
  --tag myvaydns \
  --domain v.example.com \
  --record-type txt \
  --idle-timeout 10s \
  --keep-alive 2s \
  --clientid-size 2 \
  --queue-size 512

# Soar tunnel (built into aura, no extra binary). Direct backend: no
# login, the server reaches public sites itself (works with stock soar clients)
# Optional: --private-key <base64 Ed25519 seed> to import an existing key
sudo aura tunnel add \
  --transport soar \
  --backend direct \
  --tag mysoar \
  --domain r.example.com \
  --allow-ports 80,443

# Soar with the SSH backend: the server reaches only the SSH server, so each
# person needs their own SSH user (AuraNet; share with 'aura tunnel share')
sudo aura tunnel add \
  --transport soar \
  --backend ssh \
  --tag mysoar-ssh \
  --domain rs.example.com

# Slipstream tunnel
sudo aura tunnel add \
  --transport slipstream \
  --backend ssh \
  --tag myslip \
  --domain s.example.com

# NaiveProxy tunnel
sudo aura tunnel add \
  --transport naive \
  --backend socks \
  --tag myproxy \
  --domain example.com \
  --email admin@example.com \
  --decoy-url https://www.wikipedia.org

# StunTLS tunnel (SSH over TLS + WebSocket)
sudo aura tunnel add \
  --transport stuntls \
  --tag mytls

# External DNS routing (forward queries to a custom port)
sudo aura tunnel add \
  --transport external \
  --tag my-proto \
  --domain j.example.com \
  --port 5301
# Queries for j.example.com route to 127.0.0.1:5301

# Direct SSH / SOCKS5 transports
sudo aura tunnel add --transport direct-ssh --tag myssh
sudo aura tunnel add --transport direct-socks5 --tag mysocks

# Rename a tunnel
sudo aura tunnel edit --tag mydnstt --new-tag my-tunnel

# Change MTU on a DNSTT tunnel
sudo aura tunnel edit --tag mydnstt --mtu 1232

# Set MTU for all DNSTT/NoizDNS/VayDNS tunnels at once (rewrites and restarts each service)
sudo aura mtu 1200

# Tune VayDNS parameters
sudo aura tunnel edit --tag myvaydns \
  --mtu 1232 \
  --record-type txt \
  --idle-timeout 10s \
  --keep-alive 2s \
  --clientid-size 2 \
  --queue-size 512

# View tunnel details (keys, MTU, port, status)
sudo aura tunnel status --tag mydnstt

# Share tunnel config as auranet:// URI
sudo aura tunnel share mydnstt

# Move to a new server: same keys and passwords, so client configs keep working.
# Afterwards point the DNS records (ns.<domain>, NaiveProxy domains) at the new IP.
ssh root@old-server aura backup - | ssh root@new-server aura restore - --yes

# Bulk-add SSH/SOCKS users (random passwords, up to 500 per call)
sudo aura users bulk_add --count=50 --prefix=user
# Creates user001..user050 with random passwords. A single SOCKS reload
# and WARP rule sync runs for the whole batch.
```

## Architecture

```
                       ┌──────────────────┐
                       │  AuraNet Client  │
                       │                  │
                       └────────┬─────────┘
                                │
              DNS :53/udp+tcp ──┼────── HTTPS/TLS :443/tcp
                    │           │           │
┌───────────────────┼───────────┼───────────┼──────────────────┐
│  SERVER           v           │           v                  │
│                               │                              │
│  ┌────────────────────────┐   │   ┌───────────────────────┐  │
│  │      DNS Router        │   │   │     NaiveProxy        │  │
│  │  domain-based dispatch │   │   │  Caddy + Auto-TLS     │  │
│  │  single / multi mode   │   │   │  + decoy website      │  │
│  │  + external routing    │   │   └───────────┬───────────┘  │
│  └──┬────────┬────────┬───┘   │               │              │
│     │        │        │       │   ┌───────────────────────┐  │
│     v        v        v       │   │     StunTLS           │  │
│  ┌──────┐┌────────┐┌──────┐   │   │  SSH over TLS + WS   │  │
│  │DNSTT ││Slip-   ││VayDNS│   │   │  self-signed cert     │  │
│  │NoizDN││stream  ││      │   │   └───────────┬───────────┘  │
│  │──────││────────││──────│   │               │              │
│  │DNS   ││QUIC    ││KCP   │   │               │              │
│  │Curve ││TLS cert││Curve │   │               │              │
│  │25519 ││        ││25519 │   │               │              │
│  └──┬───┘└───┬────┘└──┬───┘   │               │              │
│     └────────┼────────┘       │               │              │
│              │                │               │              │
│              v                v               v              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    Backend Layer                     │    │
│  │                                                      │    │
│  │   ┌──────────────────┐    ┌──────────────────────┐   │    │
│  │   │  SOCKS5 Proxy    │    │   SSH Forwarding     │   │    │
│  │   │  built-in Go     │    │   port forwarding    │   │    │
│  │   │  :1080           │    │   :22 (configurable) │   │    │
│  │   └────────┬─────────┘    └──────────┬───────────┘   │    │
│  │            └─────────┬───────────────┘               │    │
│  └──────────────────────┼───────────────────────────────┘    │
│                         v                                    │
│              ┌──────────────────────┐                        │
│              │   WARP (optional)    │                        │
│              │  Cloudflare outbound │                        │
│              └──────────┬───────────┘                        │
│                         v                                    │
│                    Internet                                  │
└──────────────────────────────────────────────────────────────┘

  systemd: aura-dnsrouter, aura-socks5, aura-{tag}
```

### Transport Types

| Transport | Protocol | Port | Description |
|-----------|----------|------|-------------|
| **DNSTT/NoizDNS** | DNS | 53/udp | Curve25519 encrypted DNS tunnel. A single server serves both DNSTT and NoizDNS clients. NoizDNS adds DPI evasion with base36/hex encoding and CDN prefix stripping |
| **Slipstream** | QUIC DNS | 53/udp | QUIC-based tunnel with certificate authentication |
| **VayDNS** | KCP DNS | 53/udp | KCP-based DNS tunnel with Curve25519 encryption. Supports configurable idle timeout, keepalive, queue size, and multiple DNS record types |
| **Soar** | DNS | 53/udp | [Soar](https://github.com/getlantern/soar) multipath DNS tunnel (X25519 + Ed25519-signed handshake), served by aura itself. Soar has no per-user login, so it has two backends. **Direct**: like soar-server, it dials the destination each stream names, limited to public addresses and the allowed ports (default `80,443`, or `any`); anyone who finds the zone can use it, and it works with stock soar clients (zone + base64 public key from `tunnel status`). **SSH**: it reaches only the SSH server, so access goes through SSH users, added and removed one by one. Both export `auranet://` configs for a AuraNet version with Soar support |
| **NaiveProxy** | HTTPS | 443/tcp | Caddy with forwardproxy plugin. Auto-TLS via Let's Encrypt. Probe-resistant with decoy site |
| **StunTLS** | TLS/WSS | 443/tcp | SSH over TLS + WebSocket proxy. Auto-detects WebSocket, HTTP CONNECT, raw TLS, and payload (DPI bypass) modes. Self-signed TLS cert, no domain required |
| **External** | DNS | 53/udp | Routes DNS queries for a domain to a user-specified UDP port. No managed service — use for custom/private protocol testing |

### Domain Layout

Each DNS tunnel instance requires its own subdomain. When using both SOCKS and SSH backends, the install auto-generates subdomains by appending `s` to the SSH variant:

| Tunnel | Domain | Backend |
|--------|--------|---------|
| dnstt-socks | `t.example.com` | SOCKS5 |
| dnstt-ssh | `ts.example.com` | SSH |
| slipstream-socks | `s.example.com` | SOCKS5 |
| slipstream-ssh | `ss.example.com` | SSH |
| vaydns-socks | `v.example.com` | SOCKS5 |
| vaydns-ssh | `vs.example.com` | SSH |
| soar-direct | `r.example.com` | Direct (dials client destinations) |
| soar-ssh | `rs.example.com` | SSH |
| naive-socks | `example.com` | SOCKS5 (shared domain) |
| naive-ssh | `example.com` | SSH (shared domain) |

NaiveProxy tunnels share a domain since they use HTTPS (port 443), not DNS. DNSTT and NoizDNS also share a domain — the same server handles both client types.

**Required DNS records** (for the example above):

```
A   ns.example.com       → <server IP>
NS  t.example.com        → ns.example.com
NS  ts.example.com       → ns.example.com
NS  s.example.com        → ns.example.com
NS  ss.example.com       → ns.example.com
NS  v.example.com        → ns.example.com
NS  vs.example.com       → ns.example.com
A   example.com           → <server IP>
```

### Routing Modes

- **Single mode**: One active tunnel runs; DNS router on port 53 forwards to it
- **Multi mode**: All tunnels run on local ports; DNS router on port 53 dispatches queries by domain. Auto-enabled when multiple DNS tunnels are created.

The DNS router answers on both UDP and TCP port 53. Queries arriving over TCP (RFC 7766, pipelined) are forwarded to the tunnel over UDP and the answers returned on the same TCP connection, so every DNS tunnel works for resolvers and clients that use TCP/53 (e.g. Soar clients on networks that block UDP/53), with no change to the tunnel servers.

## Client Configuration

After creating a tunnel, generate a shareable config:

```bash
sudo aura tunnel share mytunnel
```

This outputs a `auranet://` URI that can be scanned or imported into the AuraNet Android app. For DNSTT tunnels, you'll be asked to choose between a DNSTT or NoizDNS client profile — both connect to the same server, but NoizDNS profiles enable DPI evasion on the client side.

To print every config at once, for all tunnels and users (also in the menu under **Users → Show all configs**):

```bash
sudo aura users configs
```

### Server address (Oracle, AWS, GCP, Azure)

StunTLS, direct SSH and direct SOCKS5 configs carry the server's IP, since clients connect to it directly. Cloud servers only see a private IP (e.g. `10.0.0.5`) on their network interface, so aura looks for the public one: the server's own IP when it is public, otherwise the IP that `ns.<your domain>` or a NaiveProxy domain points at. If it finds none, it asks once and saves the answer. Set or change it at any time (also in the menu under **Tunnels → Server address**):

```bash
sudo aura config address 203.0.113.7   # an IP or hostname, without a port
sudo aura config address auto          # detect it again
```

Configs for DNS tunnels, Soar and NaiveProxy connect by domain and don't depend on it.

### User Model

Users are **global**, not scoped to specific tunnels or transports. `aura users add` only asks for a username and password — the protocol is a property of the tunnel, chosen at `tunnel add` time. Every user can authenticate against every tunnel using the same credentials, and `aura users list` prints one config block per (user × tunnel) pair. `aura users configs` prints them all at once, together with the configs that need no login (Soar with the direct backend), which belong to no user. The client picks which tunnel to use by importing the matching `auranet://` URI.

## File Locations

| Path | Description |
|------|-------------|
| `/etc/aura/config.json` | Main configuration |
| `/etc/aura/tunnels/` | Per-tunnel keys, certs, and configs |
| `/usr/local/bin/aura` | Aura binary (includes built-in SOCKS5 proxy) |
| `/usr/local/bin/dnstt-server` | DNSTT transport binary |
| `/usr/local/bin/slipstream-server` | Slipstream transport binary |
| `/usr/local/bin/vaydns-server` | VayDNS transport binary |
| `/usr/local/bin/caddy-naive` | Caddy with NaiveProxy plugin |

## Building

```bash
make build              # Build for current platform
make build-linux        # Cross-compile for linux/amd64 and linux/arm64
make test               # Run tests
make release            # Build release binaries
```

## Credits

Aura builds on these projects:

- [dnstt](https://www.bamsoftware.com/software/dnstt/) by David Fifield - the DNS tunnel behind the DNSTT and NoizDNS transports, via the [tladesignz/dnstt](https://github.com/tladesignz/dnstt) fork (public domain / CC0)
- [Slipstream](https://github.com/EndPositive/slipstream) by [EndPositive](https://github.com/EndPositive) and its Rust rewrite [slipstream-rust](https://github.com/Mygod/slipstream-rust) by [Mygod](https://github.com/Mygod) - the QUIC-over-DNS tunnel behind the Slipstream transport (Apache-2.0)
- [VayDNS](https://github.com/net2share/vaydns) by [net2share](https://github.com/net2share) - the KCP-based DNS tunnel behind the VayDNS transport (CC0)
- [Soar](https://github.com/getlantern/soar) by [Lantern](https://github.com/getlantern) - the multi-resolver DNS tunnel behind the Soar transport, built into aura (Apache-2.0)
- [dnstm](https://github.com/net2share/dnstm) by [net2share](https://github.com/net2share) - the DNS tunnel manager Aura was originally built on
- WARP integration inspired by [dnstun-ezpz](https://github.com/aleskxyz/dnstun-ezpz) by [aleskxyz](https://github.com/aleskxyz)

## License

AGPL-3.0
