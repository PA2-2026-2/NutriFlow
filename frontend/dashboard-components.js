(function initNutriFlowDashboardComponents() {
  class NutriFlowBaseComponent extends HTMLElement {
    connectedCallback() {
      if (this.dataset.componentReady === 'true') {
        return;
      }

      this.dataset.componentReady = 'true';
      this.replaceChildren(this.build());
    }

    getAttr(name, fallback = '') {
      return this.getAttribute(name) ?? fallback;
    }

    createElement(tagName, className, textContent, id) {
      const element = document.createElement(tagName);

      if (className) {
        element.className = className;
      }

      if (id) {
        element.id = id;
      }

      if (textContent !== undefined && textContent !== null) {
        element.textContent = textContent;
      }

      return element;
    }

    appendIfPresent(parent, element, textContent) {
      if (!textContent) {
        return;
      }

      parent.appendChild(element);
    }
  }

  class NutriFlowStatCard extends NutriFlowBaseComponent {
    build() {
      const article = this.createElement(
        'article',
        [
          'dashboard-surface',
          'dashboard-card',
          this.getAttr('variant'),
          'rounded-[28px]',
          'p-5',
        ].filter(Boolean).join(' '),
      );

      article.append(
        this.createElement(
          'p',
          this.getAttr('label-class', 'text-xs font-semibold uppercase tracking-[0.18em] text-nutriflow-500'),
          this.getAttr('label'),
        ),
        this.createElement(
          'p',
          this.getAttr('value-class', 'mt-4 text-4xl font-bold tracking-[-0.06em] text-nutriflow-950'),
          this.getAttr('default-value', '0'),
          this.getAttr('value-id'),
        ),
        this.createElement(
          'p',
          this.getAttr('description-class', 'mt-2 text-sm text-nutriflow-700'),
          this.getAttr('description'),
        ),
      );

      return article;
    }
  }

  class NutriFlowWorkspaceChip extends NutriFlowBaseComponent {
    build() {
      const article = this.createElement(
        'article',
        ['workspace-chip', this.getAttr('variant')].filter(Boolean).join(' '),
      );

      article.append(
        this.createElement(
          'p',
          this.getAttr('label-class', 'text-xs font-semibold uppercase tracking-[0.16em] text-nutriflow-500'),
          this.getAttr('label'),
        ),
        this.createElement(
          'strong',
          this.getAttr('value-class'),
          this.getAttr('default-value', '0'),
          this.getAttr('value-id'),
        ),
        this.createElement(
          'span',
          this.getAttr('meta-class'),
          this.getAttr('default-meta'),
          this.getAttr('meta-id'),
        ),
      );

      return article;
    }
  }

  class NutriFlowMetricBlock extends NutriFlowBaseComponent {
    build() {
      const article = this.createElement(
        'article',
        ['admin-metric-block', this.getAttr('variant')].filter(Boolean).join(' '),
      );

      article.append(
        this.createElement('span', this.getAttr('label-class'), this.getAttr('label')),
        this.createElement(
          'strong',
          this.getAttr('value-class'),
          this.getAttr('default-value', '0'),
          this.getAttr('value-id'),
        ),
      );

      this.appendIfPresent(
        article,
        this.createElement(
          'small',
          this.getAttr('meta-class'),
          this.getAttr('default-meta'),
          this.getAttr('meta-id'),
        ),
        this.getAttr('default-meta'),
      );

      return article;
    }
  }

  class NutriFlowReportCard extends NutriFlowBaseComponent {
    build() {
      const article = this.createElement(
        'article',
        ['report-card', this.getAttr('variant')].filter(Boolean).join(' '),
      );

      article.append(
        this.createElement('p', this.getAttr('label-class'), this.getAttr('label')),
        this.createElement(
          'strong',
          this.getAttr('value-class'),
          this.getAttr('default-value', '0'),
          this.getAttr('value-id'),
        ),
      );

      this.appendIfPresent(
        article,
        this.createElement('span', this.getAttr('description-class'), this.getAttr('description')),
        this.getAttr('description'),
      );

      return article;
    }
  }

  [
    ['nf-stat-card', NutriFlowStatCard],
    ['nf-workspace-chip', NutriFlowWorkspaceChip],
    ['nf-metric-block', NutriFlowMetricBlock],
    ['nf-report-card', NutriFlowReportCard],
  ].forEach(([name, component]) => {
    if (!window.customElements.get(name)) {
      window.customElements.define(name, component);
    }
  });
})();
