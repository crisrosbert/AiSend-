"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, ArrowDownUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
}

type TabValue = "open" | "pending" | "resolved";

const STATUS_DOT: Record<ConversationStatus, string> = {
  open: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-slate-400",
};

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("open");
  const [loading, setLoading] = useState(true);

  const onLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onLoadedRef.current = onConversationsLoaded;
  });

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("conversations")
          .select(`
            *,
            contact:contacts(*)
          `)
          .order("last_message_at", { ascending: false });

        if (error) {
          console.error("Failed to fetch conversations:", error);
          onLoadedRef.current([]);
          return;
        }
        onLoadedRef.current((data ?? []) as Conversation[]);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  // Map tab → status filter ("resolved" maps to "closed" in DB)
  const filtered = useMemo(() => {
    const statusFor: Record<TabValue, ConversationStatus> = {
      open: "open",
      pending: "pending",
      resolved: "closed",
    };
    let result = conversations.filter((c) => c.status === statusFor[activeTab]);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }
    return result;
  }, [conversations, activeTab, search]);

  // Counts per tab
  const counts = useMemo(() => ({
    open: conversations.filter((c) => c.status === "open").length,
    pending: conversations.filter((c) => c.status === "pending").length,
    resolved: conversations.filter((c) => c.status === "closed").length,
  }), [conversations]);

  return (
    <div className="flex h-full w-full flex-col bg-white lg:w-[340px]">
      {/* Search */}
      <div className="border-b border-[#e7ece9] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-[#e7ece9] bg-[#f8faf9] py-2 pl-9 pr-3 text-sm text-[#0c1f17] placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Segmented pill tabs with count chips */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[#e7ece9] bg-[#f8faf9] p-1">
            <TabButton
              active={activeTab === "open"}
              onClick={() => setActiveTab("open")}
              label="Open"
              count={counts.open}
            />
            <TabButton
              active={activeTab === "pending"}
              onClick={() => setActiveTab("pending")}
              label="Pending"
              count={counts.pending}
            />
            <TabButton
              active={activeTab === "resolved"}
              onClick={() => setActiveTab("resolved")}
              label="Resolved"
              count={counts.resolved}
            />
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Sort"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Search className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {search ? "No matches" : `No ${activeTab} chats`}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {search
                ? "Try a different search term."
                : activeTab === "open"
                ? "New chats from customers will appear here."
                : `Mark conversations as ${activeTab} to see them here.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
        active
          ? "bg-white text-emerald-700 shadow-sm"
          : "text-slate-500 hover:text-slate-700"
      )}
    >
      {label}
      <span
        className={cn(
          "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
          active
            ? "bg-emerald-500 text-white"
            : count === 0
            ? "bg-slate-200 text-slate-400"
            : "bg-emerald-100 text-emerald-700"
        )}
      >
        {count}
      </span>
    </button>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
}

function ConversationItem({ conversation, isActive, onSelect }: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();
  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })
    : "";

  return (
    <button
      onClick={() => onSelect(conversation)}
      className={cn(
        "group relative flex w-full items-start gap-3 border-b border-[#e7ece9] px-4 py-3 text-left transition-colors",
        isActive
          ? "bg-emerald-50/70"
          : "hover:bg-[#f8faf9]"
      )}
    >
      {/* Left accent stripe when active */}
      {isActive && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-emerald-500" />
      )}

      {/* Avatar with status dot */}
      <div className="relative shrink-0">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-200 to-emerald-500 text-sm font-bold text-white shadow-sm">
          {contact?.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
            STATUS_DOT[conversation.status]
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              conversation.unread_count > 0
                ? "font-bold text-[#0c1f17]"
                : "font-semibold text-slate-700"
            )}
          >
            {displayName}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-slate-400">{timeAgo}</span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              conversation.unread_count > 0
                ? "font-semibold text-slate-700"
                : "text-slate-500"
            )}
          >
            {conversation.last_message_text || "No messages yet"}
          </p>
          {conversation.unread_count > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
              {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
