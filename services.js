// ============================================================
//  TESESTHETICS — SERVICES DATA
//  Edit this file to add, remove, or change services.
//  Each service has: id, name, category, duration, price,
//  description, bullets (list of details), available (true/false),
//  and comingSoon (true/false).
// ============================================================

const SERVICES = [
  // ── FACIALS ──────────────────────────────────────────────
  {
    id: "classic-facial",
    name: "Classic Facial",
    category: "Facials",
    duration: "60 min",
    price: "$75",
    description: "A thorough, results-driven facial tailored to your skin type. Includes deep cleansing, steam, extractions, mask, and customized moisturizer.",
    bullets: [
      "Double cleanse & skin analysis",
      "Steam & gentle extractions",
      "Custom mask treatment",
      "Facial massage & moisturizer",
      "SPF finishing touch"
    ],
    available: true,
    comingSoon: false,
    icon: "✦"
  },
  {
    id: "express-facial",
    name: "Express Glow Facial",
    category: "Facials",
    duration: "30 min",
    price: "$45",
    description: "A quick but effective skin refresh — perfect for a lunch break or before a big event. Cleanse, tone, treat, and protect.",
    bullets: [
      "Cleanse & tone",
      "Targeted serum application",
      "Moisturize & protect",
      "Ideal for maintenance visits"
    ],
    available: true,
    comingSoon: false,
    icon: "✦"
  },
  {
    id: "hydrating-facial",
    name: "Hydration Infusion Facial",
    category: "Facials",
    duration: "60 min",
    price: "$85",
    description: "Deeply replenishing treatment for dry, dehydrated, or sensitive skin. Loaded with hyaluronic acid serums, nourishing oils, and calming botanicals.",
    bullets: [
      "Gentle enzyme exfoliation",
      "Hyaluronic acid infusion",
      "Barrier-repair mask",
      "Rosehip & bakuchiol serum",
      "Great for sensitive skin"
    ],
    available: true,
    comingSoon: false,
    icon: "✦"
  },
  {
    id: "back-facial",
    name: "Back Facial",
    category: "Facials",
    duration: "45 min",
    price: "$65",
    description: "All the benefits of a classic facial applied to your back — ideal for body acne, congestion, or an upcoming special event.",
    bullets: [
      "Deep cleanse & exfoliation",
      "Steam & extractions",
      "Clarifying or hydrating mask",
      "Moisturizer & spot treatment"
    ],
    available: true,
    comingSoon: false,
    icon: "✦"
  },

  // ── WAXING ───────────────────────────────────────────────
  {
    id: "brow-wax",
    name: "Brow Shaping",
    category: "Waxing",
    duration: "15 min",
    price: "$18",
    description: "Precise brow waxing and shaping to frame your face and enhance your natural features.",
    bullets: [
      "Consultation for desired shape",
      "Hard or soft wax",
      "Clean-up tweezing",
      "Soothing post-wax oil"
    ],
    available: true,
    comingSoon: false,
    icon: "◆"
  },
  {
    id: "lip-chin-wax",
    name: "Lip & Chin Wax",
    category: "Waxing",
    duration: "15 min",
    price: "$20",
    description: "Smooth, clean results for upper lip and chin in a quick, comfortable session.",
    bullets: [
      "Gentle hard wax formula",
      "Upper lip and/or chin",
      "Calming post-wax treatment"
    ],
    available: true,
    comingSoon: false,
    icon: "◆"
  },
  {
    id: "face-wax",
    name: "Full Face Wax",
    category: "Waxing",
    duration: "30 min",
    price: "$45",
    description: "Complete facial hair removal covering brows, upper lip, chin, sides of face, and forehead.",
    bullets: [
      "Brows, lip, chin & sides",
      "Hard wax for sensitive areas",
      "Soothing finish serum"
    ],
    available: true,
    comingSoon: false,
    icon: "◆"
  },

  // ── COMING SOON ──────────────────────────────────────────
  {
    id: "chemical-peel",
    name: "Chemical Peel",
    category: "Advanced Treatments",
    duration: "45 min",
    price: "TBD",
    description: "Targeted exfoliation to address hyperpigmentation, fine lines, acne scarring, and uneven texture.",
    bullets: [
      "Superficial to medium-depth options",
      "Lactic, glycolic, or salicylic",
      "Post-peel care included"
    ],
    available: false,
    comingSoon: true,
    icon: "◈"
  },
  {
    id: "led-therapy",
    name: "LED Light Therapy",
    category: "Advanced Treatments",
    duration: "20 min add-on",
    price: "$30 add-on",
    description: "Red and blue LED wavelengths target acne-causing bacteria, stimulate collagen, and calm inflammation.",
    bullets: [
      "Red light: anti-aging & glow",
      "Blue light: acne & bacteria",
      "Can be added to any facial"
    ],
    available: false,
    comingSoon: true,
    icon: "◈"
  },
  {
    id: "lash-tint",
    name: "Lash & Brow Tinting",
    category: "Advanced Treatments",
    duration: "30 min",
    price: "TBD",
    description: "Semi-permanent tint to darken and define lashes and brows without daily mascara.",
    bullets: [
      "Patch test required 24 hrs prior",
      "Multiple shades available",
      "Lasts 4–6 weeks"
    ],
    available: false,
    comingSoon: true,
    icon: "◈"
  }
];

// Categories in display order
const SERVICE_CATEGORIES = ["Facials", "Waxing", "Advanced Treatments"];
