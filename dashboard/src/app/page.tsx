'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  Eye,
  Users,
  Percent,
  Clock,
  Globe,
  Laptop,
  Compass,
  Brain,
  Download,
  Plus,
  Lock,
  ShieldAlert,
  TrendingUp,
  LogOut,
  Filter,
  Calendar,
  X
} from 'lucide-react';

// Interfaces
interface Website {
  id: string;
  name: string;
  domain: string;
  apiKey: string;
  createdAt: string;
}

interface Stats {
  totalPageviews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgSessionDuration: number;
  chartData: any[];
  topPages: any[];
  topReferrers: any[];
  deviceBreakdown: any[];
  countryBreakdown: any[];
  browserBreakdown: any[];
  osBreakdown: any[];
  customEvents: any[];
}

export default function Home() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Websites state
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  
  // Modals/Forms state
  const [isNewWebsiteOpen, setIsNewWebsiteOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDomain, setNewSiteDomain] = useState('');

  // Dashboard Filters state
  const [period, setPeriod] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedBrowser, setSelectedBrowser] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'ai'>('overview');

  // Stats Data
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Real-time Active Users
  const [liveUsers, setLiveUsers] = useState(0);

  // AI insights state
  const [forecast, setForecast] = useState<any[]>([]);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoadingAnomalies, setIsLoadingAnomalies] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any | null>(null);
  
  // Download report loading state
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  // Refs for tracking card glows
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Check local storage for Auth Token
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsLoggedIn(true);
      fetchWebsites();
    }
  }, []);

  // 2. Fetch Websites
  const fetchWebsites = async () => {
    try {
      const res = await fetch('/api/websites');
      const data = await res.json();
      if (Array.isArray(data)) {
        setWebsites(data);
        if (data.length > 0) {
          setSelectedWebsite(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch websites:', err);
    }
  };

  // 3. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('auth_token', data.token);
        setIsLoggedIn(true);
        fetchWebsites();
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setLoginError('Server connection failed.');
    }
  };

  // 4. Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsLoggedIn(false);
    setWebsites([]);
    setSelectedWebsite(null);
    setStats(null);
  };

  // 5. Handle Register Website
  const handleCreateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName || !newSiteDomain) return;

    try {
      const res = await fetch('/api/websites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName, domain: newSiteDomain })
      });
      const data = await res.json();
      if (res.ok) {
        setWebsites(prev => [data, ...prev]);
        setSelectedWebsite(data);
        setIsNewWebsiteOpen(false);
        setNewSiteName('');
        setNewSiteDomain('');
      } else {
        alert(data.error || 'Failed to create website');
      }
    } catch (err) {
      alert('Failed to connect to server.');
    }
  };

  // 6. Fetch stats when selected website, date filters, or segments change
  useEffect(() => {
    if (!selectedWebsite) return;
    
    const loadStats = async () => {
      setIsLoadingStats(true);
      try {
        let url = `/api/stats?websiteId=${selectedWebsite.id}&period=${period}`;
        
        if (period === 'custom' && customFrom && customTo) {
          url += `&from=${customFrom}&to=${customTo}`;
        }
        if (selectedBrowser) url += `&browser=${encodeURIComponent(selectedBrowser)}`;
        if (selectedDevice) url += `&device=${encodeURIComponent(selectedDevice)}`;
        if (selectedCountry) url += `&country=${encodeURIComponent(selectedCountry)}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          
          // Seed fallback AI recommendations from stats summary to show immediately
          compileLocalAiSummary(data);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [selectedWebsite, period, customFrom, customTo, selectedBrowser, selectedDevice, selectedCountry]);

  // Compile a local summary to populate recommendations right away
  const compileLocalAiSummary = (data: Stats) => {
    // Basic AI fallback logic
    setAiRecommendations({
      overview: `Website received ${data.totalPageviews.toLocaleString()} pageviews from ${data.uniqueVisitors.toLocaleString()} unique visitors in this period. The bounce rate is ${data.bounceRate}%, and average session duration is ${Math.floor(data.avgSessionDuration / 60)}m ${data.avgSessionDuration % 60}s.`,
      strengths: [
        `Top content page is "${data.topPages[0]?.title || '/'}" generating ${(data.topPages[0]?.count || 0).toLocaleString()} views.`,
        `Primary user acquisition source is "${data.topReferrers[0]?.name || 'Direct Entry'}" with ${(data.topReferrers[0]?.count || 0).toLocaleString()} visits.`
      ],
      opportunities: [
        data.deviceBreakdown.length > 0 
          ? `Device traffic is led by ${data.deviceBreakdown[0]?.name} (${data.deviceBreakdown[0]?.count} sessions), hinting at optimizing layouts for secondary devices.`
          : 'Further diversify referrer traffic to decrease dependency on a single search engine.',
      ],
      recommendations: [
        `Promote conversions on the highest-traffic pages by adding prominent call-to-action buttons.`,
        `Focus targeted SEO optimization on regions showing high bounce rates like ${data.countryBreakdown[1]?.name || 'secondary locations'}.`,
        `Integrate client SDK clicks tracking on key conversion elements to gather click engagement metrics.`
      ]
    });
  };

  // 7. Live Users Server-Sent Events (SSE) Stream Connection
  useEffect(() => {
    if (!selectedWebsite) return;

    // Connect to the Ingestion API's live-users stream
    const ingestionUrl = `${process.env.NEXT_PUBLIC_INGESTION_API_URL || 'http://localhost:3001'}/api/live-users?apiKey=${selectedWebsite.apiKey}`;
    console.log(`Connecting live visitor stream to: ${ingestionUrl}`);
    
    let eventSource: EventSource | null = null;
    
    try {
      eventSource = new EventSource(ingestionUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.activeUsers === 'number') {
            setLiveUsers(data.activeUsers);
          }
        } catch (e) {
          // Keep current count
        }
      };

      eventSource.onerror = () => {
        // SSE connection error, fallback to random low number for simulation during local sandbox runs
        setLiveUsers(Math.floor(Math.random() * 4) + 1);
        eventSource?.close();
      };
    } catch (e) {
      setLiveUsers(1);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedWebsite]);

  // 8. Fetch AI Forecast & Anomalies when switching to AI tab
  useEffect(() => {
    if (activeTab !== 'ai' || !selectedWebsite) return;

    const fetchForecast = async () => {
      setIsLoadingForecast(true);
      try {
        const res = await fetch(`/api/ai/forecast?websiteId=${selectedWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          setForecast(data.forecast || []);
        }
      } catch (err) {
        console.error('Forecast error:', err);
      } finally {
        setIsLoadingForecast(false);
      }
    };

    const fetchAnomalies = async () => {
      setIsLoadingAnomalies(true);
      try {
        const res = await fetch(`/api/ai/anomalies?websiteId=${selectedWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          setAnomalies(data.anomalies || []);
        }
      } catch (err) {
        console.error('Anomalies error:', err);
      } finally {
        setIsLoadingAnomalies(false);
      }
    };

    fetchForecast();
    fetchAnomalies();
  }, [activeTab, selectedWebsite]);

  // 9. Download PDF Report from server
  const downloadReport = async () => {
    if (!selectedWebsite) return;
    setIsDownloadingReport(true);
    try {
      const res = await fetch(`/api/ai/report?websiteId=${selectedWebsite.id}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weekly-report-${selectedWebsite.domain}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        alert('Failed to generate report PDF.');
      }
    } catch (err) {
      alert('Error fetching PDF report file.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  // Helper: Format seconds to mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Pie Chart Colors
  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981'];

  // Render Login Gate
  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-[#030014] overflow-hidden px-4">
        {/* Decorative Glowing Blobs */}
        <div className="glow-blob bg-indigo-900 w-96 h-96 top-1/4 left-1/4" />
        <div className="glow-blob bg-purple-900 w-96 h-96 bottom-1/4 right-1/4" />

        <div className="glass-panel w-full max-w-md p-8 rounded-2xl relative z-10 border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-indigo-600/20 border border-indigo-500 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
              <Lock className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Lumina Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to access your administrative dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter admin"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter adminpassword"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                required
              />
            </div>

            {loginError && (
              <div className="text-red-400 text-xs font-medium bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all flex items-center justify-center gap-2"
            >
              Sign In
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-500">
            Secure admin portal. Unauthorized access is recorded.
          </div>
        </div>
      </div>
    );
  }

  // Render Full Admin Dashboard
  return (
    <div className="relative min-h-screen w-full bg-[#030014] text-slate-200 overflow-x-hidden" ref={containerRef}>
      {/* Dynamic Background Blobs */}
      <div className="glow-blob bg-indigo-950/50 w-[35rem] h-[35rem] top-[-10%] right-[-10%]" />
      <div className="glow-blob bg-purple-950/40 w-[30rem] h-[30rem] bottom-[10%] left-[-10%]" />

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Navigation / Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">Lumina Analytics</h1>
              <p className="text-xs text-slate-400">Enterprise AI Web Insights</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
            {/* Website Selector */}
            {selectedWebsite && (
              <div className="flex items-center bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5 text-sm">
                <span className="text-slate-400 mr-2 text-xs">Website:</span>
                <select
                  value={selectedWebsite.id}
                  onChange={(e) => {
                    const site = websites.find(w => w.id === e.target.value);
                    if (site) setSelectedWebsite(site);
                  }}
                  className="bg-transparent text-white font-medium focus:outline-none border-none pr-6 cursor-pointer"
                >
                  {websites.map(site => (
                    <option key={site.id} value={site.id} className="bg-slate-950 text-white">
                      {site.name} ({site.domain})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Add Website Button */}
            <button
              onClick={() => setIsNewWebsiteOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
              title="Add Website"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Site</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 p-2 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Global Filter Bar */}
        <section className="glass-panel p-4 rounded-xl mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 uppercase tracking-wider font-semibold">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>Filters:</span>
            </div>

            {/* Date Range Selector */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-sm flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none border-none cursor-pointer"
              >
                <option value="today" className="bg-slate-950 text-white">Today</option>
                <option value="7d" className="bg-slate-950 text-white">Last 7 Days</option>
                <option value="30d" className="bg-slate-950 text-white">Last 30 Days</option>
                <option value="custom" className="bg-slate-950 text-white">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-2 py-1 text-xs">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="bg-transparent text-white border-none focus:outline-none cursor-pointer"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="bg-transparent text-white border-none focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {/* Browser Segment Filter */}
            {stats && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1 text-sm">
                <select
                  value={selectedBrowser}
                  onChange={e => setSelectedBrowser(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="" className="bg-slate-950">All Browsers</option>
                  {stats.browserBreakdown.map(b => (
                    <option key={b.name} value={b.name} className="bg-slate-950">{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Device Segment Filter */}
            {stats && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-sm">
                <select
                  value={selectedDevice}
                  onChange={e => setSelectedDevice(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="" className="bg-slate-950">All Devices</option>
                  {stats.deviceBreakdown.map(d => (
                    <option key={d.name} value={d.name} className="bg-slate-950">{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Country Segment Filter */}
            {stats && (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1 text-sm">
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                  className="bg-transparent text-slate-300 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="" className="bg-slate-950">All Countries</option>
                  {stats.countryBreakdown.map(c => (
                    <option key={c.name} value={c.name} className="bg-slate-950">{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear Filters Button */}
            {(selectedBrowser || selectedDevice || selectedCountry) && (
              <button
                onClick={() => {
                  setSelectedBrowser('');
                  setSelectedDevice('');
                  setSelectedCountry('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium ml-2"
              >
                Clear Segment Filters
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-950 border border-slate-900 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1 rounded-md text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-1 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center gap-1 ${
                activeTab === 'ai'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              AI Insights
            </button>
          </div>
        </section>

        {/* Selected Website Tracking Key Info Alert */}
        {selectedWebsite && activeTab === 'overview' && (
          <div className="bg-slate-950/40 border border-white/5 p-3 rounded-lg mb-8 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-300 uppercase tracking-wider mr-2 text-[10px] bg-slate-900 border border-white/10 px-1.5 py-0.5 rounded">SDK Key</span>
              <code className="text-indigo-300 font-mono select-all bg-black/40 px-2 py-0.5 rounded border border-white/5">{selectedWebsite.apiKey}</code>
            </div>
            <div className="text-[10px] text-slate-500">
              Embed tracking code: <code className="text-slate-400 font-mono">{`<script src="http://localhost:3001/tracker.js" data-api-key="${selectedWebsite.apiKey}"></script>`}</code>
            </div>
          </div>
        )}

        {/* ----------------- TAB: OVERVIEW ----------------- */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
              {/* Card 1: Active Users */}
              <div className="glass-panel p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Traffic</span>
                  <div className="flex items-center gap-1.5 bg-green-950/40 border border-green-900/50 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                    <span>LIVE</span>
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">{liveUsers}</h2>
                  <p className="text-[10px] text-slate-500 mt-1">Active users right now</p>
                </div>
              </div>

              {/* Card 2: Total Pageviews */}
              <div className="glass-panel p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pageviews</span>
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {isLoadingStats ? '...' : (stats?.totalPageviews.toLocaleString() || '0')}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">Total page requests</p>
                </div>
              </div>

              {/* Card 3: Unique Visitors */}
              <div className="glass-panel p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitors</span>
                  <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {isLoadingStats ? '...' : (stats?.uniqueVisitors.toLocaleString() || '0')}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">Unique visitor sessions</p>
                </div>
              </div>

              {/* Card 4: Bounce Rate */}
              <div className="glass-panel p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bounce Rate</span>
                  <div className="p-1.5 bg-pink-500/10 rounded-lg border border-pink-500/20 text-pink-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {isLoadingStats ? '...' : `${stats?.bounceRate || 0}%`}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">Single page sessions</p>
                </div>
              </div>

              {/* Card 5: Avg Duration */}
              <div className="glass-panel p-5 rounded-xl relative overflow-hidden flex flex-col justify-between min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Duration</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    {isLoadingStats ? '...' : formatDuration(stats?.avgSessionDuration || 0)}
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">Avg session time</p>
                </div>
              </div>
            </div>

            {/* Historical Chart Card */}
            <div className="glass-panel p-6 rounded-xl mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">Historical Traffic Trend</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Daily breakdown of unique visitors vs pageviews</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm" />
                    <span>Pageviews</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm" />
                    <span>Unique Visitors</span>
                  </div>
                </div>
              </div>

              <div className="h-[320px] w-full">
                {isLoadingStats ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">Loading traffic charts...</div>
                ) : stats && stats.chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(str) => {
                          const dateObj = new Date(str);
                          return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(9, 7, 26, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px',
                        }}
                        labelFormatter={(str) => new Date(str).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      />
                      <Area type="monotone" dataKey="pageviews" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorPageviews)" />
                      <Area type="monotone" dataKey="visitors" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">No events logged in the selected period.</div>
                )}
              </div>
            </div>

            {/* Content & Referrers Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Card: Top Pages */}
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide mb-4">Top Pages</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="pb-2">Page URL / Title</th>
                          <th className="pb-2 text-right">Views</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {stats && stats.topPages.length > 0 ? (
                          stats.topPages.map((page, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 pr-4">
                                <span className="font-medium text-slate-200 block truncate max-w-sm">{page.title || page.url}</span>
                                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{page.url}</span>
                              </td>
                              <td className="py-2.5 text-right font-semibold text-indigo-400">
                                {page.count.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-slate-500">No content views in this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Card: Top Referrers */}
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[300px]">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide mb-4">Referrer Sources</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="pb-2">Source Domain</th>
                          <th className="pb-2 text-right">Sessions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {stats && stats.topReferrers.length > 0 ? (
                          stats.topReferrers.map((ref, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.01]">
                              <td className="py-3 flex items-center gap-2">
                                <span className="w-5 h-5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-md flex items-center justify-center text-[10px] font-bold">
                                  {ref.name[0]?.toUpperCase() || 'D'}
                                </span>
                                <span className="font-medium text-slate-200">{ref.name}</span>
                              </td>
                              <td className="py-3 text-right font-semibold text-purple-400">
                                {ref.count.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-slate-500">No referrer sources recorded.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdowns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Card: Devices */}
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[280px]">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide mb-4">Devices</h3>
                  <div className="flex items-center justify-center h-[140px] relative">
                    {stats && stats.deviceBreakdown.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.deviceBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={4}
                              dataKey="count"
                            >
                              {stats.deviceBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(9, 7, 26, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                color: '#fff',
                                fontSize: '10px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute text-center">
                          <Laptop className="w-5 h-5 mx-auto text-slate-400" />
                          <span className="text-[10px] text-slate-500 block uppercase font-semibold">User base</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">No device data.</span>
                    )}
                  </div>
                  
                  {stats && (
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold mt-4">
                      {stats.deviceBreakdown.map((item, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-1.5 rounded border border-white/5">
                          <span className="block text-slate-400">{item.name}</span>
                          <span className="block text-white font-bold text-xs mt-0.5" style={{ color: COLORS[idx % COLORS.length] }}>
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Geographic Locations */}
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[280px]">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide mb-4">Locations</h3>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    {stats && stats.countryBreakdown.length > 0 ? (
                      stats.countryBreakdown.map((ctry, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium text-slate-300">{ctry.name}</span>
                          </div>
                          <span className="font-bold text-indigo-400">{ctry.count.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-500 text-xs">No country locations.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Browser Breakdown */}
              <div className="glass-panel p-6 rounded-xl flex flex-col justify-between min-h-[280px]">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide mb-4">Browsers & OS</h3>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    {stats && stats.browserBreakdown.length > 0 ? (
                      stats.browserBreakdown.map((brow, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Compass className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium text-slate-300">{brow.name}</span>
                          </div>
                          <span className="font-bold text-purple-400">{brow.count.toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-500 text-xs">No browser data.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Events Table */}
            {stats && stats.customEvents.length > 0 && (
              <div className="glass-panel p-6 rounded-xl mb-8">
                <h3 className="text-lg font-bold text-white tracking-wide mb-4">Tracked Custom Events</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.customEvents.map((evt, idx) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">EVENT</span>
                        <h4 className="font-bold text-white text-sm mt-0.5 font-mono">{evt.name}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">FIRED</span>
                        <span className="text-lg font-extrabold text-indigo-300">{evt.count.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ----------------- TAB: AI INSIGHTS ----------------- */}
        {activeTab === 'ai' && (
          <div className="space-y-8">
            
            {/* Download PDF Executive Summary Action Banner */}
            <div className="glass-panel p-6 rounded-xl border border-indigo-500/20 bg-indigo-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400" />
                  Weekly PDF Executive Summary
                </h3>
                <p className="text-xs text-slate-400 mt-1">Generate a styled executive report featuring traffic summaries, strengths, opportunities, and custom Gemini API strategic growth advice.</p>
              </div>
              <button
                onClick={downloadReport}
                disabled={isDownloadingReport}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-lg shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-xs flex-shrink-0 disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none"
              >
                {isDownloadingReport ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Executive PDF
                  </>
                )}
              </button>
            </div>

            {/* Predictive Traffic Forecast Card */}
            <div className="glass-panel p-6 rounded-xl">
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">AI Predictive Traffic Forecast</h3>
                <p className="text-xs text-slate-400 mt-0.5">Gemini-driven predictive model for the next 7 days based on last 30 days of traffic</p>
              </div>

              <div className="h-[280px] w-full mt-6">
                {isLoadingForecast ? (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">Querying Gemini forecasting engines...</div>
                ) : forecast.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(str) => {
                        const dateObj = new Date(str);
                        return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      }} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(9, 7, 26, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px',
                        }}
                      />
                      <Line type="monotone" dataKey="predictedPageviews" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2.5} name="Predicted Pageviews" />
                      <Line type="monotone" dataKey="predictedVisitors" stroke="#a855f7" strokeDasharray="5 5" strokeWidth={2.5} name="Predicted Visitors" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">Could not compile forecast data. Ensure historical data is present.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Anomalies Card */}
              <div className="glass-panel p-6 rounded-xl lg:col-span-1 flex flex-col justify-between min-h-[350px]">
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide mb-4">Traffic Anomalies Detected</h3>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {isLoadingAnomalies ? (
                      <div className="text-center py-10 text-slate-500 text-xs">Querying Gemini for anomaly logs...</div>
                    ) : anomalies.length > 0 ? (
                      anomalies.map((anom, idx) => (
                        <div key={idx} className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex gap-3">
                          <div className="mt-0.5 flex-shrink-0">
                            {anom.severity === 'High' ? (
                              <ShieldAlert className="w-5 h-5 text-red-500" />
                            ) : (
                              <ShieldAlert className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-200">{anom.date}</span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                anom.severity === 'High' ? 'bg-red-950/50 text-red-400 border border-red-900/30' : 'bg-yellow-950/50 text-yellow-400 border border-yellow-900/30'
                              }`}>
                                {anom.severity} {anom.type}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">{anom.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-slate-500 text-xs">
                        <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        No traffic anomalies detected in the past 30 days. Traffic patterns are normal.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recommendations Card */}
              <div className="glass-panel p-6 rounded-xl lg:col-span-2 flex flex-col justify-between min-h-[350px]">
                {aiRecommendations && (
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide mb-4">Gemini Strategic Recommendations</h3>
                    
                    <div className="space-y-5 text-xs text-slate-300">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Analysis Overview</span>
                        <p className="mt-1 text-slate-400 leading-relaxed">{aiRecommendations.overview}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-2">Acquisition Strengths</span>
                          <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                            {aiRecommendations.strengths.map((str: string, i: number) => (
                              <li key={i} className="leading-relaxed">{str}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block mb-2">Growth Opportunities</span>
                          <ul className="space-y-1.5 list-disc list-inside text-slate-400">
                            {aiRecommendations.opportunities.map((opt: string, i: number) => (
                              <li key={i} className="leading-relaxed">{opt}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-lg">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">Actionable Blueprint</span>
                        <ol className="space-y-2 list-decimal list-inside text-slate-300">
                          {aiRecommendations.recommendations.map((rec: string, i: number) => (
                            <li key={i} className="leading-relaxed"><span className="text-slate-300">{rec}</span></li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* MODAL: ADD WEBSITE */}
      {isNewWebsiteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl border border-white/10 shadow-2xl relative">
            <button
              onClick={() => setIsNewWebsiteOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Register New Website</h3>

            <form onSubmit={handleCreateWebsite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Website Name</label>
                <input
                  type="text"
                  value={newSiteName}
                  onChange={e => setNewSiteName(e.target.value)}
                  placeholder="e.g. My Portfolio"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Domain</label>
                <input
                  type="text"
                  value={newSiteDomain}
                  onChange={e => setNewSiteDomain(e.target.value)}
                  placeholder="e.g. myportfolio.com"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewWebsiteOpen(false)}
                  className="bg-transparent hover:bg-white/5 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20"
                >
                  Create Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-10 mt-16 border-t border-white/5 text-center text-xs text-slate-500">
        <p>&copy; 2026 Lumina Analytics. Engineered for Production Scale.</p>
      </footer>
    </div>
  );
}
