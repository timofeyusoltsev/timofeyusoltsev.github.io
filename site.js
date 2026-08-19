/* Общий скрипт сайта: появление блоков при прокрутке и карусели экранов. */

/* ── появление блоков ───────────────────────────────────────────────── */
// при захвате макета в фигму ничего не прокручивается, поэтому показываем всё сразу
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

/* ── карусель экранов ───────────────────────────────────────────────── */
// Разметка задаёт только дорожку со слайдами; стрелки и точки строятся здесь,
// чтобы без JS блок оставался обычной прокручиваемой лентой, а не мёртвыми кнопками.
const icon = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"` +
  ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

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
  const prev = button('prev', 'Предыдущий экран', 'M15 5l-7 7 7 7');
  const next = button('next', 'Следующий экран', 'M9 5l7 7-7 7');
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

  // Именованные слайды («Покупатель» / «Продавец») на узком экране переключаются
  // сегментированным контролом: точки не говорят, что где, а вложить боковую
  // прокрутку ленты внутрь боковой прокрутки ряда экранов нельзя.
  const labels = (root.dataset.tabs || '').split('|').filter(Boolean);
  const narrow = window.matchMedia('(max-width:700px)');
  const tabbed = () => labels.length === slides.length && narrow.matches;
  let tabs = null;
  if (labels.length === slides.length) {
    tabs = document.createElement('div');
    tabs.className = 'carousel__tabs';
    tabs.setAttribute('role', 'tablist');
    labels.forEach((label, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'carousel__tab';
      tab.setAttribute('role', 'tab');
      tab.textContent = label;
      tab.addEventListener('click', () => go(i));
      tabs.append(tab);
    });
    root.append(tabs);
  }

  // выбранный сценарий в режиме переключателя: прокрутки там нет, спросить не у кого
  let tabIndex = 0;

  // текущий слайд — тот, чей центр ближе всего к центру окна просмотра
  const nearest = () => {
    const middle = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestDist = Infinity;
    slides.forEach((s, i) => {
      const dist = Math.abs(s.offsetLeft + s.offsetWidth / 2 - middle);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  };
  const current = () => (tabbed() ? tabIndex : nearest());

  const go = (i) => {
    const n = Math.max(0, Math.min(slides.length - 1, i));
    if (tabbed()) { tabIndex = n; sync(); return; }
    const slide = slides[n];
    const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    track.scrollTo({ left, behavior: 'smooth' });
  };

  // подписи, если они свои у каждого слайда и вынесены под точки
  const caps = root.parentElement && root.parentElement.querySelector('.fig__caps');

  const sync = () => {
    const onTabs = tabbed();
    root.classList.toggle('is-tabbed', onTabs);
    const i = current();
    Array.from(dots.children).forEach((d, n) =>
      d.setAttribute('aria-current', String(n === i)));
    if (tabs) Array.from(tabs.children).forEach((t, n) =>
      t.setAttribute('aria-selected', String(n === i)));
    slides.forEach((s, n) => s.classList.toggle('is-on', n === i));
    if (caps) Array.from(caps.children).forEach((c, n) => c.classList.toggle('is-on', n === i));
    prev.disabled = onTabs ? i === 0 : track.scrollLeft <= 1;
    next.disabled = onTabs
      ? i === slides.length - 1
      : track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
  };

  // при переходе через границу ширины лента должна встать на тот же слайд
  narrow.addEventListener('change', () => {
    if (tabbed()) { tabIndex = nearest(); sync(); }  // лента → переключатель
    else { sync(); go(tabIndex); }                   // переключатель → лента
  });

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
    if (e.pointerType === 'touch' || tabbed()) return;
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
  // отпускание после протяжки не должно засчитаться как клик по ссылке внутри слайда
  track.addEventListener('click', (e) => {
    if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  sync();
};

document.querySelectorAll('[data-carousel]').forEach(setupCarousel);
