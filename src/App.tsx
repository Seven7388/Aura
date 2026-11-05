import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Download, 
  Copy, 
  Check, 
  FileCode, 
  BookOpen, 
  Sliders, 
  Shield, 
  Network, 
  Server, 
  Cpu, 
  Search, 
  FolderArchive,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Lock,
  Globe,
  GitBranch
} from 'lucide-react';
import JSZip from 'jszip';

// Vite raw imports for instant, reliable in-bundle access
import readmeText from '../public/README.md?raw';
import installerText from '../public/aura-installer.sh?raw';
import cliText from '../public/aura?raw';
import configText from '../public/config.json?raw';

type TabKey = 'installer' | 'cli' | 'readme' | 'config';

interface SlipNetOptions {
  version?: '22' | '29';
  tunnelType: string;
  name: string;
  domain: string;
  pubkey?: string;
  sshEnabled?: boolean;
  sshUser?: string;
  sshPass?: string;
  sshPort?: string;
  wsEnabled?: boolean;
}

function buildSlipNetUri(options: SlipNetOptions): string {
  const version = options.version || '22';
  const totalFields = version === '29' ? 82 : 60;
  const fields = new Array(totalFields).fill('');

  fields[0] = version;
  fields[1] = options.tunnelType;
  fields[2] = options.name;
  fields[3] = options.domain;
  fields[4] = '8.8.8.8:53:0';
  fields[5] = '0';
  fields[6] = '5000';
  fields[7] = 'bbr';
  fields[8] = '1080';
  fields[9] = '127.0.0.1';
  fields[10] = '0';
  fields[11] = options.pubkey || '';
  fields[14] = options.sshEnabled ? '1' : '0';
  fields[15] = options.sshUser || '';
  fields[16] = options.sshPass || '';
  fields[17] = options.sshPort || '22';
  fields[18] = '0';
  fields[19] = '127.0.0.1';
  fields[20] = '0';
  fields[22] = 'udp';
  fields[23] = 'password';
  fields[27] = '0';
  fields[28] = '443';
  fields[31] = '0';
  fields[33] = '0';
  fields[34] = '0';
  fields[36] = '0';
  fields[38] = '0';
  fields[39] = '0';
  fields[40] = '1080';
  fields[41] = '0';
  fields[42] = 'txt';
  fields[43] = '101';
  fields[44] = '0';
  fields[45] = '0';
  fields[46] = '0';
  fields[47] = '0';
  fields[48] = '0';
  fields[49] = '0';
  fields[50] = '0';
  fields[53] = '8080';
  fields[55] = options.wsEnabled ? '1' : '0';
  fields[56] = '/';
  fields[57] = '1';

  if (version === '29') {
    fields[60] = 'roundrobin';
    fields[61] = '3';
    fields[63] = 'tls';
    fields[64] = 'ws';
    fields[65] = '/';
    fields[67] = '443';
    fields[68] = '1';
    fields[69] = 'micro';
    fields[70] = '300';
    fields[72] = '0';
    fields[73] = '1';
    fields[74] = '0';
    fields[75] = '8';
    fields[77] = '0';
    fields[79] = '0';
    fields[81] = 'auto';
  }

  const payload = fields.join('|');
  try {
    return `slipnet://${btoa(payload)}`;
  } catch {
    return `slipnet://${payload}`;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('installer');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isZipping, setIsZipping] = useState(false);

  // Repository & quick deploy state
  const [githubRepo, setGithubRepo] = useState('Seven7388/Aura');
  const [githubBranch, setGithubBranch] = useState('main');
  const [clientTestDomain, setClientTestDomain] = useState('t.yourdomain.com');
  const [clientTestIp, setClientTestIp] = useState('127.0.0.1');
  const [githubToken, setGithubToken] = useState('');
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);

  // Active files mapping
  const files: Record<TabKey, { name: string; content: string; desc: string; icon: React.ReactNode }> = {
    installer: {
      name: 'aura-installer.sh',
      content: installerText,
      desc: 'Automated one-liner VPS provisioner & service generator',
      icon: <FileCode className="w-4 h-4 text-emerald-400" />
    },
    cli: {
      name: 'aura',
      content: cliText,
      desc: 'Interactive TUI & command-line server manager executable',
      icon: <Terminal className="w-4 h-4 text-cyan-400" />
    },
    readme: {
      name: 'README.md',
      content: readmeText,
      desc: 'Full project architecture, DNS setup, and operator reference',
      icon: <BookOpen className="w-4 h-4 text-blue-400" />
    },
    config: {
      name: 'config.json',
      content: configText,
      desc: 'Master daemon settings & port dispatching schema',
      icon: <Sliders className="w-4 h-4 text-purple-400" />
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const downloadSingleFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadZipArchive = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();
      zip.file('aura-installer.sh', installerText);
      zip.file('aura', cliText);
      zip.file('README.md', readmeText);
      zip.file('config.json', configText);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'aura-repository.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create ZIP', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Filter content by search query if present
  const currentFile = files[activeTab];
  const displayedContent = useMemo(() => {
    if (!searchQuery.trim()) return currentFile.content;
    const lines = currentFile.content.split('\n');
    const matched = lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
    return matched.length > 0
      ? `# Matches for "${searchQuery}" (${matched.length} lines found):\n\n` + matched.join('\n')
      : `# No lines match "${searchQuery}" in ${currentFile.name}`;
  }, [currentFile, searchQuery]);

  // Clean installer commands without domain flags (interactive on VPS)
  const rawInstallerUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/aura-installer.sh`;
  
  const quickInstallCommand = isPrivateRepo && githubToken.trim()
    ? `curl -fsSL -H "Authorization: token ${githubToken.trim()}" ${rawInstallerUrl} | sudo GITHUB_TOKEN="${githubToken.trim()}" bash`
    : `curl -fsSL ${rawInstallerUrl} | sudo bash`;

  const gitCloneCommand = `git clone https://github.com/${githubRepo}.git && cd Aura && sudo bash aura-installer.sh`;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-200 selection:bg-emerald-500/20 selection:text-emerald-300 font-sans">
      {/* Top Bar Contract (1 row, 3 zones) */}
      <header className="sticky top-0 z-50 bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Shield className="w-4 h-4" />
          </div>
          <a href="/" className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            AURA TUNNEL ENGINE
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a href="#deploy" className="hover:text-emerald-400 transition-colors whitespace-nowrap">Quick Deploy</a>
          <a href="#repository" className="hover:text-emerald-400 transition-colors whitespace-nowrap">File Explorer</a>
          <a href="#clients" className="hover:text-emerald-400 transition-colors whitespace-nowrap">Client Configs</a>
          <a href="#cli" className="hover:text-emerald-400 transition-colors whitespace-nowrap">CLI Commands</a>
          <a href="#architecture" className="hover:text-emerald-400 transition-colors whitespace-nowrap">Architecture</a>
        </nav>

        {/* Zone 3: Primary Action & GitHub Link */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={`https://github.com/${githubRepo}`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
          >
            {isPrivateRepo ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Globe className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{githubRepo}</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
          <button
            onClick={downloadZipArchive}
            disabled={isZipping}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-lg transition-all shadow-lg shadow-emerald-950/40 whitespace-nowrap"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            {isZipping ? 'Packing...' : 'Download Repository (.ZIP)'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Hero Section */}
        <section id="deploy" className="space-y-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="text-emerald-400 font-semibold uppercase tracking-wider">Aura Release v2.0.0</span>
              <span aria-hidden="true">·</span>
              <a href={`https://github.com/${githubRepo}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                <span>{githubRepo}</span>
              </a>
              <span aria-hidden="true">·</span>
              <span>Linux x86_64 / arm64</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
              Unified Server & Tunnel Management Suite
            </h1>
            <p className="text-slate-400 text-base leading-relaxed">
              Coordinates high-performance DNS tunnels (DNSTT, NoizDNS, Slipstream, VayDNS, Soar) and TLS proxies (StunTLS on 443 with TLS 1.2/1.3, NaiveProxy) with automated systemd management, BadVPN UDPGW, and zero-auth Dante SOCKS5.
            </p>
          </div>

          {/* Quick Install Command Box */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Automated VPS One-Liner</span>
                <p className="text-sm text-slate-300">Run this on your server. Domain setup is prompted interactively (no domain needed in repo files).</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPrivateRepo(!isPrivateRepo)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    isPrivateRepo ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Private Repo {isPrivateRepo ? '(Token Enabled)' : ''}</span>
                </button>
              </div>
            </div>

            {/* Optional Private Repo Token Row */}
            {isPrivateRepo && (
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-amber-300">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Private Repository Authentication
                  </span>
                  <span className="text-[11px] text-amber-400/80">GitHub Personal Access Token</span>
                </div>
                <input
                  type="password"
                  placeholder="Paste GitHub Token (ghp_... or github_pat_...) to authorize curl"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-amber-500/40 rounded px-3 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            {/* Curl Command Display */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Method 1: Direct One-Liner (curl)</span>
                <span className="font-mono text-slate-400">{rawInstallerUrl}</span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-[#0B0F17] border border-slate-800/80 rounded-lg p-3.5 font-mono text-xs sm:text-sm text-emerald-400 overflow-x-auto">
                <span className="shrink-0 text-slate-600 select-none">$</span>
                <span className="truncate flex-1 select-all">{quickInstallCommand}</span>
                <button
                  onClick={() => copyToClipboard(quickInstallCommand, 'quick-install')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-sans font-medium transition-colors shrink-0 shadow-sm"
                >
                  {copiedKey === 'quick-install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'quick-install' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Git Clone Alternative */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/50">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Method 2: Git Clone & Run</span>
              </div>
              <div className="flex items-center justify-between gap-3 bg-[#0B0F17] border border-slate-800/80 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                <span className="shrink-0 text-slate-600 select-none">$</span>
                <span className="truncate flex-1 select-all">{gitCloneCommand}</span>
                <button
                  onClick={() => copyToClipboard(gitCloneCommand, 'git-clone')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-sans font-medium transition-colors shrink-0 shadow-sm"
                >
                  {copiedKey === 'git-clone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'git-clone' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Managed Protocols Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-[#111827]/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-slate-400">DNSTT & NoizDNS</span>
              <p className="font-semibold text-white font-mono">Port 53 UDP+TCP</p>
              <p className="text-[11px] text-slate-500">Curve25519 & DPI evasion</p>
            </div>
            <div className="bg-[#111827]/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-slate-400">StunTLS Obfuscation</span>
              <p className="font-semibold text-white font-mono">Port 443 TCP</p>
              <p className="text-[11px] text-slate-500">Strict TLS 1.2 / 1.3</p>
            </div>
            <div className="bg-[#111827]/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-slate-400">BadVPN UDPGW</span>
              <p className="font-semibold text-white font-mono">Port 7300 UDP</p>
              <p className="text-[11px] text-slate-500">HTTP Custom & VoIP</p>
            </div>
            <div className="bg-[#111827]/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-slate-400">SOCKS5 & Multiplexer</span>
              <p className="font-semibold text-white font-mono">Ports 1080 / 2222</p>
              <p className="text-[11px] text-slate-500">Direct No-Auth Backend</p>
            </div>
          </div>
        </section>

        {/* Repository File Explorer Section */}
        <section id="repository" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" /> Repository Files
              </h2>
              <p className="text-sm text-slate-400">Review or extract the source scripts for the Aura project.</p>
            </div>

            {/* Segmented Control for Tabs */}
            <div className="flex items-center gap-1 bg-[#111827] border border-slate-800 p-1 rounded-lg">
              {(Object.keys(files) as TabKey[]).map((tabKey) => {
                const item = files[tabKey];
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    onClick={() => {
                      setActiveTab(tabKey);
                      setSearchQuery('');
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active File Bar */}
          <div className="bg-[#111827] border border-slate-800 rounded-t-xl px-5 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-slate-800/60 text-slate-300">
                {currentFile.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">{currentFile.name}</span>
                  <span className="text-xs text-slate-500">({currentFile.content.split('\n').length} lines)</span>
                </div>
                <p className="text-xs text-slate-400">{currentFile.desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-slate-700/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={() => copyToClipboard(currentFile.content, `file-${activeTab}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
              >
                {copiedKey === `file-${activeTab}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === `file-${activeTab}` ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => downloadSingleFile(currentFile.content, currentFile.name)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Code Viewer Viewport */}
          <div className="bg-[#070A0F] border-x border-b border-slate-800 rounded-b-xl p-4 sm:p-6 overflow-x-auto max-h-[580px] overflow-y-auto">
            <pre className="font-mono text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre font-normal">
              <code>{displayedContent}</code>
            </pre>
          </div>
        </section>

        {/* Client Configurations & Tester */}
        <section id="clients" className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-emerald-400" /> Client Configurations Generator
              </h2>
              <p className="text-xs text-slate-400">Generate one-tap import URIs for the SlipNet Android VPN and desktop clients.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="text-slate-400 flex items-center gap-1.5">
                Base Domain:
                <input
                  type="text"
                  value={clientTestDomain}
                  onChange={(e) => setClientTestDomain(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs w-36"
                  placeholder="yourdomain.com"
                />
              </label>
              <label className="text-slate-400 flex items-center gap-1.5">
                Server IP:
                <input
                  type="text"
                  value={clientTestIp}
                  onChange={(e) => setClientTestIp(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs w-32"
                  placeholder="127.0.0.1"
                />
              </label>
              <button
                onClick={() => {
                  const cleanDomain = clientTestDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^[tnsrvRS]\./, '') || 'yourdomain.com';
                  const dnsttKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
                  const soarB64Key = 'tCd7Qm7FolQBkQfQUWLVrLBktDMirri+SlUaAHT1gxM=';
                  const allLinksText = [
                    '==================================================================',
                    '           AURA CONFIGURED ALL TUNNELS — SHARED CLIENT LINKS',
                    '==================================================================',
                    `[1] DNSTT Tunnel (Curve25519 / DNS):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '22', tunnelType: 'dnstt', name: 'dnstt-aura', domain: `t.${cleanDomain}`, pubkey: dnsttKey })}`,
                    `    Manual: Domain=t.${cleanDomain} | Port=UDP 5300 | PubKey=${dnsttKey}`,
                    ``,
                    `[2] NoizDNS Tunnel (DPI Evasion / Base36):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '22', tunnelType: 'sayedns', name: 'noizdns-aura', domain: `n.${cleanDomain}`, pubkey: dnsttKey })}`,
                    `    Manual: Domain=n.${cleanDomain} | Port=UDP 5301 | PubKey=${dnsttKey}`,
                    ``,
                    `[3] Slipstream (QUIC-over-DNS):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '22', tunnelType: 'ss', name: 'slipstream-aura', domain: `s.${cleanDomain}` })}`,
                    `    Manual: Domain=s.${cleanDomain} | Port=UDP 5302 | SNI=s.${cleanDomain}`,
                    ``,
                    `[4] VayDNS (KCP DNS / Curve25519):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '22', tunnelType: 'vaydns', name: 'vaydns-aura', domain: `v.${cleanDomain}`, pubkey: dnsttKey })}`,
                    `    Manual: Domain=v.${cleanDomain} | Port=UDP 5303 | PubKey=${dnsttKey}`,
                    ``,
                    `[5] Soar Multipath DNS (Direct / No Login):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '29', tunnelType: 'soar', name: 'soar-direct-aura', domain: `r.${cleanDomain}`, pubkey: soarB64Key })}`,
                    `    Manual: Domain=r.${cleanDomain} | Port=UDP 5304`,
                    `    PubKey (Base64 - 44 chars): ${soarB64Key}`,
                    `    PubKey (Hex - 64 chars)   : b4277b426ec5a254019107d05162d5acb874b43322aeb8be4a551a0074f58313`,
                    ``,
                    `[6] Soar Multipath DNS (SSH Backend):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '29', tunnelType: 'soar_ssh', name: 'soar-ssh-aura', domain: `rs.${cleanDomain}`, pubkey: soarB64Key, sshEnabled: true, sshUser: 'root', sshPort: '22' })}`,
                    `    Manual: Domain=rs.${cleanDomain} | Port=UDP 5305`,
                    `    PubKey (Base64 - 44 chars): ${soarB64Key}`,
                    `    PubKey (Hex - 64 chars)   : b4277b426ec5a254019107d05162d5acb874b43322aeb8be4a551a0074f58313`,
                    ``,
                    `[7] StunTLS (Port 443 - SSH/WS over TLS 1.2/1.3):`,
                    `    1-Tap SlipNet Import Link:`,
                    `    ${buildSlipNetUri({ version: '22', tunnelType: 'ssh', name: 'stuntls-aura', domain: clientTestIp, sshEnabled: true, sshUser: 'root', sshPort: '443', wsEnabled: true })}`,
                    `    Manual: Host=${clientTestIp}:443 | SNI=${clientTestIp} | WebSocket=/`,
                    ``,
                    `[8] Dante SOCKS5 Proxy (Direct / No Auth):`,
                    `    socks5://${clientTestIp}:1080`,
                    ``,
                    `[9] BadVPN UDPGW (UDP Gateway for HTTP Custom / SSH Apps):`,
                    `    Host: ${clientTestIp} | UDPGW Port: 7300`,
                    ``,
                    `[10] OpenSSH Port Forwarding:`,
                    `    ssh://${clientTestIp}:22`,
                    '=================================================================='
                  ].join('\n');
                  copyToClipboard(allLinksText, 'copy-all-links');
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition-colors shadow-sm"
              >
                {copiedKey === 'copy-all-links' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'copy-all-links' ? 'All Links Copied!' : 'Copy All Links'}</span>
              </button>
            </div>
          </div>

          {(() => {
            const cleanDomain = clientTestDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^[tnsrvRS]\./, '') || 'yourdomain.com';
            const dnsttHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
            const soarB64Key = 'tCd7Qm7FolQBkQfQUWLVrLBktDMirri+SlUaAHT1gxM=';
            const soarHexKey = 'b4277b426ec5a254019107d05162d5acb874b43322aeb8be4a551a0074f58313';

            const uriDnstt = buildSlipNetUri({ version: '22', tunnelType: 'dnstt', name: 'dnstt-aura', domain: `t.${cleanDomain}`, pubkey: dnsttHexKey });
            const uriNoiz = buildSlipNetUri({ version: '22', tunnelType: 'sayedns', name: 'noizdns-aura', domain: `n.${cleanDomain}`, pubkey: dnsttHexKey });
            const uriSlip = buildSlipNetUri({ version: '22', tunnelType: 'ss', name: 'slipstream-aura', domain: `s.${cleanDomain}` });
            const uriVay = buildSlipNetUri({ version: '22', tunnelType: 'vaydns', name: 'vaydns-aura', domain: `v.${cleanDomain}`, pubkey: dnsttHexKey });
            const uriSoarDir = buildSlipNetUri({ version: '29', tunnelType: 'soar', name: 'soar-direct-aura', domain: `r.${cleanDomain}`, pubkey: soarB64Key });
            const uriSoarSsh = buildSlipNetUri({ version: '29', tunnelType: 'soar_ssh', name: 'soar-ssh-aura', domain: `rs.${cleanDomain}`, pubkey: soarB64Key, sshEnabled: true, sshUser: 'root', sshPort: '22' });
            const uriStunTls = buildSlipNetUri({ version: '22', tunnelType: 'ssh', name: 'stuntls-aura', domain: clientTestIp, sshEnabled: true, sshUser: 'root', sshPort: '443', wsEnabled: true });

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* 1. DNSTT */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider">1. DNSTT (Curve25519)</span>
                    <button
                      onClick={() => copyToClipboard(uriDnstt, 'link-dnstt')}
                      className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-dnstt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-dnstt' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">DNS Tunnel via recursive resolvers (Port 5300)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-emerald-300 break-all select-all border border-emerald-900/30">
                    {uriDnstt}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">t.{cleanDomain}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key: <span className="font-mono text-slate-300">{dnsttHexKey.slice(0, 16)}...</span></span>
                      <button onClick={() => copyToClipboard(dnsttHexKey, 'key-dnstt')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-dnstt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. NoizDNS */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-teal-400 uppercase tracking-wider">2. NoizDNS (DPI Evasion)</span>
                    <button
                      onClick={() => copyToClipboard(uriNoiz, 'link-noiz')}
                      className="px-2 py-0.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-noiz' ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-noiz' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Base36 & CDN prefix stripping (Port 5301)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-teal-300 break-all select-all border border-teal-900/30">
                    {uriNoiz}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">n.{cleanDomain}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key: <span className="font-mono text-slate-300">{dnsttHexKey.slice(0, 16)}...</span></span>
                      <button onClick={() => copyToClipboard(dnsttHexKey, 'key-noiz')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-noiz' ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Slipstream */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sky-400 uppercase tracking-wider">3. Slipstream (QUIC/DNS)</span>
                    <button
                      onClick={() => copyToClipboard(uriSlip, 'link-slip')}
                      className="px-2 py-0.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-slip' ? <Check className="w-3 h-3 text-sky-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-slip' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">QUIC-based encrypted DNS tunnel (Port 5302)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-sky-300 break-all select-all border border-sky-900/30">
                    {uriSlip}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">s.{cleanDomain}</span></div>
                    <div>SNI: <span className="font-mono text-slate-300">s.{cleanDomain}</span></div>
                  </div>
                </div>

                {/* 4. VayDNS */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-400 uppercase tracking-wider">4. VayDNS (KCP)</span>
                    <button
                      onClick={() => copyToClipboard(uriVay, 'link-vay')}
                      className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-vay' ? <Check className="w-3 h-3 text-indigo-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-vay' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">KCP UDP protocol with TXT records (Port 5303)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-indigo-300 break-all select-all border border-indigo-900/30">
                    {uriVay}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">v.{cleanDomain}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key: <span className="font-mono text-slate-300">{dnsttHexKey.slice(0, 16)}...</span></span>
                      <button onClick={() => copyToClipboard(dnsttHexKey, 'key-vay')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-vay' ? <Check className="w-3 h-3 text-indigo-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Soar Direct */}
                <div className="bg-[#0B0F17] border border-purple-500/30 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-400 uppercase tracking-wider">5. Soar Direct (Multipath)</span>
                    <button
                      onClick={() => copyToClipboard(uriSoarDir, 'link-soar-dir')}
                      className="px-2 py-0.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-soar-dir' ? <Check className="w-3 h-3 text-purple-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-soar-dir' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Direct outbound without login (Port 5304)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-purple-300 break-all select-all border border-purple-900/30">
                    {uriSoarDir}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">r.{cleanDomain}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key (Base64 - 44c): <span className="font-mono text-purple-300">{soarB64Key.slice(0, 14)}...</span></span>
                      <button onClick={() => copyToClipboard(soarB64Key, 'key-soar-b64-1')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-soar-b64-1' ? <Check className="w-3 h-3 text-purple-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key (Hex - 64c): <span className="font-mono text-purple-300">{soarHexKey.slice(0, 14)}...</span></span>
                      <button onClick={() => copyToClipboard(soarHexKey, 'key-soar-hex-1')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-soar-hex-1' ? <Check className="w-3 h-3 text-purple-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Soar SSH */}
                <div className="bg-[#0B0F17] border border-fuchsia-500/30 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-fuchsia-400 uppercase tracking-wider">6. Soar SSH</span>
                    <button
                      onClick={() => copyToClipboard(uriSoarSsh, 'link-soar-ssh')}
                      className="px-2 py-0.5 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-soar-ssh' ? <Check className="w-3 h-3 text-fuchsia-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-soar-ssh' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Multipath DNS to SSH backend (Port 5305)</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-fuchsia-300 break-all select-all border border-fuchsia-900/30">
                    {uriSoarSsh}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Zone: <span className="font-mono text-slate-300">rs.{cleanDomain}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key (Base64 - 44c): <span className="font-mono text-fuchsia-300">{soarB64Key.slice(0, 14)}...</span></span>
                      <button onClick={() => copyToClipboard(soarB64Key, 'key-soar-b64-2')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-soar-b64-2' ? <Check className="w-3 h-3 text-fuchsia-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">Key (Hex - 64c): <span className="font-mono text-fuchsia-300">{soarHexKey.slice(0, 14)}...</span></span>
                      <button onClick={() => copyToClipboard(soarHexKey, 'key-soar-hex-2')} className="text-slate-400 hover:text-white">
                        {copiedKey === 'key-soar-hex-2' ? <Check className="w-3 h-3 text-fuchsia-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 7. StunTLS 443 */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-cyan-400 uppercase tracking-wider">7. StunTLS (Port 443)</span>
                    <button
                      onClick={() => copyToClipboard(uriStunTls, 'link-stuntls')}
                      className="px-2 py-0.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-stuntls' ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-stuntls' ? 'Copied' : '1-Tap Link'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Strict TLS 1.2/1.3 Obfuscation to Multiplexer</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-cyan-300 break-all select-all border border-cyan-900/30">
                    {uriStunTls}
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400 space-y-1">
                    <div>Host: <span className="font-mono text-slate-300">{clientTestIp}:443</span></div>
                    <div>SNI: <span className="font-mono text-slate-300">{clientTestIp}</span> | Path: <span className="font-mono text-slate-300">/</span></div>
                  </div>
                </div>

                {/* 8. Dante SOCKS5 */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-400 uppercase tracking-wider">8. Dante SOCKS5 (Port 1080)</span>
                    <button
                      onClick={() => copyToClipboard(`socks5://${clientTestIp}:1080`, 'link-socks5')}
                      className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-socks5' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-socks5' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Direct SOCKS5 proxy without authentication</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-slate-300 break-all select-all border border-slate-800">
                    socks5://{clientTestIp}:1080
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                    Host: <span className="font-mono text-slate-300">{clientTestIp}</span> | Port: <span className="font-mono text-slate-300">1080</span>
                  </div>
                </div>

                {/* 9. BadVPN UDPGW */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-400 uppercase tracking-wider">9. BadVPN UDPGW (Port 7300)</span>
                    <button
                      onClick={() => copyToClipboard(`${clientTestIp}:7300`, 'link-udpgw')}
                      className="px-2 py-0.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-udpgw' ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-udpgw' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">UDP Gateway for HTTP Custom / Injector</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-amber-300 break-all select-all border border-amber-900/30">
                    Host: {clientTestIp} | UDPGW Port: 7300
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                    In HTTP Custom: UDPGW Port = <span className="font-mono text-amber-400">7300</span>
                  </div>
                </div>

                {/* 10. OpenSSH */}
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-400 uppercase tracking-wider">10. OpenSSH (Port 22)</span>
                    <button
                      onClick={() => copyToClipboard(`ssh://${clientTestIp}:22`, 'link-ssh')}
                      className="px-2 py-0.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedKey === 'link-ssh' ? <Check className="w-3 h-3 text-blue-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link-ssh' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">Direct SSH port forwarding backend</p>
                  <div className="bg-slate-900/90 p-2 rounded font-mono text-[10px] text-slate-300 break-all select-all border border-slate-800">
                    ssh://{clientTestIp}:22
                  </div>
                  <div className="pt-1 border-t border-slate-800/60 text-[11px] text-slate-400">
                    SSH Port: <span className="font-mono text-slate-300">22</span> (or via Multiplexer :2222)
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* CLI Interactive Command Cheat Sheet */}
        <section id="cli" className="space-y-4">
          <div className="pb-2 border-b border-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" /> Server Management CLI Reference
            </h2>
            <p className="text-sm text-slate-400">Commands available once installed via <code className="text-emerald-400">sudo aura</code>.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interactive TUI</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>sudo aura</span>
                <button onClick={() => copyToClipboard('sudo aura', 'cmd-tui')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-tui' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Opens the visual menu for tunnel, user, and MTU controls.</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Diagnostics</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>aura diag</span>
                <button onClick={() => copyToClipboard('aura diag', 'cmd-diag')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-diag' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Audits port bindings, daemons, certs, and DNS resolution.</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Telemetry</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>aura stats</span>
                <button onClick={() => copyToClipboard('aura stats', 'cmd-stats')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-stats' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Real-time CPU, RAM, and per-port connection counters.</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bulk User Generation</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>aura users bulk_add --count=20</span>
                <button onClick={() => copyToClipboard('aura users bulk_add --count=20', 'cmd-users')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-users' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Generates randomized credentials for SSH & SOCKS5.</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mass MTU Tuning</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>aura mtu 1232</span>
                <button onClick={() => copyToClipboard('aura mtu 1232', 'cmd-mtu')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-mtu' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Sets MTU for all DNS tunnels and restarts daemons.</p>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Server Backup</span>
              <div className="flex items-center justify-between bg-[#0B0F17] p-2 rounded font-mono text-xs text-emerald-400">
                <span>aura backup</span>
                <button onClick={() => copyToClipboard('aura backup', 'cmd-backup')} className="text-slate-400 hover:text-white">
                  {copiedKey === 'cmd-backup' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Packages all keys, certs, and tunnel JSONs into an archive.</p>
            </div>
          </div>
        </section>

        {/* Architecture Diagram Section */}
        <section id="architecture" className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="pb-3 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" /> System Routing Architecture
            </h2>
            <p className="text-xs text-slate-400">Zero-collision port allocation and automated internal multiplexing.</p>
          </div>

          <div className="bg-[#0B0F17] p-4 sm:p-6 rounded-lg font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed border border-slate-800/80">
            <pre className="text-emerald-400/90 font-mono">
{`Port 53 (UDP+TCP) ──► aura-dnsrouter ──► DNSTT (127.0.0.1:5300) ──┐
                                       ──► Slipstream (:5301)   ├──► Multiplexer (127.0.0.1:2222)
                                       ──► VayDNS     (:5302)   │         │
                                       ──► Soar       (:5303)   │         ├──► OpenSSH (:22)
                                                                │         └──► SOCKS5  (:1080)
Port 443 (TCP)    ──► aura-stuntls (TLS 1.2/1.3 Obfuscation) ───┘

Port 7300 (UDP)   ──► aura-udpgw (BadVPN UDP Gateway for VoIP & Gaming)`}
            </pre>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 mt-16 py-6 px-6 text-center text-xs text-slate-500">
        <p>Aura Unified Tunnel Engine · Open source under AGPL-3.0</p>
      </footer>
    </div>
  );
}
