/* ================================================
   SK CARS — main.js  (API-connected frontend)
   ================================================ */

const API = 'https://sk-cars.onrender.com/api';

/* ─── STATE ─────────────────────────────────────── */
let allCars      = [];
let currentMin   = 0;
let currentMax   = 9999999;
let searchTimer  = null;
const galleryIdx = {};

/* ─── FETCH CARS FROM API ────────────────────────── */
async function loadCars() {
  try {
    const res  = await fetch(`${API}/cars`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    allCars = json.data;

    // Update stock count in stats bar
    const countEl = document.getElementById('stockCount');
    if (countEl) countEl.textContent = allCars.length + '+';

    renderCars(allCars);
  } catch (err) {
    document.getElementById('carsGrid').innerHTML =
      `<p class="error-state"><i class="fas fa-exclamation-circle"></i> Could not load cars. Make sure the server is running.<br><small>${err.message}</small></p>`;
  }
}

/* ─── RENDER CARS ────────────────────────────────── */
function renderCars(list) {
  const grid = document.getElementById('carsGrid');
  grid.innerHTML = '';

  if (!list.length) {
    grid.innerHTML = '<p class="empty-state"><i class="fas fa-car"></i><br>No cars found for this filter.</p>';
    return;
  }

  list.forEach(c => {
    const images    = c.images && c.images.length ? c.images : [{ url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600', id: 0 }];
    const primaryImg = images[0].url;

    const card = document.createElement('div');
    card.className         = 'car-card reveal';
    card.dataset.carId     = c.id;
    card.dataset.price     = c.price;
    card.dataset.name      = (c.name || '').toLowerCase();
    card.dataset.fuel      = (c.fuel || '').toLowerCase();

    card.innerHTML = `
      <div class="car-img-wrap">
        <img src="${primaryImg}" alt="${c.name}" id="carimg-${c.id}" loading="lazy" style="cursor:pointer" onclick="openLightbox('${primaryImg}')"/>
        <div class="car-gallery-nav">
          <button class="gal-btn" onclick="prevImg(${c.id}, event, ${JSON.stringify(images).replace(/"/g, '&quot;')})"><i class="fas fa-chevron-left"></i></button>
          <button class="gal-btn" onclick="nextImg(${c.id}, event, ${JSON.stringify(images).replace(/"/g, '&quot;')})"><i class="fas fa-chevron-right"></i></button>
        </div>
        ${c.badge ? `<div class="car-badge">${c.badge}</div>` : ''}
        <div class="review-badge"><i class="fas fa-star"></i> ${c.rating || 4.5} (${c.reviews || 0} reviews)</div>
      </div>
      <div class="car-info">
        <div class="car-name">${c.name}</div>
        <div class="car-price">₹${Number(c.price).toLocaleString('en-IN')}</div>
        <div class="car-meta">
          <span><i class="fas fa-calendar"></i>${c.year}</span>
          <span><i class="fas fa-tachometer-alt"></i>${c.km} km</span>
          <span><i class="fas fa-gas-pump"></i>${c.fuel}</span>
          <span><i class="fas fa-road"></i>${c.mileage}</span>
        </div>
        <p class="car-desc">${c.description || ''}</p>
        <button class="book-btn" onclick="openModal(${c.id}, '${c.name.replace(/'/g, "\\'")}')">Book Now</button>
      </div>`;

    grid.appendChild(card);
  });

  observeReveal();
}

/* ─── GALLERY NAVIGATION ─────────────────────────── */
function nextImg(id, e, images) {
  e.stopPropagation();
  galleryIdx[id] = ((galleryIdx[id] || 0) + 1) % images.length;
  const img = document.getElementById('carimg-' + id);
  img.src   = images[galleryIdx[id]].url;
  img.onclick = () => openLightbox(images[galleryIdx[id]].url);
}

function prevImg(id, e, images) {
  e.stopPropagation();
  galleryIdx[id] = ((galleryIdx[id] || 0) - 1 + images.length) % images.length;
  const img = document.getElementById('carimg-' + id);
  img.src   = images[galleryIdx[id]].url;
  img.onclick = () => openLightbox(images[galleryIdx[id]].url);
}

/* ─── LIGHTBOX ───────────────────────────────────── */
function openLightbox(src) {
  document.getElementById('lbImg').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

/* ─── BUDGET FILTER ──────────────────────────────── */
function filterBudget(btn) {
  document.querySelectorAll('.budget-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMin = +btn.dataset.min;
  currentMax = +btn.dataset.max;
  applyFilter();
  document.getElementById('cars').scrollIntoView({ behavior: 'smooth' });
}

function handleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilter, 300);
}

function applyFilter() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const filtered = allCars.filter(c => {
    const inBudget = c.price >= currentMin && c.price <= currentMax;
    const inSearch = !q || c.name.toLowerCase().includes(q) ||
                     (c.fuel || '').toLowerCase().includes(q) ||
                     (c.description || '').toLowerCase().includes(q);
    return inBudget && inSearch;
  });
  renderCars(filtered);
}

/* ─── BOOKING MODAL ──────────────────────────────── */
function openModal(carId, carName) {
  document.getElementById('bkCarId').value      = carId;
  document.getElementById('modalCarName').textContent = 'Booking: ' + carName;
  document.getElementById('modalForm').style.display  = 'block';
  document.getElementById('successMsg').style.display = 'none';
  document.getElementById('bookError').style.display  = 'none';
  ['bkName','bkPhone','bkCity','bkNote'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('bookModal').classList.add('open');
}

function closeModal() {
  document.getElementById('bookModal').classList.remove('open');
}

async function submitBooking() {
  const car_id   = document.getElementById('bkCarId').value;
  const car_name = document.getElementById('modalCarName').textContent.replace('Booking: ', '');
  const name     = document.getElementById('bkName').value.trim();
  const phone    = document.getElementById('bkPhone').value.trim();
  const city     = document.getElementById('bkCity').value.trim();
  const note     = document.getElementById('bkNote').value.trim();
  const errEl    = document.getElementById('bookError');

  if (!name || !phone || !city) {
    errEl.textContent = 'Please fill in all required fields.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.querySelector('#modalForm .btn-primary');
  btn.textContent = 'Submitting…';
  btn.disabled    = true;

  try {
    const res  = await fetch(`${API}/bookings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ car_id, car_name, name, phone, city, note })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    document.getElementById('modalForm').style.display  = 'none';
    document.getElementById('successMsg').style.display = 'block';
  } catch (err) {
    errEl.textContent   = err.message || 'Something went wrong. Try again.';
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Confirm Booking';
    btn.disabled    = false;
  }
}

/* ─── HERO SLIDER ────────────────────────────────── */
let currentSlide  = 0;
let autoPlayTimer = null;
let isAnimating   = false;

const sliderWrapper = document.getElementById('slider');
const slides        = document.querySelectorAll('.slide');
const totalSlides   = slides.length;

function initSlider() {
  sliderWrapper.style.position = 'relative';
  sliderWrapper.style.width    = '100%';
  sliderWrapper.style.height   = '100%';
  sliderWrapper.style.overflow = 'hidden';
  sliderWrapper.style.display  = 'block';
  sliderWrapper.style.transform = 'none';

  slides.forEach((slide, i) => {
    slide.style.position   = 'absolute';
    slide.style.top        = '0';
    slide.style.left       = '0';
    slide.style.width      = '100%';
    slide.style.height     = '100%';
    slide.style.minWidth   = 'unset';
    slide.style.flexShrink = 'unset';
    slide.style.transition = 'transform 0.85s cubic-bezier(0.77,0,0.18,1), opacity 0.4s ease';
    slide.style.transform  = i === 0 ? 'translateX(0%)' : 'translateX(100%)';
    slide.style.opacity    = i === 0 ? '1' : '0';
    slide.style.zIndex     = i === 0 ? '2' : '1';
  });
  slides[0].classList.add('active');
}

function goSlide(n) {
  if (isAnimating) return;
  isAnimating = true;

  const prev = currentSlide;
  const dots  = document.querySelectorAll('.hero-dot');
  slides[prev].classList.remove('active');
  if (dots[prev]) dots[prev].classList.remove('active');

  // figure out direction
  let direction = 1;
  if (n < prev && !(prev === totalSlides - 1 && n === 0)) direction = -1;
  if (prev === totalSlides - 1 && n === 0) direction = 1;
  if (prev === 0 && n === totalSlides - 1) direction = -1;

  currentSlide = ((n % totalSlides) + totalSlides) % totalSlides;

  // place incoming slide off screen
  slides[currentSlide].style.zIndex    = '3';
  slides[currentSlide].style.opacity   = '1';
  slides[currentSlide].style.transition = 'none';
  slides[currentSlide].style.transform  = direction > 0 ? 'translateX(100%)' : 'translateX(-100%)';

  // force reflow
  void slides[currentSlide].getBoundingClientRect();

  // animate both slides
  slides[currentSlide].style.transition = 'transform 0.85s cubic-bezier(0.77,0,0.18,1)';
  slides[prev].style.transition          = 'transform 0.85s cubic-bezier(0.77,0,0.18,1), opacity 0.4s ease';

  requestAnimationFrame(() => {
    slides[currentSlide].style.transform = 'translateX(0%)';
    slides[prev].style.transform         = direction > 0 ? 'translateX(-100%)' : 'translateX(100%)';
    slides[prev].style.opacity           = '0';
    slides[prev].style.zIndex            = '1';
  });

  slides[currentSlide].classList.add('active');
  if (dots[currentSlide]) dots[currentSlide].classList.add('active');

  setTimeout(() => { isAnimating = false; }, 900);
}

function buildDots() {
  const container = document.getElementById('heroDots');
  container.innerHTML = '';
  slides.forEach((_, i) => {
    const d     = document.createElement('div');
    d.className = 'hero-dot' + (i === 0 ? ' active' : '');
    d.onclick   = () => { stopAutoPlay(); goSlide(i); startAutoPlay(); };
    container.appendChild(d);
  });
}

function startAutoPlay() {
  stopAutoPlay();
  autoPlayTimer = setInterval(() => goSlide(currentSlide + 1), 4000);
}
function stopAutoPlay() {
  if (autoPlayTimer) { clearInterval(autoPlayTimer); autoPlayTimer = null; }
}

/* swipe support */
let touchStartX = 0;
const heroEl = document.getElementById('hero');
heroEl.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
heroEl.addEventListener('touchend',   e => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) goSlide(diff > 0 ? currentSlide + 1 : currentSlide - 1);
});
heroEl.addEventListener('mouseenter', stopAutoPlay);
heroEl.addEventListener('mouseleave', startAutoPlay);

initSlider();
buildDots();
startAutoPlay();

/* ─── NAVBAR ─────────────────────────────────────── */
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', scrollY > 60);
});

/* ─── MOBILE MENU ────────────────────────────────── */
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

/* ─── BOTTOM NAV ─────────────────────────────────── */
document.querySelectorAll('.bnav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.bnav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});

/* ─── SMOOTH SCROLL ──────────────────────────────── */
function smoothScroll(sel) {
  document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth' });
}

/* ─── CONTACT FORM ───────────────────────────────── */
function submitContact(e) {
  e.preventDefault();
  alert('✅ Thank you! We\'ll get back to you shortly.');
  e.target.reset();
}

/* ─── SCROLL REVEAL ──────────────────────────────── */
function observeReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal,.reveal-l,.reveal-r').forEach(el => io.observe(el));
}

/* ─── MODAL / LIGHTBOX CLOSE ON OVERLAY ─────────── */
document.getElementById('bookModal').addEventListener('click', e => { if (e.target.id === 'bookModal') closeModal(); });
document.getElementById('lightbox').addEventListener('click',  e => { if (e.target.id === 'lightbox')  closeLightbox(); });

/* ─── INIT ───────────────────────────────────────── */
observeReveal();
loadCars();