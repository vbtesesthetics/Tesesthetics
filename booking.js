// ============================================================
//  TESESTHETICS — BOOKING & GOOGLE SHEETS INTEGRATION
//
//  SETUP INSTRUCTIONS:
//  1. Go to https://sheets.google.com and create a new sheet
//     Name it: "Tesesthetics Bookings"
//  2. Add these headers in Row 1:
//     Timestamp | First Name | Last Name | Phone | Email | Address | Service | Type | Notes | Status
//  3. Go to Extensions → Apps Script
//  4. Paste the Apps Script code from README.md
//  5. Deploy as Web App (Execute as: Me, Access: Anyone)
//  6. Copy the Web App URL and paste it below as SHEETS_ENDPOINT
// ============================================================

const SHEETS_CONFIG = {
  // Paste your Google Apps Script Web App URL here after setup:
  endpoint: "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",

  // Column headers (must match your Google Sheet Row 1):
  columns: ["Timestamp", "First Name", "Last Name", "Phone", "Email", "Address", "Service", "Type", "Notes", "Status"]
};

// ── BOOKING FORM LOGIC ───────────────────────────────────

function initBookingForm() {
  const form = document.getElementById("booking-form");
  if (!form) return;

  // Populate service dropdown from services data
  const serviceSelect = document.getElementById("service-select");
  if (serviceSelect && typeof SERVICES !== "undefined") {
    SERVICE_CATEGORIES.forEach(cat => {
      const group = document.createElement("optgroup");
      group.label = cat;

      SERVICES.filter(s => s.category === cat).forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name + (s.comingSoon ? " (Coming Soon)" : "");
        if (s.comingSoon) opt.disabled = true;
        group.appendChild(opt);
      });

      serviceSelect.appendChild(group);
    });

    // Add "Not Sure Yet" option
    const notSure = document.createElement("option");
    notSure.value = "not-sure";
    notSure.textContent = "Not Sure Yet — Let's Chat!";
    serviceSelect.appendChild(notSure);
  }

  form.addEventListener("submit", handleBookingSubmit);
}

async function handleBookingSubmit(e) {
  e.preventDefault();

  const btn = document.getElementById("submit-btn");
  const successMsg = document.getElementById("form-success");
  const errorMsg = document.getElementById("form-error");

  // Hide previous messages
  successMsg.style.display = "none";
  errorMsg.style.display = "none";

  // Collect form data
  const formData = {
    timestamp: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    firstName: document.getElementById("first-name").value.trim(),
    lastName: document.getElementById("last-name").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    email: document.getElementById("email").value.trim(),
    address: document.getElementById("address").value.trim(),
    service: getServiceLabel(document.getElementById("service-select").value),
    type: document.getElementById("booking-type").value,
    notes: document.getElementById("notes").value.trim(),
    status: "New"
  };

  // Basic validation
  if (!formData.firstName || !formData.lastName || !formData.phone || !formData.email) {
    showError(errorMsg, "Please fill in all required fields.");
    return;
  }

  // Email validation
  if (!isValidEmail(formData.email)) {
    showError(errorMsg, "Please enter a valid email address.");
    return;
  }

  // Phone validation (basic)
  if (!isValidPhone(formData.phone)) {
    showError(errorMsg, "Please enter a valid phone number.");
    return;
  }

  // Loading state
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner"></span> Sending...';

  // Check if endpoint is configured
  if (SHEETS_CONFIG.endpoint === "https://script.google.com/macros/s/AKfycbyTN91xqnBkPaPry9qSi2Tw8dUlsaRqIQOVDcBXkaqvc-WnMqeWi8Rp7XPfY8yHfr6zBQ/exec") {
    // Demo mode — show success without actually submitting
    await new Promise(r => setTimeout(r, 1200));
    showFormSuccess(successMsg, btn, formData);
    console.log("📋 Form data (not submitted — configure SHEETS_CONFIG.endpoint):", formData);
    return;
  }

  try {
    // Submit to Google Sheets via Apps Script
    const response = await fetch(SHEETS_CONFIG.endpoint, {
      method: "POST",
      mode: "no-cors", // Required for Apps Script
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });

    // no-cors means we can't read the response body, treat as success
    showFormSuccess(successMsg, btn, formData);

  } catch (err) {
    console.error("Submission error:", err);
    btn.disabled = false;
    btn.innerHTML = "Send Request";
    showError(errorMsg, typeof CONTENT !== "undefined"
      ? CONTENT.booking.errorMessage
      : "Something went wrong. Please try again.");
  }
}

function showFormSuccess(successMsg, btn, formData) {
  const msg = typeof CONTENT !== "undefined"
    ? CONTENT.booking.successMessage
    : "Thank you! We'll be in touch soon. 🌸";
  successMsg.textContent = msg;
  successMsg.style.display = "block";
  btn.innerHTML = "✓ Request Sent!";
  btn.style.background = "var(--success)";

  // Reset form after delay
  setTimeout(() => {
    document.getElementById("booking-form").reset();
    btn.disabled = false;
    btn.innerHTML = "Send Booking Request";
    btn.style.background = "";
    successMsg.style.display = "none";
  }, 6000);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = "block";
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function getServiceLabel(value) {
  if (!value || value === "not-sure") return "Not Sure Yet";
  if (typeof SERVICES !== "undefined") {
    const s = SERVICES.find(s => s.id === value);
    return s ? s.name : value;
  }
  return value;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[\d\s\-\(\)\+\.]{7,}$/.test(phone);
}

// Phone number auto-formatting
document.addEventListener("DOMContentLoaded", () => {
  const phoneInput = document.getElementById("phone");
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      let val = e.target.value.replace(/\D/g, "");
      if (val.length >= 6) {
        val = `(${val.slice(0,3)}) ${val.slice(3,6)}-${val.slice(6,10)}`;
      } else if (val.length >= 3) {
        val = `(${val.slice(0,3)}) ${val.slice(3)}`;
      }
      e.target.value = val;
    });
  }
});
