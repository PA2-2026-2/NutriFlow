(function initNutriFlowUi() {
  const THEME_STORAGE_KEY = 'nutriflow.theme';

  function getPreferredTheme() {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setupThemeToggle() {
    let button = document.querySelector('[data-theme-toggle]');

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.themeToggle = '';
      button.className = 'nf-theme-toggle';
      document.body.appendChild(button);
    }

    function applyTheme(theme, persist = false) {
      const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = normalizedTheme;
      document.documentElement.style.colorScheme = normalizedTheme;

      if (persist) {
        window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
      }

      const nextTheme = normalizedTheme === 'dark' ? 'claro' : 'escuro';
      button.innerHTML = normalizedTheme === 'dark'
        ? '<span aria-hidden="true">☀</span><span>Modo claro</span>'
        : '<span aria-hidden="true">☾</span><span>Modo escuro</span>';
      button.setAttribute('aria-label', `Ativar modo ${nextTheme}`);
      button.setAttribute('aria-pressed', String(normalizedTheme === 'dark'));
      button.title = `Ativar modo ${nextTheme}`;
    }

    applyTheme(getPreferredTheme());
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  function setupSkipLink() {
    if (document.querySelector('.nf-skip-link')) {
      return;
    }

    const main = document.querySelector('main');
    if (!main) {
      return;
    }

    if (!main.id) {
      main.id = 'main-content';
    }

    const link = document.createElement('a');
    link.className = 'nf-skip-link';
    link.href = `#${main.id}`;
    link.textContent = 'Ir para o conteúdo principal';
    document.body.insertBefore(link, document.body.firstChild);
  }

  function setupBackToTop() {
    let button = document.getElementById('backToTopButton');

    if (!button) {
      button = document.createElement('button');
      button.id = 'backToTopButton';
      button.type = 'button';
      button.className = 'nf-back-to-top';
      button.setAttribute('aria-label', 'Voltar ao topo');
      button.title = 'Voltar ao topo';
      button.innerHTML = '<span aria-hidden="true">↑</span>';
      document.body.appendChild(button);
    }

    function updateVisibility() {
      button.classList.toggle('is-visible', window.scrollY > 320);
    }

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();
  }

  function setupSectionNavigation(options = {}) {
    const {
      linkSelector,
      activeClass = 'is-active',
      rootMargin = '-26% 0px -58% 0px',
    } = options;

    if (!linkSelector) {
      return;
    }

    const links = [...document.querySelectorAll(linkSelector)]
      .filter((link) => {
        const href = link.getAttribute('href') || '';
        return href.startsWith('#') && href.length > 1;
      });

    if (!links.length) {
      return;
    }

    const sections = links
      .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
      .filter(Boolean);

    function setActive(sectionId) {
      links.forEach((link) => {
        const href = link.getAttribute('href') || '';
        link.classList.toggle(activeClass, href === `#${sectionId}`);
      });
    }

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const href = link.getAttribute('href') || '';
        if (href.startsWith('#')) {
          setActive(href.slice(1));
        }
      });
    });

    if (!sections.length || typeof IntersectionObserver !== 'function') {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (visibleEntry?.target?.id) {
        setActive(visibleEntry.target.id);
      }
    }, {
      threshold: [0.2, 0.35, 0.55],
      rootMargin,
    });

    sections.forEach((section) => observer.observe(section));

    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      setActive(initialHash);
      return;
    }

    if (sections[0]?.id) {
      setActive(sections[0].id);
    }
  }

  window.NutriFlowUi = {
    setupBackToTop,
    setupSectionNavigation,
    setupSkipLink,
    setupThemeToggle,
  };

  setupSkipLink();
  setupThemeToggle();
  setupBackToTop();
})();
