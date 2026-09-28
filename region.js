(function () {
  "use strict";

  var regions = [
    { id: "jp", label: "日本", home: "jp/index.html", product: "jp/product/index.html" },
    { id: "us", label: "United States", home: "us/index.html", product: "us/product/index.html" },
    { id: "sg", label: "Singapore", home: "sg/index.html", product: "sg/product/index.html" }
  ];

  function scriptUrl() {
    var script = document.currentScript;
    if (script && script.src) return new URL(script.src, document.baseURI);
    return new URL("region.js", document.baseURI);
  }

  function currentRegion(rootPath) {
    var path = window.location.pathname;
    var relative = path.indexOf(rootPath) === 0 ? path.slice(rootPath.length) : path;
    var match = relative.match(/^(jp|us|sg)(?:\/|$)/);
    return match ? match[1] : "";
  }

  function currentPage() {
    return /\/product(?:\/|\/index\.html$)/.test(window.location.pathname) ? "product" : "home";
  }

  function init() {
    var switcher = document.querySelector("[data-region-switcher]");
    if (!switcher) return;
    var button = switcher.querySelector("[data-region-button]");
    var menu = switcher.querySelector("[data-region-menu]");
    var source = scriptUrl();
    var rootPath = new URL("./", source).pathname;
    var current = currentRegion(rootPath);
    var page = currentPage();
    if (!button || !menu) return;

    regions.forEach(function (region) {
      var link = document.createElement("a");
      link.href = new URL(region[page], source).href;
      link.dataset.region = region.id;
      link.setAttribute("role", "menuitem");
      link.textContent = region.label;
      if (region.id === current) link.setAttribute("aria-current", "page");
      menu.appendChild(link);
    });

    function setOpen(open) {
      switcher.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    }

    button.addEventListener("click", function () {
      setOpen(!switcher.classList.contains("is-open"));
    });
    document.addEventListener("click", function (event) {
      if (!switcher.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
