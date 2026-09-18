(function initNutriFlowUi() {
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
    setupSectionNavigation,
  };
})();
