/* Общий скрипт сайта: появление блоков, карусели экранов и просмотр во весь экран. */

/* ── появление блоков ───────────────────────────────────────────────── */
// при захвате макета в фигму ничего не прокручивается, поэтому показываем все сразу
if (location.hash.includes('figmacapture')) {
  document.querySelectorAll('.rv, .stg').forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv, .stg').forEach((el) => io.observe(el));
}

const icon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"` +
  ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const ARROW_LEFT  = 'M15 5l-7 7 7 7';
const ARROW_RIGHT = 'M9 5l7 7-7 7';
const CROSS       = 'M6 6l12 12M18 6L6 18';

/* ── карусель экранов ───────────────────────────────────────────────── */
// Разметка задает только дорожку со слайдами; стрелки и точки строятся здесь,
// чтобы без JS блок оставался обычной прокручиваемой лентой, а не мертвыми кнопками.
// Вид один и тот же у всех визуалов: стрелки по бокам карточки, точки под лентой.
const setupCarousel = (root) => {
  const track = root.querySelector('.carousel__track');
  const viewport = root.querySelector('.carousel__viewport') || track.parentElement;
  const slides = Array.from(track.children);
  if (slides.length < 2) return;

  const button = (dir, label, path) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `carousel__nav carousel__nav--${dir}`;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon(path);
    return b;
  };
  const prev = button('prev', 'Предыдущий экран', ARROW_LEFT);
  const next = button('next', 'Следующий экран', ARROW_RIGHT);
  viewport.append(prev, next);

  const dots = document.createElement('div');
  dots.className = 'carousel__dots';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel__dot';
    dot.setAttribute('aria-label', `Экран ${i + 1} из ${slides.length}`);
    dot.addEventListener('click', () => go(i));
    dots.append(dot);
  });
  root.append(dots);

  // текущий слайд — тот, чей центр ближе всего к центру окна просмотра
  const current = () => {
    const middle = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    slides.forEach((s, i) => {
      const dist = Math.abs(s.offsetLeft + s.offsetWidth / 2 - middle);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  };

  const go = (i) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, i))];
    const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    track.scrollTo({ left, behavior: 'smooth' });
  };

  const sync = () => {
    const i = current();
    Array.from(dots.children).forEach((d, n) =>
      d.setAttribute('aria-current', String(n === i)));
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
  };

  prev.addEventListener('click', () => go(current() - 1));
  next.addEventListener('click', () => go(current() + 1));

  let settle;
  track.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(sync, 60);
  }, { passive: true });
  window.addEventListener('resize', sync);

  // ленту можно и просто тянуть мышью; на тач-устройствах работает родная прокрутка
  let down = false, startX = 0, startLeft = 0, moved = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    down = true; moved = 0; startX = e.clientX; startLeft = track.scrollLeft;
    track.classList.add('is-drag');
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* синтетика без захвата */ }
  });
  track.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > moved) moved = Math.abs(dx);
    track.scrollLeft = startLeft - dx;
    e.preventDefault();
  });
  const release = () => { down = false; track.classList.remove('is-drag'); sync(); };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('lostpointercapture', release);
  // протяжка не должна засчитаться как тап по экрану и открыть просмотр
  track.addEventListener('click', (e) => {
    if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  sync();
};

document.querySelectorAll('[data-carousel]').forEach(setupCarousel);

/* ── просмотр во весь экран ─────────────────────────────────────────────
   Любой визуал открывается по тапу. Если он часть ленты, в просмотре
   листаются все ее экраны — теми же стрелками и точками, что в карточке. */
const lightbox = (() => {
  let box, figure, img, closeBtn, prev, next, dots;
  let group = [], index = 0, opener = null;

  const build = () => {
    box = document.createElement('div');
    box.className = 'lb';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Просмотр визуала');

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lb__close';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.innerHTML = icon(CROSS);

    figure = document.createElement('figure');
    figure.className = 'lb__fig';
    img = document.createElement('img');
    img.className = 'lb__img';
    // подпись остаётся на странице: в просмотре нужен только сам макет
    figure.append(img);

    prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'lb__nav lb__nav--prev';
    prev.setAttribute('aria-label', 'Предыдущий экран');
    prev.innerHTML = icon(ARROW_LEFT);

    next = document.createElement('button');
    next.type = 'button';
    next.className = 'lb__nav lb__nav--next';
    next.setAttribute('aria-label', 'Следующий экран');
    next.innerHTML = icon(ARROW_RIGHT);

    dots = document.createElement('div');
    dots.className = 'lb__dots';

    box.append(closeBtn, prev, figure, next, dots);
    document.body.append(box);

    closeBtn.addEventListener('click', close);
    prev.addEventListener('click', () => show(index - 1));
    next.addEventListener('click', () => show(index + 1));
    // клик мимо картинки закрывает — привычное поведение просмотрщика
    box.addEventListener('click', (e) => { if (e.target === box || e.target === figure) close(); });

    // свайп пальцем между экранами
    let x0 = null;
    box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  };

  const show = (i) => {
    index = Math.max(0, Math.min(group.length - 1, i));
    const src = group[index];
    img.src = src.currentSrc || src.src;
    img.alt = src.alt || '';
    prev.hidden = next.hidden = group.length < 2;
    prev.disabled = index === 0;
    next.disabled = index === group.length - 1;
    dots.hidden = group.length < 2;
    dots.replaceChildren(...group.map((_, n) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'carousel__dot';
      d.setAttribute('aria-label', `Экран ${n + 1} из ${group.length}`);
      d.setAttribute('aria-current', String(n === index));
      d.addEventListener('click', () => show(n));
      return d;
    }));
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  };

  function close() {
    box.hidden = true;
    document.documentElement.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  }

  const open = (target) => {
    if (!box) build();
    const carousel = target.closest('.carousel');
    group = carousel
      ? Array.from(carousel.querySelectorAll('.carousel__slide'))
      : [target];
    opener = target;
    show(Math.max(0, group.indexOf(target)));
    box.hidden = false;
    // фон не должен прокручиваться под просмотром
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    closeBtn.focus({ preventScroll: true });
  };

  return { open };
})();

document.addEventListener('click', (e) => {
  const target = e.target.closest('.fig img');
  if (target) { e.preventDefault(); lightbox.open(target); }
});
