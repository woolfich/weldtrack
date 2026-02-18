<script lang="ts">
  import { page } from '$app/stores';
</script>

<nav class="bottom-nav">
  <a href="/" class:active={$page.url.pathname === '/'}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
    <span>Главная</span>
  </a>
  <a href="/rates" class:active={$page.url.pathname === '/rates'}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
    </svg>
    <span>Нормы</span>
  </a>
  <a href="/plan" class:active={$page.url.pathname === '/plan'}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
    </svg>
    <span>План</span>
  </a>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: #1e293b;
    border-top: 1px solid #334155;
    display: flex;
    align-items: stretch;
    z-index: 100;
  }

  .bottom-nav a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #94a3b8;
    text-decoration: none;
    font-size: 11px;
    transition: color 0.15s;
  }

  .bottom-nav a.active {
    color: #38bdf8;
  }

  .bottom-nav a:active {
    opacity: 0.7;
  }
</style>
