/* Three independent slices: preserve both caps and stretch only the middle. */
(function () {
  'use strict';
  const base = new URL('./images/app-ui/', document.currentScript.src);
  function decorate(title) {
    if (title.querySelector('.title-plate')) return;
    const plate = document.createElement('span');
    plate.className = 'title-plate';
    plate.setAttribute('aria-hidden', 'true');
    const prefix = title.matches('.module-title') ? 'product-title' : title.matches('.tab-detail-title') ? 'product-subtitle' : 'title-column';
    for (const part of ['left', 'middle', 'right']) {
      const image = document.createElement('img');
      image.src = new URL(prefix + '-' + part + (prefix === 'product-title' ? '-trimmed.svg' : prefix === 'title-column' ? '.svg' : '.png'), base).href;
      image.alt = '';
      image.className = part === 'middle' ? 'title-plate-middle' : 'title-plate-cap';
      plate.append(image);
    }
    title.prepend(plate);
  }
  for (const title of document.querySelectorAll('.module-title, .tab-detail-title, .reservation-content > h2')) {
    decorate(title);
    new MutationObserver(() => decorate(title)).observe(title, {childList:true});
  }
  for (const description of document.querySelectorAll('.tab-detail-desc')) {
    function stars() {
      if (description.querySelector('.feature-point')) return;
      const lines = [''];
      for (const node of description.childNodes) {
        if (node.nodeName === 'BR') lines.push('');
        else lines[lines.length - 1] += node.textContent;
      }
      const rows = lines.map(line => line.replace(/^\s*▸\s*/, '').trim()).filter(Boolean).map(line => {
        const row = document.createElement('span');row.className = 'feature-point';
        const icon = document.createElement('img');icon.src = new URL('../reservation/star.png', base).href;icon.alt = '';
        const text = document.createElement('span');text.textContent = line;row.append(icon, text);return row;
      });
      description.replaceChildren(...rows);
    }
    stars();
    new MutationObserver(stars).observe(description, {childList:true});
  }
})();
