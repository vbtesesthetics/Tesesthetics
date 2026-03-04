// ============================================================
//  TESESTHETICS — MAIN APP JS
//  Renders dynamic content from data files, handles navigation,
//  scroll animations, mobile menu, etc.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  applyContentToPage();
  renderServices();
  renderAboutHighlights();
  renderFAQ();
  initNav();
  initScrollAnimations();
  initSmoothScroll();
  initBookingForm();
  renderFooter();
});

// ── APPLY TEXT CONTENT ────────────────────────────────────

function applyContentToPage() {
  if (typeof CONTENT === "undefined") return;
  const c = CONTENT;

  setText("hero-headline", c.hero.headline.replace("\n", "<br>"));
  setText("hero-sub", c.hero.subheadline);
  setText("hero-cta", c.hero.ctaText);
  setText("hero-cta-secondary", c.hero.ctaSecondary);
  setText("about-name", c.about.name);
  setText("about-cert", c.about.certificationNote);
  setText("booking-headline", c.booking.headline);
  setText("booking-sub", c.booking.subheadline);
  setText("booking-note", c.booking.formNote);

  // Bio paragraphs
  const bioContainer = document.getElementById("about-bio");
  if (bioContainer) {
    bioContainer.innerHTML = c.about.bio.map(p => `<p>${p}</p>`).join("");
  }

  // Page title
  document.title = `${c.business.name} — ${c.business.tagline}`;

  // Social links
  if (c.business.instagram) {
    const igEl = document.getElementById("nav-instagram");
    if (igEl) { igEl.href = `https://instagram.com/${c.business.instagram.replace("@","")}`; igEl.style.display = "flex"; }
  }
}

function setText(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ── RENDER SERVICES ───────────────────────────────────────

function renderServices() {
  if (typeof SERVICES === "undefined" || typeof SERVICE_CATEGORIES === "undefined") return;

  const container = document.getElementById("services-container");
  if (!container) return;

  SERVICE_CATEGORIES.forEach(cat => {
    const catServices = SERVICES.filter(s => s.category === cat);
    if (!catServices.length) return;

    const section = document.createElement("div");
    section.className = "service-category";
    section.innerHTML = `<h3 class="category-label">${cat}</h3>`;

    const grid = document.createElement("div");
    grid.className = "services-grid";

    catServices.forEach(s => {
      const card = document.createElement("div");
      card.className = `service-card${s.comingSoon ? " coming-soon" : ""}`;
      card.setAttribute("data-service-id", s.id);

      card.innerHTML = `
        <div class="card-header">
          <span class="card-icon">${s.icon}</span>
          <div class="card-title-row">
            <h4 class="card-name">${s.name}</h4>
            ${s.comingSoon ? '<span class="badge coming-soon-badge">Coming Soon</span>' : '<span class="badge available-badge">Available</span>'}
          </div>
          <div class="card-meta">
            <span class="card-duration">⏱ ${s.duration}</span>
            <span class="card-price">${s.price}</span>
          </div>
        </div>
        <p class="card-description">${s.description}</p>
        <ul class="card-bullets">
          ${s.bullets.map(b => `<li>${b}</li>`).join("")}
        </ul>
        ${!s.comingSoon ? `<button class="card-book-btn" onclick="scrollToBooking('${s.id}')">Book This →</button>` : `<span class="card-notify">Get notified when available</span>`}
      `;

      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// ── RENDER ABOUT HIGHLIGHTS ───────────────────────────────

function renderAboutHighlights() {
  if (typeof CONTENT === "undefined") return;
  const highlights = CONTENT.about.highlights;
  const container = document.getElementById("about-highlights");
  if (!container || !highlights) return;

  container.innerHTML = highlights.map(h => `
    <div class="highlight-item">
      <span class="highlight-icon">${h.icon}</span>
      <div>
        <strong>${h.label}</strong>
        <span>${h.detail}</span>
      </div>
    </div>
  `).join("");
}

// ── RENDER FAQ ────────────────────────────────────────────

function renderFAQ() {
  if (typeof CONTENT === "undefined") return;
  const faqs = CONTENT.faq;
  const container = document.getElementById("faq-container");
  if (!container || !faqs) return;

  container.innerHTML = faqs.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-question" onclick="toggleFAQ(${i})" aria-expanded="false">
        <span>${item.q}</span>
        <span class="faq-chevron">›</span>
      </button>
      <div class="faq-answer" id="faq-answer-${i}">
        <p>${item.a}</p>
      </div>
    </div>
  `).join("");
}

function toggleFAQ(index) {
  const answer = document.getElementById(`faq-answer-${index}`);
  const btn = document.querySelector(`#faq-${index} .faq-question`);
  const chevron = btn.querySelector(".faq-chevron");
  const isOpen = answer.classList.contains("open");

  // Close all
  document.querySelectorAll(".faq-answer.open").forEach(el => {
    el.classList.remove("open");
    el.style.maxHeight = null;
  });
  document.querySelectorAll(".faq-question").forEach(b => {
    b.setAttribute("aria-expanded", "false");
    b.querySelector(".faq-chevron").style.transform = "";
  });

  if (!isOpen) {
    answer.classList.add("open");
    answer.style.maxHeight = answer.scrollHeight + "px";
    btn.setAttribute("aria-expanded", "true");
    chevron.style.transform = "rotate(90deg)";
  }
}

// ── FOOTER ────────────────────────────────────────────────

function renderFooter() {
  if (typeof CONTENT === "undefined") return;
  const f = CONTENT.footer;
  const b = CONTENT.business;
  setText("footer-tagline", f.tagline);
  setText("footer-copyright", f.copyright);
  setText("footer-disclaimer", f.disclaimer);
  if (b.email) setText("footer-email", b.email);
  if (b.phone) setText("footer-phone", b.phone);
}

// ── NAVIGATION ────────────────────────────────────────────

function initNav() {
  const hamburger = document.getElementById("hamburger");
  const navMenu = document.getElementById("nav-menu");
  const navbar = document.getElementById("navbar");

  // Mobile toggle
  if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
      hamburger.classList.toggle("open");
      navMenu.classList.toggle("open");
    });

    // Close on nav link click
    navMenu.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("open");
        navMenu.classList.remove("open");
      });
    });
  }

  // Scroll-based navbar style
  window.addEventListener("scroll", () => {
    if (window.scrollY > 60) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }

    // Active nav link highlight
    updateActiveNavLink();
  });
}

function updateActiveNavLink() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");
  let current = "";

  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 120) {
      current = section.getAttribute("id");
    }
  });

  navLinks.forEach(link => {
    link.classList.remove("active");
    if (link.getAttribute("href") === `#${current}`) {
      link.classList.add("active");
    }
  });
}

// ── SMOOTH SCROLL ─────────────────────────────────────────

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        const navH = document.getElementById("navbar")?.offsetHeight || 70;
        const top = target.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  });
}

function scrollToBooking(serviceId) {
  const bookingSection = document.getElementById("booking");
  if (!bookingSection) return;

  const navH = document.getElementById("navbar")?.offsetHeight || 70;
  const top = bookingSection.getBoundingClientRect().top + window.scrollY - navH;
  window.scrollTo({ top, behavior: "smooth" });

  // Pre-select the service
  setTimeout(() => {
    const select = document.getElementById("service-select");
    if (select && serviceId) {
      select.value = serviceId;
      select.dispatchEvent(new Event("change"));
      // Highlight the field briefly
      select.classList.add("highlight-pulse");
      setTimeout(() => select.classList.remove("highlight-pulse"), 1500);
    }
  }, 600);
}

// ── SCROLL ANIMATIONS ────────────────────────────────────

function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  document.querySelectorAll(".fade-in, .slide-up, .slide-left, .slide-right").forEach(el => {
    observer.observe(el);
  });
}

// ── PARTICLE / PETAL EFFECT (Hero) ───────────────────────

function initHeroParticles() {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const particles = Array.from({ length: 18 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 3 + 1,
    speedY: Math.random() * 0.5 + 0.2,
    speedX: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.4 + 0.1,
    color: Math.random() > 0.5 ? "197, 164, 232" : "160, 82, 45"
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
      ctx.fill();
      p.y -= p.speedY;
      p.x += p.speedX;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
    });
    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener("resize", () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  });
}

window.addEventListener("load", initHeroParticles);
