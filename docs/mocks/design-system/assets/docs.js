/*
 * Trellis design system docs — shared page chrome. No dependencies.
 *
 * 1. Injects the SVG icon sprite (symbols transcribed from
 *    frontend/src/app/shared/components/rail-button/rail-icons.ts and
 *    tree-action-button/tree-action-icons.ts, plus the title-bar chrome
 *    glyphs from title-bar.component.html).
 * 2. Renders the sidebar navigation into the `.ds-nav` placeholder and
 *    highlights the current page (`<body data-page="…">`).
 *
 * Usage on each page:
 *   <body class="ds" data-page="components/buttons">
 *     <div class="ds-layout">
 *       <nav class="ds-nav" aria-label="Design system"></nav>
 *       <main class="ds-main">…</main>
 *     </div>
 *     <script src="../assets/docs.js"></script>
 */

(function () {
  'use strict';

  /* == Icon sprite ======================================================= */
  /* All product icons are hand-authored outline paths on a 24×24 viewBox
   * (fill:none, stroke:currentColor) — no icon-library dependency. */

  var RAIL_ICONS = {
    // rail-icons.ts — <app-rail-button> glyphs.
    new: ['M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM13 2v5h5', 'M12 14v6M9 17h6'],
    save: ['M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 3v5h7V3M7 13h10v8H7z'],
    upload: ['M12 15V4M8 8l4-4 4 4', 'M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],
    templates: ['M4 4h6v6H4zM14 4h6v6H14zM4 14h6v6H4zM14 14h6v6H14z'],
    documents: ['M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z'],
    explorer: [
      'M4 9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
      'M8 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1'
    ]
  };

  var ACTION_ICONS = {
    // tree-action-icons.ts — <app-tree-action-button> glyphs.
    open: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6M21 3l-11 11'],
    rename: ['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
    delete: [
      'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      'M10 11v6M14 11v6'
    ],
    'new-file': ['M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM13 2v5h5', 'M12 14v6M9 17h6'],
    'new-folder': [
      'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
      'M12 10.5v5M9.5 13h5'
    ],
    move: [
      'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
      'M9 13h5.5M12 10.5 14.5 13 12 15.5'
    ],
    update: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M21 3l-8 8M13 5v6h6'],
    scope: [
      'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0',
      'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
      'M12 2v3M12 19v3M2 12h3M19 12h3'
    ],
    up: ['M12 19V5M5 12l7-7 7 7'],
    clear: ['M6 6l12 12M18 6L6 18'],
    export: ['M12 3v12M8 11l4 4 4-4', 'M4 19h16'],
    'no-export': ['M12 3v12M8 11l4 4 4-4', 'M4 19h16', 'M3 3l18 18'],
    copy: [
      'M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9z',
      'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'
    ],
    check: ['M4 12.5l5 5L20 6.5']
  };

  var CHROME_ICONS = {
    // title-bar.component.html — chrome glyphs (16×16 unless noted).
    logo: { viewBox: '0 0 24 24', paths: ['M4 8h16M4 16h16M8 4v16M16 4v16'] },
    search: { viewBox: '0 0 16 16', paths: ['M10.6 10.6 14 14'], circles: [{ cx: 7, cy: 7, r: 4.5 }] },
    minimize: { viewBox: '0 0 16 16', paths: ['M3 8.5h10'] },
    maximize: { viewBox: '0 0 16 16', rects: [{ x: 3, y: 3.5, width: 10, height: 9.5, rx: 1 }] },
    close: { viewBox: '0 0 16 16', paths: ['M4 4.5l8 8M12 4.5l-8 8'] }
  };

  function symbol(id, viewBox, inner) {
    return '<symbol id="' + id + '" viewBox="' + viewBox + '">' + inner + '</symbol>';
  }

  function pathsToInner(paths) {
    return paths.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
  }

  function buildSprite() {
    var out = [];
    Object.keys(RAIL_ICONS).forEach(function (name) {
      out.push(symbol('tds-icon-rail-' + name, '0 0 24 24', pathsToInner(RAIL_ICONS[name])));
    });
    Object.keys(ACTION_ICONS).forEach(function (name) {
      out.push(symbol('tds-icon-action-' + name, '0 0 24 24', pathsToInner(ACTION_ICONS[name])));
    });
    Object.keys(CHROME_ICONS).forEach(function (name) {
      var spec = CHROME_ICONS[name];
      var inner = pathsToInner(spec.paths || []);
      (spec.circles || []).forEach(function (c) {
        inner += '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '"/>';
      });
      (spec.rects || []).forEach(function (r) {
        inner += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.width + '" height="' + r.height + '"' +
          (r.rx ? ' rx="' + r.rx + '"' : '') + '/>';
      });
      out.push(symbol('tds-icon-chrome-' + name, spec.viewBox, inner));
    });

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.innerHTML = out.join('');
    document.body.insertBefore(svg, document.body.firstChild);
  }

  /* == Navigation ======================================================== */

  var NAV = [
    { section: null, links: [['index', 'Overview']] },
    {
      section: 'Foundations',
      links: [
        ['foundations/color', 'Color'],
        ['foundations/typography', 'Typography'],
        ['foundations/spacing', 'Spacing & layout'],
        ['foundations/elevation', 'Elevation'],
        ['foundations/iconography', 'Iconography'],
        ['foundations/motion', 'Motion']
      ]
    },
    {
      section: 'Components',
      links: [
        ['components/buttons', 'Buttons'],
        ['components/form-controls', 'Form controls'],
        ['components/dialogs', 'Dialogs'],
        ['components/trees', 'Trees'],
        ['components/panels', 'Panels'],
        ['components/menus', 'Menus'],
        ['components/toolbars', 'Toolbars & chrome'],
        ['components/indicators', 'Indicators']
      ]
    },
    {
      section: 'Patterns',
      links: [
        ['patterns/shell', 'Workbench shell'],
        ['patterns/editor', 'Editor surface'],
        ['patterns/preview', 'Diagram preview'],
        ['patterns/feedback', 'Feedback & empty states']
      ]
    }
  ];

  function buildNav() {
    var host = document.querySelector('.ds-nav');
    if (!host) return;

    var page = document.body.getAttribute('data-page') || 'index';
    // Pages live at the root (index) or one level down (foundations/…).
    var root = page.indexOf('/') >= 0 ? '../' : './';

    function href(id) {
      return id === 'index' ? root + 'index.html' : root + id + '.html';
    }

    var html =
      '<a class="ds-nav__brand" href="' + href('index') + '">' +
      '<svg aria-hidden="true"><use href="#tds-icon-chrome-logo"/></svg>' +
      '<span><span class="ds-nav__brand-name">Trellis</span>' +
      '<span class="ds-nav__brand-sub">Design System</span></span></a>';

    NAV.forEach(function (group) {
      if (group.section) {
        html += '<div class="ds-nav__section">' + group.section + '</div>';
      }
      group.links.forEach(function (link) {
        var id = link[0];
        var active = id === page ? ' ds-nav__link--active" aria-current="page' : '';
        html += '<a class="ds-nav__link' + active + '" href="' + href(id) + '">' + link[1] + '</a>';
      });
    });

    host.innerHTML = html;
  }

  buildSprite();
  buildNav();
})();
