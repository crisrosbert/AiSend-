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
import { WifiOff, Inbox } from "lucide-react";
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
      const isConnected =
        data?.status === "connected" ||
        (!!data?.phone_number_id && !!data?.access_token);
      setWhatsappConnected(isConnected);
    };
    checkConnection();
  }, []);

  // ── FIXED REAL-TIME MESSAGE ROUTING ──
  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;
      if (event.eventType === "INSERT") {
        // 1. Append message to the thread view only if it belongs to the active conversation panel
        if (activeConversation && newMsg.conversation_id === activeConversation.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const withoutOptimistic = prev.filter((m) => !m.id.startsWith("temp-"));
            return [...withoutOptimistic, newMsg];
          });
        }

        // 2. Update side rail metadata AND reorganize list order dynamically (WhatsApp Style)
        setConversations((prev) => {
          const targetExists = prev.some((c) => c.id === newMsg.conversation_id);

          if (!targetExists) {
            // If the conversation object doesn't exist in our state sidebar array yet, 
            // wait for handleConversationEvent to insert it or ignore orphan logs.
            return prev;
          }

          const updatedList = prev.map((c) => {
            if (c.id === newMsg.conversation_id) {
              return {
                ...c,
                last_message_text: newMsg.content_text ?? "[Media/Template]",
                last_message_at: newMsg.created_at,
                unread_count:
                  activeConversation?.id === newMsg.conversation_id
                    ? 0
                    : c.unread_count + 1,
              };
            }
            return c;
          });

          // Sort dynamically: Push the conversation with the newest text message right to the absolute top
          return [...updatedList].sort(
            (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          );
        });
      } else if (event.eventType === "UPDATE") {
        if (activeConversation && newMsg.conversation_id === activeConversation.id) {
          setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? newMsg : m)));
        }
      }
    },
    [activeConversation]
  );

  // ── FIXED REAL-TIME CONVERSATION DEDUPLICATION ──
  const handleConversationEvent = useCallback(
    (event: { eventType: string; new: Conversation; old: Partial<Conversation> }) => {
      const conv = event.new;
      if (event.eventType === "INSERT") {
        setConversations((prev) => {
          // Strict Guard: If the conversation is already sitting inside our sidebar array, completely block duplication rows!
          if (prev.some((c) => c.id === conv.id)) return prev;
          return [conv, ...prev];
        });
      } else if (event.eventType === "UPDATE") {
        setConversations((prev) => {
          const updated = prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c));
          // Keep list sorting perfectly chronological when conversation record changes
          return [...updated].sort(
            (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          );
        });
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
      // Ensure initial mount load lists are cleanly sorted by timeline activity out of the box
      const sortedLoaded = [...loaded].sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
      setConversations(sortedLoaded);
      
      if (
        deepLinkConvId &&
        autoSelectedForDeepLinkRef.current !== deepLinkConvId &&
        sortedLoaded.length > 0
      ) {
        autoSelectedForDeepLinkRef.current = deepLinkConvId;
        if (activeConversation?.id === deepLinkConvId) return;
        const match = sortedLoaded.find((c) => c.id === deepLinkConvId);
        if (match) {
          setActiveConversation(match);
          setActiveContact(match.contact ?? null);
          setMessages([]);
        }
      }
    },
    [deepLinkConvId, activeConversation]
  );

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      setActiveConversation(conv);
      setActiveContact(conv.contact ?? null);
      setMessages([]);
      if (deepLinkConvId && deepLinkConvId !== conv.id) {
        router.replace("/inbox", { scroll: false });
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
      );
    },
    [deepLinkConvId, router]
  );

  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages(loaded);
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleUpdateMessage = useCallback(
    (msgId: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m))
      );
    },
    []
  );

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
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#e7ece9] bg-white px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#0c1f17] leading-tight">Live Chat</h1>
            <p className="text-[11px] text-slate-400 leading-tight">
              {openCount > 0
                ? `${openCount} open conversation${openCount === 1 ? "" : "s"}`
                : "All caught up"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            LIVE
          </span>
        </div>
      </div>

      {/* WhatsApp not-connected banner */}
      {whatsappConnected === false && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <WifiOff className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-xs font-semibold text-amber-700">
            WhatsApp is not connected.{" "}
            <a href="/settings?tab=whatsapp" className="underline hover:text-amber-900">
              Go to Settings
            </a>{" "}
            to connect your account.
          </p>
        </div>
      )}

      {/* 3-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — conversation list */}
        <div
          className={cn(
            "flex h-full flex-1 lg:flex-none border-r border-[#e7ece9] bg-white",
            hasActiveConv ? "hidden lg:flex" : "flex"
          )}
        >
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
          />
        </div>

        {/* CENTER — message thread */}
        <div
          className={cn(
            "flex h-full flex-1 bg-[#f8faf9]",
            hasActiveConv ? "flex" : "hidden lg:flex"
          )}
        >
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center bg-[#f8faf9]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-[#e7ece9] shadow-sm">
        <Inbox className="h-7 w-7 text-slate-300" />
      </div>
      <div>
        <h2 className="text-base font-bold text-[#0c1f17]">Your inbox is ready</h2>
        <p className="mt-1 max-w-xs text-sm text-slate-400 leading-relaxed">
          Select a conversation from the left to start replying. New messages appear here in real time.
        </p>
      </div>
      {whatsappConnected === false && (
        <a
          href="/settings?tab=whatsapp"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors"
        >
          Connect WhatsApp →
        </a>
      )}
      {whatsappConnected === true && (
        <p className="text-[11px] text-slate-400">
          No messages yet? Customers can message your business number to start a conversation.
        </p>
      )}
    </div>
  );
}
