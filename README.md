# 🌸 Tesesthetics Website
### Complete Guide — Setup, Editing, Deploying & Growing

---

## 📁 File Structure

```
tesesthetics/
├── index.html        ← The entire website (HTML + CSS + JavaScript)
└── assets/
    └── logo.png      ← Logo and all future images go here
```

That's it. Two files, one folder. Everything lives in `index.html` — styles,
content, logic, all of it. The `assets/` folder is where you'll drop any
images or media as the business grows.

---

## ✏️ Editing the Website

All edits happen inside `index.html`. Open it in any text editor
(Notepad, VS Code, TextEdit, etc.). Everything you'll ever need to change
is clearly labeled at the top of the `<script>` section near the bottom
of the file. Look for these three clearly marked blocks:

```
╔═════════════════════════════════════════════════╗
║  1. SERVICES DATA                               ║
╚═════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════╗
║  2. ABOUT & FAQ CONTENT                         ║
╚═════════════════════════════════════════════════╝

╔═════════════════════════════════════════════════╗
║  3. GOOGLE SHEETS ENDPOINT                      ║
╚═════════════════════════════════════════════════╝
```

---

## 🛠️ How to Edit Each Section

---

### 1. Adding or Changing a Service

Find the `SERVICES` array in section 1 of the script. Each service looks like this:

```javascript
{
  id:          "classic-facial",       // unique ID, no spaces (used internally)
  name:        "Classic Facial",       // display name on the card
  category:    "Facials",              // must match one of: "Facials" | "Waxing" | "Advanced Treatments"
  duration:    "60 min",               // shown on the card
  price:       "$75",                  // shown on the card — use "TBD" if not set yet
  icon:        "✦",                    // decorative icon (✦ Facials | ◆ Waxing | ◈ Advanced)
  available:   true,                   // true = shows "Available" badge
  comingSoon:  false,                  // true = grays out card + shows "Coming Soon" badge
  description: "A short description.", // 1-2 sentences shown on the card
  bullets: [                           // 3-5 bullet points of details
    "First detail here",
    "Second detail here",
    "Third detail here"
  ]
},
```

**To add a new service:** Copy any existing service block, paste it at the
end of the array (before the `]`), and update the values.

**To mark a service as coming soon:** Set `available: false` and `comingSoon: true`.
The card will gray out automatically and hide the Book button.

**To activate a coming soon service:** Flip it to `available: true` and `comingSoon: false`.

**To remove a service:** Delete the entire `{ ... },` block for that service.

> 💡 **Tip:** Always leave a comma after each service block except the very last one.
> If you get a blank page after saving, a missing or extra comma is usually the culprit.

---

### 2. Updating Veronica's Bio

Find the `BIO` array in section 2. Each item in the array is one paragraph:

```javascript
const BIO = [
  "First paragraph text here.",
  "Second paragraph text here.",
  "Third paragraph text here."
];
```

Just edit the text inside the quotes. To add a paragraph, add a new line
with a comma. To remove one, delete the line.

> 💡 **Tip:** If your text includes an apostrophe (') or quote mark, put a
> backslash before it: `I\'m` instead of `I'm` — otherwise it will break the script.

---

### 3. Updating the Highlight Cards (About section)

Find the `HIGHLIGHTS` array. Each card has an icon, a bold label, and a detail line:

```javascript
const HIGHLIGHTS = [
  { icon: "🦷", label: "Clinical Precision",   detail: "Dental training in facial anatomy" },
  { icon: "🌎", label: "From Guadalajara, MX", detail: "Bringing warmth, culture & dedication" },
  // ...
];
```

Change the text, swap the emoji, or add a new card. Four cards display in a 2×2 grid.

---

### 4. Editing FAQ Questions

Find the `FAQS` array in section 2. Each item has a question `q` and answer `a`:

```javascript
const FAQS = [
  {
    q: "Your question here?",
    a: "Your answer here."
  },
  // ...
];
```

Add, remove, or reorder as needed. Same apostrophe rule applies — use `\'` inside text.

---

### 5. Adding Phone Number & Email to Footer

In the HTML (not the script), find the footer contact section and update these lines:

```html
<!-- Replace these two lines: -->
<div class="footer-contact-item">
  <span class="footer-contact-icon">📍</span><span>Buford, GA</span>
</div>
<div class="footer-contact-item">
  <span class="footer-contact-icon">🕐</span><span>By appointment only</span>
</div>

<!-- Add these after: -->
<div class="footer-contact-item">
  <span class="footer-contact-icon">📞</span>
  <a href="tel:+16785550100">(678) 555-0100</a>
</div>
<div class="footer-contact-item">
  <span class="footer-contact-icon">✉️</span>
  <a href="mailto:hello@tesesthetics.com">hello@tesesthetics.com</a>
</div>
```

> 💡 **Tip:** In the `href="tel:..."` link, use the full number with no spaces or dashes:
> `+16785551234` — this makes it tap-to-call on mobile.

---

### 6. Changing Colors

At the top of the `<style>` section, find the `:root { }` block. All brand colors
are defined there as variables:

```css
:root {
  --lavender:       #C5A4E8;   /* accent rings, borders */
  --lavender-deep:  #9B72CF;   /* focused fields, labels */
  --lavender-pale:  #F7F1FD;   /* section backgrounds */
  --bronze:         #8B4A28;   /* buttons, headings, prices */
  --bronze-light:   #B87046;   /* hover states */
  --cream:          #FAF7F2;   /* main background */
  --dark:           #2C1A10;   /* heading text */
  --text-muted:     #7A6055;   /* body text */
}
```

Change any hex value and every element using that color updates automatically.

---

### 7. Adding Photos to the Assets Folder

Upload any image to the `assets/` folder in GitHub. Then reference it anywhere
in the HTML like this:

```html
<img src="assets/your-photo.jpg" alt="Description of photo" />
```

> 💡 **Tip:** Keep image files under 500KB for fast loading. Use `.jpg` for photos
> and `.png` for images that need a transparent background (like the logo).
> Free tools like [squoosh.app](https://squoosh.app) can shrink images without
> losing quality.

**Suggested assets to add over time:**
- `assets/veronica.jpg` — a photo of Veronica for the About section
- `assets/treatment-room.jpg` — the space/setup
- `assets/og-image.jpg` — a 1200×630px image for social media link previews

---

## 📊 Google Sheets Setup (Booking Form)

When someone submits the booking form, their info gets sent to a Google Sheet.
Here's how to set it up:

---

### Step 1 — Create Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → create a new sheet
2. Name it: **Tesesthetics Bookings**
3. In **Row 1**, add these exact headers across the columns:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Timestamp | First Name | Last Name | Phone | Email | Address | Service | Type | Notes | Status |

---

### Step 2 — Create the Apps Script

1. In your sheet: click **Extensions → Apps Script**
2. Delete any existing code, paste this entire block:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data  = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.firstName || "",
      data.lastName  || "",
      data.phone     || "",
      data.email     || "",
      data.address   || "",
      data.service   || "",
      data.type      || "",
      data.notes     || "",
      data.status    || "New"
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput("Tesesthetics Bookings endpoint is live.")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Click **Save** (name it anything, e.g. "Booking Handler")

---

### Step 3 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the ⚙️ gear → select **Web app**
3. Configure:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** → **Authorize** when prompted → click **Allow**
5. **Copy the Web App URL** — looks like:
   `https://script.google.com/macros/s/LONG_RANDOM_STRING/exec`

> ⚠️ **Important:** Every time you make changes to the Apps Script code,
> you must create a **New Deployment** (not update existing) or the old
> version will still be running.

---

### Step 4 — Paste URL into the Website

In `index.html`, find this line near the bottom of the script section:

```javascript
const SHEETS_ENDPOINT = "YOUR_APPS_SCRIPT_URL_HERE";
```

Replace with your actual URL:

```javascript
const SHEETS_ENDPOINT = "https://script.google.com/macros/s/YOUR_ID/exec";
```

Save, push to GitHub, and Netlify will auto-deploy within 30 seconds.

---

### Managing Bookings in the Sheet

Every submission comes in with **Status = New**. Update the Status column manually:

| Status | Meaning |
|--------|---------|
| `New` | Just submitted, not yet reviewed |
| `Info` | Reached out with info, no appointment yet |
| `Booked` | Appointment confirmed |
| `Complete` | Service completed |
| `No Show` | Didn't show up |
| `Cancelled` | Client cancelled |

> 💡 **Tip:** Use Google Sheets conditional formatting to color-code the Status
> column. Select the column → Format → Conditional formatting → add rules
> for each status (green = Booked, gray = Complete, red = No Show, etc.)
> It makes the sheet much easier to scan at a glance.

---

## 🚀 GitHub + Netlify Workflow

### First-Time Setup

1. Create a [GitHub](https://github.com) account
2. Create a new **public** repository named `tesesthetics`
3. Upload your files — keeping this structure:
   ```
   index.html
   assets/
     logo.png
   README.md
   ```
4. In [Netlify](https://netlify.com): **Add new site → Import from GitHub**
5. Select your repo — leave all build settings blank
6. Click **Deploy site**

Your site goes live at a temp URL like `cozy-nasturtium-c364f9.netlify.app`

---

### Making Updates (The Normal Workflow)

1. Open the file on GitHub (click it → click the ✏️ pencil icon)
2. Make your edit
3. Click **Commit changes**
4. Netlify auto-detects the change and redeploys in ~30 seconds

That's it. No uploading, no dragging, no build tools. Just edit and commit.

---

### Adding a Custom Domain (When Ready)

When Veronica gets her real domain (e.g. `tesesthetics.com`):

1. In Netlify: **Site settings → Domain management → Add custom domain**
2. Type in the domain and follow Netlify's DNS instructions
3. Netlify handles the SSL certificate (https://) automatically for free

> 💡 **Tip:** Netlify's own DNS is the easiest option if you're buying the domain
> fresh. If using a registrar like GoDaddy or Namecheap, you'll point their
> nameservers to Netlify's — Netlify gives you the exact values to copy/paste.

---

## 🌱 Growing the Site Over Time

Here's a roadmap of things to add as the business grows:

| When | What to Add |
|------|-------------|
| Now | Phone number + email in footer |
| Now | Google Sheets endpoint URL |
| Soon | Photo of Veronica in the About section |
| Soon | Real pricing confirmed for all services |
| Later | Instagram feed or link |
| Later | Before/after photo gallery |
| Later | Gift card or package offerings |
| Later | Online booking tool (Square, Acuity, Vagaro) |
| Later | Blog or skin tips section |

---

## 🎨 Brand Reference

| | Color | Hex |
|--|-------|-----|
| 🟣 | Lavender | `#C5A4E8` |
| 🟣 | Lavender Deep | `#9B72CF` |
| 🟫 | Bronze | `#8B4A28` |
| 🟫 | Bronze Light | `#B87046` |
| 🟡 | Cream | `#FAF7F2` |
| ⬛ | Dark | `#2C1A10` |

**Fonts:**
- Display / Headings: `Cormorant Garamond` (Google Fonts)
- Body / UI: `Jost` (Google Fonts)

---

## 🆘 Troubleshooting

**Blank page after saving a change**
→ Almost always a JavaScript syntax error. Common causes:
- Missing or extra comma in the SERVICES or FAQS array
- An unescaped apostrophe in text (use `\'` instead of `'`)
- An unclosed quote `"` somewhere

**Logo not showing up**
→ Make sure `logo.png` is inside the `assets/` folder in GitHub — not just
in the root. The file path in the HTML is `assets/logo.png`.

**Booking form submits but nothing appears in the sheet**
→ Double-check that you created a **New Deployment** (not edited an existing one)
in Apps Script. Also confirm the URL in `SHEETS_ENDPOINT` ends with `/exec`.

**Netlify not updating after a GitHub commit**
→ Go to Netlify → Deploys — you should see the deploy triggered. If it shows
"failed", click it to see the error log. Usually it's a file path issue.

**Site looks unstyled (like plain text)**
→ This was the old multi-file issue. The rebuilt site has all CSS inside
`index.html` so this shouldn't happen anymore. If it does, make sure you're
using the latest `index.html`.

---

*Built with 💜 for Veronica & Tesesthetics — Buford, GA*
