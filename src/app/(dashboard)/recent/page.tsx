"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { 
  History, 
  Search, 
  MessageSquare, 
  Bot, 
  Radio, 
  ChevronRight, 
  Loader2, 
  Inbox 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface RecentActivity {
  contact_id: string;
  conversation_id: string;
  contact_name: string;
  contact_phone: string;
  avatar_url: string | null;
  event_type: "customer_msg" | "agent_msg" | "bot_msg" | "broadcast";
  subtitle_prefix: "USER:" | "SYSTEM:";
  subtitle_text: string;
  badge_color: string;
  bg_color: string;
  icon: React.ComponentType<{ className?: string }>;
  created_at: string;
}

export default function RecentActivityPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "user" | "system">("all");

  const slug = params?.slug as string;

  const fetchRecentActivity = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Pull latest messages sequentially to derive current chronological touchpoints
      const { data: messagesData, error: msgError } = await supabase
        .from("messages")
        .select(`
          id,
          conversation_id,
          sender_type,
          content_type,
          content_text,
          created_at,
          conversations!inner (
            user_id,
            contact:contacts!inner (
              id,
              name,
              phone,
              avatar_url
            )
          )
        `)
        .eq("conversations.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (msgError) throw msgError;

      // 2. Map and format raw payload metrics into chronological activity feeds
      const mappedActivities: RecentActivity[] = (messagesData || []).map((msg: any) => {
        const contact = msg.conversations.contact;
        let event_type: RecentActivity["event_type"] = "customer_msg";
        let subtitle_prefix: RecentActivity["subtitle_prefix"] = "USER:";
        let subtitle_text = msg.content_text || `[Shared ${msg.content_type}]`;
        let badge_color = "bg-blue-500 text-white";
        let bg_color = "bg-blue-50";
        let icon = MessageSquare;

        if (msg.sender_type === "agent") {
          event_type = "agent_msg";
          subtitle_prefix = "SYSTEM:";
          subtitle_text = `Reply sent: ${subtitle_text}`;
          badge_color = "bg-emerald-500 text-white";
          bg_color = "bg-emerald-50";
        } else if (msg.sender_type === "bot") {
          event_type = "bot_msg";
          subtitle_prefix = "SYSTEM:";
          subtitle_text = `Bot flow triggered: ${subtitle_text}`;
          badge_color = "bg-amber-500 text-white";
          bg_color = "bg-amber-50";
          icon = Bot;
        } else if (msg.content_type === "template") {
          event_type = "broadcast";
          subtitle_prefix = "SYSTEM:";
          subtitle_text = `Marketing Template Sent: ${subtitle_text}`;
          badge_color = "bg-purple-500 text-white";
          bg_color = "bg-purple-50";
          icon = Radio;
        } else {
          subtitle_text = `Sent message: ${subtitle_text}`;
        }

        return {
          contact_id: contact.id,
          conversation_id: msg.conversation_id,
          contact_name: contact.name || contact.phone || "Unknown Customer",
          contact_phone: contact.phone,
          avatar_url: contact.avatar_url,
          event_type,
          subtitle_prefix,
          subtitle_text,
          badge_color,
          bg_color,
          icon,
          created_at: msg.created_at,
        };
      });

      // 3. De-duplicate so each contact shows only their single absolute latest activity touchpoint
      const uniqueContactsMap = new Map<string, RecentActivity>();
      for (const activity of mappedActivities) {
        if (!uniqueContactsMap.has(activity.contact_id)) {
          uniqueContactsMap.set(activity.contact_id, activity);
        }
      }

      setActivities(Array.from(uniqueContactsMap.values()));
    } catch (err) {
      console.error("Failed to load aggregate activity tracks:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRecentActivity();
  }, [fetchRecentActivity]);

  // ── FILTERING AND SEARCH PROCESSING ──
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchesSearch =
        act.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.contact_phone.includes(searchQuery) ||
        act.subtitle_text.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (activeFilter === "user") return act.subtitle_prefix === "USER:";
      if (activeFilter === "system") return act.subtitle_prefix === "SYSTEM:";
      return true;
    });
  }, [activities, searchQuery, activeFilter]);

  const handleRowClick = (conversationId: string) => {
    // Dynamically navigates straight to live chat workspace matching your shell layout configurations
    const basePath = slug ? `/${slug}/inbox` : "/inbox";
    router.push(`${basePath}?c=${conversationId}`);
  };

  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-3.5rem)] flex-col bg-[#f8faf9] overflow-hidden">
      {/* Upper Header Control Section */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e7ece9] bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#0c1f17] leading-tight">Recent Activity</h1>
            <p className="text-[11px] text-slate-400 leading-tight">
              Chronological feed of unified communication touchpoints
            </p>
          </div>
        </div>

        {/* Filter Navigation Rails */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#e7ece9] bg-slate-50 p-1">
          {(["all", "user", "system"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-all",
                activeFilter === filter
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-700"
              )}
            >
              {filter === "all" ? "All Logs" : filter === "user" ? "User Actions" : "System Events"}
            </button>
          ))}
        </div>
      </div>

      {/* Control Utility Search Bar */}
      <div className="shrink-0 bg-white border-b border-[#e7ece9] px-5 py-2.5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contact profile name, phone ID, or execution summary..."
            className="w-full rounded-xl border border-[#e7ece9] bg-slate-50 pl-9 pr-4 py-2 text-xs text-[#0c1f17] outline-none transition-all focus:border-emerald-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Main Table Feed Component */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-white border border-[#e7ece9] rounded-2xl p-6 text-center">
            <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-slate-50 text-slate-300">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0c1f17]">No matching activities verified</p>
              <p className="text-xs text-slate-400 max-w-xs mt-0.5">
                New incoming webhooks, template distributions, and bot updates populate automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {filteredActivities.map((act) => (
              <div
                key={act.contact_id}
                onClick={() => handleRowClick(act.conversation_id)}
                className="group flex items-center justify-between border border-[#e7ece9] bg-white p-3 rounded-xl shadow-sm transition-all hover:border-emerald-500 hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Left Avatar Stack Indicator */}
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f4ee] text-sm font-bold text-[#0c1f17]">
                      {act.avatar_url ? (
                        <img
                          src={act.avatar_url}
                          alt={act.contact_name}
                          className="h-full w-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        act.contact_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Small Corner Badge mapping the exact category event type channel */}
                    <div className={cn("absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white shadow-xs", act.bg_color)}>
                      <act.icon className={cn("h-2.5 w-2.5", act.badge_color.replace("bg-", "text-"))} />
                    </div>
                  </div>

                  {/* Core Activity Metadata Frame */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0c1f17] truncate">{act.contact_name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{act.contact_phone}</span>
                    </div>
                    {/* Dynamic "USER: Call Now" / "SYSTEM: Template Sent" style layout */}
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className={cn(
                        "text-[10px] font-extrabold px-1 py-0.5 rounded-md shrink-0 uppercase tracking-wide",
                        act.subtitle_prefix === "USER:" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {act.subtitle_prefix}
                      </span>
                      <p className="text-xs text-slate-500 truncate max-w-md group-hover:text-slate-800 transition-colors">
                        {act.subtitle_text}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Timeline Frame Indicators */}
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
