// ============================================================
//  TESESTHETICS — SITE CONTENT
//  Edit this file to update any text on the site without
//  touching HTML or CSS.
// ============================================================

const CONTENT = {

  // ── BUSINESS INFO ────────────────────────────────────────
  business: {
    name: "Tesesthetics",
    tagline: "Skin Care in Buford, GA",
    subTagline: "Personalized facial & skin treatments — because your skin deserves intention.",
    location: "Buford, GA",
    phone: "",          // Add phone number when ready
    email: "",          // Add email when ready
    instagram: "",      // Add Instagram handle (e.g. "@tesesthetics")
    facebook: "",       // Add Facebook URL when ready
    bookingNote: "Currently accepting new clients! Fill out the form below to get started — I'll reach out to confirm your appointment.",
  },

  // ── HERO SECTION ─────────────────────────────────────────
  hero: {
    headline: "Your Skin,\nIntentionally Cared For.",
    subheadline: "Licensed esthetician in Buford, GA — clinically trained, personally invested, and ready to make your skin glow.",
    ctaText: "Book a Service",
    ctaSecondary: "View Services"
  },

  // ── ABOUT SECTION ────────────────────────────────────────
  about: {
    headline: "Meet Your Esthetician",
    name: "Veronica",
    certificationNote: "Licensed Esthetician — School of Skin & Nail Care, Buford GA",
    bio: [
      "Hi, I'm Veronica — a licensed esthetician based in Buford, GA, originally from the beautiful city of Guadalajara, Mexico. Growing up, I was surrounded by a culture that celebrates taking care of yourself with intention and pride, and that spirit has shaped everything I do today.",
      "Before esthetics, I built my career in dentistry — training as a dentist in Mexico and working as a dental assistant here in Georgia. That background gave me a deep understanding of facial anatomy, precision, and the kind of trust a client places in someone who works up close. I bring all of that into every treatment I perform. When I'm working on your skin, I'm not guessing — I understand what's beneath it.",
      "Making the transition into esthetics felt natural. The attention to detail, the care for the person in front of you, the commitment to real results — it's the same philosophy, just a different canvas. I'm just getting started here in Buford, and I'd be honored to have you as one of my first clients. Come as you are. Leave glowing."
    ],
    highlights: [
      { icon: "🦷", label: "Clinical Precision", detail: "Dental training in facial anatomy & technique" },
      { icon: "🌎", label: "From Guadalajara, MX", detail: "Bringing warmth, culture & dedication" },
      { icon: "📍", label: "Buford, GA", detail: "Serving Buford, Sugar Hill, Suwanee & beyond" },
      { icon: "🎓", label: "Licensed Esthetician", detail: "School of Skin & Nail Care, Buford GA" }
    ]
  },

  // ── BOOKING SECTION ──────────────────────────────────────
  booking: {
    headline: "Book or Express Interest",
    subheadline: "Fill out the form below and I'll reach out within 24–48 hours to confirm your appointment or answer any questions.",
    formNote: "Not sure what service you need? Just pick 'Not Sure Yet' and we'll chat about what's best for your skin!",
    successMessage: "You're all set! 🌸 I'll be in touch within 24–48 hours. Can't wait to meet you!",
    errorMessage: "Something went wrong. Please try again or reach out directly."
  },

  // ── FAQ SECTION ──────────────────────────────────────────
  faq: [
    {
      q: "Do I need to do anything to prepare for my facial?",
      a: "Come with a clean face if possible, but don't stress if you can't — we'll take care of it! Avoid retinol or acids for 24–48 hours before your appointment. Let me know about any allergies or medications during booking."
    },
    {
      q: "How often should I get a facial?",
      a: "For most skin types, every 4–6 weeks is ideal. This lines up with your skin's natural cell turnover cycle. That said, we'll create a plan that works for your skin and your schedule."
    },
    {
      q: "Is waxing okay for sensitive skin?",
      a: "Yes! I use hard wax on sensitive areas which is gentler and adheres to hair rather than skin. Let me know your skin type when booking and I'll plan accordingly."
    },
    {
      q: "What areas do you serve?",
      a: "I'm based in Buford, GA and primarily serve the Buford, Sugar Hill, Suwanee, Cumming, and surrounding Gwinnett/Forsyth County areas. Reach out if you're unsure!"
    },
    {
      q: "I've never had a facial before — what should I expect?",
      a: "Welcome! Your first facial is a relaxing, educational experience. We'll start with a skin consultation, then you'll lay back and enjoy cleansing, steam, extractions (if needed), a mask, and moisturizing. Most clients leave glowing and wondering why they waited so long."
    },
    {
      q: "What's your cancellation policy?",
      a: "Life happens! I just ask for at least 24 hours notice if you need to reschedule. I'll be updating policies as the business grows — I'll always be upfront and fair about it."
    }
  ],

  // ── FOOTER ───────────────────────────────────────────────
  footer: {
    tagline: "Skin that glows from intention, not accident.",
    copyright: `© ${new Date().getFullYear()} Tesesthetics. All rights reserved.`,
    disclaimer: "Located in Buford, GA · By appointment only"
  }
};
