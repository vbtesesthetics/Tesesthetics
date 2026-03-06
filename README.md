<!-- 
  Include this script tag BEFORE the main page scripts.
  Set your business slug and Supabase keys here.
  
  OPTION A: Hardcode per-deployment (simplest)
  OPTION B: Use Netlify environment variables with a build step
  
  For the booking page, only SALON_SLUG is needed (API handles DB).
  For the admin page, Supabase URL + Anon Key are needed for auth.
-->
<script>
  // === CONFIGURE PER INSTALLATION ===
  window.SALON_SLUG = 'your-business-slug';      // Must match businesses.slug in DB
  window.SUPABASE_URL = 'https://your-project.supabase.co';
  window.SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';
  // === END CONFIG ===
</script>
