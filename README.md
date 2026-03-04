# Tesesthetics Website

A modern, multi-file website for Tesesthetics — skin care services in Buford, GA.

---

## 📁 File Structure

```
tesesthetics/
├── index.html              ← Main site (structure only — no editing needed)
├── css/
│   └── styles.css          ← All styles, colors, fonts, layout
├── js/
│   ├── app.js              ← Site logic (services render, nav, animations)
│   └── booking.js          ← Booking form + Google Sheets integration
├── data/
│   ├── services.js         ← ✏️ EDIT THIS to add/change/remove services
│   └── content.js          ← ✏️ EDIT THIS to update all text on the site
└── assets/
    └── logo.png            ← Logo file
```

---

## ✏️ How to Edit Content

### Change text, bio, FAQs, business info:
→ Open `data/content.js` and edit the values directly.
  - Update the bio when ready
  - Add phone/email/Instagram to `business` section
  - Edit FAQ questions/answers

### Add or change services:
→ Open `data/services.js`
  - Copy an existing service object and edit it
  - Set `available: false, comingSoon: true` for services not yet offered
  - Set `available: true, comingSoon: false` for active services

### Change colors:
→ Open `css/styles.css` and edit the `:root { }` section at the top.

---

## 📊 Google Sheets Integration (Booking Form)

### Step 1 — Create Your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it: **Tesesthetics Bookings**
3. In **Row 1**, add these exact headers (one per cell):
   ```
   Timestamp | First Name | Last Name | Phone | Email | Address | Service | Type | Notes | Status
   ```

---

### Step 2 — Create the Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete any existing code and paste this:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp   || new Date().toLocaleString(),
      data.firstName   || "",
      data.lastName    || "",
      data.phone       || "",
      data.email       || "",
      data.address     || "",
      data.service     || "",
      data.type        || "",
      data.notes       || "",
      data.status      || "New"
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

// Allow GET requests (for testing)
function doGet(e) {
  return ContentService
    .createTextOutput("Tesesthetics Bookings endpoint is live.")
    .setMimeType(ContentService.MimeType.TEXT);
}
```

3. Click **Save** (name it anything, e.g. "Bookings Handler")

---

### Step 3 — Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the ⚙️ gear next to "Select type" → choose **Web app**
3. Set these options:
   - **Description**: Tesesthetics Booking Handler
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**
5. Authorize when prompted (click "Allow")
6. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/LONG_STRING/exec`

---

### Step 4 — Add URL to Website

1. Open `js/booking.js`
2. Find this line near the top:
   ```javascript
   endpoint: "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",
   ```
3. Replace with your actual URL:
   ```javascript
   endpoint: "https://script.google.com/macros/s/YOUR_ID/exec",
   ```

---

### Tracking Status in the Sheet

Each submission arrives with **Status = "New"**. You can manually update this to:
- `New` — just submitted, hasn't been seen
- `Info` — sent information, no booking yet
- `Booked` — appointment confirmed
- `Complete` — service done
- `No Show` — didn't show up

You can also use conditional formatting in Google Sheets to color-code statuses!

---

## 🚀 Deploying to GitHub Pages

### First-time setup:
1. Create a [GitHub account](https://github.com) if you haven't
2. Create a new **public** repository (e.g. `tesesthetics`)
3. Upload all these files keeping the same folder structure
4. Go to **Settings → Pages**
5. Under "Source", select **Deploy from branch → main → / (root)**
6. Click **Save** — your site will be live at:
   `https://YOUR_USERNAME.github.io/tesesthetics`

### Future edits:
- Edit files directly on GitHub (click the file → pencil icon)
- Or use GitHub Desktop for drag-and-drop updates

---

## 🌐 Custom Domain (when ready)

When you get a domain (e.g. `tesesthetics.com`):
1. Add a file called `CNAME` to the root of your repo
2. Put just your domain name in it: `tesesthetics.com`
3. Configure your domain registrar's DNS to point to GitHub Pages
4. In GitHub → Settings → Pages → add your custom domain

---

## 🎨 Brand Colors (for reference)

| Color | Hex | Use |
|-------|-----|-----|
| Lavender | `#C5A4E8` | Accents, rings |
| Lavender Light | `#EDE0F9` | Subtle backgrounds |
| Bronze | `#8B4A28` | Primary text, buttons |
| Bronze Light | `#B87046` | Hover states |
| Cream | `#FAF7F2` | Main background |
| Dark | `#2C1A10` | Headings |

---

## 📞 Need Help?

The site is built with plain HTML, CSS, and JavaScript — no frameworks or build tools required. Just edit the files and push to GitHub!
