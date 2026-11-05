# Aura

> **Unified Tunnel & Server Management Suite for Linux**  
> Orchestrates DNS tunnels (DNSTT, NoizDNS, Slipstream, VayDNS, Soar), HTTPS/TLS proxies (NaiveProxy, StunTLS on port 443), BadVPN UDP gateways, and multi-user authentication through a single automated management CLI.

---

## Features

- **Multi-Transport Support**:
  - **DNSTT & NoizDNS**: Curve25519-encrypted DNS tunneling with anti-censorship DPI evasion, base36/hex encoding, and CDN prefix stripping.
  - **Slipstream**: QUIC-based DNS tunnel with TLS certificate authentication.
  - **VayDNS**: KCP-based UDP DNS tunnel with Curve25519 cryptography, customizable record types (TXT, A, AAAA), and queue sizing.
  - **Soar**: Multipath DNS tunnel built into the manager with both **Direct** (dial public destinations) and **SSH** backend modes.
  - **NaiveProxy**: Caddy forward-proxy with automated Let's Encrypt TLS and probe-resistant decoy websites.
  - **StunTLS**: SSH and WebSocket over TLS on port 443 with TLS 1.2/1.3 enforcement and traffic obfuscation.
- **Dual Backend Routing**:
  - Built-in Dante & Go SOCKS5 proxies (`127.0.0.1:1080`) with optional or zero authentication.
  - OpenSSH port forwarding (`127.0.0.1:22`).
  - Automated Protocol Multiplexer (`127.0.0.1:2222`) that inspects traffic and routes to SSH or SOCKS.
- **BadVPN UDPGW**:
  - UDP Gateway listening on `127.0.0.1:7300` for gaming and VoIP in HTTP Custom, HTTP Injector, and SSH VPN apps.
- **Domain-Based DNS Routing**:
  - Unified listener on port 53 (UDP & RFC 7766 TCP) with automated subdomain dispatch.
- **Interactive TUI & Scriptable CLI**:
  - Run `sudo aura` for the visual menu, or run scriptable subcommands (`aura tunnel add`, `aura diag`, `aura stats`, `aura users bulk_add`).
- **One-Tap Client Export**:
  - Generates `slipnet://` URIs compatible with SlipNet Android VPN and universal client profiles.

---

## Architecture

```
                       ┌─────────────────────────┐
                       │   SlipNet / VPN Client  │
                       └────────────┬────────────┘
                                    │
              DNS :53 (UDP+TCP) ────┼────── HTTPS / TLS :443 (TCP)
                    │               │               │
┌───────────────────┼───────────────┼───────────────┼──────────────────┐
│  AURA SERVER      ▼               │               ▼                  │
│                                   │                                  │
│  ┌────────────────────────────┐   │   ┌───────────────────────────┐  │
│  │      Aura DNS Router       │   │   │     Aura StunTLS          │  │
│  │   domain-based dispatch    │   │   │   TLS 1.2/1.3 Obfuscation │  │
│  │   port 53 (UDP + TCP)      │   │   │   port 443 -> :2222       │  │
│  └────────┬───────────┬───────┘   │   └─────────────┬─────────────┘  │
│           │           │           │                 │                │
│     ┌─────┴─────┐ ┌───┴─────┐     │                 ▼                │
│     │ DNSTT /   │ │ Slip-   │     │   ┌───────────────────────────┐  │
│     │ NoizDNS   │ │ stream  │     │   │   Protocol Multiplexer    │  │
│     │ Curve25519│ │ QUIC/DNS│     │   │   port 2222               │  │
│     └─────┬─────┘ └───┬─────┘     │   └─────────────┬─────────────┘  │
│           │           │           │                 │                │
│           ▼           ▼           │                 │                │
│  ┌────────────────────────────┐   │                 │                │
│  │        Backend Layer       │◄──┴─────────────────┘                │
│  │                                                                   │
│  │  ┌───────────────────────┐       ┌─────────────────────────────┐  │
│  │  │   Dante SOCKS5 Proxy  │       │       OpenSSH Server        │  │
│  │  │   127.0.0.1:1080      │       │       127.0.0.1:22          │  │
│  │  └───────────────────────┘       └─────────────────────────────┘  │
│  │                                                                   │
│  │  ┌─────────────────────────────────────────────────────────────┐  │
│  │  │   BadVPN UDP Gateway: 127.0.0.1:7300 (VoIP & UDP for SSH)   │  │
│  │  └─────────────────────────────────────────────────────────────┘  │
│  └────────────────────────────┬──────────────────────────────────────┘
│                               ▼
│                       Public Internet
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start (One-Liner Install)

Run the automated installer on your Ubuntu or Debian VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/Seven7388/Aura/main/aura-installer.sh | sudo bash
```

> **Note for Private Repository**: If your repository is set to Private on GitHub, provide your GitHub Personal Access Token:
> ```bash
> curl -fsSL -H "Authorization: token YOUR_GITHUB_TOKEN" \
>   https://raw.githubusercontent.com/Seven7388/Aura/main/aura-installer.sh | sudo bash
> ```
> Or clone and run locally:
> ```bash
> git clone https://github.com/Seven7388/Aura.git
> cd Aura && sudo bash aura-installer.sh
> ```

Once installed, launch the interactive manager anytime:

```bash
sudo aura
```

---

## CLI Reference

Aura can be operated via its interactive menu or using scriptable CLI commands:

```bash
aura                          # Launch interactive TUI menu
aura diag                     # Run complete health check (ports, services, certificates)
aura stats                    # Live real-time dashboard (CPU, RAM, active connections)
aura mtu 1232                 # Update MTU size for all active DNS tunnels
aura restart                  # Restart all Aura systemd services

# User Management
aura users list               # List all registered proxy/SSH users
aura users add                # Add a single user with custom credentials
aura users bulk_add --count=20 # Bulk generate users with random passwords
aura users remove <user>      # Remove a user
aura users configs            # Print all client configuration URIs (slipnet://)

# Tunnel Orchestration
aura tunnel add               # Add a new tunnel (DNSTT, Slipstream, VayDNS, Soar)
aura tunnel status            # Display all configured tunnels and parameters
aura tunnel share <tag>       # Generate shareable slipnet:// URI for a specific tunnel
aura tunnel remove <tag>      # Remove a tunnel profile and stop its daemon

# Configuration & Backup
aura backup [path]            # Create compressed archive of /etc/aura
aura restore <path>           # Restore server keys, certs, and configs from backup
```

---

## Domain Configuration

To connect via DNS tunnels, configure the following records in your DNS manager (e.g., Cloudflare):

| Type | Name | Target / IP | Proxy Status |
| :--- | :--- | :--- | :--- |
| **A** | `ns-aura.yourdomain.com` | `<Server IPv4>` | **DNS Only (Grey Cloud)** |
| **NS** | `t.yourdomain.com` | `ns-aura.yourdomain.com` | **DNS Only (Grey Cloud)** |
| **A** | `yourdomain.com` | `<Server IPv4>` | **DNS Only (Grey Cloud)** |

---

## File Locations

| Path | Purpose |
| :--- | :--- |
| `/usr/local/bin/aura` | Central Aura CLI and TUI management executable |
| `/etc/aura/config.json` | Master daemon settings and port configuration |
| `/etc/aura/tunnels/` | Per-tunnel configurations, Curve25519 keys, and parameters |
| `/etc/aura/certs/` | StunTLS 443 certificates (`stuntls.pem`) |
| `/var/log/aura/` | Aura service logs |
| `/etc/systemd/system/aura-*.service` | Systemd service units managed by Aura |

---

## License

AGPL-3.0. Built for resilience and secure network freedom.
