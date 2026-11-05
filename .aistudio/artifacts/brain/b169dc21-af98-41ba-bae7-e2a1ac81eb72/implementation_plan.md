# Aura — Unified Tunnel & Server Management Suite

Aura is a server management suite and tunnel orchestrator for Linux systems, refactoring and rebranding the upstream SlipGate codebase into a custom, standalone solution. It coordinates DNS tunnels (DNSTT, NoizDNS, Slipstream, VayDNS, and built-in Soar), HTTPS/TLS proxies (NaiveProxy with Caddy, StunTLS on 443 with TLS 1.2/1.3), UDP gateways (BadVPN UDPGW on 7300), and dual backend routing (SOCKS5 and SSH) through a single automated CLI manager and one-line installer.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the scope: **All tunnels included** with a **Command-line installer and automated server management script** as the primary deliverables. All references, service definitions, CLI entrypoints, configuration directories, and systemd units will transition from `slipgate` to `aura`.

- **Confirmed Branding**: Full brand pivot to `Aura` (`/usr/local/bin/aura`, `/etc/aura/`, systemd units `aura-dnsrouter`, `aura-socks5`, `aura-stuntls`, `aura-udpgw`, and `aura-{tag}`).
- **Tunnel Transports Included**:
  1. **DNSTT / NoizDNS**: Curve25519 DNS tunneling with DPI evasion profiles (Base36/Hex, CDN prefix stripping).
  2. **Slipstream**: QUIC-based high-speed DNS tunnel with TLS certificate handling.
  3. **VayDNS**: KCP-based DNS tunnel with Curve25519 encryption, configurable record types (TXT/A/AAAA), idle timeouts, and queue size.
  4. **Soar**: Multipath DNS tunnel with both **Direct** (no login, dial public ports) and **SSH** backend modes.
  5. **NaiveProxy**: Caddy forward-proxy with automated Let's Encrypt TLS and probe-resistant decoy site support.
  6. **StunTLS**: SSL/TLS on port 443 with WebSocket/HTTP CONNECT auto-multiplexer and strict TLS 1.2/1.3 security.
  7. **Dual Backend**: Built-in Go SOCKS5 daemon (`127.0.0.1:1080`) and OpenSSH port forwarder (`127.0.0.1:22` / `2222`).
  8. **BadVPN UDPGW**: UDP gateway for HTTP Custom, HTTP Injector, and SSH VPN apps (`127.0.0.1:7300`).
- **Client Configuration Format**: Generates both universal `slipnet://` URIs for instant compatibility with Android clients and human-readable Aura configuration export blocks.

---

## 1. Overview & Core Concept

- **What It Does**: Aura provisions, starts, stops, monitors, and shares configurations for all DNS and TLS tunneling protocols on a Linux VPS. It includes an interactive terminal user interface (`aura`), scriptable non-interactive CLI flags (`aura tunnel add ...`, `aura users add ...`, `aura diag`), and an automated one-liner installer (`curl -fsSL ... | sudo bash`).
- **Target Audience / Persona**: Network engineers, privacy advocates, and server administrators operating circumvention infrastructure across restricted network environments.
- **Key Value**: Replaces multiple disconnected manual binaries with an integrated, production-grade Linux management system that manages systemd services, domain-based DNS routing on port 53 (UDP & TCP), and zero-collision port allocation automatically.

---

## 2. User Experience & Visual Design

The web interface serves as the repository hub and control center where operators can inspect, download, customize, and bundle the complete Aura project before deployment to their servers.

### Key User Flows
1. **Repository Hub & Quick Install**: Direct access to the one-liner command `curl -fsSL .../install.sh | sudo bash`, with real-time parameter customizing (domain, MTU, default backend).
2. **Interactive File Inspector & Exporter**:
   - `aura-installer.sh`: Automated bash installer setting up dependencies, binaries, systemd units, and `/etc/aura/`.
   - `aura` (CLI & TUI): Complete interactive server management script containing menus for tunnel management, user provisioning, diagnostics, MTU tuning, backups, and live stats.
   - `README.md`: Up-to-date documentation with architecture diagram, quick start, system requirements, DNS record guide, and CLI cheat sheet.
   - `config.json`: Master configuration schema and default tunnel profiles.
3. **One-Click Repository Bundler**: Download individual scripts or bundle the entire Aura repository as a clean `.tar.gz` / `.zip` archive.

### Visual Identity & Theme
- **Aesthetic Direction**: High-density engineering console with clean dark canvas, disciplined typography, and zero-pill metadata.
- **Color Palette**:
  - Background Canvas: Deep neutral slate (`#0B0F17`)
  - Structural Surfaces: Hairline bordered containers (`#111827`, border `#1F2937`)
  - Accent Tone: Aura Emerald (`#10B981`) for active and verified states, Cobalt Blue (`#3B82F6`) for primary interactive actions.
- **Typography**: `Plus Jakarta Sans` for titles and navigation, paired with `JetBrains Mono` / tabular numerals (`tabular-nums`) for bash scripts, config JSON, ports, and console commands.
- **Top Bar Contract**: Single-row layout: Brand title `AURA TUNNEL ENGINE` on the left, 4 concise navigation tabs (`Installer`, `CLI Script`, `Documentation`, `Architecture`) in the center, and a primary `Export Repository` action on the right.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Standalone Shell Script vs. Precompiled Go Binary**
  - *Chosen Approach*: Deliver both the robust automated shell management engine (`aura`) and the installer script, with modular hooks to download or build the transport binaries (dnstt, slipstream, vaydns, caddy-naive).
  - *Why*: Allows instant deployment on any Debian/Ubuntu server without requiring a local Go toolchain, while maintaining compatibility with systemd and existing binary releases.
- **Decision 2: Rebranding Depth (Paths and Systemd Units)**
  - *Chosen Approach*: Clean separation: configuration moves to `/etc/aura/`, CLI command is `/usr/local/bin/aura`, log files route to `/var/log/aura/`, and systemd units are named `aura-dnsrouter.service`, `aura-socks5.service`, `aura-stuntls.service`, `aura-udpgw.service`, and `aura-{tag}.service`.
  - *Why*: Eliminates all collision with older installations and establishes a clean, unified brand identity.
- **Decision 3: Preserving Protocol Compatibility with SlipNet**
  - *Chosen Approach*: Keep the output configuration format fully compatible with `slipnet://` while labeling the profiles with Aura metadata.
  - *Why*: Android and desktop clients can import tunnels without needing a specialized client fork.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Aura Operator                         │
│       One-Line Install: curl -fsSL ... | sudo bash          │
│       Interactive Menu: sudo aura                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│     Aura Installer Script     │ │      Aura CLI / TUI       │
│      (aura-installer.sh)      │ │   (/usr/local/bin/aura)   │
│ - Dependency provisioning     │ │ - Tunnel add / edit / del │
│ - User & permission setup     │ │ - User batch generator    │
│ - Systemd unit registration   │ │ - Diagnostics & health    │
│ - Directory creation:         │ │ - MTU mass configuration  │
│   /etc/aura/{config,tunnels}  │ │ - Backup & restore        │
└───────────────┬───────────────┘ └─────────────┬─────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Linux Host System                      │
│                                                             │
│  Port 53 (UDP+TCP)  ──► aura-dnsrouter                      │
│                         ├─► DNSTT / NoizDNS (127.0.0.1:5300)│
│                         ├─► Slipstream      (127.0.0.1:5301)│
│                         ├─► VayDNS          (127.0.0.1:5302)│
│                         └─► Soar Multipath  (127.0.0.1:5303)│
│                                                             │
│  Port 443 (TCP)     ──► aura-stuntls / NaiveProxy (Caddy)   │
│                         └─► Multiplexer / SOCKS / SSH       │
│                                                             │
│  Port 7300 (UDP)    ──► aura-udpgw (BadVPN UDP Gateway)     │
│                                                             │
│  Backend Daemons:                                           │
│  - aura-socks5: 127.0.0.1:1080 (No-auth / Multi-user)       │
│  - OpenSSH:     127.0.0.1:22   (SSH forwarding backend)     │
└─────────────────────────────────────────────────────────────┘
```

### Component & File Structure
- `/src/App.tsx`: High-performance Aura Repository Hub with tabbed viewing, syntax copy, configuration builder, and direct file downloaders.
- `/public/aura-installer.sh` & `/aura-installer.sh`: Production-ready installer script.
- `/public/aura` & `/aura`: Full-featured interactive CLI and management program.
- `/public/README.md` & `/README.md`: Complete repository documentation for Aura.
- `/metadata.json`: Updated project name to `Aura Tunnel Engine` with comprehensive description.
