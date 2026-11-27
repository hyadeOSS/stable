// hyadeOS legal and health pages: language switch (follows the system language, Italian or English),
// a bar linking the pages of the same group, and where the page was opened from:
//   ?embed=settings  inside Settings (About, or the page named by &back=, e.g. back=accessibility)
//   ?from=setup      first-run setup (back goes to the setup's Legal step)
(function () {
  const params = new URLSearchParams(location.search);
  const embed = params.get('embed') === 'settings';
  const fromSetup = params.get('from') === 'setup';
  // Only Settings pages can be a "back" target: a name, never a URL.
  const backPage = /^[a-z0-9-]+$/.test(params.get('back') || '') ? params.get('back') : 'about';
  if (embed) document.body.classList.add('embed-settings');

  // Two groups: the legal documents, and health & device care. The bar shows the page's own group.
  const GROUPS = [
    [['index.html', 'Overview', 'Panoramica'], ['license.html', 'License', 'Licenza'], ['terms.html', 'Terms of use', "Termini d'uso"], ['privacy.html', 'Privacy', 'Privacy']],
    [['safety.html', 'Health & safety', 'Salute e sicurezza'], ['device-care.html', 'Device care & cooling', 'Cura del dispositivo e raffreddamento']]
  ];
  const here = location.pathname.split('/').pop() || 'index.html';
  const group = GROUPS.find(g => g.some(([file]) => file === here)) || GROUPS[0];
  const langBar = document.querySelector('.lang');
  if (langBar) {
    const nav = document.createElement('nav');
    nav.className = 'doc-nav';
    nav.setAttribute('aria-label', 'Documents');
    group.forEach(([file, en, it]) => {
      const a = document.createElement('a');
      a.href = file; a.dataset.legal = ''; a.dataset.en = en; a.dataset.it = it;
      if (file === here) a.setAttribute('aria-current', 'page');
      nav.append(a);
    });
    langBar.after(nav);
  }

  const buttons = [...document.querySelectorAll('.lang button')];
  function setLang(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-lang]').forEach(el => el.classList.toggle('show', el.dataset.lang === lang));
    document.querySelectorAll('.doc-nav a, [data-it][data-en]').forEach(a => { a.textContent = a.dataset[lang] || a.dataset.en; });
    buttons.forEach(b => b.classList.toggle('active', b.dataset.set === lang));
  }
  buttons.forEach(b => b.addEventListener('click', () => setLang(b.dataset.set)));
  const i18n = window.hyadeOSI18n;
  const locale = (i18n && (i18n.language || i18n.locale)) || navigator.language || 'en';
  setLang(/^it\b/i.test(locale) ? 'it' : 'en');

  // Back: to the Settings page it came from, to the setup step, otherwise history.
  const back = () => {
    if (embed) location.href = `/desktop/apps/settings/assets/${backPage}.html`;
    else if (fromSetup) location.href = '/desktop/license.html';
    else history.back();
  };
  document.querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', event => { event.preventDefault(); back(); }));

  // Links between the pages keep the same mode.
  document.querySelectorAll('a[data-legal]').forEach(a => {
    const url = new URL(a.getAttribute('href'), location.href);
    if (embed) { url.searchParams.set('embed', 'settings'); if (backPage !== 'about') url.searchParams.set('back', backPage); }
    if (fromSetup) url.searchParams.set('from', 'setup');
    a.href = url.pathname + url.search;
  });
})();
