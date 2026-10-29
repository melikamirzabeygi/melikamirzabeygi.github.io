/* Page logic: renders every section from js/data.js in Persian or English, the case viewer,
   filters, and the order / consultation forms. */
(function () {
  "use strict";
  var S = window.SITE, IMG = "assets/img/";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var lang = store.get("mm-lang") || "fa", cat = "all", workCat = "all", tab = "order";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fa = function () { return lang === "fa"; };
  var dg = function (s) { return fa() ? String(s).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }) : String(s); };
  var pad = function (n) { return dg(n < 10 ? "0" + n : String(n)); };
  var U = function () { return S.ui[lang]; }, X = function () { return S.x[lang]; };
  var catName = function (id) { var c = S.categories.filter(function (k) { return k.id === id; })[0]; return c ? c[lang] : ""; };

  var SECTIONS = ["services", "work", "learn", "impact", "research", "about", "process", "order", "faq"];
  var POSTS = [], learnCat = "all";

  /* ---------- header, nav ---------- */
  var TOPNAV = ["hero", "services", "work", "learn", "about", "order"];      // links shown in the desktop bar
  function navLabel(id) { return id === "hero" ? (X().nav.home || (fa() ? "خانه" : "Home")) : X().nav[id]; }
  function header() {
    var x = X(), u = U();
    document.documentElement.lang = lang;
    document.documentElement.dir = fa() ? "rtl" : "ltr";
    document.title = fa() ? "ملیکا میرزابیکی — پژوهش، داده و داشبورد" : "Melika Mirzabeygi — Research, data & dashboards";
    $("brandName").textContent = u.name;
    $("langBtn").textContent = fa() ? "EN" : "فا";
    $("langBtn").setAttribute("aria-label", u.lang);
    $("orderTop").textContent = x.orderCta;
    $("menuBtn").textContent = $("sheet").hidden ? (u.menu || "Menu") : x.close;
    $("index").innerHTML = TOPNAV.map(function (id) { return '<a href="#' + id + '" data-id="' + id + '">' + esc(navLabel(id)) + "</a>"; }).join("");
    $("sheetNav").innerHTML = ["hero"].concat(SECTIONS).map(function (id) { return '<a href="#' + id + '" data-id="' + id + '"><span class="lbl">' + esc(navLabel(id)) + "</span></a>"; }).join("");
  }

  /* ---------- hero: cinematic heading over the video ----------
     The part of the title after the first comma is shown in the muted colour, for contrast. */
  function hero() {
    var h = S.hero[lang], t = String(h.title || ""), m = /^(.*?[،,])\s*(.+)$/.exec(t);
    $("heroTitle").innerHTML = m ? esc(m[1]) + ' <em class="soft">' + esc(m[2]) + "</em>" : esc(t);
    $("heroTitle").classList.toggle("long", t.length > 70);
    $("heroText").textContent = h.text || "";
    $("heroCta").textContent = X().orderCta;
  }

  /* ---------- hero: chips, case cards, info column ---------- */
  function chips(el, current) {
    var all = [{ id: "all", name: X().all }].concat(S.categories.map(function (c) { return { id: c.id, name: c[lang] }; }));
    el.innerHTML = all.map(function (c) { return '<button class="chip" type="button" data-cat="' + c.id + '" aria-pressed="' + (c.id === current) + '">' + esc(c.name) + "</button>"; }).join("");
  }
  /* ---------- sections ---------- */
  function heads() {
    var x = X();
    document.querySelectorAll(".sec").forEach(function (sec) {
      var id = sec.id;
      sec.querySelector(".sec-tag").textContent = x.h[id];
      sec.querySelector(".sec-t").textContent = x.t[id];
      sec.querySelector(".sec-i").textContent = pad(SECTIONS.indexOf(id) + 2);
    });
  }
  function services() {
    var x = X();
    $("svc").innerHTML = S.services.map(function (s, i) {
      return '<div class="svc-row"><span class="n">' + pad(i + 1) + '</span><div><b>' + esc(s.t[lang]) + "</b><p>" + esc(s.d[lang]) + '</p>' +
        '<button class="arrow" type="button" data-order-service="' + i + '">' + esc(x.orderThis) + (fa() ? " ←" : " →") + "</button></div></div>";
    }).join("");
  }
  function work() {
    var x = X();
    chips($("workChips"), workCat);
    $("workGrid").innerHTML = S.cases.map(function (c, i) {
      if (workCat !== "all" && c.cat !== workCat) return "";
      return '<button class="wcard" type="button" data-case="' + i + '"><div class="thumb"><img src="' + IMG + c.img[lang] + '" alt="" loading="lazy"></div>' +
        '<div class="meta"><span class="m-l">' + esc(c.title[lang]) + '</span><span class="m-r">' + esc(catName(c.cat)) + "</span></div>" +
        "<p>" + esc(c.pso[lang][2]) + "</p>" +
        '<div class="tags">' + c.tags[lang].map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>" +
        '<span class="arrow">' + esc(x.viewCase) + " · " + dg(c.gallery.length) + " " + esc(x.images) + (fa() ? " ←" : " →") + "</span></button>";
    }).join("");
  }
  /* ---------- learn: article list and reader ---------- */
  function visiblePosts() { return POSTS.filter(function (p) { return p.published !== false && p.title && p.title[lang]; }); }
  function learn() {
    var x = X(), list = visiblePosts(), cats = [];
    list.forEach(function (p) { var c = p.cat && p.cat[lang]; if (c && cats.indexOf(c) < 0) cats.push(c); });
    if (learnCat !== "all" && cats.indexOf(learnCat) < 0) learnCat = "all";
    $("learnChips").innerHTML = cats.length > 1 ? ['<button class="chip" type="button" data-lcat="all" aria-pressed="' + (learnCat === "all") + '">' + esc(x.all) + "</button>"]
      .concat(cats.map(function (c) { return '<button class="chip" type="button" data-lcat="' + esc(c) + '" aria-pressed="' + (learnCat === c) + '">' + esc(c) + "</button>"; })).join("") : "";
    var shown = list.filter(function (p) { return learnCat === "all" || (p.cat && p.cat[lang]) === learnCat; });
    $("posts").innerHTML = shown.length ? shown.map(function (p) {
      var mins = Math.max(1, Math.round(window.MD ? MD.words(p.body[lang]) / 200 : 1));
      return '<a class="post" href="#learn/' + esc(p.slug) + '">' +
        (p.cover ? '<div class="thumb"><img src="' + esc(postImg(p.cover)) + '" alt="" loading="lazy"></div>' : "") +
        '<span class="post-meta">' + esc(p.cat ? p.cat[lang] : "") + " · " + esc(p.date ? p.date[lang] : "") + " · " + dg(mins) + " " + esc(x.minRead) + "</span>" +
        "<b>" + esc(p.title[lang]) + "</b><p>" + esc(p.summary ? p.summary[lang] : "") + '</p><span class="arrow">' + esc(x.readMore) + (fa() ? " ←" : " →") + "</span></a>";
    }).join("") : '<p class="empty">' + esc(x.noPosts) + "</p>";
  }
  function postImg(src) { return /^(https?:|\/)/.test(src) || src.indexOf("/") > -1 ? src : IMG + src; }
  var readerOpen = false;
  function openPost(slug) {
    var p = POSTS.filter(function (q) { return q.slug === slug && q.published !== false; })[0];
    if (!p) return false;
    var x = X(), l = p.title[lang] ? lang : (lang === "fa" ? "en" : "fa");
    $("rBack").textContent = (fa() ? "→ " : "← ") + x.back; $("rShare").textContent = x.share;
    $("rMeta").textContent = [p.cat ? p.cat[l] : "", p.date ? p.date[l] : ""].filter(Boolean).join(" · ");
    $("rTitle").textContent = p.title[l];
    var cov = $("rCover"); cov.hidden = !p.cover; if (p.cover) cov.querySelector("img").src = postImg(p.cover);
    $("rBody").innerHTML = window.MD ? MD.render(p.body[l], IMG) : esc(p.body[l]);
    $("rBody").dir = l === "fa" ? "rtl" : "ltr";
    $("rCta").textContent = x.consultCta;
    $("reader").hidden = false; $("reader").scrollTop = 0; document.body.style.overflow = "hidden"; readerOpen = true;
    document.title = p.title[l];
    $("rBack").focus({ preventScroll: true });
    return true;
  }
  function closePost(keepHash) {
    if (!readerOpen) return;
    $("reader").hidden = true; document.body.style.overflow = ""; readerOpen = false; header();
    if (!keepHash && /^#learn\//.test(location.hash)) history.replaceState(null, "", "#learn");
  }
  function route() {
    var m = /^#learn\/(.+)$/.exec(location.hash);
    if (m) { if (!openPost(decodeURIComponent(m[1]))) closePost(true); }
    else closePost(true);
  }

  function bars(el, items, max, white) {
    el.innerHTML = items.map(function (it, i) {
      var v = it.n, pct = Math.max(2, v / max * 100);
      return '<div class="bar"><span>' + esc(it.k[lang]) + '</span><span class="v">' + dg(v) + (max === 100 ? (fa() ? "٪" : "%") : "") + '</span>' +
        '<span class="track"><span class="fill' + (white ? " w" : "") + '" style="width:' + pct + "%;transition-delay:" + i * 70 + 'ms"></span></span></div>';
    }).join("");
  }
  function impact() {
    var x = X();
    $("kpis").innerHTML = S.kpis.map(function (k) { return '<div class="kpi"><dt>' + esc(k.v[lang]) + "</dt><dd>" + esc(k.l[lang]) + "</dd></div>"; }).join("");
    $("lOutputs").textContent = x.outputs; $("lStatus").textContent = x.status; $("lSkills").textContent = x.skills;
    var mo = Math.max.apply(null, S.dash.outputs.map(function (d) { return d.n; }));
    bars($("bOutputs"), S.dash.outputs, mo, true);
    var ms = Math.max.apply(null, S.dash.status.map(function (d) { return d.n; }));
    bars($("bStatus"), S.dash.status, ms, false);
    bars($("bSkills"), S.dash.skills, 100, false);
  }
  function research() {
    var x = X();
    $("pubSearch").placeholder = x.search;
    var sel = $("pubStatus"), cur = sel.value || "all";
    sel.innerHTML = '<option value="all">' + esc(x.allStatus) + "</option>" + Object.keys(S.statusLabels).map(function (k) { return '<option value="' + k + '">' + esc(S.statusLabels[k][lang]) + "</option>"; }).join("");
    sel.value = cur;
    document.querySelector("#pubs thead tr").innerHTML = x.th.map(function (t) { return "<th>" + esc(t) + "</th>"; }).join("");
    pubs();
    $("lProps").textContent = x.props; $("lWs").textContent = x.ws;
    $("props").innerHTML = S.proposals[lang].map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
    $("ws").innerHTML = S.workshops.map(function (w) { return "<li>" + esc(w.t[lang]) + "<span>" + esc(w.d[lang]) + "</span></li>"; }).join("");
  }
  function pubs() {
    var q = $("pubSearch").value.trim().toLowerCase(), st = $("pubStatus").value || "all", n = 0;
    $("pubs").tBodies[0].innerHTML = S.pubs.map(function (p) {
      var title = p.t[lang], m = p.m ? p.m[lang] : "";
      if (st !== "all" && p.s !== st) return "";
      if (q && (title + " " + m).toLowerCase().indexOf(q) < 0) return "";
      n++;
      var L = S.statusLabels[p.s];
      return "<tr><td>" + pad(n) + "</td><td>" + esc(title) + "</td><td>" + esc(m) + '</td><td><span class="st s-' + L.c + '">' + esc(L[lang]) + "</span></td></tr>";
    }).join("");
  }
  function about() {
    var x = X();
    $("lExp").textContent = x.exp; $("lEdu").textContent = x.edu; $("lRec").textContent = x.rec; $("lTools").textContent = x.tools;
    $("photo").alt = U().name;
    $("aboutIntro").textContent = U().role + " · " + U().badgeLine;
    $("exp").innerHTML = S.experience.map(function (e) {
      return '<li><span class="d' + (e.now ? " now" : "") + '">' + esc(e.d[lang]) + "</span><div><b>" + esc(e.t[lang]) + '</b><span class="o">' + esc(e.o[lang]) + "</span><ul>" +
        e.b[lang].map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div></li>";
    }).join("");
    $("edu").innerHTML = S.education.map(function (e) { return "<li>" + esc(e.t[lang]) + '<br><span style="color:var(--muted)">' + esc(e.o[lang]) + "</span></li>"; }).join("");
    $("rec").innerHTML = S.recognition[lang].map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");
    $("tools").textContent = S.tools.join(" · ");
  }
  function process() {
    $("steps").innerHTML = S.process.map(function (p, i) { return '<li><span class="n">' + pad(i + 1) + "</span><b>" + esc(p.t[lang]) + "</b><p>" + esc(p.d[lang]) + "</p></li>"; }).join("");
  }
  function faq() {
    $("faqList").innerHTML = S.faq.map(function (f) { return "<details><summary>" + esc(f.q[lang]) + "</summary><p>" + esc(f.a[lang]) + "</p></details>"; }).join("");
  }
  function foot() {
    var u = U(), x = X();
    $("footName").textContent = "© " + dg(new Date().getFullYear()) + " " + u.name;
    $("footMail").textContent = S.email; $("footMail").href = "mailto:" + S.email; $("footMail").dir = "ltr";
    $("footNote").textContent = u.footer;
    $("footTop").textContent = x.top;
  }

  /* ---------- order & consultation ---------- */
  function opts(list, withEmpty) { return (withEmpty ? '<option value=""></option>' : "") + list.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join(""); }
  function field(name, label, control, req, full) {
    return '<div class="field' + (full ? " full" : "") + '"><label for="f-' + name + '">' + esc(label) + (req ? " <i>*</i>" : "") + "</label>" + control + '<span class="err" id="e-' + name + '"></span></div>';
  }
  function orderForms() {
    var x = X(), f = x.f;
    $("tabOrder").textContent = x.tabs.order; $("tabConsult").textContent = x.tabs.consult;
    $("orderLead").textContent = U().contactText;
    $("consultList").innerHTML = S.consult.map(function (c) { return "<li>" + esc(c[lang]) + "</li>"; }).join("");
    $("mailLbl").textContent = x.mailLabel; $("mailLink").textContent = S.email; $("mailLink").href = "mailto:" + S.email; $("mailLink").dir = "ltr";
    var svc = S.services.map(function (s) { return s.t[lang]; }).concat([f.other]);
    var hp = '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';
    var send = '<div class="send"><button class="btn" type="submit">' + esc(f.send) + "</button><small>" + esc(f.privacy) + "</small></div>";
    $("formOrder").innerHTML = hp +
      field("name", f.name, '<input id="f-name" name="name" autocomplete="name" required>', true) +
      field("contact", f.contact, '<input id="f-contact" name="contact" autocomplete="email" required dir="auto">', true) +
      field("service", f.service, '<select id="f-service" name="service" required>' + opts(svc, true) + "</select>", true) +
      field("deadline", f.deadline, '<select id="f-deadline" name="deadline">' + opts(x.deadlines, true) + "</select>") +
      field("title", f.title, '<input id="f-title" name="title" required>', true, true) +
      field("desc", f.desc, '<textarea id="f-desc" name="desc" required placeholder="' + esc(f.descHint) + '"></textarea>', true, true) +
      field("outLang", f.lang, '<select id="f-outLang" name="outLang">' + opts(x.langs, false) + "</select>") +
      field("link", f.link, '<input id="f-link" name="link" type="url" dir="ltr" placeholder="' + esc(f.linkHint) + '">') + send;
    $("formConsult").innerHTML = hp +
      field("cname", f.name, '<input id="f-cname" name="name" autocomplete="name" required>', true) +
      field("ccontact", f.contact, '<input id="f-ccontact" name="contact" autocomplete="email" required dir="auto">', true) +
      field("topic", f.topic, '<select id="f-topic" name="topic" required>' + opts(S.consult.map(function (c) { return c[lang]; }).concat([f.other]), true) + "</select>", true, true) +
      field("mode", f.mode, '<select id="f-mode" name="mode">' + opts(x.modes, false) + "</select>") +
      field("duration", f.duration, '<select id="f-duration" name="duration">' + opts(x.durations, false) + "</select>") +
      field("when", f.when, '<input id="f-when" name="when" placeholder="' + esc(f.whenHint) + '">', false, true) +
      field("question", f.question, '<textarea id="f-question" name="question" required></textarea>', true, true) + send;
    setTab(tab, false);
  }
  function setTab(t, focus) {
    tab = t;
    $("tabOrder").setAttribute("aria-selected", t === "order"); $("tabConsult").setAttribute("aria-selected", t === "consult");
    $("formOrder").hidden = t !== "order"; $("formConsult").hidden = t !== "consult";
    if (focus) { var first = (t === "order" ? $("formOrder") : $("formConsult")).querySelector("input:not(.hp)"); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 500); }
  }
  function validate(form) {
    var ok = true, f = X().f;
    form.querySelectorAll("[required]").forEach(function (el) {
      var bad = !el.value.trim();
      if (!bad && el.name === "contact") bad = !/@|\d{6,}/.test(el.value.replace(/\s/g, ""));
      el.classList.toggle("invalid", bad);
      var err = form.querySelector("#e-" + el.id.slice(2)); if (err) err.textContent = bad ? f.required : "";
      if (bad && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  function payload(form, type) {
    var data = { type: type, lang: lang, sentAt: new Date().toISOString() };
    form.querySelectorAll("input:not(.hp), select, textarea").forEach(function (el) { data[el.name] = el.value.trim(); });
    return data;
  }
  function asText(d) {
    var f = X().f, rows = d.type === "order"
      ? [[f.name, d.name], [f.contact, d.contact], [f.service, d.service], [f.title, d.title], [f.deadline, d.deadline], [f.lang, d.outLang], [f.link, d.link], [f.desc, d.desc]]
      : [[f.name, d.name], [f.contact, d.contact], [f.topic, d.topic], [f.mode, d.mode], [f.duration, d.duration], [f.when, d.when], [f.question, d.question]];
    return rows.filter(function (r) { return r[1]; }).map(function (r) { return r[0] + ": " + r[1]; }).join("\n");
  }
  function showResult(html, ok) { var r = $("result"); r.innerHTML = html; r.hidden = false; r.classList.toggle("ok", !!ok); r.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  function submit(form, type) {
    if (form.querySelector(".hp").value) return;                 // bots fill hidden fields
    if (!validate(form)) return;
    var x = X(), btn = form.querySelector(".btn"), d = payload(form, type);
    btn.disabled = true; btn.textContent = x.f.sending;
    var done = function () { btn.disabled = false; btn.textContent = x.f.send; };
    var fallback = function () {
      done();
      var subject = (type === "order" ? x.tabs.order : x.tabs.consult) + " — " + d.name;
      var body = asText(d);
      try { window.location.href = "mailto:" + S.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); } catch (e) {}
      var note = fa() ? "برنامهٔ ایمیل شما با متن آمادهٔ درخواست باز شد؛ فقط «ارسال» را بزنید. اگر برنامهٔ ایمیل باز نشد، متن زیر را کپی کنید و به این آدرس بفرستید:"
        : "Your email app has opened with the request ready: just press Send. If it did not open, copy the text below and send it to:";
      showResult("<p>" + esc(note) + ' <b dir="ltr">' + esc(S.email) + "</b></p><pre>" + esc(body) + '</pre><button class="pill" type="button" id="copyReq">' + esc(x.copyText) + "</button>", false);
      $("copyReq").onclick = function () { try { navigator.clipboard.writeText(body).then(function () { $("copyReq").textContent = x.copied; }); } catch (e) {} };
    };
    if (location.protocol === "file:") { fallback(); return; }
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    fetch("api/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) throw new Error("bad response");
        done(); form.reset();
        showResult("<p>" + esc(x.ok) + ' <b dir="ltr">' + esc(res.id) + "</b></p><p>" + esc(x.okNext) + "</p>", true);
      })
      .catch(function () { clearTimeout(timer); fallback(); });
  }

  /* ---------- case viewer ---------- */
  var lbCase = null, lastFocus = null;
  function openCase(i) {
    lastFocus = document.activeElement; lbCase = S.cases[i];
    var x = X();
    $("lbCat").textContent = catName(lbCase.cat); $("lbTitle").textContent = lbCase.title[lang]; $("lbClose").textContent = x.close;
    $("lbPso").innerHTML = [x.problem, x.did, x.result].map(function (h, k) { return "<dt>" + esc(h) + "</dt><dd>" + esc(lbCase.pso[lang][k]) + "</dd>"; }).join("");
    $("lbThumbs").innerHTML = lbCase.gallery.map(function (g, k) { return '<button type="button" data-g="' + k + '" aria-label="' + esc(g.c[lang]) + '"><img src="' + IMG + g[lang] + '" alt=""></button>'; }).join("");
    showImg(0);
    $("lb").hidden = false; document.body.style.overflow = "hidden"; $("lbClose").focus();
  }
  function showImg(k) {
    var g = lbCase.gallery[k];
    $("lbImg").src = IMG + g[lang]; $("lbImg").alt = g.c[lang]; $("lbCap").textContent = g.c[lang];
    $("lbThumbs").querySelectorAll("button").forEach(function (b, j) { b.setAttribute("aria-current", j === k); });
  }
  function closeCase() { $("lb").hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }

  /* ---------- scroll state ---------- */
  function onScroll() {
    $("top").classList.toggle("scrolled", window.scrollY > 40);
    var hb = $("hero") ? $("hero").getBoundingClientRect().bottom : 0;
    $("top").classList.toggle("on-light", hb < 110);          // past the video: light header
    var on = "hero";
    SECTIONS.forEach(function (id) { var el = $(id); if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) on = id; });
    document.querySelectorAll("#index a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-id") === on); });
  }
  var barIO = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove("pre"); barIO.unobserve(e.target); } });
  }, { threshold: 0.3 }) : null;
  function armBars() {
    if (!barIO) return;
    document.querySelectorAll(".bars").forEach(function (b) { if (b.getBoundingClientRect().top > window.innerHeight) { b.classList.add("pre"); barIO.observe(b); } });
  }

  function setMenu(open) {
    $("sheet").hidden = !open; $("menuBtn").setAttribute("aria-expanded", open);
    $("menuBtn").textContent = open ? X().close : (U().menu || "Menu");
    document.body.style.overflow = open ? "hidden" : "";
  }

  /* scroll-in animation for cards and rows (skipped when the visitor prefers less motion) */
  var fxIO = ("IntersectionObserver" in window && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches))
    ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("fx-in"); fxIO.unobserve(e.target); } }); }, { threshold: 0.12 }) : null;
  function fx() {
    if (!fxIO) return;
    document.querySelectorAll(".svc-row, .wcard, .post, .kpi, .steps li, .faq details, .tl > li, .bars3 > div, .order-main, .order-side, .about aside, .cols2 > div, .tbl-wrap").forEach(function (el) {
      if (el.classList.contains("fx-in") || el.classList.contains("fx")) return;
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) { el.classList.add("fx-in"); return; }
      var sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.setProperty("--fx-d", (sib % 4) * 90 + "ms");
      el.classList.add("fx"); fxIO.observe(el);
    });
  }

  function render() {
    header(); hero(); heads(); services(); work(); learn(); impact(); research(); about(); process(); orderForms(); faq(); foot();
    onScroll(); fx();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-case]"))) { openCase(+t.getAttribute("data-case")); return; }
    if ((t = e.target.closest("[data-g]"))) { showImg(+t.getAttribute("data-g")); return; }
    if ((t = e.target.closest("#workChips [data-cat]"))) { workCat = t.getAttribute("data-cat"); work(); fx(); return; }
    if ((t = e.target.closest("[data-lcat]"))) { learnCat = t.getAttribute("data-lcat"); learn(); fx(); return; }
    if (e.target.closest("#rCta")) { closePost(true); }
    if ((t = e.target.closest("[data-order-service]"))) {
      setTab("order", false);
      $("f-service").selectedIndex = +t.getAttribute("data-order-service") + 1;
      $("order").scrollIntoView({ behavior: "smooth" }); setTimeout(function () { $("f-name").focus({ preventScroll: true }); }, 600); return;
    }
    if ((t = e.target.closest("[data-tab]"))) { setTab(t.getAttribute("data-tab"), true); }
    if (e.target.closest("#sheetNav a")) setMenu(false);
    if (e.target === $("lb")) closeCase();
  });
  $("tabOrder").addEventListener("click", function () { setTab("order", true); });
  $("tabConsult").addEventListener("click", function () { setTab("consult", true); });
  $("tabs").addEventListener("keydown", function (e) { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { setTab(tab === "order" ? "consult" : "order", false); (tab === "order" ? $("tabOrder") : $("tabConsult")).focus(); } });
  $("formOrder").addEventListener("submit", function (e) { e.preventDefault(); submit(this, "order"); });
  $("formConsult").addEventListener("submit", function (e) { e.preventDefault(); submit(this, "consult"); });
  $("lbClose").addEventListener("click", closeCase);
  $("rBack").addEventListener("click", function () { closePost(false); var l = $("learn"); if (l) l.scrollIntoView(); });
  $("rShare").addEventListener("click", function () {
    var b = $("rShare"), url = location.href;
    try { navigator.clipboard.writeText(url).then(function () { b.textContent = X().linkCopied; }); } catch (e) {}
  });
  window.addEventListener("hashchange", route);
  $("menuBtn").addEventListener("click", function () { setMenu($("sheet").hidden); });
  $("langBtn").addEventListener("click", function () { lang = fa() ? "en" : "fa"; store.set("mm-lang", lang); $("result").hidden = true; render(); });
  $("pubSearch").addEventListener("input", pubs);
  $("pubStatus").addEventListener("change", pubs);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (readerOpen) { closePost(false); return; } if (!$("lb").hidden) closeCase(); if (!$("sheet").hidden) setMenu(false); } });
  window.addEventListener("scroll", onScroll, { passive: true });
  if (/^#(order|consult)/.test(location.hash)) setTab(location.hash === "#consult" ? "consult" : "order", false);

  /* Content comes from content/site.json and content/posts.json (edited in the admin panel).
     If those cannot be fetched (e.g. the file was opened directly), js/data.js is used instead. */
  function load(url) {
    return fetch(url + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function start() {
    render(); armBars(); route();
    var v = $("heroVideo");
    if (v && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { try { v.removeAttribute("autoplay"); v.pause(); } catch (e) {} }
  }
  if (location.protocol === "file:" || !window.fetch) { start(); }
  else {
    Promise.all([load("content/site.json").catch(function () { return null; }), load("content/posts.json").catch(function () { return []; })])
      .then(function (r) {
        if (r[0] && r[0].ui && r[0].x) S = window.SITE = r[0];
        POSTS = Array.isArray(r[1]) ? r[1] : [];
        start();
      });
  }
})();
