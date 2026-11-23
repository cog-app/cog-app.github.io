// docs-search.js: the docs' search box, in Cog's /docs/ and on the website.
// It searches search.json the way internal/docs.Search does on the server:
// every word of the query must start a word of the page; a title word
// counts 10, a heading word 4, each text word 1 (at most 5). cog.js gives
// the box its keys (/, arrows, Enter, Escape).
(function () {
  "use strict";

  var box = document.querySelector("[data-docs-index]");
  if (!box) return;
  var results = document.getElementById("search-results");
  var root = box.getAttribute("data-docs-root");
  var pages = null;
  var loading = null;

  function words(s) {
    return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  function load() {
    if (!loading) {
      loading = fetch(box.getAttribute("data-docs-index"))
        .then(function (r) {
          if (!r.ok) throw new Error("search.json: " + r.status);
          return r.json();
        })
        .then(function (es) {
          pages = es.map(function (e) {
            return {
              title: e.title,
              url: e.url,
              section: e.section || "",
              words: [words(e.title), words((e.headings || []).join(" ")), words(e.text)],
            };
          });
        });
    }
    return loading;
  }

  function count(ws, t) {
    var n = 0;
    for (var i = 0; i < ws.length; i++) if (ws[i].lastIndexOf(t, 0) === 0) n++;
    return n;
  }

  function search(q) {
    var terms = words(q);
    if (!terms.length) return [];
    var hits = [];
    pages.forEach(function (p) {
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        var s = 10 * count(p.words[0], terms[i]) + 4 * count(p.words[1], terms[i]) + Math.min(count(p.words[2], terms[i]), 5);
        if (!s) return;
        score += s;
      }
      hits.push({ page: p, score: score });
    });
    hits.sort(function (a, b) {
      return b.score - a.score;
    });
    return hits.slice(0, 10);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function show() {
    var q = box.value.trim();
    results.replaceChildren();
    if (!q) return;
    var hits = search(q);
    if (!hits.length) {
      var empty = el("div", "search-empty", "No results for ");
      empty.appendChild(el("strong", "", "“" + q + "”"));
      results.appendChild(empty);
      return;
    }
    results.appendChild(el("div", "search-section", "Help"));
    hits.forEach(function (h) {
      var a = el("a", "search-hit");
      a.href = root + h.page.url;
      a.appendChild(el("span", "search-hit-name", h.page.title));
      if (h.page.section) a.appendChild(el("span", "search-hit-sub", h.page.section));
      results.appendChild(a);
    });
  }

  var timer;
  box.addEventListener("focus", load);
  box.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      load().then(show, function (err) {
        console.error("docs search:", err);
        results.replaceChildren(el("div", "search-empty", "Search is not available."));
      });
    }, 100);
  });
})();
