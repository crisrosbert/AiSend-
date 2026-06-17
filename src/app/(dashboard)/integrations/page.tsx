"use client";

import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Search,
  LayoutGrid,
  Wallet,
  Settings2,
  Link2,
  MessageCircle,
  Bot,
  Sheet,
  CreditCard,
  ShoppingBag,
  ShoppingCart,
  BarChart3,
  Check,
  Plus,
  Store,
  Loader2,
  AlertTriangle,
  X,
  Globe,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category = "communication" | "crm" | "payments" | "ecommerce";

interface IntegrationApp {
  id: string;
  name: string;
  description: string;
  category: Category;
  icon: LucideIcon;
  gradient: string;
  glow: string;
  accent: string;
  badge?: "New" | "Installed" | "Popular";
}

type FilterValue = "all" | "whatsapp-pay" | "store-setup" | "installed";

interface CategoryNav {
  value: FilterValue;
  label: string;
  icon: LucideIcon;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES: CategoryNav[] = [
  { value: "all", label: "Discover", icon: LayoutGrid },
  { value: "whatsapp-pay", label: "WhatsApp Pay", icon: Wallet },
  { value: "store-setup", label: "Store Setup", icon: Settings2 },
];

const APPS: IntegrationApp[] = [
  {
    id: "wa-link-gen",
    name: "WhatsApp Link Generator",
    category: "communication",
    description: "Create shareable links & QR for your WA business number",
    icon: Link2,
    gradient: "from-emerald-400 to-green-600",
    glow: "rgba(16,185,129,.4)",
    accent: "#10b981",
    badge: "Popular",
  },
  {
    id: "wa-widget",
    name: "WhatsApp Website Widget",
    category: "communication",
    description: "Drive WhatsApp sales with personalised CTAs",
    icon: MessageCircle,
    gradient: "from-teal-400 to-cyan-600",
    glow: "rgba(34,211,238,.4)",
    accent: "#22d3ee",
    badge: "New",
  },
  {
    id: "dialogflow",
    name: "Dialogflow Integration",
    category: "communication",
    description: "Natural language understanding to enable human-like conversations between users and your app.",
    icon: Bot,
    gradient: "from-orange-400 to-amber-600",
    glow: "rgba(245,158,11,.4)",
    accent: "#f59e0b",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "crm",
    description: "Sync contacts from Google Sheets automatically, without uploading CSVs.",
    icon: Sheet,
    gradient: "from-green-500 to-emerald-700",
    glow: "rgba(34,197,94,.4)",
    accent: "#22c55e",
  },
  {
    id: "zoho",
    name: "Zoho",
    category: "crm",
    description: "Drive WhatsApp communication to your Leads and Customers on Zoho seamlessly.",
    icon: BarChart3,
    gradient: "from-red-400 to-rose-600",
    glow: "rgba(244,63,94,.4)",
    accent: "#f43f5e",
  },
  {
    id: "payu",
    name: "PayU",
    category: "payments",
    description: "Send payment links & subscription updates to drive quick payments",
    icon: CreditCard,
    gradient: "from-violet-400 to-purple-600",
    glow: "rgba(168,85,247,.4)",
    accent: "#a855f7",
  },
  {
    id: "razorpay",
    name: "Razorpay",
    category: "payments",
    description: "Collect payments directly through WhatsApp with Razorpay's seamless payment links.",
    icon: CreditCard,
    gradient: "from-blue-500 to-indigo-600",
    glow: "rgba(59,130,246,.4)",
    accent: "#3b82f6",
    badge: "Popular",
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "ecommerce",
    description: "Automate order updates, abandoned cart recovery, and customer support via WhatsApp.",
    icon: ShoppingBag,
    gradient: "from-lime-400 to-green-600",
    glow: "rgba(132,204,22,.4)",
    accent: "#84cc16",
    badge: "Popular",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "ecommerce",
    description: "Connect your WooCommerce store and send order notifications through WhatsApp.",
    icon: ShoppingCart,
    gradient: "from-purple-500 to-violet-700",
    glow: "rgba(139,92,246,.4)",
    accent: "#8b5cf6",
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [category, setCategory] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dbMode, setDbMode] = useState<"supabase" | "local">("supabase");

  const [connections, setConnections] = useState<Record<string, { status: string; config: any }>>({});

  const [activeModalApp, setActiveModalApp] = useState<IntegrationApp | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);

  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");

  const [dialogflowProjId, setDialogflowProjId] = useState("");
  const [dialogflowAgent, setDialogflowAgent] = useState("");
  const [dialogflowKey, setDialogflowKey] = useState("");

  const [shopifyUrl, setShopifyUrl] = useState("");
  const [shopifyToken, setShopifyToken] = useState("");

  const [wooUrl, setWooUrl] = useState("");
  const [wooKey, setWooKey] = useState("");
  const [wooSecret, setWooSecret] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const [waNumber, setWaNumber] = useState("");
  const [waMessage, setWaMessage] = useState("");

  const [widgetHeader, setWidgetHeader] = useState("Chat with Us");
  const [widgetMessage, setWidgetMessage] = useState("Hi! How can we help you today?");
  const [widgetBtnText, setWidgetBtnText] = useState("Start Chat");
  const [widgetPosition, setWidgetPosition] = useState("right");
  const [widgetColor, setWidgetColor] = useState("#1aa260");

  useEffect(() => {
    async function loadConnections() {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("integration_connections")
          .select("app_id, status, config");

        if (error) {
          console.warn("integration_connections table query failed, falling back to localStorage:", error.message);
          setDbMode("local");
          loadLocalConnections();
        } else {
          setDbMode("supabase");
          const map: Record<string, { status: string; config: any }> = {};
          data?.forEach((row) => {
            map[row.app_id] = { status: row.status, config: row.config };
          });

          if (!map["dialogflow"]) {
            map["dialogflow"] = {
              status: "connected",
              config: { project_id: "aisensy-dialogflow-agent", agent_name: "Default Dialogflow" },
            };
          }
          setConnections(map);
        }
      } catch (err) {
        console.error("Error loading connections:", err);
        setDbMode("local");
        loadLocalConnections();
      } finally {
        setLoading(false);
      }
    }

    function loadLocalConnections() {
      try {
        const stored = localStorage.getItem(`connections_${user?.id || "guest"}`);
        if (stored) {
          setConnections(JSON.parse(stored));
        } else {
          const defaultMap = {
            dialogflow: {
              status: "connected",
              config: { project_id: "aisensy-dialogflow-agent", agent_name: "Default Dialogflow" },
            },
          };
          setConnections(defaultMap);
          localStorage.setItem(`connections_${user?.id || "guest"}`, JSON.stringify(defaultMap));
        }
      } catch (e) {
        console.error("Failed to read from localStorage:", e);
      }
    }

    loadConnections();
  }, [user]);

  const openModal = (app: IntegrationApp) => {
    setActiveModalApp(app);
    const existing = connections[app.id]?.config || {};

    if (app.id === "google-sheets") {
      setGoogleEmail(existing.email || "");
      setGoogleName(existing.name || "");
      setSheetUrl(existing.sheet_url || "");
      setSheetName(existing.sheet_name || "Sheet1");
    } else if (app.id === "dialogflow") {
      setDialogflowProjId(existing.project_id || "");
      setDialogflowAgent(existing.agent_name || "");
      setDialogflowKey(existing.service_account_key || "");
    } else if (app.id === "shopify") {
      setShopifyUrl(existing.store_url || "");
      setShopifyToken(existing.access_token || "");
    } else if (app.id === "woocommerce") {
      setWooUrl(existing.store_url || "");
      setWooKey(existing.consumer_key || "");
      setWooSecret(existing.consumer_secret || "");
    } else if (app.id === "razorpay" || app.id === "payu") {
      setApiKey(existing.api_key || "");
      setApiSecret(existing.api_secret || "");
    } else if (app.id === "wa-link-gen") {
      setWaNumber(existing.phone_number || "");
      setWaMessage(existing.message || "");
    } else if (app.id === "wa-widget") {
      setWidgetHeader(existing.header || "Chat with Us");
      setWidgetMessage(existing.message || "Hi! How can we help you today?");
      setWidgetBtnText(existing.button_text || "Start Chat");
      setWidgetPosition(existing.position || "right");
      setWidgetColor(existing.theme_color || "#1aa260");
      setWaNumber(existing.phone_number || "");
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoggingIn(true);
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "about:blank",
      "google_oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (popup) {
      popup.document.write(`
        <html>
          <head>
            <title>Sign in with Google</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="flex flex-col items-center justify-center min-h-screen bg-slate-50 font-sans p-6 text-center">
            <div class="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100 flex flex-col items-center">
              <svg class="w-10 h-10 mb-4" viewBox="0 0 24 24">
                <path fill="#ea4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 15.02 1 12 1 7.24 1 3.2 3.73 1.24 7.72l3.83 2.97C6.01 7.23 8.76 5.04 12 5.04z"/>
                <path fill="#4285f4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.71-4.94 3.71-8.6z"/>
                <path fill="#fbbc05" d="M5.07 14.69c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.24 7.72C.45 9.33 0 11.12 0 13s.45 3.67 1.24 5.28l3.83-2.97z"/>
                <path fill="#34a853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.7-2.87c-1.1.74-2.52 1.18-4.26 1.18-3.24 0-5.99-2.19-6.97-5.65L1.2 15.71C3.16 19.7 7.21 23 12 23z"/>
              </svg>
              <h2 class="text-xl font-bold text-slate-800 mb-1">Choose an account</h2>
              <p class="text-xs text-slate-500 mb-6">to continue to AiSend Integrations</p>
              <button id="account-btn" class="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-left mb-3">
                <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  ${user?.email?.charAt(0).toUpperCase() || "A"}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800 truncate">${profile?.full_name || "Active User"}</p>
                  <p class="text-xs text-slate-500 truncate">${user?.email || "user@example.com"}</p>
                </div>
              </button>
              <p class="text-[10px] text-slate-400 leading-normal mt-4">
                To continue, Google will share your name, email address, language preference, and profile picture with AiSend.
              </p>
            </div>
            <script>
              document.getElementById('account-btn').addEventListener('click', () => {
                window.opener.postMessage({
                  type: 'GOOGLE_OAUTH_SUCCESS',
                  email: '${user?.email || "user@example.com"}',
                  name: '${profile?.full_name || "Active User"}'
                }, '*');
                window.close();
              });
            </script>
          </body>
        </html>
      `);
    }

    const messageListener = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        setGoogleEmail(event.data.email);
        setGoogleName(event.data.name);
        setGoogleLoggingIn(false);
        toast.success(`Successfully authenticated as ${event.data.email}`);
        window.removeEventListener("message", messageListener);
      }
    };

    window.addEventListener("message", messageListener);
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalApp || !user) return;

    setSavingConfig(true);
    let configData: any = {};

    if (activeModalApp.id === "google-sheets") {
      if (!googleEmail) {
        toast.error("Please login with Gmail first!");
        setSavingConfig(false);
        return;
      }
      configData = { email: googleEmail, name: googleName, sheet_url: sheetUrl, sheet_name: sheetName };
    } else if (activeModalApp.id === "dialogflow") {
      configData = { project_id: dialogflowProjId, agent_name: dialogflowAgent, service_account_key: dialogflowKey };
    } else if (activeModalApp.id === "shopify") {
      configData = { store_url: shopifyUrl, access_token: shopifyToken };
    } else if (activeModalApp.id === "woocommerce") {
      configData = { store_url: wooUrl, consumer_key: wooKey, consumer_secret: wooSecret };
    } else if (activeModalApp.id === "razorpay" || activeModalApp.id === "payu") {
      configData = { api_key: apiKey, api_secret: apiSecret };
    } else if (activeModalApp.id === "wa-link-gen") {
      configData = { phone_number: waNumber, message: waMessage };
    } else if (activeModalApp.id === "wa-widget") {
      configData = {
        header: widgetHeader, message: widgetMessage, button_text: widgetBtnText,
        position: widgetPosition, theme_color: widgetColor, phone_number: waNumber,
      };
    }

    try {
      const nextMap = {
        ...connections,
        [activeModalApp.id]: { status: "connected", config: configData },
      };

      if (dbMode === "supabase") {
        const { error } = await supabase
          .from("integration_connections")
          .upsert({
            user_id: user.id,
            app_id: activeModalApp.id,
            status: "connected",
            config: configData,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,app_id" });

        if (error) throw error;
      } else {
        localStorage.setItem(`connections_${user.id}`, JSON.stringify(nextMap));
      }

      setConnections(nextMap);
      toast.success(`${activeModalApp.name} successfully connected!`);
      setActiveModalApp(null);
    } catch (err: any) {
      console.error("Failed to save connection config:", err);
      toast.error(`Error connecting: ${err.message || "Unknown error"}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDisconnect = async (appId: string) => {
    if (!user) return;
    try {
      const nextMap = { ...connections };
      delete nextMap[appId];

      if (dbMode === "supabase") {
        const { error } = await supabase
          .from("integration_connections")
          .delete()
          .eq("user_id", user.id)
          .eq("app_id", appId);

        if (error) throw error;
      } else {
        localStorage.setItem(`connections_${user.id}`, JSON.stringify(nextMap));
      }

      setConnections(nextMap);
      toast.success("Integration disconnected");
      setActiveModalApp(null);
    } catch (err: any) {
      console.error("Disconnect error:", err);
      toast.error(`Error disconnecting: ${err.message}`);
    }
  };

  const filtered = useMemo(() => {
    let result = APPS;

    if (category === "installed") {
      result = result.filter((a) => connections[a.id]?.status === "connected");
    } else if (category === "whatsapp-pay") {
      result = result.filter((a) => a.category === "payments");
    } else if (category === "store-setup") {
      result = result.filter((a) => a.category === "ecommerce");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [category, search, connections]);

  const installedApps = useMemo(() => {
    return APPS.filter((a) => connections[a.id]?.status === "connected");
  }, [connections]);

  return (
    <div
      className="w-full relative min-h-screen pb-16 -mx-4 -my-6 px-4 py-6 sm:-mx-6 sm:px-6"
      style={{ background: "linear-gradient(180deg,#f6faf8 0%,#eff7f3 100%)" }}
    >
      {/* DB Connection Indicator */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-[#d1fae5] bg-white/70 px-4 py-2 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {dbMode === "supabase" ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-emerald-700">Connected to Supabase Database</span>
            </>
          ) : (
            <>
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>Offline Cache Mode (Run 010 migration to enable persistent database storage)</span>
            </>
          )}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          AiSend Integrations System
        </div>
      </div>

      {/* HERO HEADER */}
      <div
        className="mb-6 overflow-hidden rounded-2xl border border-[#d1fae5] p-6 shadow-sm"
        style={{ background: "linear-gradient(135deg,#fff 0%,#f0fdf4 100%)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                App Store
              </span>
            </div>
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg,#0c1f17,#047857)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Integrations Hub
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Supercharge your WhatsApp business — connect the tools you already love.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-[#d1fae5] bg-white px-5 py-3 text-center shadow-[0_4px_12px_rgba(16,185,129,0.08)]">
              <div className="text-2xl font-extrabold text-emerald-700" style={{ fontFamily: "var(--font-display)" }}>
                {installedApps.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">
                Connected
              </div>
            </div>
            <div className="rounded-xl border border-[#e7ece9] bg-white px-5 py-3 text-center shadow-sm">
              <div className="text-2xl font-extrabold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                {APPS.length}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Available
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="shrink-0 lg:w-[220px]">
          <div className="overflow-hidden rounded-2xl border border-[#e7ece9] bg-white shadow-sm">
            <div className="px-4 pt-5 pb-2">
              <h2
                className="text-lg font-bold tracking-tight text-[#0c1f17]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Categories
              </h2>
            </div>

            <nav className="flex flex-col gap-0.5 px-2 pb-2">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 ${
                      active
                        ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    <c.icon className={`size-4 shrink-0 ${active ? "text-emerald-600" : "text-slate-400"}`} />
                    {c.label}
                  </button>
                );
              })}
            </nav>

            <div className="mx-4 border-t border-[#e7ece9]" />

            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Installed Apps
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="size-4 animate-spin text-slate-400" />
              </div>
            ) : installedApps.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-slate-400">No apps connected yet</p>
            ) : (
              <div className="flex flex-col gap-0.5 px-2 pb-4">
                {installedApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      onClick={() => setCategory("installed")}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                        category === "installed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="relative flex size-5 items-center justify-center">
                        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                        <Icon className="size-4 text-slate-500" />
                      </span>
                      <span className="truncate">{app.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="min-w-0 flex-1 space-y-5">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full rounded-xl border border-[#e7ece9] bg-white py-3 pl-11 pr-4 text-sm text-[#0c1f17] placeholder:text-slate-400 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-emerald-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#e7ece9] bg-white py-16 px-6 text-center shadow-sm">
              <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <Store className="size-7" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No integrations found</p>
              <p className="mt-1 text-xs text-slate-400">
                {category === "installed"
                  ? "You haven't connected any integrations yet."
                  : "Try a different category or search term."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((app) => {
                const isInstalled = connections[app.id]?.status === "connected";
                const Icon = app.icon;
                return (
                  <div
                    key={app.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e7ece9] bg-white p-5 shadow-[0_1px_2px_rgba(12,31,23,.04),0_8px_24px_rgba(12,31,23,.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_8px_rgba(12,31,23,.06),0_24px_48px_rgba(12,31,23,.1)]"
                    style={{ borderColor: isInstalled ? `${app.accent}40` : undefined }}
                  >
                    {/* Top accent stripe */}
                    <span
                      className="absolute left-0 right-0 top-0 h-[3px] opacity-90"
                      style={{ background: app.accent }}
                    />
                    {/* Soft colored glow blob in top-right */}
                    <span
                      className="pointer-events-none absolute -top-1/2 right-[-30%] h-[120%] w-[60%]"
                      style={{
                        background: `radial-gradient(circle, ${app.glow.replace(".4", ".08")} 0%, transparent 60%)`,
                      }}
                    />

                    <div className="relative z-10 flex items-start justify-between">
                      <span
                        className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${app.gradient} text-white transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}
                        style={{ boxShadow: `0 8px 20px ${app.glow}` }}
                      >
                        <Icon className="size-6" />
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isInstalled ? (
                          <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                            <Check className="size-3" /> Installed
                          </span>
                        ) : app.badge === "Popular" ? (
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-pink-900"
                            style={{
                              background: "linear-gradient(135deg,#fce7f3,#fbcfe8)",
                              border: "1px solid #f9a8d4",
                            }}
                          >
                            🔥 Popular
                          </span>
                        ) : app.badge === "New" ? (
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-900"
                            style={{
                              background: "linear-gradient(135deg,#fef3c7,#fde68a)",
                              border: "1px solid #fcd34d",
                            }}
                          >
                            ⭐ New
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <h3 className="relative z-10 mt-4 text-base font-extrabold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
                      {app.name}
                    </h3>

                    <p className="relative z-10 mt-1 flex-1 text-sm leading-relaxed text-slate-500">
                      {app.description}
                    </p>

                    <button
                      onClick={() => openModal(app)}
                      className={`relative z-10 mt-4 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
                        isInstalled
                          ? "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                          : "text-white hover:-translate-y-0.5"
                      }`}
                      style={
                        !isInstalled
                          ? {
                              background: "linear-gradient(135deg,#10b981,#059669)",
                              boxShadow: "0 6px 16px rgba(16,185,129,.3)",
                            }
                          : undefined
                      }
                    >
                      {isInstalled ? (
                        <>
                          <Settings className="size-4" /> Manage
                        </>
                      ) : (
                        <>
                          <Plus className="size-4" /> Connect
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── DYNAMIC CONFIG MODAL ── */}
      {activeModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="relative border-b border-slate-100 px-6 py-4">
              <span
                className="absolute left-0 right-0 top-0 h-[3px]"
                style={{ background: activeModalApp.accent }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${activeModalApp.gradient} text-white`}
                    style={{ boxShadow: `0 6px 14px ${activeModalApp.glow}` }}
                  >
                    <activeModalApp.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>
                      {connections[activeModalApp.id]?.status === "connected" ? "Manage" : "Connect"} {activeModalApp.name}
                    </h3>
                    <p className="text-[11px] text-slate-400">Configure your integration settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModalApp(null)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <form onSubmit={saveConfig}>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">

                {activeModalApp.id === "google-sheets" && (
                  <div className="space-y-4">
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Google Authentication
                      </p>

                      {googleEmail ? (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                              {googleEmail.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-slate-700">{googleName || "Google Account"}</p>
                              <p className="truncate text-[10px] text-slate-500">{googleEmail}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setGoogleEmail(""); setGoogleName(""); }}
                            className="px-2 text-[10px] font-bold text-red-600 hover:underline"
                          >
                            Sign Out
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          disabled={googleLoggingIn}
                          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          {googleLoggingIn ? (
                            <Loader2 className="size-4 animate-spin text-slate-400" />
                          ) : (
                            <Globe className="size-4 text-red-500" />
                          )}
                          Sign in with Google
                        </button>
                      )}
                    </div>

                    <Field label="Spreadsheet URL">
                      <input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." required className={inputCls} />
                    </Field>
                    <Field label="Sheet Name">
                      <input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Sheet1" required className={inputCls} />
                    </Field>
                  </div>
                )}

                {activeModalApp.id === "dialogflow" && (
                  <div className="space-y-4">
                    <Field label="Google Cloud Project ID">
                      <input value={dialogflowProjId} onChange={(e) => setDialogflowProjId(e.target.value)} placeholder="my-dialogflow-project-123" required className={inputCls} />
                    </Field>
                    <Field label="Agent Name / Display Name">
                      <input value={dialogflowAgent} onChange={(e) => setDialogflowAgent(e.target.value)} placeholder="Customer Support Agent" required className={inputCls} />
                    </Field>
                    <Field label="Service Account Key (JSON)">
                      <textarea value={dialogflowKey} onChange={(e) => setDialogflowKey(e.target.value)} placeholder='{ "type": "service_account", ... }' rows={4} required className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                )}

                {activeModalApp.id === "shopify" && (
                  <div className="space-y-4">
                    <Field label="Shopify Store URL">
                      <input value={shopifyUrl} onChange={(e) => setShopifyUrl(e.target.value)} placeholder="my-boutique.myshopify.com" required className={inputCls} />
                    </Field>
                    <Field label="Admin Access Token">
                      <input type="password" value={shopifyToken} onChange={(e) => setShopifyToken(e.target.value)} placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx" required className={inputCls} />
                    </Field>
                  </div>
                )}

                {activeModalApp.id === "woocommerce" && (
                  <div className="space-y-4">
                    <Field label="WordPress Store URL">
                      <input value={wooUrl} onChange={(e) => setWooUrl(e.target.value)} placeholder="https://mywoo-store.com" required className={inputCls} />
                    </Field>
                    <Field label="Consumer Key">
                      <input value={wooKey} onChange={(e) => setWooKey(e.target.value)} placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxx" required className={inputCls} />
                    </Field>
                    <Field label="Consumer Secret">
                      <input type="password" value={wooSecret} onChange={(e) => setWooSecret(e.target.value)} placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxx" required className={inputCls} />
                    </Field>
                  </div>
                )}

                {(activeModalApp.id === "razorpay" || activeModalApp.id === "payu") && (
                  <div className="space-y-4">
                    <Field label="API Key ID">
                      <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={activeModalApp.id === "razorpay" ? "rzp_live_xxxxxx" : "merchant_key_xxxxx"} required className={inputCls} />
                    </Field>
                    <Field label="API Key Secret / Salt">
                      <input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="••••••••••••••••" required className={inputCls} />
                    </Field>
                  </div>
                )}

                {activeModalApp.id === "wa-link-gen" && (
                  <div className="space-y-4">
                    <Field label="WhatsApp Phone Number">
                      <input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="+919876543210" required className={inputCls} />
                    </Field>
                    <Field label="Pre-filled Message">
                      <textarea value={waMessage} onChange={(e) => setWaMessage(e.target.value)} placeholder="I'm interested in your services!" rows={3} required className={inputCls} />
                    </Field>

                    {connections[activeModalApp.id]?.status === "connected" && waNumber && (
                      <div className="space-y-2 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 text-xs">
                        <p className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <Sparkles className="size-3.5" /> Your Shareable Link:
                        </p>
                        <a
                          href={`https://wa.me/${waNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waMessage)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-all rounded-lg border bg-white p-2 font-mono text-[10px] text-blue-600 hover:underline"
                        >
                          https://wa.me/{waNumber.replace(/[^\d]/g, "")}?text={encodeURIComponent(waMessage).substring(0, 50)}...
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {activeModalApp.id === "wa-widget" && (
                  <div className="space-y-4">
                    <Field label="WhatsApp Phone Number">
                      <input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="+919876543210" required className={inputCls} />
                    </Field>
                    <Field label="Widget Title Header">
                      <input value={widgetHeader} onChange={(e) => setWidgetHeader(e.target.value)} placeholder="Chat with Us" required className={inputCls} />
                    </Field>
                    <Field label="Welcome Message">
                      <input value={widgetMessage} onChange={(e) => setWidgetMessage(e.target.value)} placeholder="Hi! How can we help you today?" required className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Button Text">
                        <input value={widgetBtnText} onChange={(e) => setWidgetBtnText(e.target.value)} placeholder="Start Chat" required className={inputCls} />
                      </Field>
                      <Field label="Widget Position">
                        <select value={widgetPosition} onChange={(e) => setWidgetPosition(e.target.value)} className={`${inputCls} bg-white`}>
                          <option value="right">Bottom Right</option>
                          <option value="left">Bottom Left</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Theme Color">
                      <div className="flex items-center gap-2">
                        <input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="size-8 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                        <span className="font-mono text-xs uppercase text-slate-600">{widgetColor}</span>
                      </div>
                    </Field>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                {connections[activeModalApp.id]?.status === "connected" ? (
                  <button
                    type="button"
                    onClick={() => handleDisconnect(activeModalApp.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveModalApp(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5"
                    style={{
                      background: "linear-gradient(135deg,#10b981,#059669)",
                      boxShadow: "0 6px 16px rgba(16,185,129,.3)",
                    }}
                  >
                    {savingConfig && <Loader2 className="size-3 animate-spin text-white" />}
                    Save Connection
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
