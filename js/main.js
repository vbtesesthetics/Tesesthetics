// =====================================================
//  TESESTHETICS — SHARED JS
//  Nav, animations, booking bar
// =====================================================

const BOOKING_URL  = 'https://chaircare.netlify.app/booking/?b=tesesthetics';
const PORTAL_URL   = 'https://chaircare.netlify.app/portal/?b=tesesthetics';
const ADMIN_URL    = 'https://chaircare.netlify.app/admin/';

function initNav() {
  const hamburger = document.getElementById('hamburger');
  const menu      = document.getElementById('nav-menu');
  const navbar    = document.getElementById('navbar');
  if (!hamburger || !menu || !navbar) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    menu.classList.toggle('open');
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    hamburger.classList.remove('open');
    menu.classList.remove('open');
  }));
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // Mark active nav link by current page
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link[data-page]').forEach(l => {
    if (path.includes(l.dataset.page)) l.classList.add('active');
  });
}

function initAnimations() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.fade-in,.slide-up,.slide-left,.slide-right').forEach(el => obs.observe(el));
}

function initBookingLinks() {
  document.querySelectorAll('[data-book]').forEach(el => el.setAttribute('href', BOOKING_URL));
  document.querySelectorAll('[data-portal]').forEach(el => el.setAttribute('href', PORTAL_URL));
  document.querySelectorAll('[data-admin]').forEach(el => el.setAttribute('href', ADMIN_URL));
}

function initFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initAnimations();
  initBookingLinks();
  initFooterYear();
});
