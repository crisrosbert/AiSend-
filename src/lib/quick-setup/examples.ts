// src/lib/quick-setup/examples.ts
//
// The clickable examples on the Quick Setup screen. They are SAMPLE text
// with made-up names, prices and phone numbers; the owner is told to
// change every detail. Kept as plain data so a test can check that each
// one passes the same validation the owner's own text must pass.

export interface SetupExample {
  id: string
  label: string
  language: 'Hinglish' | 'English'
  text: string
}

export const SETUP_EXAMPLES: SetupExample[] = [
  {
    id: 'clinic',
    label: 'Clinic (Hinglish)',
    language: 'Hinglish',
    text:
      'Main Dr. Sharma hoon, Pediatrician in Sector 14. Meri consultation fees Rs 800 hai. Timing Mon-Sat shaam 5 se 8 PM hai. ' +
      'Agar koi patient appointment maange, to uska naam, bache ki umar aur preferred slot poochkar slot book kar lo aur clinic ka address bhej do: https://maps.google.com/?q=Sector+14. ' +
      'Emergency ho to 98765 43210 par call karne ko bolo.',
  },
  {
    id: 'coaching',
    label: 'Coaching centre (Hinglish)',
    language: 'Hinglish',
    text:
      'Hum Gyan Classes hain, 9th se 12th ke liye Maths aur Science coaching. Monthly fees Rs 2500 hai. ' +
      'Batch timing Mon-Sat shaam 4 se 8 baje. Admission ke liye student ka naam, class aur parent ka phone poochho aur demo class book karo. ' +
      'Result ya selection ki guarantee kabhi mat dena.',
  },
  {
    id: 'salon',
    label: 'Salon (Hinglish)',
    language: 'Hinglish',
    text:
      'Hum Glow Beauty Salon hain, Sector 9 mein. Haircut Rs 300 aur facial Rs 800 hai. Timing roz 10 se 8 baje, Sunday band. ' +
      'Booking ke liye customer ka naam, service aur preferred time poochho aur slot book karo. Kisi offer ya discount ka wada mat karna.',
  },
  {
    id: 'dentist',
    label: 'Dental clinic (English)',
    language: 'English',
    text:
      'I am Dr. Mehta, a dentist at Smile Dental Clinic, MG Road. Consultation fee is Rs 500. We are open Mon-Sat 10 AM to 6 PM. ' +
      "Ask the patient's name and preferred time, then book the slot and share our location link https://maps.google.com/?q=MG+Road. " +
      'In an emergency such as severe pain or swelling, tell the patient to call 98765 43210.',
  },
]

/** Messages the owner can click to try the assistant. */
export const TEST_MESSAGE_SUGGESTIONS: string[] = [
  'Hello doctor sahab, aaj bache ko dikhana tha, kitne baje aa sakte hain?',
  'Sir kal 6 baje aa jaun?',
  'Fees kitni hai?',
  'Sunday ko khule ho?',
]

export const LANGUAGE_HINT =
  'You can write in Hindi, English or Hinglish. Write who you are, your fees, your timings, what the assistant should ask a customer who wants an appointment, your address link, and a phone number for urgent cases.'
