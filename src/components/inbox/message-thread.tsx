// 1. Define the Media Send Function inside your MessageThread component block:
const handleSendMedia = useCallback(
  async (file: File, contentType: "image" | "video" | "audio" | "document") => {
    if (!conversation) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversation_id", conversation.id);
    formData.append("content_type", contentType);

    try {
      const res = await fetch("/api/whatsapp/media-upload", {
        method: "POST",
        body: formData, // Multi-part form layout passes boundaries cleanly
      });

      if (!res.ok) throw new Error("Upload response error state");
      toast.success(`${contentType} sent successfully!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload attachment");
    }
  },
  [conversation]
);

// 2. Wire it down inside your layout JSX tree wrapper:
<MessageComposer
  conversationId={conversation.id}
  sessionExpired={sessionInfo.expired}
  onSend={handleSend}
  onSendMedia={handleSendMedia} // <-- ADD THIS LINE
  onOpenTemplates={handleOpenTemplates}
  replyTo={replyTo}
  onClearReply={() => setReplyTo(null)}
/>
