/* Instead of Sleeping
   Reads writing/list.txt, loads each piece named there, and draws the site.
   You should not need to edit this file to add writing. */
(function () {
  "use strict";

  var WORDS_PER_MINUTE = 200;
  var main = document.getElementById("main");
  var siteName = document.title;
  var pieces = [];     // newest first
  var missing = [];    // names in list.txt that could not be loaded
  var about = null;
  var ready = false;

  /* ---------- small helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function getText(path) {
    return fetch(path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path);
      return r.text();
    });
  }
  function slugOf(name) {
    return name.replace(/\.txt$/i, "").trim();
  }
  function wordCount(s) {
    var m = s.trim().match(/\S+/g);
    return m ? m.length : 0;
  }
  function readTime(s) {
    return Math.max(1, Math.round(wordCount(s) / WORDS_PER_MINUTE)) + " min read";
  }
  function parseDate(s) {
    if (!s) return null;
    var m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function showDate(d, long) {
    if (!d) return "";
    return d.toLocaleDateString(undefined, long
      ? { year: "numeric", month: "long", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" });
  }

  /* A piece file looks like:
       Title: What the kettle knows
       Date: 2026-11-10
       Category: Poems
       Label: Sonnet
       (blank line)
       The writing itself…
     The top lines are optional. Category is one of your main sections;
     Label is a finer description, if you want one. */
  function parsePiece(slug, raw) {
    var text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
    var lines = text.split("\n");
    var info = {};
    var i = 0;
    while (i < lines.length) {
      var m = lines[i].match(/^(title|date|label|category)\s*:\s*(.*)$/i);
      if (!m) break;
      info[m[1].toLowerCase()] = m[2].trim();
      i++;
    }
    var body = lines.slice(i).join("\n").replace(/^\n+/, "").replace(/\s+$/, "");
    return {
      slug: slug,
      title: info.title || slug.replace(/[-_]+/g, " "),
      date: parseDate(info.date),
      label: info.label || "",
      category: (info.category || "").trim(),
      body: body
    };
  }
  function excerpt(body, n) {
    var words = body.replace(/^#+\s.*$/gm, "").replace(/\*/g, "").trim().split(/\s+/);
    return words.length > n ? words.slice(0, n).join(" ") + "…" : words.join(" ");
  }
  function metaLine(p, long, skipCategory) {
    var bits = [];
    if (p.category && !skipCategory) bits.push(p.category);
    if (p.label) bits.push(p.label);
    bits.push(readTime(p.body));
    if (p.date) bits.push(showDate(p.date, long));
    return bits.join(" · ");
  }

  /* **bold** and *italic*, built as real elements (never as raw HTML) */
  function addInline(parent, text) {
    var re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var bold = m[0].slice(0, 2) === "**";
      parent.appendChild(el(bold ? "strong" : "em", null, bold ? m[0].slice(2, -2) : m[0].slice(1, -1)));
      last = m.index + m[0].length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function proseOf(body) {
    var box = el("div", "prose");
    body.split(/\n{2,}/).forEach(function (block) {
      if (!block.trim()) return;
      var h = block.match(/^#+\s+(.*)$/);
      var node = h && block.indexOf("\n") === -1 ? el("h2") : el("p");
      addInline(node, h && block.indexOf("\n") === -1 ? h[1] : block);
      box.appendChild(node);
    });
    return box;
  }

  /* ---------- categories ---------- */
  function catSlug(name) {
    return "in-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function categories() {
    var seen = {}, out = [];
    pieces.forEach(function (p) {
      if (!p.category) return;
      var key = catSlug(p.category);
      if (!seen[key]) { seen[key] = { name: p.category, slug: key, count: 0 }; out.push(seen[key]); }
      seen[key].count++;
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }
  function catBar(active) {
    var cats = categories();
    if (!cats.length) return null;
    var nav = el("nav", "cats mono");
    nav.setAttribute("aria-label", "Categories");
    function link(text, href, on) {
      var a = el("a", on ? "on" : null, text);
      a.href = href;
      if (on) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }
    link("all (" + pieces.length + ")", "#", !active);
    cats.forEach(function (c) { link(c.name + " (" + c.count + ")", "#" + c.slug, active === c.slug); });
    return nav;
  }

  /* ---------- pages ---------- */
  function drawHome(cat) {
    var all = pieces;
    var pieces_ = cat ? all.filter(function (p) { return p.category && catSlug(p.category) === cat.slug; }) : all;
    document.title = cat ? cat.name + " · " + siteName : siteName;
    var out = [];
    var bar = catBar(cat ? cat.slug : "");
    if (bar) out.push(bar);
    if (!pieces_.length) {
      out.push(el("p", "status", "Nothing here yet. Add a piece to the writing folder and name it in writing/list.txt."));
    } else {
      var first = pieces_[0];
      var card = el("a", "latest");
      card.href = "#" + encodeURIComponent(first.slug);
      card.appendChild(el("span", "mono", (cat ? "latest in " + cat.name + " · " : "latest · ") + metaLine(first, false, !!cat)));
      card.appendChild(el("h2", null, first.title));
      card.appendChild(el("p", null, excerpt(first.body, 34)));
      card.appendChild(el("span", "more", "keep reading"));
      out.push(card);

      if (pieces_.length > 1) {
        var sec = el("section", "index");
        sec.appendChild(el("p", "index-head mono", cat ? "the rest of " + cat.name + ", newest first" : "everything else, newest first"));
        var ul = el("ul");
        pieces_.slice(1).forEach(function (p) {
          var li = el("li");
          var a = el("a");
          a.href = "#" + encodeURIComponent(p.slug);
          a.appendChild(el("span", "t", p.title));
          a.appendChild(el("span", "dots"));
          a.appendChild(el("span", "m mono", metaLine(p, false, !!cat)));
          li.appendChild(a);
          ul.appendChild(li);
        });
        sec.appendChild(ul);
        out.push(sec);
      }
    }
    if (missing.length) {
      out.push(el("p", "status", "Listed but not found: " + missing.join(", ") + ". Check the spelling in writing/list.txt."));
    }
    main.replaceChildren.apply(main, out);
  }

  function drawPiece(p, i) {
    document.title = p.title + " · " + siteName;
    var art = el("article", "piece");
    var back = el("a", "back", "← all writing");
    back.href = "#";
    art.appendChild(back);
    art.appendChild(el("p", "mono", metaLine(p, true)));
    art.appendChild(el("h1", null, p.title));
    art.appendChild(proseOf(p.body));

    var around = el("nav", "around");
    around.setAttribute("aria-label", "More writing");
    var older = pieces[i + 1], newer = pieces[i - 1];
    if (older) { var o = el("a", null, "← older: " + older.title); o.href = "#" + encodeURIComponent(older.slug); around.appendChild(o); }
    if (newer) { var n = el("a", null, "newer: " + newer.title + " →"); n.href = "#" + encodeURIComponent(newer.slug); around.appendChild(n); }
    if (older || newer) art.appendChild(around);
    main.replaceChildren(art);
  }

  function drawAbout() {
    document.title = "About · " + siteName;
    var art = el("article", "piece");
    var back = el("a", "back", "← all writing");
    back.href = "#";
    art.appendChild(back);
    art.appendChild(el("h1", null, about ? about.title : "About"));
    art.appendChild(about ? proseOf(about.body) : el("p", "status", "Add an about.txt file next to index.html to fill this page."));
    main.replaceChildren(art);
  }

  function draw() {
    if (!ready) return;
    var want = "";
    try { want = decodeURIComponent(location.hash.replace(/^#/, "")); } catch (e) {}
    if (!want) return drawHome();
    if (want === "about") return drawAbout();
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].slug === want) return drawPiece(pieces[i], i);
    }
    var cats = categories();
    for (var c = 0; c < cats.length; c++) {
      if (cats[c].slug === want) return drawHome(cats[c]);
    }
    document.title = siteName;
    var back = el("a", "back", "← all writing");
    back.href = "#";
    main.replaceChildren(el("p", "status", "That page is not here."), back);
  }

  /* ---------- start ---------- */
  window.addEventListener("hashchange", function () { draw(); window.scrollTo(0, 0); });

  if (location.protocol === "file:") {
    main.replaceChildren(
      el("p", "status", "You opened this file straight from your computer, and browsers do not let a page read its neighbouring files that way."),
      el("p", "status", "Upload the whole folder to a web host and open it from there. HOW-TO.txt explains the steps.")
    );
    return;
  }

  getText("writing/list.txt").then(function (list) {
    var names = [];
    list.replace(/^﻿/, "").split(/\r?\n/).forEach(function (line) {
      var name = line.trim();
      if (!name || name.charAt(0) === "#") return;
      if (!/\.txt$/i.test(name)) name += ".txt";
      if (names.indexOf(name) === -1) names.push(name);
    });
    var jobs = names.map(function (name) {
      return getText("writing/" + encodeURIComponent(name)).then(
        function (raw) { return parsePiece(slugOf(name), raw); },
        function () { missing.push(name); return null; });
    });
    jobs.push(getText("about.txt").then(
      function (raw) { about = parsePiece("about", raw); if (!/^title\s*:/im.test(raw.split(/\n\s*\n/)[0] || "")) about.title = "About"; return null; },
      function () { return null; }));
    return Promise.all(jobs);
  }).then(function (got) {
    pieces = got.filter(Boolean);
    // newest first; pieces without a date go to the end, in list order
    pieces.forEach(function (p, i) { p.order = i; });
    pieces.sort(function (a, b) {
      if (a.date && b.date) return b.date - a.date || a.order - b.order;
      if (a.date) return -1;
      if (b.date) return 1;
      return a.order - b.order;
    });
    ready = true;
    draw();
  }).catch(function () {
    main.replaceChildren(el("p", "status", "The list of writing could not be loaded. Make sure writing/list.txt was uploaded with the rest of the site."));
  });
})();
