// Add this helper function at the top of your route.ts file or inside the file scope
async function fetchWhatsAppProfilePic(phoneNumberId: string, accessToken: string, customerWaId: string): Promise<string | null> {
  try {
    // Meta Graph API endpoint to look up contact business profile nodes
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_contacts?fields=profile_picture_url&input=[%22${customerWaId}%22]`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    // Meta returns an array matching your input query strings
    const profilePictureUrl = data?.data?.[0]?.profile_picture_url || null;
    return profilePictureUrl;
  } catch (err) {
    console.error("Failed to fetch WhatsApp profile picture:", err);
    return null;
  }
}

// ── INSIDE YOUR POST HANDLING LOGIC ──
// When processing the incoming webhook payload:
const customerWaId = contactsArray[0].wa_id; // e.g., "918884355757"
const customerName = contactsArray[0].profile.name || "Customer";

// 1. Check if the contact already exists in your database table
let { data: existingContact } = await supabase
  .from("contacts")
  .select("*")
  .eq("phone", customerWaId)
  .maybeSingle();

let avatarUrl = existingContact?.avatar_url || null;

// 2. If it's a new contact, or the contact doesn't have a profile picture yet, fetch it from Meta!
if (!avatarUrl) {
  // Pull your active WhatsApp credentials from your config layer
  const phoneNumberId = "1202749299580096"; 
  const accessToken = "YOUR_PERMANENT_ACCESS_TOKEN"; // Ensure this matches your secure variable reference

  avatarUrl = await fetchWhatsAppProfilePic(phoneNumberId, accessToken, customerWaId);
}

// 3. Perform your clean Upsert down to your Supabase table tracking matrix
const { data: contact } = await supabase
  .from("contacts")
  .upsert({
    phone: customerWaId,
    name: customerName,
    avatar_url: avatarUrl, // <-- THIS SAVES THE REAL WHATSAPP AVATAR LINK
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone" })
  .select()
  .single();
