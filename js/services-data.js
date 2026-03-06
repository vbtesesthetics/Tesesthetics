// =====================================================
//  TESESTHETICS — SERVICES & ADD-ONS DATA
//  Source of truth for all service listings.
//  Used by: services page, booking system, SaaS setup.
// =====================================================

const SERVICES = [

  // ── FACIALS ──────────────────────────────────────

  {
    id: "express-facial",
    name: "Express Facial",
    category: "Facial",
    description: "A results-driven refresh designed to cleanse, exfoliate, and hydrate the skin in less time. Perfect for routine maintenance, a quick reset, or a fresh glow between longer treatments.",
    addons: ["enzyme-treatment", "eye-treatment", "lip-treatment", "scalp-massage"],
    available: true
  },
  {
    id: "signature-facial",
    name: "Signature Custom Facial",
    category: "Facial",
    description: "A personalized facial experience tailored to your skin's unique needs. This treatment focuses on restoring balance, improving texture, and leaving the skin refreshed, nourished, and visibly renewed.",
    addons: ["extractions", "enzyme-treatment", "hydrating-mask", "eye-treatment", "lip-treatment", "scalp-massage"],
    available: true
  },
  {
    id: "deep-cleansing-facial",
    name: "Deep Cleansing Facial",
    category: "Facial",
    description: "A clarifying treatment created for skin that feels congested, unbalanced, or in need of a thorough reset. Focuses on deep cleansing, gentle exfoliation, and targeted care to support a clearer, smoother complexion.",
    addons: ["extractions", "enzyme-treatment", "calming-mask", "scalp-massage"],
    available: true
  },
  {
    id: "hydrating-facial",
    name: "Hydrating Facial",
    category: "Facial",
    description: "A moisture-rich treatment designed to restore comfort to dry, tight, or depleted skin. Helps replenish hydration, soften texture, and bring back a healthy, refreshed glow.",
    addons: ["hydrating-mask", "eye-treatment", "lip-treatment", "cooling-globe", "scalp-massage"],
    available: true
  },
  {
    id: "brightening-facial",
    name: "Brightening Facial",
    category: "Facial",
    description: "A radiance-focused facial that helps revive dull, tired-looking skin with gentle exfoliation and nourishing care. Ideal for clients wanting a smoother, more luminous finish without harsh treatment.",
    addons: ["enzyme-treatment", "eye-treatment", "lip-treatment", "hydrating-mask", "cooling-globe"],
    available: true
  },
  {
    id: "calming-facial",
    name: "Calming Facial",
    category: "Facial",
    description: "A soothing treatment created for sensitive, reactive, or easily irritated skin. Prioritizes comfort, hydration, and barrier support while helping the skin look more balanced and at ease.",
    addons: ["hydrating-mask", "eye-treatment", "lip-treatment", "cooling-globe", "scalp-massage"],
    available: true
  },
  {
    id: "clarifying-facial",
    name: "Clarifying Facial",
    category: "Facial",
    description: "A targeted treatment for oily, breakout-prone, or congested skin. Deeply cleanses and refines the skin without stripping it, helping support a clearer, healthier-looking complexion over time.",
    addons: ["extractions", "enzyme-treatment", "calming-mask", "scalp-massage"],
    available: true
  },
  {
    id: "teen-facial",
    name: "Teen Facial",
    category: "Facial",
    description: "A gentle, age-appropriate facial designed to introduce healthy skincare habits while addressing common concerns like oiliness, congestion, and occasional breakouts. A great starting point for younger skin.",
    addons: ["extractions", "enzyme-treatment", "scalp-massage"],
    available: true
  },
  {
    id: "glow-facial",
    name: "Glow Facial",
    category: "Facial",
    description: "A revitalizing treatment designed to refresh dull skin and restore a naturally radiant look. Combines cleansing, exfoliation, and hydration for a smooth, healthy finish that feels polished but effortless.",
    addons: ["enzyme-treatment", "eye-treatment", "lip-treatment", "hydrating-mask", "cooling-globe"],
    available: true
  },

  // ── SEASONAL ──────────────────────────────────────

  {
    id: "seasonal-renewal",
    name: "Seasonal Renewal Facial",
    category: "Seasonal",
    description: "A customized facial designed to help the skin adjust through seasonal changes — whether that means calming dryness, clearing buildup, or restoring hydration and balance.",
    addons: ["enzyme-treatment", "hydrating-mask", "eye-treatment", "lip-treatment", "scalp-massage"],
    available: true
  },

  // ── BODY ──────────────────────────────────────────

  {
    id: "back-facial",
    name: "Back Facial",
    category: "Body Treatment",
    description: "A deep-cleansing treatment for one of the most overlooked areas of the body. Designed to improve congestion, dryness, and rough texture — leaving the skin feeling smoother, cleaner, and refreshed.",
    addons: ["enzyme-treatment", "hydrating-mask", "extractions", "scalp-massage"],
    available: true
  },

  // ── MAKEUP ────────────────────────────────────────

  {
    id: "makeup-application",
    name: "Makeup Application",
    category: "Makeup",
    description: "A polished makeup service for special occasions, photos, or events where you want to feel refined, confident, and put together. Can be booked on its own or paired with a skin-prep service.",
    addons: ["lip-treatment", "eye-treatment", "mini-skin-prep", "glow-boost"],
    available: true
  },

];

// ── ADD-ONS ───────────────────────────────────────

const ADDONS = [
  { id: "extractions",     name: "Extractions",          description: "Targeted pore clearing for areas of congestion." },
  { id: "enzyme-treatment",name: "Enzyme Treatment",     description: "A gentle exfoliating boost to refine texture and refresh the skin." },
  { id: "hydrating-mask",  name: "Hydrating Mask Upgrade",description: "An added layer of nourishment for dry or depleted skin." },
  { id: "calming-mask",    name: "Calming Mask Upgrade",  description: "A soothing enhancement for skin that needs comfort and balance." },
  { id: "eye-treatment",   name: "Eye Treatment",         description: "Focused care to hydrate and refresh the delicate eye area." },
  { id: "lip-treatment",   name: "Lip Treatment",         description: "A smoothing, softening treatment for dry lips." },
  { id: "scalp-massage",   name: "Scalp Massage",         description: "A relaxing finishing touch designed to elevate the overall experience." },
  { id: "cooling-globe",   name: "Cooling Globe Massage", description: "A soothing facial massage that helps the skin feel calm, refreshed, and revitalized." },
  { id: "mini-skin-prep",  name: "Mini Skin Prep",        description: "A quick skin-perfecting prep before makeup application." },
  { id: "glow-boost",      name: "Glow Boost Add-On",     description: "A finishing enhancement designed to leave the skin looking especially fresh and radiant." },
];

// ── CATEGORY DISPLAY ORDER ────────────────────────

const CATEGORIES = ["Facial", "Seasonal", "Body Treatment", "Makeup"];

// ── ICONS PER CATEGORY ────────────────────────────

const CATEGORY_ICONS = {
  "Facial":         "✦",
  "Seasonal":       "🌿",
  "Body Treatment": "◆",
  "Makeup":         "◈",
};
