# Publishing Aura releases (your GitHub)

This project is **yours**. Install downloads helper binaries only from:

`https://github.com/Sixbravo7388/aura/releases`

Nothing is fetched from SlipGate or any other third-party release page.

## 1. Create the GitHub repo

1. Log in as **Sixbravo7388**
2. New repository → name: `aura` → Public (or Private)
3. Do **not** add a README (you already have one)

## 2. Push this source

```bash
cd aura
git init
git add .
git commit -m "Aura — initial release"
git branch -M main
git remote add origin https://github.com/Sixbravo7388/aura.git
git push -u origin main
```

If your GitHub username is different, replace `Sixbravo7388` everywhere:

```bash
grep -rl 'Sixbravo7388' --include='*.go' --include='*.md' --include='*.sh' --include='Makefile' --include='go.mod' \
  | xargs sed -i 's/Sixbravo7388/YOUR_USERNAME/g'
```

## 3. Build the main binary

```bash
# Linux amd64 (typical VPS)
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags "-s -w" -o aura-linux-amd64 .

# Optional: compress
upx --best --lzma aura-linux-amd64
```

## 4. Helper binaries (required for online `aura install`)

`aura install` expects these **exact asset names** on the latest GitHub Release:

| Asset name | Purpose |
|------------|---------|
| `aura-linux-amd64` | Main manager (this program) |
| `aura-linux-arm64` | Optional ARM64 build |
| `dnstt-server-linux-amd64` | DNSTT / NoizDNS server |
| `dnstt-server-linux-arm64` | optional |
| `slipstream-server-linux-amd64` | Slipstream server |
| `slipstream-server-linux-arm64` | optional |
| `vaydns-server-linux-amd64` | VayDNS server |
| `vaydns-server-linux-arm64` | optional |
| `caddy-naive-linux-amd64` | NaiveProxy (Caddy + naive plugin) |
| `caddy-naive-linux-arm64` | optional |

You must **build or obtain** those helpers and upload them to **your** release. They are separate open-source tools; Aura only orchestrates them.

Until your release exists, use offline install on the server:

```bash
# put the four *-linux-amd64 helpers in a folder, then:
sudo aura install --bin-dir /path/to/that/folder
```

## 5. Create a GitHub Release

1. GitHub → your `aura` repo → **Releases** → **Draft a new release**
2. Tag: `v1.0.0` (or any version)
3. Upload all assets listed above
4. Publish

After that:

```bash
curl -fsSL https://raw.githubusercontent.com/Sixbravo7388/aura/main/install.sh | sudo bash
# or
sudo aura install
```

will download from **your** releases only.

## 6. Client URIs

- New shares use `auranet://…`
- Older SlipNet apps still accept `slipnet://…` (same payload) for compatibility
