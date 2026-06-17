"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message, Contact, ConversationStatus } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
import { toast } from "sonner";
import { WifiOff, MessageSquare, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkConvId = searchParams.get("c");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const autoSelectedForDeepLinkRef = useRef<string | null>(null);

  // Check WhatsApp connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_config")
        .select("status, phone_number_id, access_token")
        .eq("user_id", user.id)
        .maybeSingle();
      // Treat as connected if status is "connected" OR if we have credentials
      // (some setups don't set status field even when working)
      const isConnected = data?.status === "connected" ||
        (!!data?.phone_number_id && !!data?.access_token);
      setWhatsappConnected(isConnected);
    };
    checkConnection();
  }, []);

  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;
      if (event.eventType === "INSERT") {
        if (activeConversation && newMsg.conversation_id === activeConversation.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const withoutOptimistic = prev.filter((m) => !m.id.startsWith("temp-"));
            return [...withoutOptimistic, newMsg];
          });
        }
        setConversations((prev) =>
          prev.map((c) =>
            c.id === newMsg.conversation_id
              ? {
                  ...c,
                  last_message_text: newMsg.content_text ?? "",
                  last_message_at: newMsg.created_at,
                  unread_count:
                    activeConversation?.id === newMsg.conversation_id
                      ? 0
                      : c.unread_count + 1,
                }
              : c
          )
        );
      } else if (event.eventType === "UPDATE") {
        if (activeConversation && newMsg.conversation_id === activeConversation.id) {
          setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? newMsg : m)));
        }
      }
    },
    [activeConversation]
  );

  const handleConversationEvent = useCallback(
    (event: { eventType: string; new: Conversation; old: Partial<Conversation> }) => {
      const conv = event.new;
      if (event.eventType === "INSERT") {
        setConversations((prev) => [conv, ...prev]);
      } else if (event.eventType === "UPDATE") {
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c))
        );
        if (activeConversation?.id === conv.id) {
          setActiveConversation((prev) => (prev ? { ...prev, ...conv } : prev));
        }
      }
    },
    [activeConversation]
  );

  useRealtime({
    channelName: "inbox-realtime",
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: true,
  });

  const handleConversationsLoaded = useCallback(
    (loaded: Conversation[]) => {
      setConversations(loaded);
      if (
        deepLinkConvId &&
        autoSelectedForDeepLinkRef.current !== deepLinkConvId &&
        loaded.length > 0
      ) {
        autoSelectedForDeepLinkRef.current = deepLinkConvId;
        if (activeConversation?.id === deepLinkConvId) return;
        const match = loaded.find((c) => c.id === deepLinkConvId);
        if (match) {
          setActiveConversation(match);
          setActiveContact(match.contact ?? null);
          setMessages([]);
        }
      }
    },
    [deepLinkConvId, activeConversation]
  );

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setActiveConversation(conv);
    setActiveContact(conv.contact ?? null);
    setMessages([]);
    if (deepLinkConvId && deepLinkConvId !== conv.id) {
      router.replace("/inbox", { scroll: false });
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  }, [deepLinkConvId, router]);

  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages(loaded);
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleUpdateMessage = useCallback((msgId: string, updates: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m)));
  }, []);

  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
  }, []);

  const handleStatusChange = useCallback(
    (conversationId: string, status: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, status } : prev));
      }
    },
    [activeConversation]
  );

  const handleAssignChange = useCallback(
    (conversationId: string, assignedAgentId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, assigned_agent_id: assignedAgentId ?? undefined }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev
            ? { ...prev, assigned_agent_id: assignedAgentId ?? undefined }
            : prev
        );
      }
    },
    [activeConversation]
  );

  const hasActiveConv = !!activeConversation;
  const openCount = conversations.filter((c) => c.status === "open").length;

  return (
    <div className="-m-4 sm:-m-6 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#f8faf9]">
      {/* Top status bar — emerald-themed Live Chat header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e7ece9] bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
              Live Chat
            </h1>
            <p className="text-[11px] text-slate-500">
              {openCount > 0 ? `${openCount} active conversation${openCount === 1 ? "" : "s"}` : "All caught up"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Real-time sync
          </span>
        </div>
      </div>

      {/* WhatsApp not-connected banner — emerald light theme */}
      {whatsappConnected === false && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <p className="text-xs font-semibold text-amber-700">
            WhatsApp is not connected.{" "}
            <a href="/settings?tab=whatsapp" className="underline hover:text-amber-900">
              Go to Settings
            </a>{" "}
            to connect your account.
          </p>
        </div>
      )}

      {/* Main 3-pane area */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — conversation list */}
        <div className={cn(
          "flex h-full flex-1 lg:flex-none border-r border-[#e7ece9] bg-white",
          hasActiveConv ? "hidden lg:flex" : "flex",
        )}>
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
          />
        </div>

        {/* CENTER — message thread */}
        <div className={cn(
          "flex h-full flex-1 lg:flex bg-[#f8faf9]",
          hasActiveConv ? "flex" : "hidden lg:flex",
        )}>
          {!hasActiveConv ? (
            <EmptyState whatsappConnected={whatsappConnected} />
          ) : (
            <MessageThread
              conversation={activeConversation}
              contact={activeContact}
              messages={messages}
              onMessagesLoaded={handleMessagesLoaded}
              onNewMessage={handleNewMessage}
              onUpdateMessage={handleUpdateMessage}
              onStatusChange={handleStatusChange}
              onAssignChange={handleAssignChange}
              onBack={handleCloseConversation}
            />
          )}
        </div>

        {/* RIGHT — contact sidebar (desktop only) */}
        <div className="hidden lg:block border-l border-[#e7ece9] bg-white">
          <ContactSidebar contact={activeContact} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ whatsappConnected }: { whatsappConnected: boolean | null }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-600 shadow-[0_10px_30px_rgba(16,185,129,.18)]">
        <MessageSquare className="h-9 w-9" />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
          <Radio className="h-3 w-3" />
        </span>
      </div>
      <h2 className="text-xl font-bold text-[#0c1f17]" style={{ fontFamily: "var(--font-display)" }}>
        Pick a conversation
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Select a chat from the left to start replying. New messages appear here in real time.
      </p>
      {whatsappConnected === false && (
        <a
          href="/settings?tab=whatsapp"
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
        >
          Connect WhatsApp →
        </a>
      )}
      {whatsappConnected === true && (
        <p className="mt-4 text-[11px] text-slate-400">
          No new messages yet? Customers can message your business number to start a conversation.
        </p>
      )}
    </div>
  );
}
