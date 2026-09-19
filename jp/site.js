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

  function initVariants(doc) {
    const image = doc.querySelector("[data-product-image]");
    const manualImage = doc.querySelector("[data-manual-image]");
    const manualLinks = doc.querySelectorAll("[data-manual-link]");
    const input = doc.querySelector("[name='variantInterest']");
    if (!image) return;
    doc.querySelectorAll("[data-variant]").forEach(function (button) {
      button.addEventListener("click", function () {
        doc.querySelectorAll("[data-variant]").forEach(function (item) {
          item.setAttribute("aria-pressed", String(item === button));
        });
        image.src = button.dataset.image;
        image.alt = button.dataset.alt;
        if (manualImage && button.dataset.manual) {
          manualImage.src = button.dataset.manual;
          manualImage.alt = button.dataset.manualAlt;
        }
        manualLinks.forEach(function (link) {
          if (button.dataset.manual) link.href = button.dataset.manual;
          if (link.classList.contains("guide-preview")) {
            link.setAttribute("aria-label", button.dataset.manualAlt + "を拡大表示");
          }
        });
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
    const email = normalizeEmail(form.elements.email.value);
    const consent = Boolean(form.elements.consent && form.elements.consent.checked);
    if (!isValidEmail(email)) {
      setFormMessage(form, "有効なメールアドレスを入力してください。", "error");
      return false;
    }
    if (!consent) {
      setFormMessage(form, "発売通知とプライバシーポリシーへの同意が必要です。", "error");
      return false;
    }

    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    setFormMessage(form, "登録しています…", "info");
    const payload = {
      email: email,
      consent: true,
      consentVersion: "jp-waitlist-2026-09-19",
      productCode: "PRODUCT_01",
      variantInterest: form.elements.variantInterest ? form.elements.variantInterest.value : "UNDECIDED",
      locale: "ja-JP",
      source: "jp_website",
      website: form.elements.website ? form.elements.website.value : ""
    };

    try {
      const response = await fetchImpl(apiBase(doc) + "/api/product-waitlist", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(function () { return null; });
      if (!response.ok || !body || body.result !== 0) throw new Error("request_failed");
      form.elements.email.value = "";
      form.elements.consent.checked = false;
      setFormMessage(form, "登録が完了しました。発売時にメールでお知らせします。", "success");
      return true;
    } catch (error) {
      setFormMessage(form, "登録できませんでした。通信環境をご確認のうえ、もう一度お試しください。", "error");
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
    const status = doc.querySelector("[data-unsubscribe-status]");
    if (!status) return;
    const token = new URLSearchParams(root.location.search).get("token");
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      status.textContent = "このリンクは無効です。";
      status.dataset.kind = "error";
      return;
    }
    try {
      const response = await fetchImpl(apiBase(doc) + "/api/product-waitlist/unsubscribe", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token: token })
      });
      const body = await response.json().catch(function () { return null; });
      if (!response.ok || !body || body.result !== 0) throw new Error("request_failed");
      status.textContent = "配信停止を受け付けました。今後、発売通知は送信されません。";
    } catch (error) {
      status.textContent = "配信停止を完了できませんでした。support@lunakoru.com までご連絡ください。";
      status.dataset.kind = "error";
    }
  }

  function init(doc, fetchImpl) {
    initMenu(doc);
    initVariants(doc);
    initModal(doc);
    initForms(doc, fetchImpl || root.fetch.bind(root));
    initUnsubscribe(doc, fetchImpl || root.fetch.bind(root));
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", function () { init(document); });
  }

  return { DEFAULT_API_BASE, normalizeEmail, isValidEmail, apiBase, submitWaitlist };
});
