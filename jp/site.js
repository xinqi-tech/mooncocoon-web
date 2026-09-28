(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LunaKoruJp = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const DEFAULT_API_BASE = "https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com";
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isValidEmail(value) {
    const normalized = normalizeEmail(value);
    return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
  }

  function apiBase(doc) {
    const configured = doc && doc.body ? doc.body.dataset.apiBase : "";
    return String(configured || DEFAULT_API_BASE).replace(/\/$/, "");
  }

  function messages(doc) {
    var english = doc && doc.body && String(doc.body.dataset.locale || "").toLowerCase().indexOf("en") === 0;
    return english ? {
      invalidEmail: "Please enter a valid email address.",
      consentRequired: "Please agree to release updates and the privacy policy.",
      registering: "Joining the waitlist…",
      alreadyRegistered: "This email is already registered. You do not need to sign up again.",
      success: "You are on the list. We will email you when the product launches.",
      failed: "We could not complete your registration. Please check your connection and try again.",
      unsubscribeSuccess: "Your subscription has been cancelled. You will not receive further release updates.",
      unsubscribeFailed: "We could not cancel your subscription. Please contact support@lunakoru.com.",
      invalidLink: "This link is invalid."
    } : {
      invalidEmail: "有効なメールアドレスを入力してください。",
      consentRequired: "発売通知とプライバシーポリシーへの同意が必要です。",
      registering: "登録しています…",
      alreadyRegistered: "このメールアドレスは登録済みです。再度ご登録いただく必要はありません。",
      success: "登録が完了しました。発売時にメールでお知らせします。",
      failed: "登録できませんでした。通信環境をご確認のうえ、もう一度お試しください。",
      unsubscribeSuccess: "配信停止を受け付けました。今後、発売通知は送信されません。",
      unsubscribeFailed: "配信停止を完了できませんでした。support@lunakoru.com までご連絡ください。",
      invalidLink: "このリンクは無効です。"
    };
  }

  function initMenu(doc) {
    const button = doc.querySelector("[data-menu-button]");
    const links = doc.querySelector("[data-nav-links]");
    if (!button || !links) return;
    button.addEventListener("click", function () {
      const open = links.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        links.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
      });
    });
  }

  function initBgm(doc) {
    const button = doc.querySelector("[data-bgm-toggle]");
    const audio = doc.querySelector("[data-bgm-audio]");
    if (!button || !audio) return;
    audio.volume = 0.55;
    var english = doc.body && String(doc.body.dataset.locale || "").toLowerCase().indexOf("en") === 0;
    button.addEventListener("click", function () {
      if (audio.paused) {
        audio.play().then(function () {
          button.classList.add("playing");
          button.setAttribute("aria-pressed", "true");
          button.setAttribute("aria-label", english ? "Pause BGM" : "BGMを一時停止");
        }).catch(function () {});
      } else {
        audio.pause();
        button.classList.remove("playing");
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", english ? "Play BGM" : "BGMを再生");
      }
    });
  }

  function initScrollMask(doc, viewport) {
    const header = doc.querySelector(".product-page .site-header");
    const win = viewport || root;
    if (!header || !win || typeof win.addEventListener !== "function") return;
    const update = function () {
      header.classList.toggle("scrolled", Number(win.scrollY || 0) > 80);
    };
    win.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initProductMotion(doc, viewport) {
    const body = doc.body;
    if (!body || !body.classList || !body.classList.contains("product-page")) return;
    const win = viewport || root;
    const targets = doc.querySelectorAll([
      ".product-page-hero > *",
      "main > .section:not(.product-page-hero) .section-heading",
      ".card-grid > *",
      ".angle-gallery > *",
      ".specs",
      ".product-policy-card",
      ".manual-card"
    ].join(","));
    targets.forEach(function (element, index) {
      element.setAttribute("data-reveal", "");
      element.style.setProperty("--reveal-delay", String((index % 3) * 90) + "ms");
    });
    body.classList.add("motion-ready");

    const reduceMotion = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || typeof win.IntersectionObserver !== "function") {
      targets.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }
    const observer = new win.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px 80px 0px" });
    targets.forEach(function (element) { observer.observe(element); });
  }

  function initVariants(doc) {
    const image = doc.querySelector("[data-product-image]");
    const input = doc.querySelector("[name='variantInterest']");
    if (!image) return;
    doc.querySelectorAll("[data-variant]").forEach(function (button) {
      button.addEventListener("click", function () {
        doc.querySelectorAll("[data-variant]").forEach(function (item) {
          item.setAttribute("aria-pressed", String(item === button));
        });
        image.src = button.dataset.image;
        image.alt = button.dataset.alt;
        if (input) input.value = button.dataset.variant;
      });
    });
  }

  function initModal(doc) {
    const modal = doc.querySelector("[data-waitlist-modal]");
    if (!modal) return;
    let previousFocus = null;
    const close = function () {
      modal.hidden = true;
      doc.body.classList.remove("modal-open");
      if (previousFocus) previousFocus.focus();
    };
    doc.querySelectorAll("[data-open-waitlist]").forEach(function (button) {
      button.addEventListener("click", function () {
        previousFocus = button;
        modal.hidden = false;
        doc.body.classList.add("modal-open");
        const email = modal.querySelector("input[type='email']");
        if (email) email.focus();
      });
    });
    modal.querySelectorAll("[data-close-modal]").forEach(function (button) {
      button.addEventListener("click", close);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) close();
    });
  }

  function setFormMessage(form, message, kind) {
    const target = form.querySelector("[data-form-message]");
    if (!target) return;
    target.textContent = message;
    target.dataset.kind = kind || "info";
  }

  async function submitWaitlist(form, fetchImpl, doc) {
    var copy = messages(doc);
    const email = normalizeEmail(form.elements.email.value);
    const consent = Boolean(form.elements.consent && form.elements.consent.checked);
    if (!isValidEmail(email)) {
      setFormMessage(form, copy.invalidEmail, "error");
      return false;
    }
    if (!consent) {
      setFormMessage(form, copy.consentRequired, "error");
      return false;
    }

    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    setFormMessage(form, copy.registering, "info");
    const payload = {
      email: email,
      consent: true,
      consentVersion: doc.body && doc.body.dataset.locale ? "en-waitlist-2026-09-19" : "jp-waitlist-2026-09-19",
      productCode: "PRODUCT_01",
      variantInterest: form.elements.variantInterest ? form.elements.variantInterest.value : "UNDECIDED",
      locale: doc.body && doc.body.dataset.locale ? doc.body.dataset.locale : "ja-JP",
      source: doc.body && doc.body.dataset.locale ? "en_website" : "jp_website",
      website: form.elements.website ? form.elements.website.value : ""
    };

    try {
      const formBody = new URLSearchParams();
      Object.keys(payload).forEach(function (key) { formBody.set(key, String(payload[key])); });
      const response = await fetchImpl(apiBase(doc) + "/api/product-waitlist", {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: formBody
      });
      const body = await response.json().catch(function () { return null; });
      if (!response.ok || !body || body.result !== 0) throw new Error("request_failed");
      form.elements.email.value = "";
      form.elements.consent.checked = false;
      if (body.data && body.data.alreadyRegistered === true) {
        setFormMessage(form, copy.alreadyRegistered, "info");
      } else {
        setFormMessage(form, copy.success, "success");
      }
      return true;
    } catch (error) {
      setFormMessage(form, copy.failed, "error");
      return false;
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  function initForms(doc, fetchImpl) {
    doc.querySelectorAll("[data-waitlist-form]").forEach(function (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitWaitlist(form, fetchImpl, doc);
      });
    });
  }

  async function initUnsubscribe(doc, fetchImpl) {
    var copy = messages(doc);
    const status = doc.querySelector("[data-unsubscribe-status]");
    if (!status) return;
    const token = new URLSearchParams(root.location.search).get("token");
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      status.textContent = copy.invalidLink;
      status.dataset.kind = "error";
      return;
    }
    try {
      const formBody = new URLSearchParams();
      formBody.set("token", token);
      const response = await fetchImpl(apiBase(doc) + "/api/product-waitlist/unsubscribe", {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: formBody
      });
      const body = await response.json().catch(function () { return null; });
      if (!response.ok || !body || body.result !== 0) throw new Error("request_failed");
      status.textContent = copy.unsubscribeSuccess;
    } catch (error) {
      status.textContent = copy.unsubscribeFailed;
      status.dataset.kind = "error";
    }
  }

  function init(doc, fetchImpl) {
    initMenu(doc);
    initBgm(doc);
    initScrollMask(doc);
    initProductMotion(doc);
    initVariants(doc);
    initModal(doc);
    initForms(doc, fetchImpl || root.fetch.bind(root));
    initUnsubscribe(doc, fetchImpl || root.fetch.bind(root));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () { init(document); });
  }

  return { DEFAULT_API_BASE, normalizeEmail, isValidEmail, apiBase, submitWaitlist, initBgm, initScrollMask, initProductMotion };
});
