// Carregado no <head> (script normal, sem module) para aplicar as preferências
// de acessibilidade antes da página aparecer, evitando "piscar" o visual padrão.
(function () {
  var KEY = "gameverse-a11y:v1";
  var DEFAULTS = {
    textSize: 0,        // 0 = padrão, 1 = grande, 2 = muito grande
    font: "default",    // default | legible | dyslexic
    color: "normal",    // normal | low | gray
    contrast: false,
    reduceMotion: false,
    spacing: false,
    links: false
  };
  var CHOICES = {
    textSize: [0, 1, 2],
    font: ["default", "legible", "dyslexic"],
    color: ["normal", "low", "gray"]
  };

  function normalize(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var settings = {};
    Object.keys(DEFAULTS).forEach(function (key) {
      var value = source[key];
      if (CHOICES[key]) {
        settings[key] = CHOICES[key].indexOf(value) >= 0 ? value : DEFAULTS[key];
      } else {
        settings[key] = typeof value === "boolean" ? value : DEFAULTS[key];
      }
    });
    return settings;
  }

  function read() {
    try {
      return normalize(JSON.parse(window.localStorage.getItem(KEY) || "{}"));
    } catch (error) {
      return normalize({});
    }
  }

  function save(settings) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(normalize(settings)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function apply(settings) {
    var s = normalize(settings);
    var classes = document.documentElement.classList;
    classes.toggle("a11y-text-1", s.textSize === 1);
    classes.toggle("a11y-text-2", s.textSize === 2);
    classes.toggle("a11y-font-legible", s.font === "legible");
    classes.toggle("a11y-font-dyslexic", s.font === "dyslexic");
    classes.toggle("a11y-color-low", s.color === "low");
    classes.toggle("a11y-color-gray", s.color === "gray");
    classes.toggle("a11y-contrast", s.contrast);
    classes.toggle("a11y-reduce-motion", s.reduceMotion);
    classes.toggle("a11y-spacing", s.spacing);
    classes.toggle("a11y-links", s.links);
    document.dispatchEvent(new CustomEvent("gameverse:a11y-change", { detail: s }));
    return s;
  }

  function systemPrefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function isReducedMotion() {
    return document.documentElement.classList.contains("a11y-reduce-motion") || systemPrefersReducedMotion();
  }

  window.GameVerseA11y = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    read: read,
    save: save,
    apply: apply,
    normalize: normalize,
    isReducedMotion: isReducedMotion,
    systemPrefersReducedMotion: systemPrefersReducedMotion
  };

  apply(read());
})();
