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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('installer');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isZipping, setIsZipping] = useState(false);

  // Repository & quick deploy state
  const [githubRepo, setGithubRepo] = useState('Seven7388/Aura');
  const [githubBranch, setGithubBranch] = useState('main');
  const [deployDomain, setDeployDomain] = useState('s.sixbravo.qzz.io');
  const [deployMtu, setDeployMtu] = useState('1232');
  const [deployPort, setDeployPort] = useState('5300');
  const [serverIp, setServerIp] = useState('141.148.15.143');
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

  // Dynamically compute the installer command for Seven7388/Aura
  const rawInstallerUrl = `https://raw.githubusercontent.com/${githubRepo}/${githubBranch}/aura-installer.sh`;
  const flags = `-d "${deployDomain}" -m "${deployMtu}" -p "${deployPort}"`;
  
  const quickInstallCommand = isPrivateRepo && githubToken.trim()
    ? `curl -fsSL -H "Authorization: token ${githubToken.trim()}" ${rawInstallerUrl} | sudo GITHUB_TOKEN="${githubToken.trim()}" bash -s -- ${flags}`
    : `curl -fsSL ${rawInstallerUrl} | sudo bash -s -- ${flags}`;

  const gitCloneCommand = `git clone https://github.com/${githubRepo}.git && cd Aura && sudo bash aura-installer.sh ${flags}`;

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
                <p className="text-sm text-slate-300">Run this single command on your Ubuntu/Debian server to deploy the entire suite.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-slate-400">
                  Domain:
                  <input
                    type="text"
                    value={deployDomain}
                    onChange={(e) => setDeployDomain(e.target.value)}
                    className="bg-[#0B0F17] border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    placeholder="t.yourdomain.com"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-400">
                  MTU:
                  <input
                    type="text"
                    value={deployMtu}
                    onChange={(e) => setDeployMtu(e.target.value)}
                    className="w-16 bg-[#0B0F17] border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setIsPrivateRepo(!isPrivateRepo)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    isPrivateRepo ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Private Repo</span>
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
            <div className="flex items-center gap-3 text-xs">
              <label className="text-slate-400 flex items-center gap-1.5">
                Server IP:
                <input
                  type="text"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DNSTT SlipNet Link */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">DNSTT Tunnel (Curve25519)</span>
                <button
                  onClick={() => copyToClipboard(`slipnet://dnstt?domain=${deployDomain}&pubkey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef&ns=1.1.1.1`, 'slipnet-dnstt')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === 'slipnet-dnstt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'slipnet-dnstt' ? 'Copied' : 'Copy URI'}
                </button>
              </div>
              <p className="text-xs text-slate-400">Bypasses deep packet inspection through DNS recursive resolvers.</p>
              <div className="bg-slate-900/80 p-2.5 rounded font-mono text-xs text-slate-300 break-all select-all">
                slipnet://dnstt?domain={deployDomain}&pubkey=&lt;server-pubkey&gt;&ns=1.1.1.1
              </div>
            </div>

            {/* StunTLS 443 Link */}
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">StunTLS Port 443 (HTTPS)</span>
                <button
                  onClick={() => copyToClipboard(`slipnet://stuntls?addr=${serverIp}:443&sni=${serverIp}&insecure=1`, 'slipnet-stuntls')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {copiedKey === 'slipnet-stuntls' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'slipnet-stuntls' ? 'Copied' : 'Copy URI'}
                </button>
              </div>
              <p className="text-xs text-slate-400">Obfuscated TLS 1.2/1.3 connection forwarding to Protocol Multiplexer.</p>
              <div className="bg-slate-900/80 p-2.5 rounded font-mono text-xs text-slate-300 break-all select-all">
                slipnet://stuntls?addr={serverIp}:443&sni={serverIp}&insecure=1
              </div>
            </div>
          </div>
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
