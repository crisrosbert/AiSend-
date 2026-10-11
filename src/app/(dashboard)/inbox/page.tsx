"use client";

// src/app/(dashboard)/inbox/page.tsx
//
// ────────────────────────────────────────────────────────────────────────────
// Live Chat (Inbox) — Design System v2 surgical pass (2026-10-11)
// ────────────────────────────────────────────────────────────────────────────
// A 3-pane full-height chat shell (list · thread · contact sidebar). Unlike
// the dashboard/campaigns/contacts pages, this page CANNOT use the standard
// scrolling container — the thread owns the scroll, the sidebar owns a
// separate scroll, and the whole thing must fill the viewport minus the
// top header.
//
// WHAT CHANGED
// ------------
//   • Dropped the `-m-4 sm:-m-6` negative-margin escape (dashboard-shell's
//     <main> no longer adds padding, so there is nothing to escape from).
//   • Replaced every hardcoded hex (#f8faf9, #e7ece9, #0c1f17) and raw
//     Tailwind class (emerald-500, slate-400, amber-50) with globals.css
//     tokens. One edit in :root re-tints the whole inbox.
//   • The "LIVE" badge now mirrors the design-system Pill shape so it reads
//     as part of the same system as the status pills on Dashboard/Campaigns.
//   • Not-connected banner uses --amber tokens, keeping it visibly distinct
//     from informational text without inventing a new amber shade.
//
// WHAT DID NOT CHANGE
// -------------------
// Realtime wiring, deep-link handling, conversation / message / contact
// state, the three sub-components (ConversationList, MessageThread,
// ContactSidebar) — all preserved verbatim.
// ────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message, Contact, ConversationStatus } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
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

          // Sort dynamically with safe TypeScript fallback boundaries
          return [...updatedList].sort((a, b) => {
            const timeB = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
            const timeA = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
            return timeB - timeA;
          });
        });
      } else if (event.eventType === "UPDATE") {
        if (activeConversation && newMsg.conversation_id === activeConversation.id) {
          setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? newMsg : m)));
        }
      }
    },
    [activeConversation]
  );

  // ── FIXED REAL-TIME CONVERSATION Deduplication ──
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
          return [...updated].sort((a, b) => {
            const timeB = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
            const timeA = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
            return timeB - timeA;
          });
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
      const sortedLoaded = [...loaded].sort((a, b) => {
        const timeB = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
        const timeA = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
        return timeB - timeA;
      });
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
    // Full-viewport shell — no page padding (dashboard-shell removed its
    // own padding, so this page sits flush under the top header and fills
    // the remaining height). The 3-pane body owns its own scroll.
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Page header */}
      <div
        className="flex shrink-0 items-center justify-between border-b px-5 py-3"
        style={{
          borderColor: "var(--line)",
          background: "var(--surface)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white"
            style={{
              background: "linear-gradient(180deg,var(--brand),var(--brand-deep))",
              boxShadow: "var(--shadow-brand)",
            }}
          >
            <Inbox className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <h1
              className="text-[15px] font-bold leading-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
            >
              Live Chat
            </h1>
            <p
              className="text-[11.5px] leading-tight"
              style={{ color: "var(--ink-3)" }}
            >
              {openCount > 0
                ? `${openCount} open conversation${openCount === 1 ? "" : "s"}`
                : "All caught up"}
            </p>
          </div>
        </div>

        {/* LIVE pill — same shape as the design-system Pill, kept inline so
            it can carry its own pulsing dot without recreating the animation. */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em]"
          style={{
            color: "var(--brand-deep)",
            background: "var(--brand-50)",
            borderColor: "var(--brand-200)",
          }}
        >
          <span className="relative inline-flex h-[7px] w-[7px]">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ background: "var(--brand-300)" }}
            />
            <span
              className="relative inline-flex h-[7px] w-[7px] rounded-full"
              style={{ background: "var(--brand)" }}
            />
          </span>
          Live
        </span>
      </div>

      {/* WhatsApp not-connected banner */}
      {whatsappConnected === false && (
        <div
          className="flex shrink-0 items-center justify-center gap-2 border-b px-4 py-2"
          style={{
            borderColor: "var(--amber-200)",
            background: "var(--amber-50)",
          }}
        >
          <WifiOff
            className="h-3.5 w-3.5"
            style={{ color: "var(--amber)" }}
            aria-hidden
          />
          <p
            className="text-[12px] font-semibold"
            style={{ color: "var(--amber)" }}
          >
            WhatsApp is not connected.{" "}
            <a
              href="/settings?tab=whatsapp"
              className="underline"
              style={{ color: "var(--amber)" }}
            >
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
            "flex h-full flex-1 border-r lg:flex-none",
            hasActiveConv ? "hidden lg:flex" : "flex",
          )}
          style={{
            borderColor: "var(--line)",
            background: "var(--surface)",
          }}
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
            "flex h-full flex-1",
            hasActiveConv ? "flex" : "hidden lg:flex",
          )}
          style={{ background: "var(--surface-2)" }}
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
        <div
          className="hidden border-l lg:block"
          style={{
            borderColor: "var(--line)",
            background: "var(--surface)",
          }}
        >
          <ContactSidebar contact={activeContact} />
        </div>
      </div>
    </div>
  );
}

/** The empty-state shown in the thread pane when no conversation is open. */
function EmptyState({ whatsappConnected }: { whatsappConnected: boolean | null }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "var(--surface-2)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{
          background: "var(--surface)",
          borderColor: "var(--line)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--ink-4)",
        }}
      >
        <Inbox className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <h2
          className="text-[16px] font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          Your inbox is ready
        </h2>
        <p
          className="mt-1 max-w-xs text-[13px] leading-relaxed"
          style={{ color: "var(--ink-3)" }}
        >
          Select a conversation from the left to start replying. New messages
          appear here in real time.
        </p>
      </div>
      {whatsappConnected === false && (
        <a
          href="/settings?tab=whatsapp"
          className="inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[13px] font-bold text-white transition-all"
          style={{
            background: "linear-gradient(180deg,var(--brand),var(--brand-deep))",
            boxShadow: "var(--shadow-brand)",
          }}
        >
          Connect WhatsApp →
        </a>
      )}
      {whatsappConnected === true && (
        <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          No messages yet? Customers can message your business number to start a conversation.
        </p>
      )}
    </div>
  );
}
