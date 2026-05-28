// src/lib/template-library.ts
// Pre-built, Meta-guideline-compliant WhatsApp message templates.
// English + Hindi versions across many industries.
// These are STARTING POINTS — the client still submits them to Meta
// for approval in WhatsApp Manager before sending.

export interface LibraryTemplate {
  id: string;
  title: string;
  name: string;
  category: 'Marketing' | 'Utility' | 'Authentication';
  language: string;
  industry: string;
  header_type?: 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  description: string;
  variables: string[];
}

export const TEMPLATE_INDUSTRIES = [
  'All', 'General', 'E-commerce', 'Healthcare', 'Education',
  'Real Estate', 'Restaurant', 'Services', 'Finance', 'Travel', 'Fitness',
] as const;

export const TEMPLATE_LANGUAGES = ['All', 'English', 'Hindi'] as const;

export const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ===== ENGLISH — UTILITY =====
  {
    id: 'order-confirmation-en', title: 'Order Confirmation', name: 'order_confirmation',
    category: 'Utility', language: 'en_US', industry: 'E-commerce',
    body_text: 'Hi {{1}}, your order #{{2}} has been confirmed! 🎉\n\nTotal: {{3}}\nEstimated delivery: {{4}}\n\nThank you for shopping with us.',
    footer_text: 'Reply STOP to unsubscribe',
    description: 'Sent automatically when a customer places an order.',
    variables: ['Customer name', 'Order number', 'Order total', 'Delivery date'],
  },
  {
    id: 'order-shipped-en', title: 'Order Shipped', name: 'order_shipped',
    category: 'Utility', language: 'en_US', industry: 'E-commerce',
    body_text: 'Good news {{1}}! Your order #{{2}} is on its way. 📦\n\nTrack it here: {{3}}\n\nExpected delivery: {{4}}',
    description: 'Notify customer when their order ships with tracking link.',
    variables: ['Customer name', 'Order number', 'Tracking link', 'Delivery date'],
  },
  {
    id: 'appointment-reminder-en', title: 'Appointment Reminder', name: 'appointment_reminder',
    category: 'Utility', language: 'en_US', industry: 'Healthcare',
    body_text: 'Hello {{1}}, this is a reminder for your appointment with {{2}} on {{3}} at {{4}}.\n\nPlease arrive 10 minutes early. To reschedule, reply to this message.',
    footer_text: 'See you soon!',
    description: 'Reduce no-shows by reminding patients of upcoming appointments.',
    variables: ['Patient name', 'Doctor/clinic name', 'Date', 'Time'],
  },
  {
    id: 'payment-received-en', title: 'Payment Received', name: 'payment_received',
    category: 'Utility', language: 'en_US', industry: 'Finance',
    body_text: 'Hi {{1}}, we have received your payment of {{2}}. ✅\n\nInvoice: #{{3}}\nDate: {{4}}\n\nThank you for your business.',
    description: 'Confirm payment receipt to customers.',
    variables: ['Customer name', 'Amount', 'Invoice number', 'Date'],
  },
  {
    id: 'payment-reminder-en', title: 'Payment Reminder', name: 'payment_reminder',
    category: 'Utility', language: 'en_US', industry: 'Finance',
    body_text: 'Hi {{1}}, a friendly reminder that your payment of {{2}} for invoice #{{3}} is due on {{4}}.\n\nTo pay now, reply to this message.',
    description: 'Remind customers of upcoming or overdue payments.',
    variables: ['Customer name', 'Amount', 'Invoice number', 'Due date'],
  },
  {
    id: 'booking-confirmation-en', title: 'Table Booking Confirmation', name: 'booking_confirmation',
    category: 'Utility', language: 'en_US', industry: 'Restaurant',
    body_text: 'Hi {{1}}, your table for {{2}} on {{3}} at {{4}} is confirmed. 🍽️\n\nWe look forward to serving you. To modify your booking, reply here.',
    description: 'Confirm restaurant table reservations.',
    variables: ['Customer name', 'Number of guests', 'Date', 'Time'],
  },
  {
    id: 'travel-reminder-en', title: 'Travel Booking Reminder', name: 'travel_booking_reminder',
    category: 'Utility', language: 'en_US', industry: 'Travel',
    body_text: 'Hi {{1}}, your booking to {{2}} is confirmed for {{3}}. ✈️\n\nBooking ID: {{4}}\n\nHave a great trip! Reply for any assistance.',
    description: 'Confirm travel/flight/hotel bookings.',
    variables: ['Customer name', 'Destination', 'Travel date', 'Booking ID'],
  },
  {
    id: 'class-reminder-en', title: 'Class Reminder', name: 'class_reminder',
    category: 'Utility', language: 'en_US', industry: 'Fitness',
    body_text: 'Hi {{1}}, reminder for your {{2}} class today at {{3}}. 💪\n\nSee you at {{4}}! Reply to cancel or reschedule.',
    description: 'Remind members of their booked fitness/yoga classes.',
    variables: ['Member name', 'Class type', 'Time', 'Location'],
  },
  {
    id: 'service-followup-en', title: 'Service Follow-up', name: 'service_followup',
    category: 'Utility', language: 'en_US', industry: 'Services',
    body_text: 'Hi {{1}}, thank you for choosing {{2}}! How was your experience with our {{3}} service?\n\nWe would love your feedback. Reply here to let us know.',
    description: 'Follow up after a service is completed to gather feedback.',
    variables: ['Customer name', 'Business name', 'Service name'],
  },
  {
    id: 'quote-ready-en', title: 'Quote Ready', name: 'quote_ready',
    category: 'Utility', language: 'en_US', industry: 'Services',
    body_text: 'Hi {{1}}, your quote for {{2}} is ready.\n\nEstimated cost: {{3}}\nValid until: {{4}}\n\nReply to confirm or ask any questions.',
    description: 'Send a service quote to a customer who requested one.',
    variables: ['Customer name', 'Service/project', 'Cost', 'Validity date'],
  },

  // ===== ENGLISH — MARKETING =====
  {
    id: 'welcome-offer-en', title: 'Welcome Offer', name: 'welcome_offer',
    category: 'Marketing', language: 'en_US', industry: 'E-commerce',
    body_text: 'Welcome to {{1}}, {{2}}! 🎁\n\nHere is a special {{3}} discount on your first purchase. Use code: {{4}}\n\nShop now and save!',
    footer_text: 'Reply STOP to opt out',
    description: 'Greet new subscribers with a first-purchase discount.',
    variables: ['Business name', 'Customer name', 'Discount %', 'Promo code'],
  },
  {
    id: 'festive-sale-en', title: 'Festive Sale', name: 'festive_sale',
    category: 'Marketing', language: 'en_US', industry: 'General',
    body_text: 'Hi {{1}}! 🎉 Our {{2}} sale is LIVE!\n\nGet up to {{3}} off on all products. Offer valid till {{4}}.\n\nVisit us today to grab the best deals!',
    footer_text: 'Reply STOP to unsubscribe',
    description: 'Promote seasonal or festival sales to your contact list.',
    variables: ['Customer name', 'Sale name', 'Max discount', 'End date'],
  },
  {
    id: 'abandoned-cart-en', title: 'Abandoned Cart', name: 'abandoned_cart',
    category: 'Marketing', language: 'en_US', industry: 'E-commerce',
    body_text: 'Hi {{1}}, you left some items in your cart! 🛒\n\nComplete your purchase before they sell out. Your cart: {{2}}\n\nNeed help? Just reply here.',
    footer_text: 'Reply STOP to opt out',
    description: 'Recover lost sales by reminding customers of items left in cart.',
    variables: ['Customer name', 'Cart link'],
  },
  {
    id: 'new-course-en', title: 'New Course Launch', name: 'new_course_launch',
    category: 'Marketing', language: 'en_US', industry: 'Education',
    body_text: 'Hi {{1}}! 📚 We just launched a new course: {{2}}.\n\nEnroll before {{3}} and get {{4}} off the fee.\n\nReply YES to know more.',
    footer_text: 'Reply STOP to unsubscribe',
    description: 'Announce new courses or batches to students and leads.',
    variables: ['Student name', 'Course name', 'Deadline', 'Discount'],
  },
  {
    id: 'property-listing-en', title: 'New Property Listing', name: 'new_property_listing',
    category: 'Marketing', language: 'en_US', industry: 'Real Estate',
    body_text: 'Hi {{1}}, a new property matching your interest is available! 🏡\n\n{{2}} | {{3}}\nPrice: {{4}}\n\nReply to schedule a visit.',
    footer_text: 'Reply STOP to opt out',
    description: 'Alert leads about new property listings that match their needs.',
    variables: ['Lead name', 'Property type/location', 'Key features', 'Price'],
  },
  {
    id: 'membership-offer-en', title: 'Membership Offer', name: 'membership_offer',
    category: 'Marketing', language: 'en_US', industry: 'Fitness',
    body_text: 'Hi {{1}}! 💪 Get fit this season at {{2}}.\n\nJoin now and get {{3}} off on annual membership. Offer ends {{4}}.\n\nReply to claim your spot!',
    footer_text: 'Reply STOP to opt out',
    description: 'Promote gym/fitness membership offers.',
    variables: ['Customer name', 'Gym name', 'Discount', 'End date'],
  },

  // ===== ENGLISH — AUTHENTICATION =====
  {
    id: 'otp-verification-en', title: 'OTP Verification', name: 'otp_verification',
    category: 'Authentication', language: 'en_US', industry: 'General',
    body_text: '{{1}} is your verification code. For your security, do not share this code with anyone.',
    description: 'Send one-time passwords for login or signup verification.',
    variables: ['OTP code'],
  },
  {
    id: 'account-verification-en', title: 'Account Verification', name: 'account_verification',
    category: 'Authentication', language: 'en_US', industry: 'General',
    body_text: 'Your {{1}} verification code is {{2}}. This code expires in {{3}} minutes.',
    description: 'Verify a new account or device with a time-limited code.',
    variables: ['Business name', 'Code', 'Expiry minutes'],
  },

  // ===== HINDI — UTILITY =====
  {
    id: 'order-confirmation-hi', title: 'ऑर्डर कन्फर्मेशन (Order Confirmation)', name: 'order_confirmation_hi',
    category: 'Utility', language: 'hi', industry: 'E-commerce',
    body_text: 'नमस्ते {{1}}, आपका ऑर्डर #{{2}} कन्फर्म हो गया है! 🎉\n\nकुल राशि: {{3}}\nडिलीवरी की तारीख: {{4}}\n\nहमारे साथ खरीदारी करने के लिए धन्यवाद।',
    footer_text: 'रुकने के लिए STOP भेजें',
    description: 'ग्राहक द्वारा ऑर्डर देने पर स्वतः भेजा जाता है।',
    variables: ['ग्राहक का नाम', 'ऑर्डर नंबर', 'कुल राशि', 'डिलीवरी तारीख'],
  },
  {
    id: 'appointment-reminder-hi', title: 'अपॉइंटमेंट रिमाइंडर (Appointment)', name: 'appointment_reminder_hi',
    category: 'Utility', language: 'hi', industry: 'Healthcare',
    body_text: 'नमस्ते {{1}}, यह {{2}} के साथ आपके अपॉइंटमेंट का रिमाइंडर है — {{3}} को {{4}} बजे।\n\nकृपया 10 मिनट पहले पहुँचें। बदलाव के लिए इस संदेश का उत्तर दें।',
    footer_text: 'जल्द मिलते हैं!',
    description: 'मरीजों को आने वाले अपॉइंटमेंट की याद दिलाएं।',
    variables: ['मरीज का नाम', 'डॉक्टर/क्लिनिक', 'तारीख', 'समय'],
  },
  {
    id: 'payment-received-hi', title: 'भुगतान प्राप्त (Payment Received)', name: 'payment_received_hi',
    category: 'Utility', language: 'hi', industry: 'Finance',
    body_text: 'नमस्ते {{1}}, हमें आपका {{2}} का भुगतान प्राप्त हो गया है। ✅\n\nइनवॉइस: #{{3}}\nतारीख: {{4}}\n\nधन्यवाद।',
    description: 'ग्राहकों को भुगतान प्राप्ति की पुष्टि भेजें।',
    variables: ['ग्राहक का नाम', 'राशि', 'इनवॉइस नंबर', 'तारीख'],
  },
  {
    id: 'booking-confirmation-hi', title: 'टेबल बुकिंग (Table Booking)', name: 'booking_confirmation_hi',
    category: 'Utility', language: 'hi', industry: 'Restaurant',
    body_text: 'नमस्ते {{1}}, {{2}} लोगों के लिए आपकी टेबल {{3}} को {{4}} बजे बुक हो गई है। 🍽️\n\nआपकी सेवा के लिए हम उत्सुक हैं। बदलाव हेतु उत्तर दें।',
    description: 'रेस्टोरेंट टेबल बुकिंग की पुष्टि करें।',
    variables: ['ग्राहक का नाम', 'मेहमानों की संख्या', 'तारीख', 'समय'],
  },

  // ===== HINDI — MARKETING =====
  {
    id: 'welcome-offer-hi', title: 'वेलकम ऑफर (Welcome Offer)', name: 'welcome_offer_hi',
    category: 'Marketing', language: 'hi', industry: 'E-commerce',
    body_text: '{{1}} में आपका स्वागत है, {{2}}! 🎁\n\nआपकी पहली खरीद पर {{3}} की विशेष छूट। कोड: {{4}}\n\nअभी खरीदें और बचत करें!',
    footer_text: 'रुकने के लिए STOP भेजें',
    description: 'नए ग्राहकों का स्वागत पहली खरीद पर छूट के साथ करें।',
    variables: ['व्यवसाय का नाम', 'ग्राहक का नाम', 'छूट %', 'प्रोमो कोड'],
  },
  {
    id: 'festive-sale-hi', title: 'त्योहार सेल (Festive Sale)', name: 'festive_sale_hi',
    category: 'Marketing', language: 'hi', industry: 'General',
    body_text: 'नमस्ते {{1}}! 🎉 हमारी {{2}} सेल शुरू हो गई है!\n\nसभी प्रोडक्ट्स पर {{3}} तक की छूट। ऑफर {{4}} तक मान्य।\n\nआज ही बेहतरीन डील पाएं!',
    footer_text: 'रुकने के लिए STOP भेजें',
    description: 'अपनी संपर्क सूची को त्योहार/सीज़न सेल की जानकारी दें।',
    variables: ['ग्राहक का नाम', 'सेल का नाम', 'अधिकतम छूट', 'अंतिम तारीख'],
  },
  {
    id: 'new-course-hi', title: 'नया कोर्स (New Course)', name: 'new_course_launch_hi',
    category: 'Marketing', language: 'hi', industry: 'Education',
    body_text: 'नमस्ते {{1}}! 📚 हमने एक नया कोर्स शुरू किया है: {{2}}।\n\n{{3}} से पहले एडमिशन लें और फीस पर {{4}} की छूट पाएं।\n\nअधिक जानकारी के लिए YES भेजें।',
    footer_text: 'रुकने के लिए STOP भेजें',
    description: 'छात्रों और लीड्स को नए कोर्स/बैच की जानकारी दें।',
    variables: ['छात्र का नाम', 'कोर्स का नाम', 'अंतिम तारीख', 'छूट'],
  },
  {
    id: 'property-listing-hi', title: 'नई प्रॉपर्टी (New Property)', name: 'new_property_listing_hi',
    category: 'Marketing', language: 'hi', industry: 'Real Estate',
    body_text: 'नमस्ते {{1}}, आपकी पसंद की एक नई प्रॉपर्टी उपलब्ध है! 🏡\n\n{{2}} | {{3}}\nकीमत: {{4}}\n\nविज़िट शेड्यूल करने के लिए उत्तर दें।',
    footer_text: 'रुकने के लिए STOP भेजें',
    description: 'लीड्स को उनकी पसंद की नई प्रॉपर्टी की जानकारी दें।',
    variables: ['लीड का नाम', 'प्रॉपर्टी प्रकार/स्थान', 'मुख्य विशेषताएं', 'कीमत'],
  },

  // ===== HINDI — AUTHENTICATION =====
  {
    id: 'otp-verification-hi', title: 'OTP वेरिफिकेशन (OTP)', name: 'otp_verification_hi',
    category: 'Authentication', language: 'hi', industry: 'General',
    body_text: '{{1}} आपका वेरिफिकेशन कोड है। अपनी सुरक्षा के लिए इसे किसी के साथ साझा न करें।',
    description: 'लॉगिन या साइनअप के लिए वन-टाइम पासवर्ड भेजें।',
    variables: ['OTP कोड'],
  },
];

export function filterTemplates(industry: string, category: string, language: string, search: string) {
  const q = search.toLowerCase();
  return TEMPLATE_LIBRARY.filter((t) => {
    const matchIndustry = industry === 'All' || t.industry === industry;
    const matchCategory = category === 'All' || t.category === category;
    const isHindi = t.language === 'hi';
    const matchLanguage =
      language === 'All' ||
      (language === 'Hindi' && isHindi) ||
      (language === 'English' && !isHindi);
    const matchSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.body_text.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    return matchIndustry && matchCategory && matchLanguage && matchSearch;
  });
}
