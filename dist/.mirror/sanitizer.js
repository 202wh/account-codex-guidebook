(() => {
  'use strict';

  const CONTACT_URL_RE = /(?:\b(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog|discord\.gg|wa\.me|api\.whatsapp\.com|line\.me\/R\/ti\/p|kakao\.com\/talk|qm\.qq\.com|wpa\.qq\.com)\/[\w+?&=#@%./~-]+|\b(?:tg|mqq|weixin|whatsapp):\/\/[^\s<>"']+|\b(?:mailto|tel):[^\s<>"']+)/giu;
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
  const PHONE_RE = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d(?:[-\s]?\d){8}(?!\d)|(?<![\d.])\+[1-9]\d{0,2}(?:[-\s().]*\d){7,14}(?!\d)/gu;
  const EMAIL_CONTEXT_RE = /(?:联系|联络|客服|售后|咨询|投稿|商务合作|反馈|举报|申诉|简历投递|发送邮件|邮件联系|请发|请发送|contact|support|customer\s*service|inquir|submit|feedback|report|appeal|email\s+us|reach\s+us)/iu;
  const EMAIL_CONTEXT_WINDOW = 96;
  const LABELED_RE = /(?:微信(?:号|群)?|微\s*信|WeChat|\b(?:VX|WX)\b|QQ(?:群|号)?|Q群|QQ群|Telegram|电报|纸飞机|\bTG\b|WhatsApp|Discord|\bLINE\b|Kakao)(?:(?:\s*(?:账号|帐号|群号|号码|ID|id|：|:|是|为|=|加|联系)\s*)|\s+)[@＋+]?[-_A-Za-z0-9]{5,32}/giu;
  const DIRECT_QQ_RE = /(?:QQ(?:群|号)?|Q群|QQ群)\s*[:：=]?\s*\d{5,12}/giu;
  const DIRECT_WECHAT_RE = /(?:微信(?:号|群)?|微\s*信)\s*[:：=]?\s*[A-Za-z][-_A-Za-z0-9]{5,19}/giu;
  const HANDLE_RE = /(^|[\s(（[【,，:：])@[A-Za-z][A-Za-z0-9_]{4,31}\b/gu;
  const CONTACT_HREF_RE = /^(?:mailto:|tel:|tg:|mqq:|weixin:|whatsapp:)|(?:^|\/\/)(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog|discord\.gg|wa\.me|api\.whatsapp\.com|line\.me|qm\.qq\.com|wpa\.qq\.com)(?:\/|$)/iu;
  const MEDIA_SELECTOR = 'video,audio,iframe,object,embed';
  const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'data-url', 'data-href'];
  const TEXT_ATTRS = ['alt', 'title', 'aria-label', 'placeholder'];
  const sanitizedFlag = Symbol('mirrorSanitized');

  function isContextualEmail(text, start, end) {
    const lowerBound = Math.max(0, start - EMAIL_CONTEXT_WINDOW);
    const upperBound = Math.min(text.length, end + EMAIL_CONTEXT_WINDOW);
    const before = text.slice(lowerBound, start);
    const after = text.slice(end, upperBound);
    const beforeBoundary = Math.max(
      before.lastIndexOf('\n'), before.lastIndexOf('\r'), before.lastIndexOf('。'),
      before.lastIndexOf('！'), before.lastIndexOf('？'), before.lastIndexOf('!'),
      before.lastIndexOf('?'), before.lastIndexOf('；'), before.lastIndexOf(';'),
    );
    const afterBoundaryCandidates = ['\n', '\r', '。', '！', '？', '!', '?', '；', ';']
      .map((separator) => after.indexOf(separator))
      .filter((index) => index >= 0);
    const afterBoundary = afterBoundaryCandidates.length > 0
      ? Math.min(...afterBoundaryCandidates)
      : after.length;
    const context = `${before.slice(beforeBoundary + 1)} ${after.slice(0, afterBoundary)}`;
    return EMAIL_CONTEXT_RE.test(context);
  }

  function contextualEmailRanges(value) {
    const text = String(value || '');
    return [...text.matchAll(EMAIL_RE)]
      .filter((match) => isContextualEmail(text, match.index, match.index + match[0].length))
      .map((match) => ({ start: match.index, end: match.index + match[0].length }));
  }

  function stripContextualEmails(value) {
    const text = String(value || '');
    const ranges = contextualEmailRanges(text);
    let output = text;
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
      const range = ranges[index];
      output = `${output.slice(0, range.start)}${output.slice(range.end)}`;
    }
    return output;
  }

  function hasContact(value) {
    if (!value) return false;
    const text = String(value);
    if (contextualEmailRanges(text).length > 0) return true;
    return [CONTACT_URL_RE, PHONE_RE, LABELED_RE, DIRECT_QQ_RE, DIRECT_WECHAT_RE, HANDLE_RE].some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });
  }

  function cleanText(value) {
    if (!value) return value;
    const withoutKnownContacts = String(value)
      .replace(CONTACT_URL_RE, '')
      .replace(PHONE_RE, '')
      .replace(LABELED_RE, '')
      .replace(DIRECT_QQ_RE, '')
      .replace(DIRECT_WECHAT_RE, '')
      .replace(HANDLE_RE, '$1');
    return stripContextualEmails(withoutKnownContacts)
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([，。；、！？,.!?;])/g, '$1');
  }

  function isContactUrl(value) {
    if (!value) return false;
    try {
      const decoded = decodeURIComponent(String(value)).trim();
      return CONTACT_HREF_RE.test(decoded) || hasContact(decoded);
    } catch {
      return hasContact(String(value));
    }
  }

  function replaceMedia(element) {
    if (!(element instanceof Element) || element[sanitizedFlag]) return;
    if (element.matches('video,audio') && element.hasAttribute('data-mirror-media-allowed')) return;
    element[sanitizedFlag] = true;

    if (element.matches('video')) {
      const poster = element.getAttribute('poster');
      if (poster && !isContactUrl(poster)) {
        const image = document.createElement('img');
        image.src = poster;
        image.alt = cleanText(element.getAttribute('aria-label') || element.getAttribute('title') || '');
        image.className = element.className;
        image.setAttribute('data-mirror-video-poster', '');
        element.replaceWith(image);
        return;
      }
    }

    element.remove();
  }

  function sanitizeElement(element) {
    if (!(element instanceof Element)) return;
    if (element.matches(MEDIA_SELECTOR)) {
      replaceMedia(element);
      return;
    }

    for (const attr of URL_ATTRS) {
      const value = element.getAttribute(attr);
      if (!value || !isContactUrl(value)) continue;
      if (element.matches('a,area,button,form')) {
        element.remove();
        return;
      }
      element.removeAttribute(attr);
    }

    for (const attr of TEXT_ATTRS) {
      const value = element.getAttribute(attr);
      if (value && hasContact(value)) element.setAttribute(attr, cleanText(value));
    }

    const before = getComputedStyle(element, '::before').content;
    const after = getComputedStyle(element, '::after').content;
    if (hasContact(before)) element.classList.add('mirror-hide-before-contact');
    if (hasContact(after)) element.classList.add('mirror-hide-after-contact');
  }

  function sanitizeTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (root.parentElement?.matches('script,style,template,noscript')) return;
      if (hasContact(root.nodeValue)) root.nodeValue = cleanText(root.nodeValue);
      return;
    }
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;

    if (root instanceof Element) sanitizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.matches('script,style,template,noscript')) continue;
        if (hasContact(node.nodeValue)) node.nodeValue = cleanText(node.nodeValue);
      } else {
        sanitizeElement(node);
      }
    }
  }

  const style = document.createElement('style');
  style.textContent = '.mirror-hide-before-contact::before,.mirror-hide-after-contact::after{content:none!important}';
  (document.head || document.documentElement).appendChild(style);

  const originalOpen = window.open.bind(window);
  window.open = (url, ...args) => isContactUrl(url) ? null : originalOpen(url, ...args);

  const originalAlert = window.alert.bind(window);
  window.alert = (message) => {
    const cleaned = cleanText(message);
    if (cleaned.trim()) originalAlert(cleaned);
  };

  const originalConfirm = window.confirm.bind(window);
  window.confirm = (message) => {
    const cleaned = cleanText(message);
    return cleaned.trim() ? originalConfirm(cleaned) : false;
  };

  const originalFillText = CanvasRenderingContext2D.prototype.fillText;
  const originalStrokeText = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
    const cleaned = cleanText(text);
    if (cleaned.trim()) return originalFillText.call(this, cleaned, ...args);
  };
  CanvasRenderingContext2D.prototype.strokeText = function (text, ...args) {
    const cleaned = cleanText(text);
    if (cleaned.trim()) return originalStrokeText.call(this, cleaned, ...args);
  };

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a,area,button') : null;
    if (!link) return;
    const target = link.getAttribute('href') || link.getAttribute('data-url') || link.getAttribute('data-href');
    if (!isContactUrl(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    link.remove();
  }, true);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') sanitizeTree(mutation.target);
      if (mutation.type === 'attributes') sanitizeElement(mutation.target);
      for (const node of mutation.addedNodes) sanitizeTree(node);
    }
  });

  function prefetchTutorialRoutes() {
    if (window.__mirrorTutorialPrefetch) return;
    const run = () => {
      if (window.__mirrorTutorialPrefetch) return;
      const urls = [...new Set([...document.querySelectorAll('a.tutorial-sidebar-link[href]')]
        .map((link) => {
          try {
            const url = new URL(link.getAttribute('href'), location.href);
            return url.origin === location.origin && url.pathname.endsWith('/') && url.pathname !== location.pathname
              ? `${url.pathname}${url.search}`
              : '';
          } catch {
            return '';
          }
        })
        .filter(Boolean))];
      if (urls.length === 0) return;
      window.__mirrorTutorialPrefetch = true;
      for (const href of urls) {
        if (document.head.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.as = 'document';
        hint.href = href;
        document.head.appendChild(hint);
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 450);
    }
  }

  const start = () => {
    sanitizeTree(document.documentElement);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...URL_ATTRS, ...TEXT_ATTRS, 'poster']
    });
    prefetchTutorialRoutes();
  };

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });

  window.__mirrorSanitizer = Object.freeze({ hasContact, cleanText, isContactUrl, sanitizeTree });
})();
