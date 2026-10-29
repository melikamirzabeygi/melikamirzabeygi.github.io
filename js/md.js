/* Minimal, safe Markdown renderer for the articles (used by the site and the admin preview).
   Supported: # ## ### headings, paragraphs, **bold**, *italic*, `code`, ```code blocks```,
   - and 1. lists, > quotes, --- rules, [text](link), ![alt](image).
   All text is HTML-escaped first, and only http(s), mailto, # and relative links are allowed. */
window.MD = (function () {
  "use strict";
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function safeUrl(u) {
    u = String(u).trim();
    if (/^(https?:|mailto:)/i.test(u) || /^[#./]/.test(u) || /^[\w\-]+(\/[\w\-.]+)*\.(jpg|jpeg|png|webp|gif|pdf|html)$/i.test(u)) return u;
    return "#";
  }
  function img(src, imgBase) { return /^(https?:|\/|\.)/i.test(src) || src.indexOf("/") > -1 ? src : (imgBase || "") + src; }
  function inline(s, imgBase) {
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) { return '<img src="' + esc(safeUrl(img(src, imgBase))) + '" alt="' + alt + '" loading="lazy">'; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, href) {
      var u = safeUrl(href), ext = /^https?:/i.test(u);
      return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return "<code>" + esc(codes[+i]) + "</code>"; });
    return s;
  }
  function render(src, imgBase) {
    var lines = String(src || "").replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0;
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) {
        var code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
        i++; out.push('<pre dir="ltr"><code>' + esc(code.join("\n")) + "</code></pre>"); continue;
      }
      var h = /^(#{1,3})\s+(.*)$/.exec(l);
      if (h) { var n = h[1].length + 1; out.push("<h" + n + ">" + inline(h[2], imgBase) + "</h" + n + ">"); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if (/^>\s?/.test(l)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        out.push("<blockquote>" + inline(q.join(" "), imgBase) + "</blockquote>"); continue;
      }
      if (/^\s*([-*•])\s+/.test(l) || /^\s*[\d۰-۹]+[.)]\s+/.test(l)) {
        var ordered = !/^\s*([-*•])\s+/.test(l), items = [];
        var re = ordered ? /^\s*[\d۰-۹]+[.)]\s+/ : /^\s*([-*•])\s+/;
        while (i < lines.length && re.test(lines[i])) items.push("<li>" + inline(lines[i++].replace(re, ""), imgBase) + "</li>");
        out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>")); continue;
      }
      if (!l.trim()) { i++; continue; }
      var p = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\s*[-*•]\s+|\s*[\d۰-۹]+[.)]\s+|\s*-{3,}\s*$)/.test(lines[i])) p.push(lines[i++]);
      if (!p.length) { p.push(lines[i++]); }
      out.push("<p>" + inline(p.join("\n"), imgBase).replace(/\n/g, "<br>") + "</p>");
    }
    return out.join("\n");
  }
  function words(src) { return String(src || "").replace(/[#*`>\-\[\]()!]/g, " ").split(/\s+/).filter(Boolean).length; }
  return { render: render, words: words, esc: esc };
})();
