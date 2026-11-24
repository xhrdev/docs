import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import llmstxt, {
  copyOrDownloadAsMarkdownButtons,
} from 'vitepress-plugin-llms';

/**
 * Points the default theme's `import './styles/fonts.css'` at
 * `.vitepress/theme/fonts.css` instead.
 *
 * That import is what pulls the theme's ten Inter woff2 files into the bundle,
 * and VitePress adds its `<link rel="preload">` for Inter only when it finds an
 * `inter-roman-latin.*.woff2` in the build output — so replacing the import
 * drops both. Overriding `--vp-font-family-base` in custom.css (which we also
 * do) changes what renders but still ships and preloads a font nothing uses:
 * 66 KB at high priority on every first visit.
 *
 * This is a plugin rather than a `resolve.alias` entry because the specifier is
 * the relative `./styles/fonts.css`; an alias pattern specific enough not to
 * catch our own files would never match it. Matching on the importer is both
 * narrower and clearer about intent.
 *
 * `enforce: 'pre'` is required, not decoration: plain user plugins resolve
 * after Vite's own resolver, by which point the import is already bound.
 *
 * Typed through JSDoc rather than `satisfies Plugin` so the file stays parseable
 * by the repo's ESLint config, which reads `.mts` as plain JavaScript.
 *
 * @returns {import('vite').Plugin}
 */
const replaceDefaultThemeFonts = () => ({
  enforce: 'pre',
  name: 'xhr:replace-default-theme-fonts',
  resolveId(source, importer) {
    if (
      source === './styles/fonts.css' &&
      importer?.includes('vitepress/dist/client/theme-default/')
    ) {
      return fileURLToPath(new URL('./theme/fonts.css', import.meta.url));
    }
    return null;
  },
});

/**
 * The site is built with `cleanUrls` left at its default (false), so every
 * page except the root actually serves as `/whatever.html` (confirmed against
 * `.vitepress/dist/index.html`'s own internal links). Sitemap/canonical URLs
 * have to match what the server really returns, not the extension-less path
 * used in nav/sidebar config.
 */
/** @param {string} relativePath */
const canonicalPath = (relativePath) =>
  relativePath === 'index.md'
    ? '/'
    : `/${relativePath.replace(/\.md$/, '.html')}`;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  assetsDir: 'assets',

  // Matches the marketing site's own <meta description>, so the two describe
  // the same product in the same words.
  description:
    "Self-hosted anti-bot solvers that keep working after the vendor's next update.",
  // DM Sans and JetBrains Mono are the two faces xhr.dev uses (it loads them
  // through next/font); matching them is most of what makes the docs read as
  // the same product. They used to come from fonts.googleapis.com — a
  // render-blocking stylesheet on a third-party origin — and are now declared
  // in `.vitepress/theme/fonts.css` against woff2 in `src/public/fonts`.
  //
  // The icon is served from this origin too. It was previously hotlinked from
  // raw.githubusercontent.com, which is not a CDN and caps its own
  // `cache-control` at 300 seconds.
  head: [
    ['link', { href: '/favicon.ico', rel: 'icon', sizes: 'any' }],
    ['link', { href: '/logo.svg', rel: 'icon', type: 'image/svg+xml' }],
    // Body text only, replacing the Inter preload the default theme used to
    // emit. JetBrains Mono is deliberately left to load off the stylesheet:
    // it is 31 KB that only code needs, and `font-display: swap` covers it.
    [
      'link',
      {
        as: 'font',
        crossorigin: '',
        href: '/fonts/dm-sans-latin.woff2',
        rel: 'preload',
        type: 'font/woff2',
      },
    ],
  ],
  markdown: {
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
  },
  sitemap: {
    hostname: 'https://docs.xhr.dev',
  },

  srcDir: 'src',

  srcExclude: [
    'README.md', // Exclude a specific file
  ],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config

    // Mirrors the marketing site's footer, minus the links already in the nav.
    footer: {
      copyright:
        '© 2026 XHR Software Inc. · <a href="https://xhr.dev/">xhr.dev</a> · <a href="https://status.xhr.dev/">status</a> · <a href="mailto:info@xhr.dev">info@xhr.dev</a>',
      message:
        'Self-hosted anti-bot solvers. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>',
    },
    // byte-identical to the copy in xhrdev/starter-kit this used to hotlink
    logo: '/logo.svg',

    nav: [
      { link: 'https://xhr.dev/', text: 'xhr.dev' },
      { link: 'mailto:info@xhr.dev', text: 'Request a Licence' },
      {
        link: 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2uDlsqLG_VZLl3s3ri_-YIXD3xXi5WzY21o0dFuk6Gq4HhcXwJBxUz-1K6kMGxTEf4oIPny-nV',
        text: 'Book a Call',
      },
    ],

    search: {
      provider: 'local',
    },

    sidebar: [
      {
        items: [
          { link: '/', text: 'Getting Started' },
          { link: '/deployment', text: 'Deployment' },
          { link: '/on-prem', text: 'On-prem & network posture' },
        ],
        text: 'Overview',
      },
      {
        items: [
          { link: '/integrate', text: 'How to integrate' },
          { link: '/integrate-api', text: 'Via the API' },
          { link: '/integrate-http-clients', text: 'Via HTTP (Node, Python)' },
          { link: '/integrate-browser', text: 'Via a browser (Playwright)' },
          { link: '/integrate-lightpanda', text: 'Via a browser (Lightpanda)' },
          { link: '/integrate-claude', text: 'Via Claude' },
          { link: '/sdk', text: 'SDK' },
        ],
        text: 'Integrating',
      },
      {
        items: [
          {
            collapsed: false,
            items: [
              { link: '/api-akamai-sensor', text: 'Sensor (_abck)' },
              { link: '/api-akamai-sbsd', text: 'SBSD' },
              { link: '/api-akamai-pixel', text: 'Pixel' },
            ],
            link: '/api-akamai',
            text: 'Akamai',
          },
          { link: '/api-datadome', text: 'DataDome' },
          { link: '/api-f5', text: 'F5 / Shape' },
          { link: '/openapi.yml', text: 'OpenAPI Spec (download)' },
          {
            link: 'https://docs.xhr.dev/api.html',
            text: 'OpenAPI Spec (browse)',
          },
        ],
        text: 'API Reference',
      },
      {
        items: [
          {
            link: 'https://github.com/xhrdev/examples',
            text: 'xhrdev/examples',
          },
          {
            link: 'https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/README.md',
            text: 'Akamai sensor walkthrough',
          },
          {
            link: 'https://github.com/xhrdev/examples/blob/master/src/akamai/sbsd/README.md',
            text: 'Akamai SBSD walkthrough',
          },
          {
            link: 'https://github.com/xhrdev/examples/blob/master/src/datadome/README.md',
            text: 'DataDome walkthrough',
          },
        ],
        text: 'Examples',
      },
      {
        items: [
          { link: '/faq', text: 'FAQs' },
          { link: '/security', text: 'Security' },
        ],
        text: 'Misc',
      },
      {
        items: [
          { link: '/privacy', text: 'Privacy Policy' },
          {
            link: '/extension-privacy',
            text: 'Privacy Policy (Chrome extension)',
          },
          { link: '/terms', text: 'Terms and Conditions' },
          { link: '/subprocessors', text: 'Subprocessors' },
          { link: '/dpa', text: 'Data Processing Addendum' },
        ],
        text: 'Legal',
      },
    ],

    // The logo is already the wordmark, so the text title beside it just
    // renders "xhr.dev xhr". The marketing site's navbar shows the mark alone.
    siteTitle: false,

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xhrdev' },
      { icon: 'linkedin', link: 'https://linkedin.com/company/xhrdev' },
    ],
  },

  title: 'xhr',

  // Per-page canonical link + Open Graph/Twitter meta. VitePress has no
  // built-in option for these -- transformHead is the documented escape
  // hatch, running once per page at build time with that page's own title
  // and description already resolved.
  transformHead: ({ pageData }) => {
    const url = `https://docs.xhr.dev${canonicalPath(pageData.relativePath)}`;
    const description =
      pageData.description ||
      "Self-hosted anti-bot solvers that keep working after the vendor's next update.";

    return [
      ['link', { href: url, rel: 'canonical' }],
      ['meta', { content: pageData.title, property: 'og:title' }],
      ['meta', { content: description, property: 'og:description' }],
      ['meta', { content: url, property: 'og:url' }],
      ['meta', { content: 'article', property: 'og:type' }],
      ['meta', { content: 'docs.xhr.dev', property: 'og:site_name' }],
      ['meta', { content: '/logo.svg', property: 'og:image' }],
      ['meta', { content: 'summary', name: 'twitter:card' }],
      ['meta', { content: pageData.title, name: 'twitter:title' }],
      ['meta', { content: description, name: 'twitter:description' }],
    ];
  },
  vite: {
    // esbuild doesn't recognize the repo's shared tsconfig `target: "ES2025"`;
    // pin it to a target esbuild@0.21 actually supports.
    esbuild: {
      target: 'esnext',
    },
    plugins: [llmstxt(), replaceDefaultThemeFonts()],
  },
});
