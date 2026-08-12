import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  RefreshCw, 
  FileCode, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Download, 
  Search, 
  Database, 
  Layers, 
  Sparkles, 
  ShieldCheck,
  Briefcase,
  BookOpen,
  FolderOpen,
  ArrowRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function ManageSitemap() {
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [sitemapData, setSitemapData] = useState<{
    serviceCount: number;
    blogCount: number;
    portfolioCount: number;
    totalUrls: number;
    lastGeneratedAt: string;
    sitemapUrl: string;
  } | null>(null);
  const [xmlContent, setXmlContent] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'urls' | 'xml' | 'guide'>('overview');

  const fetchSitemapInfo = async () => {
    setLoading(true);
    try {
      // 1. Fetch JSON status
      const res = await fetch('/api/sitemap/status');
      if (res.ok) {
        const data = await res.json();
        setSitemapData(data);
      }

      // 2. Fetch raw XML preview
      const xmlRes = await fetch('/sitemap.xml?t=' + Date.now());
      if (xmlRes.ok) {
        const xmlText = await xmlRes.text();
        setXmlContent(xmlText);
      }
    } catch (err) {
      console.error('Failed to load sitemap status:', err);
      toast.error('Could not fetch sitemap status from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSitemapInfo();
  }, []);

  const handleRebuildSitemap = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/sitemap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: window.location.origin
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      toast.success(`Dynamic sitemap successfully rebuilt! (${data.totalUrls} URLs, ${data.serviceCount} active services synced)`);
      
      // Refresh preview
      await fetchSitemapInfo();
    } catch (err: any) {
      console.error('Error rebuilding sitemap:', err);
      toast.error(err.message || 'Failed to rebuild sitemap');
    } finally {
      setRebuilding(false);
    }
  };

  const handleCopyXml = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    toast.success('Sitemap XML copied to clipboard!');
  };

  const handleDownloadXml = () => {
    if (!xmlContent) return;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('sitemap.xml downloaded!');
  };

  // Parse URLs from XML for search & list display
  const parsedUrls = React.useMemo(() => {
    if (!xmlContent) return [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const urlElements = Array.from(xmlDoc.getElementsByTagName('url'));

    return urlElements.map((el) => {
      const loc = el.getElementsByTagName('loc')[0]?.textContent || '';
      const lastmod = el.getElementsByTagName('lastmod')[0]?.textContent || '';
      const changefreq = el.getElementsByTagName('changefreq')[0]?.textContent || '';
      const priority = el.getElementsByTagName('priority')[0]?.textContent || '';

      let type: 'service' | 'blog' | 'portfolio' | 'page' = 'page';
      if (loc.includes('/services/')) type = 'service';
      else if (loc.includes('/blog/')) type = 'blog';
      else if (loc.includes('/portfolio')) type = 'portfolio';

      return { loc, lastmod, changefreq, priority, type };
    });
  }, [xmlContent]);

  const filteredUrls = parsedUrls.filter((item) =>
    item.loc.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SEO title="Dynamic Sitemap Generator & SEO - Admin Dashboard" description="Automatic Firestore sitemap crawler and search engine indexing management." />

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Globe className="h-6 w-6 text-orange-600" />
              Dynamic Sitemap & SEO Engine
            </h1>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automatically queries Firestore active service IDs, blog posts, and content pages to generate <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-orange-600">sitemap.xml</code> for search engines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRebuildSitemap}
            disabled={rebuilding}
            className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Fetching & Rebuilding...' : 'Rebuild & Sync Now'}
          </Button>

          <Button
            variant="outline"
            asChild
          >
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View sitemap.xml
            </a>
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Indexed Pages</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {loading ? '...' : sitemapData?.totalUrls || parsedUrls.length || 0}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Static & Dynamic Pages
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center">
              <Layers className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Services</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {loading ? '...' : sitemapData?.serviceCount || 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-blue-500" /> Firestore Collection
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Briefcase className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Blog Content</p>
              <h3 className="text-2xl font-black text-foreground mt-1">
                {loading ? '...' : sitemapData?.blogCount || 0}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-purple-500" /> Published Posts
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center">
              <BookOpen className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Generated</p>
              <p className="text-sm font-bold text-foreground mt-1 truncate">
                {sitemapData?.lastGeneratedAt 
                  ? new Date(sitemapData.lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'Just now'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {sitemapData?.lastGeneratedAt 
                  ? new Date(sitemapData.lastGeneratedAt).toLocaleDateString()
                  : new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Control */}
      <div className="border-b flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Overview & Automatic Crawling
        </button>

        <button
          onClick={() => setActiveTab('urls')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'urls'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="h-4 w-4" />
          Discovered URLs ({parsedUrls.length})
        </button>

        <button
          onClick={() => setActiveTab('xml')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'xml'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileCode className="h-4 w-4" />
          Raw XML Inspector
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'guide'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Info className="h-4 w-4" />
          Search Console Setup Guide
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-orange-600" />
                How Dynamic Firestore Crawling Works
              </CardTitle>
              <CardDescription>
                Your sitemap continuously reflects live database modifications in Firestore without requiring manual code deployments.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Briefcase className="h-4 w-4 text-orange-600" />
                    Services Collection
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Every active service document added in <strong className="text-foreground">Manage Services</strong> automatically generates a unique URL under <code className="text-xs bg-muted px-1 rounded text-orange-600">/services/:id</code>.
                  </p>
                </div>

                <div className="p-4 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    Blogs Collection
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Published articles in <strong className="text-foreground">Manage Blog</strong> automatically map to <code className="text-xs bg-muted px-1 rounded text-purple-600">/blog/:slug</code> in the XML feed.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Real-time Request Fetching
                  </span>
                  <span className="text-xs text-muted-foreground">HTTP GET /sitemap.xml</span>
                </div>
                <p className="text-xs text-orange-900 dark:text-orange-200 leading-relaxed">
                  Whenever search engines like Googlebot or Bingbot request <code className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded text-orange-600">https://yourdomain.com/sitemap.xml</code>, the server queries Firestore in real time, updates the disk copy <code className="font-mono bg-white dark:bg-zinc-900 px-1 py-0.5 rounded text-orange-600">public/sitemap.xml</code>, and serves the latest XML payload with clean caching headers.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>robots.txt declaration:</span>
                <code className="font-mono bg-muted px-2 py-1 rounded text-foreground">
                  Sitemap: {window.location.origin}/sitemap.xml
                </code>
              </div>
            </CardContent>
          </Card>

          {/* Search Console Actions Card */}
          <Card className="border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-600" />
                Search Engine Actions
              </CardTitle>
              <CardDescription>
                Direct links to test and submit your sitemap to search engines.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Google Search Console
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-cyan-500" />
                    Bing Webmaster Tools
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <Button variant="outline" className="w-full justify-between" asChild>
                <a href="/robots.txt" target="_blank" rel="noopener noreferrer">
                  <span className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-emerald-500" />
                    View robots.txt
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>

              <div className="pt-3 border-t space-y-2">
                <Button onClick={handleCopyXml} variant="secondary" className="w-full">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy XML Content
                </Button>
                <Button onClick={handleDownloadXml} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download sitemap.xml
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Discovered URLs */}
      {activeTab === 'urls' && (
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
            <div>
              <CardTitle className="text-lg font-bold">Discovered Sitemap Entries ({filteredUrls.length})</CardTitle>
              <CardDescription>All static routes and Firestore dynamic content items currently served in sitemap.xml.</CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search URLs..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Indexed URL Location</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Change Freq</th>
                  <th className="px-4 py-3">Last Modified</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUrls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No URLs match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredUrls.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        {item.type === 'service' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            <Briefcase className="h-3 w-3" /> Service
                          </span>
                        )}
                        {item.type === 'blog' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                            <BookOpen className="h-3 w-3" /> Blog
                          </span>
                        )}
                        {item.type === 'portfolio' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            <FolderOpen className="h-3 w-3" /> Portfolio
                          </span>
                        )}
                        {item.type === 'page' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            <Globe className="h-3 w-3" /> Core Page
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-foreground max-w-xs truncate">
                        {item.loc}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-semibold text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded">
                          {item.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {item.changefreq}
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {item.lastmod}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <a
                          href={item.loc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
                        >
                          Visit <ArrowRight className="ml-1 h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Raw XML Inspector */}
      {activeTab === 'xml' && (
        <Card className="border shadow-xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileCode className="h-5 w-5 text-orange-600" />
                Raw sitemap.xml Payload
              </CardTitle>
              <CardDescription>Live XML output served to search engine web crawlers.</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleCopyXml} size="sm" variant="outline">
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
              <Button onClick={handleDownloadXml} size="sm" variant="outline">
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <pre className="bg-zinc-950 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed select-all">
              {xmlContent || 'Loading XML content...'}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Search Console Guide */}
      {activeTab === 'guide' && (
        <Card className="border shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Info className="h-5 w-5 text-orange-600" />
              Submitting Your Sitemap to Google & Bing
            </CardTitle>
            <CardDescription>Steps to notify search engines about your new dynamic content feed.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-extrabold">1</span>
                  Google Search Console
                </h3>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside pl-1">
                  <li>Log in to <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">Google Search Console</a>.</li>
                  <li>Select your property or domain.</li>
                  <li>In the left navigation menu, click <strong className="text-foreground">Sitemaps</strong>.</li>
                  <li>Under <strong className="text-foreground">Add a new sitemap</strong>, enter: <code className="bg-muted px-1.5 py-0.5 rounded text-orange-600 font-mono">sitemap.xml</code></li>
                  <li>Click <strong className="text-foreground">Submit</strong>. Google will verify and periodically crawl all new service IDs automatically.</li>
                </ol>
              </div>

              <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white text-xs font-extrabold">2</span>
                  Bing Webmaster Tools
                </h3>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside pl-1">
                  <li>Log in to <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">Bing Webmaster Tools</a>.</li>
                  <li>Select your website or import from Google Search Console.</li>
                  <li>Navigate to <strong className="text-foreground">Sitemaps</strong>.</li>
                  <li>Click <strong className="text-foreground">Submit Sitemap</strong> and provide: <code className="bg-muted px-1.5 py-0.5 rounded text-orange-600 font-mono">{window.location.origin}/sitemap.xml</code></li>
                  <li>Click <strong className="text-foreground">Submit</strong>.</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
