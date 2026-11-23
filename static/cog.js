// cog.js — behaviour for the page shell and the shared components in
// style.css. Loaded synchronously in <head> on every page, so it only defines
// functions and document-level listeners; anything that needs the DOM waits for
// DOMContentLoaded. The one exception is cog.fitNavbar(), which the layout
// calls inline right after the navbar so it never paints at the wrong stage.
(function () {
  "use strict";

  var cog = (window.cog = window.cog || {});

  // --- Navbar collapse -----------------------------------------------------
  // The nav shows as labelled icons, then labels under icons, then icons
  // alone, and finally collapses into the apps menu. Each stage is tried in
  // turn and kept as soon as the nav stops overflowing its box. Measuring the
  // real layout (rather than estimating item widths) keeps the choice the same
  // for a given width whatever the page underneath does.
  var STAGES = ["", "navbar--compact", "navbar--icon-only", "navbar--collapsed"];

  function fit(nb) {
    var nav = nb.querySelector(".navbar-nav");
    if (!nav || !nav.children.length) return;
    for (var i = 0; i < STAGES.length; i++) {
      for (var j = 1; j < STAGES.length; j++) nb.classList.remove(STAGES[j]);
      if (STAGES[i]) nb.classList.add(STAGES[i]);
      if (i === STAGES.length - 1) return;
      if (nav.scrollWidth <= nav.clientWidth + 1) return;
    }
  }

  cog.fitNavbar = function () {
    var nb = document.querySelector(".navbar");
    if (!nb) return;
    fit(nb);
    var last = nb.offsetWidth;
    var refit = function () {
      if (nb.offsetWidth === last) return;
      last = nb.offsetWidth;
      fit(nb);
    };
    if (window.ResizeObserver) new ResizeObserver(refit).observe(nb);
    else window.addEventListener("resize", refit);
  };

  // --- Dropdowns ------------------------------------------------------------
  // <div class="dropdown">
  //   <button class="dropdown-toggle" data-dropdown-toggle aria-expanded="false" aria-controls="m">
  //   <div class="dropdown-menu" id="m">…</div>
  // </div>
  function toggleOf(dd) {
    return dd.querySelector("[data-dropdown-toggle]");
  }

  function items(dd) {
    return Array.prototype.slice.call(
      dd.querySelectorAll(".dropdown-menu a, .dropdown-menu button"),
    );
  }

  function openDropdown(dd) {
    closeDropdowns(dd);
    dd.classList.add("open");
    var t = toggleOf(dd);
    if (t) t.setAttribute("aria-expanded", "true");
    dd.dispatchEvent(new CustomEvent("cog:dropdown-open", { bubbles: true }));
  }

  function closeDropdown(dd, focusToggle) {
    if (!dd.classList.contains("open")) return;
    dd.classList.remove("open");
    var t = toggleOf(dd);
    if (t) {
      t.setAttribute("aria-expanded", "false");
      if (focusToggle) t.focus();
    }
  }

  // closeDropdowns closes every open dropdown except keep.
  function closeDropdowns(keep) {
    document.querySelectorAll(".dropdown.open").forEach(function (dd) {
      if (dd !== keep) closeDropdown(dd, false);
    });
  }
  cog.closeDropdowns = closeDropdowns;

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-dropdown-toggle]");
    if (t) {
      var dd = t.closest(".dropdown");
      if (dd.classList.contains("open")) closeDropdown(dd, false);
      else openDropdown(dd);
      return;
    }
    // A click anywhere else closes menus it is not inside.
    document.querySelectorAll(".dropdown.open").forEach(function (dd) {
      if (!dd.contains(e.target)) closeDropdown(dd, false);
    });
  });

  document.addEventListener("keydown", function (e) {
    var dd = e.target.closest && e.target.closest(".dropdown");
    if (e.key === "Escape") {
      var open = document.querySelector(".dropdown.open");
      if (open) {
        closeDropdown(open, true);
        e.preventDefault();
      }
      return;
    }
    if (!dd || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    // A control in a menu keeps its own arrow keys.
    if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
    var list = items(dd);
    if (!list.length) return;
    e.preventDefault();
    if (!dd.classList.contains("open")) openDropdown(dd);
    var idx = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") idx = idx < 0 ? 0 : (idx + 1) % list.length;
    else idx = idx <= 0 ? list.length - 1 : idx - 1;
    list[idx].focus();
  });

  // Tabbing out of a menu closes it.
  document.addEventListener("focusout", function (e) {
    var dd = e.target.closest && e.target.closest(".dropdown.open");
    if (dd && e.relatedTarget && !dd.contains(e.relatedTarget)) {
      closeDropdown(dd, false);
    }
  });

  // --- Search ---------------------------------------------------------------
  function searchBox() {
    return document.getElementById("search-box");
  }

  cog.openSearch = function () {
    var nb = document.querySelector(".navbar");
    var box = searchBox();
    if (!nb || !box) return;
    closeDropdowns();
    nb.classList.add("search-open");
    var t = nb.querySelector(".search-toggle");
    if (t) t.setAttribute("aria-expanded", "true");
    box.focus();
    box.select();
  };

  cog.closeSearch = function () {
    var nb = document.querySelector(".navbar");
    if (!nb || !nb.classList.contains("search-open")) return;
    nb.classList.remove("search-open");
    var t = nb.querySelector(".search-toggle");
    if (t) t.setAttribute("aria-expanded", "false");
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-search-open]")) {
      e.preventDefault();
      var nb = document.querySelector(".navbar");
      if (nb && nb.classList.contains("search-open")) cog.closeSearch();
      else cog.openSearch();
      return;
    }
    var nb2 = document.querySelector(".navbar.search-open");
    if (nb2 && !e.target.closest(".navbar-search")) cog.closeSearch();
  });

  function initSearch() {
    var box = searchBox();
    if (!box) return;
    var results = document.getElementById("search-results");

    document.addEventListener("keydown", function (e) {
      var a = document.activeElement;
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) &&
        !a.isContentEditable
      ) {
        e.preventDefault();
        var visible = box.offsetParent !== null;
        if (visible) {
          box.focus();
          box.select();
        } else {
          cog.openSearch();
        }
      }
    });

    box.addEventListener("keydown", function (e) {
      var hits = results.querySelectorAll(".search-hit");
      if (e.key === "Escape") {
        box.blur();
        cog.closeSearch();
        return;
      }
      if (!hits.length) return;
      var cur = results.querySelector(".search-hit-active");
      var idx = cur ? Array.prototype.indexOf.call(hits, cur) : -1;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (cur) cur.classList.remove("search-hit-active");
        if (e.key === "ArrowDown") idx = (idx + 1) % hits.length;
        else idx = idx <= 0 ? hits.length - 1 : idx - 1;
        hits[idx].classList.add("search-hit-active");
        hits[idx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && cur) {
        e.preventDefault();
        cur.click();
      }
    });

    new MutationObserver(function () {
      var hits = results.querySelectorAll(".search-hit");
      hits.forEach(function (h) {
        h.classList.remove("search-hit-active");
      });
      if (hits.length) hits[0].classList.add("search-hit-active");
    }).observe(results, { childList: true });
  }

  // --- Signed-out pages ------------------------------------------------------
  // When the session ends under an open page, the next request is refused.
  // The whole page goes to the login form, which brings the user back here,
  // rather than leaving a fragment to swap the form into a panel or a script
  // to fail quietly. The server sends HTMX requests an HX-Redirect; this
  // catches what reaches the page another way: a fetch() answered 401, or a
  // request that followed a redirect to /login.
  var BACKGROUND = { "X-Cog-Background": "1" };
  var leaving = false;

  // signedIn says whether this page belongs to a session: the shell shows
  // the tray only to a signed-in user, and a plugin frame is only served to
  // one. The login page and public links have neither.
  function signedIn() {
    return !!document.getElementById("notif") || !!document.body.dataset.cogHost;
  }

  cog.signIn = function () {
    if (leaving) return;
    leaving = true;
    location.href =
      "/login?next=" + encodeURIComponent(location.pathname + location.search + location.hash);
  };

  // landedOnLogin says whether a response is the login page, reached by
  // following a redirect.
  function landedOnLogin(responseURL) {
    if (!responseURL) return false;
    try {
      var u = new URL(responseURL);
      return u.origin === location.origin && u.pathname === "/login";
    } catch (err) {
      return false;
    }
  }

  function sameOrigin(input) {
    try {
      var u = new URL(typeof input === "string" ? input : input.url, location.href);
      return u.origin === location.origin;
    } catch (err) {
      return false;
    }
  }

  function hasAuthorization(input, init) {
    var h = (init && init.headers) || (typeof input !== "string" && input.headers);
    if (!h) return false;
    if (typeof h.has === "function") return h.has("Authorization");
    return Object.keys(h).some(function (k) {
      return k.toLowerCase() === "authorization";
    });
  }

  if (window.fetch) {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      return nativeFetch.apply(this, arguments).then(function (resp) {
        if (
          signedIn() &&
          sameOrigin(input) &&
          ((resp.status === 401 && !hasAuthorization(input, init)) || landedOnLogin(resp.url))
        ) {
          cog.signIn();
        }
        return resp;
      });
    };
  }

  document.addEventListener("htmx:beforeSwap", function (e) {
    var xhr = e.detail.xhr;
    if (!signedIn()) return;
    if (xhr.status === 401 || landedOnLogin(xhr.responseURL)) {
      e.detail.shouldSwap = false;
      cog.signIn();
      return;
    }
    // A page that swaps its own error responses has said what to show.
    if (e.detail.shouldSwap || xhr.status < 400) return;
    if (xhr.status === 403) {
      cog.notify({ kind: "error", title: "You don't have permission to do that." });
    } else {
      cog.notify({
        kind: "error",
        title: "Something went wrong.",
        body: "The server answered " + xhr.status + (xhr.statusText ? " " + xhr.statusText : "") + ".",
      });
    }
  });

  document.addEventListener("htmx:sendError", function () {
    cog.notify({ kind: "error", title: "Couldn't reach the server.", body: "Check your connection and try again." });
  });

  // --- Notification tray ------------------------------------------------------
  // The bell holds two lists. Notices are raised by the page — a request that
  // failed, a calendar reminder, or anything a plugin passes to cog.notify —
  // and last until cleared or the page is left. Below them is the user's
  // recent activity, which can be narrowed to notifications (activity
  // addressed to them, such as a share they received) or to one app.
  //
  // Notifications are polled; the badge counts those newer than the last the
  // user looked at, and, if they asked for it, each new one is shown on the
  // desktop. Both marks are kept per browser.
  var POLL_EVERY = 5 * 60 * 1000;
  var REMINDERS_EVERY = 60 * 1000;
  var KEY_SEEN = "cog.tray.seen";
  var KEY_SHOWN = "cog.tray.shown";
  var KEY_FILTER = "cog.tray.filter";
  var KEY_DESKTOP = "cog.tray.desktop";
  var tray = null;

  function load(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (err) {
      // Private windows may refuse storage; the marks then last a page.
    }
  }

  function loadID(key) {
    var v = load(key);
    return v === null ? null : Number(v);
  }

  function trayItem(n, unread) {
    var el = document.createElement(n.href ? "a" : "div");
    el.className = "tray-item";
    if (n.kind === "error") el.className += " tray-item--error";
    if (unread) el.className += " tray-item--unread";
    if (n.href) el.href = n.href;
    var title = document.createElement("span");
    title.textContent = n.title;
    el.appendChild(title);
    if (n.body) {
      var sub = document.createElement("span");
      sub.className = "tray-item-sub";
      sub.textContent = n.body;
      el.appendChild(sub);
    }
    return el;
  }

  function relativeTime(iso) {
    var secs = (Date.now() - new Date(iso).getTime()) / 1000;
    if (secs < 60) return "just now";
    if (secs < 3600) return Math.floor(secs / 60) + " min ago";
    if (secs < 86400) return Math.floor(secs / 3600) + " h ago";
    return new Date(iso).toLocaleDateString();
  }

  function isOpen() {
    return tray.wrap.classList.contains("open");
  }

  // newestID is the id of the latest notification polled, or 0.
  function newestID() {
    return tray.notifications.length ? tray.notifications[0].id : 0;
  }

  function renderBadge() {
    var count = tray.notices.filter(function (n) {
      return !n.seen;
    }).length;
    tray.notifications.forEach(function (a) {
      if (tray.seen !== null && a.id > tray.seen) count++;
    });
    tray.badge.textContent = count > 99 ? "99+" : String(count);
    tray.badge.hidden = count === 0 || isOpen();
    tray.toggle.setAttribute("aria-label", count ? "Notifications (" + count + " new)" : "Notifications");
  }

  function renderNotices() {
    tray.noticeList.textContent = "";
    tray.notices.forEach(function (n) {
      tray.noticeList.appendChild(trayItem(n, !n.seen));
    });
    tray.noticesWrap.hidden = tray.notices.length === 0;
  }

  function renderActivity() {
    if (!tray.activity) return;
    tray.activityList.textContent = "";
    if (!tray.activity.length) {
      var empty = document.createElement("p");
      empty.className = "tray-empty";
      empty.textContent = tray.filter.value ? "Nothing here yet." : "No activity yet.";
      tray.activityList.appendChild(empty);
    }
    tray.activity.forEach(function (a) {
      // What was new when the panel opened stays bold while it is open.
      var unread = a.notify && tray.seenAtOpen !== null && a.id > tray.seenAtOpen;
      tray.activityList.appendChild(
        trayItem({ title: a.subject, body: a.app + " · " + relativeTime(a.at) }, unread),
      );
    });
  }

  // setApps adds an option per app the user has activity from.
  function setApps(apps) {
    var sel = tray.filter;
    var want = load(KEY_FILTER) || sel.value;
    Array.prototype.slice.call(sel.options).forEach(function (o) {
      if (o.value.indexOf("app:") === 0) o.remove();
    });
    (apps || []).forEach(function (app) {
      var o = document.createElement("option");
      o.value = "app:" + app;
      o.textContent = app.charAt(0).toUpperCase() + app.slice(1);
      sel.appendChild(o);
    });
    sel.value = want;
    if (sel.value !== want) sel.value = "";
  }

  function markSeen() {
    tray.notices.forEach(function (n) {
      n.seen = true;
    });
    var id = newestID();
    if (tray.seen === null || id > tray.seen) {
      tray.seen = id;
      save(KEY_SEEN, id);
    }
  }

  // cog.notify adds a notice to the tray: {title, body?, href?, kind?}, kind
  // being "error" or "info". In a plugin frame there is no tray, so the
  // notice goes to the console.
  cog.notify = function (n) {
    if (!tray) {
      (n.kind === "error" ? console.error : console.info)("cog:", n.title, n.body || "");
      return;
    }
    tray.notices.unshift({ title: n.title, body: n.body, href: n.href, kind: n.kind || "info" });
    if (tray.notices.length > 50) tray.notices.length = 50;
    if (isOpen()) markSeen();
    renderNotices();
    renderBadge();
  };

  // --- Desktop notifications ---
  // Shown only when the user turned them on in the tray, which is when the
  // browser asks for permission; nothing asks on its own.
  function desktopOn() {
    return (
      "Notification" in window && Notification.permission === "granted" && load(KEY_DESKTOP) === "1"
    );
  }

  function desktop(title, body) {
    if (!desktopOn()) return;
    try {
      new Notification(title, { body: body });
    } catch (err) {
      console.warn("cog: desktop notification:", err);
    }
  }

  function initDesktopToggle() {
    if (!("Notification" in window)) return;
    var box = document.getElementById("tray-desktop");
    document.getElementById("tray-desktop-row").hidden = false;
    box.checked = desktopOn();
    box.addEventListener("change", function () {
      if (!box.checked) {
        save(KEY_DESKTOP, "0");
        return;
      }
      Promise.resolve(Notification.requestPermission()).then(function (perm) {
        if (perm === "granted") {
          save(KEY_DESKTOP, "1");
          return;
        }
        box.checked = false;
        save(KEY_DESKTOP, "0");
        cog.notify({
          title: "Your browser is blocking notifications from this site.",
          body: "Allow them in the site's settings, then turn this on again.",
        });
      });
    });
  }

  // background fetches a URL as a poll: it does not renew the session, and a
  // refusal is handled by the fetch wrapper above. It resolves to the parsed
  // JSON, or null when there is nothing to read; a 404 is an app that is not
  // installed.
  function background(url) {
    return fetch(url, { headers: BACKGROUND, credentials: "same-origin" }).then(function (r) {
      if (!r.ok) {
        if (r.status !== 401 && r.status !== 404) console.warn("cog: " + url + ": " + r.status);
        return null;
      }
      return r.json();
    });
  }

  var lastPoll = 0;
  function pollNotifications() {
    lastPoll = Date.now();
    background("/api/activity?filter=notifications")
      .then(function (data) {
        if (!data) return;
        tray.notifications = data.items;
        var newest = newestID();
        // The first time this browser sees the tray, what is already there
        // is history, not news.
        if (tray.seen === null) {
          tray.seen = newest;
          save(KEY_SEEN, newest);
        }
        var shown = loadID(KEY_SHOWN);
        if (shown === null) shown = newest;
        // Oldest first, so they stack in the order they happened. Another
        // tab may have shown them already: the mark is shared.
        tray.notifications
          .slice()
          .reverse()
          .forEach(function (a) {
            if (a.id > shown) desktop(a.subject, a.app);
          });
        save(KEY_SHOWN, Math.max(shown, newest));
        if (isOpen()) {
          markSeen();
          loadActivity();
        }
        renderBadge();
      })
      .catch(function (err) {
        console.warn("cog: notifications:", err);
      });
  }

  // cog.refreshTray polls for notifications now, as a page may after doing
  // something that would make one.
  cog.refreshTray = function () {
    if (tray) pollNotifications();
  };

  // loadActivity fetches the list the filter asks for. It runs when the
  // panel opens, not on a timer: nobody reads a closed panel.
  function loadActivity() {
    var q = "/api/activity?apps=1";
    if (tray.filter.value) q += "&filter=" + encodeURIComponent(tray.filter.value);
    var asked = tray.filter.value;
    return fetch(q, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (asked !== tray.filter.value) return; // a newer choice is loading
        setApps(data.apps);
        tray.activity = data.items;
        renderActivity();
      })
      .catch(function (err) {
        console.warn("cog: activity:", err);
      });
  }

  function pollReminders() {
    background("/apps/calendar/notifications")
      .then(function (data) {
        if (!data || !data.length) return;
        data.forEach(function (n) {
          var when = "Starting " + new Date(n.start).toLocaleString();
          cog.notify({
            title: "Reminder: " + n.summary,
            body: when,
            href: "/apps/calendar/?date=" + n.start.slice(0, 10),
          });
          desktop("Reminder: " + n.summary, when);
        });
      })
      .catch(function (err) {
        console.warn("cog: reminders:", err);
      });
  }

  function initTray() {
    var wrap = document.getElementById("notif");
    if (!wrap) return;
    tray = {
      wrap: wrap,
      toggle: wrap.querySelector("[data-dropdown-toggle]"),
      badge: document.getElementById("notif-badge"),
      noticesWrap: document.getElementById("tray-notices"),
      noticeList: document.getElementById("tray-notice-list"),
      activityList: document.getElementById("tray-activity"),
      filter: document.getElementById("tray-filter"),
      notices: [],
      notifications: [],
      activity: null,
      seen: loadID(KEY_SEEN),
      seenAtOpen: null,
    };
    setApps([]);

    wrap.addEventListener("cog:dropdown-open", function () {
      tray.seenAtOpen = tray.seen;
      markSeen();
      renderBadge();
      loadActivity();
    });
    // Unread marks are dropped once the panel closes.
    new MutationObserver(function () {
      if (isOpen()) return;
      tray.seenAtOpen = tray.seen;
      renderNotices();
      renderActivity();
      renderBadge();
    }).observe(wrap, { attributes: true, attributeFilter: ["class"] });
    wrap.addEventListener("click", function (e) {
      if (!e.target.closest("[data-tray-clear]")) return;
      tray.notices = [];
      renderNotices();
      renderBadge();
    });
    tray.filter.addEventListener("change", function () {
      save(KEY_FILTER, tray.filter.value);
      loadActivity();
    });
    initDesktopToggle();

    // Polled rarely, and not at all while the tab is hidden unless desktop
    // notifications are on; a tab coming back checks at once if it has been
    // a while. A poll also finds a session that ended, so an idle page does
    // not wait for a click to send the user to the login form.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - lastPoll > 60 * 1000) pollNotifications();
    });
    setInterval(function () {
      if (!document.hidden || desktopOn()) pollNotifications();
    }, POLL_EVERY);
    pollNotifications();

    // Reminders keep their own pace, hidden or not: they are what desktop
    // notifications are for.
    setInterval(pollReminders, REMINDERS_EVERY);
    setTimeout(pollReminders, 5000);
  }

  // --- Sidebar on phones ------------------------------------------------------
  // Below 768px a sidebar collapses behind a button that names the current
  // item. The button is added here so that every sidebar gets it, including
  // ones a plugin writes by hand.
  var MENU_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  var CHEVRON =
    '<svg class="sidebar-toggle-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
  var sidebarSeq = 0;

  function sidebarLabel(sb) {
    var active = sb.querySelector(".sidebar-item.active");
    var text = "";
    if (active) {
      // The item's name only: a count or badge beside it is not part of it.
      var name = active.cloneNode(true);
      name.querySelectorAll(".count, .badge").forEach(function (el) {
        el.remove();
      });
      text = name.textContent.replace(/\s+/g, " ").trim();
    }
    return text || "Menu";
  }

  function initSidebars(root) {
    (root || document)
      .querySelectorAll(".sidebar-layout > .sidebar")
      .forEach(function (sb) {
        var layout = sb.parentElement;
        var btn = layout.querySelector(":scope > .sidebar-toggle");
        if (!btn) {
          if (!sb.id) sb.id = "sidebar-" + ++sidebarSeq;
          btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sidebar-toggle";
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-controls", sb.id);
          btn.innerHTML =
            MENU_ICON + '<span class="sidebar-toggle-label"></span>' + CHEVRON;
          layout.insertBefore(btn, sb);
          layout.classList.add("has-sidebar-toggle");
        }
        // The label is drawn from an attribute rather than written as text, so
        // the page's text still holds the item's name once, in the sidebar.
        var label = sidebarLabel(sb);
        btn.querySelector(".sidebar-toggle-label").setAttribute("data-label", label);
        btn.setAttribute("aria-label", "Menu: " + label);
      });
  }
  cog.initSidebars = initSidebars;

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".sidebar-toggle");
    if (!btn) return;
    var layout = btn.parentElement;
    var open = layout.classList.toggle("sidebar-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // --- Modal ------------------------------------------------------------------
  // dialog.modal: open with [data-modal-open="id"] or cogModal.open(id|el);
  // close with [data-modal-close], Esc (native) or a click on the backdrop.
  function dialogOf(x) {
    return typeof x === "string" ? document.getElementById(x) : x;
  }
  var cogModal = (window.cogModal = {
    open: function (x) {
      var d = dialogOf(x);
      if (!d) return null;
      if (!d.open) d.showModal();
      return d;
    },
    close: function (x) {
      var d = dialogOf(x);
      if (d && d.open) d.close();
      return d;
    },
  });

  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-modal-open]");
    if (opener) {
      e.preventDefault();
      cogModal.open(opener.getAttribute("data-modal-open"));
      return;
    }
    var closer = e.target.closest("[data-modal-close]");
    if (closer) {
      e.preventDefault();
      cogModal.close(closer.closest("dialog"));
      return;
    }
    // A click on the dialog element itself (not its content) is the backdrop.
    if (e.target.matches && e.target.matches("dialog.modal[open]")) {
      var r = e.target.getBoundingClientRect();
      var inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });

  // --- Help popovers -----------------------------------------------------------
  // a[data-help] (ui.Help) links to a heading in the docs. Hovering or
  // focusing it shows that heading's part (/docs/page.html?part=id) in a
  // popover, which the pointer can move into to follow its links.
  var helpParts = {};
  var helpPop = null;
  var helpFor = null;
  var helpShowTimer = 0;
  var helpHideTimer = 0;

  function helpPart(a) {
    var u = new URL(a.href);
    var id = decodeURIComponent(u.hash.slice(1));
    u.hash = "";
    u.searchParams.set("part", id);
    var key = u.toString();
    if (!helpParts[key]) {
      helpParts[key] = fetch(key, { credentials: "same-origin" }).then(
        function (r) {
          if (!r.ok) throw new Error(key + ": " + r.status + " " + r.statusText);
          return r.text();
        },
      );
      // A failure is not remembered: the next hover tries again.
      helpParts[key].catch(function () {
        delete helpParts[key];
      });
    }
    return helpParts[key];
  }

  function helpPopover() {
    if (helpPop) return helpPop;
    helpPop = document.createElement("div");
    helpPop.id = "help-popover";
    helpPop.className = "help-popover prose";
    helpPop.setAttribute("role", "tooltip");
    helpPop.hidden = true;
    helpPop.addEventListener("pointerenter", function () {
      clearTimeout(helpHideTimer);
    });
    helpPop.addEventListener("pointerleave", hideHelpSoon);
    document.body.appendChild(helpPop);
    return helpPop;
  }

  function placeHelp(a, pop) {
    var r = a.getBoundingClientRect();
    var gap = 6;
    var w = pop.offsetWidth;
    var h = pop.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - w - 8);
    var top = r.bottom + gap;
    if (top + h > window.innerHeight && r.top - gap - h > 0) top = r.top - gap - h;
    pop.style.left = Math.max(8, left) + window.scrollX + "px";
    pop.style.top = top + window.scrollY + "px";
  }

  function showHelp(a) {
    clearTimeout(helpHideTimer);
    helpFor = a;
    helpPart(a).then(
      function (html) {
        if (helpFor !== a) return;
        var pop = helpPopover();
        pop.innerHTML = html;
        // The part's links are relative to its page, not to this one.
        pop.querySelectorAll("[href], [src]").forEach(function (el) {
          var attr = el.hasAttribute("href") ? "href" : "src";
          el.setAttribute(attr, new URL(el.getAttribute(attr), a.href).toString());
          if (attr === "href") el.target = "_blank";
        });
        var more = document.createElement("a");
        more.className = "help-more";
        more.href = a.href;
        more.target = "_blank";
        more.rel = "noopener";
        more.textContent = "Read more in the docs";
        pop.appendChild(more);
        pop.hidden = false;
        placeHelp(a, pop);
        a.setAttribute("aria-describedby", pop.id);
      },
      function (err) {
        console.error("help:", err);
      },
    );
  }

  function hideHelp() {
    clearTimeout(helpShowTimer);
    if (helpFor) helpFor.removeAttribute("aria-describedby");
    helpFor = null;
    if (helpPop) helpPop.hidden = true;
  }

  function hideHelpSoon() {
    clearTimeout(helpShowTimer);
    clearTimeout(helpHideTimer);
    helpHideTimer = setTimeout(hideHelp, 200);
  }

  document.addEventListener("pointerover", function (e) {
    var a = e.target.closest && e.target.closest("a[data-help]");
    if (!a || a === helpFor || e.pointerType === "touch") return;
    clearTimeout(helpShowTimer);
    clearTimeout(helpHideTimer);
    helpShowTimer = setTimeout(function () {
      showHelp(a);
    }, 250);
  });
  document.addEventListener("pointerout", function (e) {
    var a = e.target.closest && e.target.closest("a[data-help]");
    if (a && !a.contains(e.relatedTarget)) hideHelpSoon();
  });
  document.addEventListener("focusin", function (e) {
    var a = e.target.closest && e.target.closest("a[data-help]");
    if (a) showHelp(a);
  });
  document.addEventListener("focusout", function (e) {
    if (e.target.closest && e.target.closest("a[data-help]")) hideHelpSoon();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && helpPop && !helpPop.hidden) hideHelp();
  });

  // --- Flash placement ----------------------------------------------------------
  // The layout renders a redirect's message at the top of <main>. On a page
  // with a sidebar it belongs above the content column, not above the sidebar.
  function placeFlash() {
    var flash = document.querySelector("main > [data-page-flash]");
    var col = document.querySelector("main .sidebar-content");
    if (flash && col) col.insertBefore(flash, col.firstChild);
  }

  document.addEventListener("DOMContentLoaded", function () {
    placeFlash();
    initSearch();
    initTray();
    initSidebars();
  });

  document.addEventListener("htmx:afterSettle", function (e) {
    initSidebars(e.target.closest(".sidebar-layout") ? document : e.target);
  });
})();
