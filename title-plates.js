/* Figma title plate: preserve end-cap aspect ratios; only the middle flexes. */
(function () {
  'use strict';
  const base = new URL('./images/app-ui/', document.currentScript.src);
  for (const title of document.querySelectorAll('.module-title, .reservation-content > h2')) {
    const plate = document.createElement('span');
    plate.className = 'title-plate';
    plate.setAttribute('aria-hidden', 'true');
    for (const part of ['left', 'middle', 'right']) {
      const image = document.createElement('img');
      image.src = new URL('title-column-' + part + '.svg', base).href;
      image.alt = '';
      image.className = part === 'middle' ? 'title-plate-middle' : 'title-plate-cap';
      plate.append(image);
    }
    title.prepend(plate);
  }
})();
