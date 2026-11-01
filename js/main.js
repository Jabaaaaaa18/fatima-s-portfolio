import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SITE } from './config.js';
import { createStudioEnvironment } from './env.js';
import { OBJECT_FACTORIES } from './objects.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => value * value * (3 - 2 * value);

const body = document.body;
const hero = $('#top');
const heroStage = $('.hero-stage');
const passages = $('#passages');
const coreStage = $('#coreStage');
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const isMobile = window.matchMedia('(max-width: 820px)');
const staticMode = motionPreference.matches;

function configureStaticMode() {
  if (!staticMode || !hero || !passages) return;

  body.classList.add('is-static-hero');
  const section = document.createElement('section');
  section.className = 'philosophy';
  section.id = 'philosophy';
  section.setAttribute('aria-labelledby', 'philosophyTitle');
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.id = 'philosophyTitle';
  title.textContent = 'Learning that stays with us.';
  section.append(title, passages);
  passages.classList.add('is-static');
  hero.after(section);
}

function setReady() {
  body.classList.remove('is-loading');
  body.classList.add('is-ready');
}

function fitHeroTitle() {
  const title = $('#heroTitle');
  if (!title) return;

  const lines = $$('.hero-title-line', title);
  if (!lines.length) return;
  const style = getComputedStyle(title);
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;

  const mobile = isMobile.matches;
  const compact = window.matchMedia('(min-width: 821px) and (max-height: 520px)').matches;
  const stacked = mobile || compact;
  const size = mobile
    ? window.innerWidth * 0.2
    : compact
      ? Math.min(window.innerWidth * 0.06, window.innerHeight * 0.1)
      : window.innerWidth * 0.06;
  title.style.fontSize = `${size}px`;
  context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  const letterSpacing = parseFloat(style.letterSpacing) || 0;
  const widths = lines.map((line) => {
    const text = line.textContent.trim().toLocaleUpperCase('en');
    return context.measureText(text).width + letterSpacing * Math.max(0, text.length - 1);
  });
  const available = window.innerWidth * (stacked ? 0.88 : 0.86);
  const gap = stacked ? 0 : parseFloat(style.columnGap) || 0;
  const naturalWidth = stacked
    ? Math.max(...widths)
    : widths.reduce((total, width) => total + width, 0) + gap * (lines.length - 1);
  if (naturalWidth > 0) title.style.fontSize = `${size * Math.min(1, available / naturalWidth)}px`;
}

function initNavigation() {
  const toggle = $('#navToggle');
  const nav = $('#siteNav');
  const links = $$('[data-nav]');
  let lastScrollY = window.scrollY;

  const closeMenu = () => {
    body.classList.remove('nav-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };

  toggle?.addEventListener('click', () => {
    const isOpen = body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const sections = links
    .map((link) => $(link.getAttribute('href')))
    .filter((section) => section instanceof HTMLElement);

  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const activeId = entry.target.id;
        for (const link of links) {
          const active = link.dataset.nav === activeId;
          link.classList.toggle('is-current', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-40% 0px -45% 0px' });
    sections.forEach((section) => navObserver.observe(section));

    const revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('[data-reveal]').forEach((element) => {
      if (staticMode) element.classList.add('is-in');
      else revealObserver.observe(element);
    });
  } else {
    $$('[data-reveal]').forEach((element) => element.classList.add('is-in'));
  }

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const header = $('#siteHeader');
    header?.classList.toggle('is-compact', y > 24);
    header?.classList.toggle('is-hidden', y > 250 && y > lastScrollY && !body.classList.contains('nav-open'));
    if (y < 80) header?.classList.remove('is-hidden');
    lastScrollY = y;
  }, { passive: true });

  window.addEventListener('resize', fitHeroTitle, { passive: true });
  document.fonts?.ready.then(fitHeroTitle);
}

function initGallery() {
  const gallery = $('#gallery');
  if (!gallery) return;

  const tabs = $$('[role="tab"]', gallery);
  const panels = $$('[role="tabpanel"]', gallery);
  const count = $('#galleryCount');
  const dialog = $('#projectDialog');
  const dialogContent = $('#dialogContent');
  let activeIndex = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));

  const select = (index, focusTab = false) => {
    if (!tabs.length || !panels.length) return;
    activeIndex = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const active = i === activeIndex;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i]?.classList.toggle('is-active', active);
      panels[i]?.classList.remove('is-entering');
      if (panels[i]) panels[i].hidden = !active;
    });
    const panel = panels[activeIndex];
    panel?.getBoundingClientRect();
    panel?.classList.add('is-entering');
    if (count) count.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(tabs.length).padStart(2, '0')}`;
    if (focusTab) tabs[activeIndex].focus();
    if (dialog?.open) renderDialog();
  };

  const renderDialog = () => {
    const project = panels[activeIndex];
    if (!project || !dialogContent) return;
    const copy = project.cloneNode(true);
    copy.removeAttribute('role');
    copy.removeAttribute('aria-labelledby');
    copy.removeAttribute('tabindex');
    copy.removeAttribute('hidden');
    copy.classList.remove('is-active', 'is-entering');
    dialogContent.replaceChildren(copy);
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', (event) => {
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next++;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next--;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });

  $('#galleryPrev')?.addEventListener('click', () => select(activeIndex - 1));
  $('#galleryNext')?.addEventListener('click', () => select(activeIndex + 1));
  $('#dialogPrev')?.addEventListener('click', () => select(activeIndex - 1));
  $('#dialogNext')?.addEventListener('click', () => select(activeIndex + 1));
  $('#galleryOpen')?.addEventListener('click', () => {
    if (!dialog || typeof dialog.showModal !== 'function') {
      console.error('Project details are unavailable because this browser does not support dialogs.');
      return;
    }
    renderDialog();
    dialog.showModal();
  });
  $('#dialogClose')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  select(activeIndex);
}

function initAmbientSound() {
  const toggle = $('#soundToggle');
  const label = $('#soundLabel');
  const music = $('#backgroundMusic');
  if (!toggle || !label || !music) return;

  music.volume = 0;
  let enabled = false;
  let starting = false;
  let fadeFrame = 0;
  const removeUnlockListeners = () => {
    document.removeEventListener('pointerdown', onFirstInteraction);
    document.removeEventListener('keydown', onFirstInteraction);
  };

  const updateToggle = (isEnabled, text) => {
    toggle.classList.toggle('is-playing', isEnabled);
    toggle.setAttribute('aria-pressed', String(isEnabled));
    toggle.setAttribute('aria-label', isEnabled ? 'Turn background music off' : 'Enable background music');
    toggle.title = isEnabled ? 'Turn background music off' : 'Enable background music';
    label.textContent = text;
  };

  const fadeVolume = (target, onComplete) => {
    window.cancelAnimationFrame(fadeFrame);
    const startVolume = music.volume;
    const startTime = performance.now();
    const duration = 700;
    const update = (time) => {
      const progress = Math.min(1, (time - startTime) / duration);
      music.volume = startVolume + (target - startVolume) * progress;
      if (progress < 1) fadeFrame = window.requestAnimationFrame(update);
      else {
        fadeFrame = 0;
        onComplete?.();
      }
    };
    fadeFrame = window.requestAnimationFrame(update);
  };

  const start = async (automatic = false) => {
    if (starting || enabled) return;
    starting = true;
    toggle.disabled = true;
    if (!automatic) label.textContent = 'Starting music';

    try {
      await music.play();
      enabled = true;
      removeUnlockListeners();
      updateToggle(true, 'Music on');
      fadeVolume(0.35);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        updateToggle(false, 'Tap for music');
        return;
      }
      console.error('Could not play the background music.', error);
      enabled = false;
      updateToggle(false, 'Music unavailable');
      removeUnlockListeners();
    } finally {
      starting = false;
      toggle.disabled = false;
    }
  };

  const stop = () => {
    enabled = false;
    removeUnlockListeners();
    updateToggle(false, 'Music off');
    fadeVolume(0, () => music.pause());
  };

  const resume = async () => {
    try {
      await music.play();
      if (enabled) fadeVolume(0.35);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        enabled = false;
        updateToggle(false, 'Tap for music');
        return;
      }
      console.error('Could not resume the background music.', error);
      enabled = false;
      updateToggle(false, 'Music unavailable');
    }
  };

  toggle.addEventListener('click', () => {
    if (enabled) stop();
    else void start();
  });

  function onFirstInteraction(event) {
    if (event.target instanceof Element && event.target.closest('#soundToggle')) return;
    void start();
  }

  document.addEventListener('pointerdown', onFirstInteraction);
  document.addEventListener('keydown', onFirstInteraction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause();
    else if (enabled) void resume();
  });

  music.addEventListener('error', () => {
    console.error('Could not load the background music.', music.error);
    enabled = false;
    updateToggle(false, 'Music unavailable');
    removeUnlockListeners();
  });

  void start(true);
}

function validEmail(value) {
  return typeof value === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    && !/your\.email|example\.com/i.test(value);
}

function validProfile(value, service) {
  try {
    const url = new URL(value);
    const hostMatches = url.hostname === service || url.hostname.endsWith(`.${service}`);
    return url.protocol === 'https:' && hostMatches && !/your-profile/i.test(url.pathname);
  } catch {
    return false;
  }
}

function initContact() {
  const configuredEmail = validEmail(SITE.email);
  $$('[data-link="email"]').forEach((link) => {
    if (configuredEmail) {
      link.href = `mailto:${SITE.email}`;
      const text = $('[data-text="email"]', link);
      if (text) text.textContent = SITE.email;
    } else if (link.closest('.footer-links')) {
      link.closest('li')?.remove();
    } else {
      link.href = '#contact';
    }
  });

  const profiles = [
    { key: 'linkedin', domain: 'linkedin.com' },
    { key: 'facebook', domain: 'facebook.com' },
  ];
  for (const { key, domain } of profiles) {
    const configured = validProfile(SITE[key], domain);
    $$(`[data-link="${key}"]`).forEach((link) => {
      if (configured) {
        link.href = SITE[key];
      } else {
        link.closest('li')?.remove();
      }
    });
  }

  const resumeLink = $('[data-link="resume"]');
  if (resumeLink && SITE.resume) {
    fetch(SITE.resume, { method: 'HEAD' })
      .then((response) => {
        if (!response.ok) resumeLink.remove();
        else resumeLink.href = SITE.resume;
      })
      .catch((error) => {
        console.warn('Could not verify the resume file; hiding its download link.', error);
        resumeLink.remove();
      });
  } else {
    resumeLink?.remove();
  }

  const form = $('#contactForm');
  if (!form) return;
  const note = $('#formNote');
  const fields = $$('input, textarea', form);

  fields.forEach((field) => {
    field.addEventListener('input', () => {
      field.removeAttribute('aria-invalid');
      field.setCustomValidity('');
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      const invalid = fields.find((field) => !field.validity.valid);
      invalid?.setAttribute('aria-invalid', 'true');
      note.textContent = 'Please complete each field with a valid email address.';
      invalid?.focus();
      return;
    }

    if (!configuredEmail) {
      note.textContent = 'Please add your email address in js/config.js before using this form.';
      return;
    }

    const values = new FormData(form);
    const subject = encodeURIComponent(SITE.mailSubject || 'Hello from your teaching portfolio');
    const message = encodeURIComponent(
      `Name: ${values.get('name')}\nEmail: ${values.get('email')}\n\n${values.get('message')}`,
    );
    note.textContent = `Your email app should open addressed to ${SITE.email}. Review your message there, then press Send.`;
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${message}`;
  });
}

function initImageFallbacks() {
  $$('img').forEach((image) => {
    const markMissing = () => {
      image.classList.add('is-missing');
      image.closest('.passage-visual')?.classList.remove('has-image');
    };
    image.addEventListener('error', markMissing, { once: true });
    if (image.complete) {
      if (image.naturalWidth) image.closest('.passage-visual')?.classList.add('has-image');
      else markMissing();
    } else {
      image.addEventListener('load', () => image.closest('.passage-visual')?.classList.add('has-image'), { once: true });
    }
  });
}

function createRenderer(canvas) {
  if (!canvas || !window.WebGLRenderingContext) return null;
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    return renderer;
  } catch (error) {
    console.warn('WebGL is unavailable; the portfolio will use its static layout.', error);
    return null;
  }
}

function initThreeScenes() {
  if (staticMode) return null;

  const heroCanvas = $('#heroCanvas');
  const coreCanvas = $('#coreCanvas');
  const heroRenderer = createRenderer(heroCanvas);
  const coreRenderer = createRenderer(coreCanvas);
  if (!heroRenderer || !coreRenderer) {
    heroRenderer?.dispose();
    coreRenderer?.dispose();
    return null;
  }

  const heroScene = new THREE.Scene();
  const heroCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  heroCamera.position.set(0, 0, 5.2);
  heroScene.add(new THREE.HemisphereLight('#ffe3ef', '#260b1e', 2.2));
  const heroKey = new THREE.DirectionalLight('#ffdce8', 3.2);
  heroKey.position.set(-2.5, 4, 4);
  heroScene.add(heroKey);

  const coreScene = new THREE.Scene();
  const coreCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  coreCamera.position.set(0, 0.15, 6.6);
  coreScene.add(new THREE.HemisphereLight('#ffe3ef', '#260b1e', 2.4));
  const coreKey = new THREE.DirectionalLight('#ffe6ee', 3.8);
  coreKey.position.set(3, 5, 4);
  coreScene.add(coreKey);

  try {
    heroScene.environment = createStudioEnvironment(heroRenderer);
    coreScene.environment = createStudioEnvironment(coreRenderer);
  } catch (error) {
    heroRenderer.dispose();
    coreRenderer.dispose();
    console.warn('The 3D environment could not be initialized; using the static layout.', error);
    return null;
  }

  const objects = new Map();
  for (const [name, factory] of Object.entries(OBJECT_FACTORIES)) {
    const object = factory();
    object.visible = false;
    heroScene.add(object);
    objects.set(name, object);
  }

  let coreModel = null;
  const loader = new GLTFLoader();
  loader.load(
    'assets/models/knowledge-core.glb',
    (gltf) => {
      coreModel = gltf.scene;
      coreModel.scale.setScalar(0.92);
      coreModel.traverse((object) => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.transparent = true;
          material.userData.baseOpacity = material.opacity;
        }
      });
      coreScene.add(coreModel);
    },
    undefined,
    (error) => console.error('Could not load the Knowledge Core model.', error),
  );

  const resize = () => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    for (const [renderer, camera] of [[heroRenderer, heroCamera], [coreRenderer, coreCamera]]) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  return {
    heroRenderer,
    heroScene,
    heroCamera,
    coreRenderer,
    coreScene,
    coreCamera,
    objects,
    get coreModel() { return coreModel; },
  };
}

function initHeroVideo() {
  if (staticMode) return;
  const video = $('#heroVideo');
  if (!video || !SITE.hero?.video) return;

  const source = isMobile.matches && SITE.hero.videoMobile ? SITE.hero.videoMobile : SITE.hero.video;
  fetch(source, { method: 'HEAD' })
    .then((response) => {
      if (!response.ok) return;
      video.src = source;
      video.load();
      video.addEventListener('loadedmetadata', () => {
        hero.classList.add('has-video');
        video.pause();
        const cutout = $('#heroFrameCutout');
        if (SITE.hero.firstFrameCutout && cutout) {
          cutout.src = SITE.hero.firstFrameCutout;
          cutout.addEventListener('load', () => { cutout.hidden = false; }, { once: true });
        }
      }, { once: true });
    })
    .catch((error) => {
      console.warn('Could not check the optional hero video; using the portrait fallback.', error);
    });
}

function initMotion(scenes) {
  const passageElements = $$('.passage');
  const windows = SITE.hero?.passageWindows || passageElements.map((_, index) => {
    const start = 0.12 + index * 0.2;
    return [start, start + 0.16];
  });
  const heroTitle = $('#heroTitle');
  const heroIntro = $('#heroIntro');
  const heroSubject = $('#heroSubject');
  const scrollCue = $('#scrollCue');
  const sections = $$('.journey .section');
  const video = $('#heroVideo');
  const staticHero = staticMode || body.classList.contains('is-static-hero');
  if (staticHero) return;

  let progress = 0;
  let targetProgress = 0;
  let coreOpacity = 0;
  let targetCoreOpacity = 0;
  let targetCoreX = 0;
  let lastFrameTime = 0;
  let scrollQueued = false;
  let renderFrame = 0;
  let activeSection = null;
  let heroIsVisible = true;

  const setObjectOpacity = (object, opacity) => {
    if (!object) return;
    object.visible = opacity > 0.005;
    for (const material of object.userData.materials || []) {
      material.opacity = (material.userData.baseOpacity ?? 1) * opacity;
    }
  };

  const readScroll = () => {
    scrollQueued = false;
    if (!hero || staticHero) return;
    const range = Math.max(1, hero.offsetHeight - window.innerHeight);
    targetProgress = clamp((window.scrollY - hero.offsetTop) / range);
    updateCoreTarget();
    scheduleRender();
  };

  const updateVisuals = () => {
    const introOpacity = 1 - smoothstep(clamp((progress - 0.025) / 0.12));
    if (heroIntro) {
      heroIntro.style.opacity = String(introOpacity);
      heroIntro.style.transform = `translateY(${(1 - introOpacity) * 18}px)`;
    }
    if (heroTitle) {
      const titleOpacity = 1 - smoothstep(clamp((progress - 0.015) / 0.11));
      heroTitle.style.opacity = String(titleOpacity);
      heroTitle.style.transform = `translateY(${progress * -24}px) scale(${1 - progress * 0.035})`;
    }
    if (heroSubject) {
      const opacity = 1 - smoothstep(clamp((progress - 0.08) / 0.14));
      heroSubject.style.opacity = String(opacity);
      heroSubject.style.transform = `translateY(${progress * 24}px) scale(${1 - progress * 0.025})`;
    }
    if (scrollCue) scrollCue.style.opacity = String(1 - smoothstep(clamp(progress / 0.09)));

    passageElements.forEach((passage, index) => {
      const [windowStart, windowEnd] = windows[index] || [0, 0];
      const previousGap = index > 0
        ? Math.max(0, windowStart - windows[index - 1][1])
        : 0;
      const nextGap = index < windows.length - 1
        ? Math.max(0, windows[index + 1][0] - windowEnd)
        : 0;
      const start = clamp(windowStart - previousGap * 0.75);
      const end = clamp(windowEnd + nextGap * 0.75);
      const fade = Math.min(0.055, Math.max(0.001, (end - start) * 0.28));
      const opacity = Math.min(
        smoothstep(clamp((progress - start) / fade)),
        smoothstep(clamp((end - progress) / fade)),
      );
      const copy = $('.passage-copy', passage);
      const visual = $('.passage-visual', passage);
      if (copy) {
        copy.style.opacity = String(opacity);
        copy.style.transform = `translateY(${(1 - opacity) * 12}px)`;
      }
      if (visual) visual.style.setProperty('--o', String(opacity));

      const object = scenes?.objects.get(passage.dataset.object);
      if (object) {
        setObjectOpacity(object, opacity);
        object.position.x = isMobile.matches ? 0 : (passage.dataset.side === 'right' ? 1.35 : -1.35);
        object.position.y = isMobile.matches ? 1.05 : 0.55;
        object.position.z = 0;
        object.scale.setScalar((isMobile.matches ? 0.8 : 1) * (0.82 + smoothstep(opacity) * 0.18));
      }
    });

    if (video?.readyState >= HTMLMediaElement.HAVE_METADATA
      && !video.seeking
      && Number.isFinite(video.duration)) {
      const time = progress * video.duration;
      if (Math.abs(video.currentTime - time) > 0.12) video.currentTime = time;
    }
  };

  function updateCoreTarget() {
    if (!scenes || !coreStage) return;
    const viewportCenter = window.innerHeight / 2;
    let closest = null;
    let closestDistance = Infinity;
    for (const section of sections) {
      const rect = section.getBoundingClientRect();
      const distance = rect.top <= viewportCenter && rect.bottom >= viewportCenter
        ? 0
        : Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter));
      if (distance < closestDistance) {
        closest = section;
        closestDistance = distance;
      }
    }

    const inJourney = closest && closestDistance < window.innerHeight * 0.75;
    targetCoreOpacity = inJourney
      ? 0.76 * (1 - smoothstep(clamp(closestDistance / (window.innerHeight * 0.75))))
      : 0;
    coreStage.classList.toggle('is-visible', Boolean(inJourney) || coreOpacity > 0.005);
    if (inJourney && closest !== activeSection) {
      activeSection = closest;
      const oppositeSide = closest.dataset.side === 'left' ? 1 : -1;
      targetCoreX = isMobile.matches ? 0 : oppositeSide * 1.45;
    }
  }

  const render = (time) => {
    renderFrame = 0;
    const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 1 / 60;
    lastFrameTime = time;
    const progressEase = 1 - Math.exp(-delta / 0.11);
    const coreEase = 1 - Math.exp(-delta / 0.2);
    progress += (targetProgress - progress) * progressEase;
    coreOpacity += (targetCoreOpacity - coreOpacity) * coreEase;
    if (Math.abs(targetProgress - progress) < 0.00005) progress = targetProgress;
    if (Math.abs(targetCoreOpacity - coreOpacity) < 0.001) coreOpacity = targetCoreOpacity;

    updateVisuals();

    if (scenes?.coreModel) {
      scenes.coreModel.position.x += (targetCoreX - scenes.coreModel.position.x) * coreEase;
    }
    if (scenes) {
      scenes.coreCamera.position.x += ((isMobile.matches ? 0 : targetCoreX * 0.08) - scenes.coreCamera.position.x) * coreEase;
      scenes.coreCamera.lookAt(0, 0, 0);
    }
    if (coreStage) {
      coreStage.style.opacity = String(coreOpacity);
      if (coreOpacity <= 0.001 && targetCoreOpacity === 0) coreStage.classList.remove('is-visible');
    }

    if (document.visibilityState === 'visible' && scenes) {
      heroIsVisible = hero.getBoundingClientRect().bottom > 0 && hero.getBoundingClientRect().top < window.innerHeight;
      if (heroIsVisible) {
        for (const [index, object] of [...scenes.objects.values()].entries()) {
          object.rotation.y = Math.sin(time * 0.00018 + index * 0.7) * 0.16 + time * 0.00007;
          object.rotation.x = Math.sin(time * 0.00012 + index) * 0.08;
        }
        scenes.heroRenderer.render(scenes.heroScene, scenes.heroCamera);
      }
      if (coreStage?.classList.contains('is-visible')) {
        if (scenes.coreModel) {
          scenes.coreModel.rotation.y = Math.sin(time * 0.00012) * 0.12;
          scenes.coreModel.rotation.x = Math.sin(time * 0.00009) * 0.035;
        }
        scenes.coreRenderer.render(scenes.coreScene, scenes.coreCamera);
      }
    }

    const isSettling = Math.abs(targetProgress - progress) > 0.00005
      || Math.abs(targetCoreOpacity - coreOpacity) > 0.001
      || (scenes?.coreModel && Math.abs(targetCoreX - scenes.coreModel.position.x) > 0.005);
    const shouldSpin = scenes
      && document.visibilityState === 'visible'
      && (heroIsVisible || coreOpacity > 0.001 || targetCoreOpacity > 0.001);
    if (isSettling || shouldSpin) scheduleRender();
  };

  function scheduleRender() {
    if (!renderFrame) renderFrame = requestAnimationFrame(render);
  }

  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(readScroll);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  video?.addEventListener('seeked', scheduleRender);
  document.addEventListener('visibilitychange', scheduleRender);
  readScroll();
  scheduleRender();
}

function init() {
  configureStaticMode();
  fitHeroTitle();
  initNavigation();
  initGallery();
  initAmbientSound();
  initContact();
  initImageFallbacks();

  const scenes = initThreeScenes();
  if (!staticMode && !scenes) {
    body.classList.add('is-static-hero');
    passages?.classList.add('is-static');
    const section = document.createElement('section');
    section.className = 'philosophy';
    section.setAttribute('aria-labelledby', 'philosophyTitle');
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.id = 'philosophyTitle';
    title.textContent = 'Learning that stays with us.';
    section.append(title);
    if (hero && passages) {
      hero.after(section);
      section.append(passages);
    }
    coreStage?.remove();
  }

  initHeroVideo();
  initMotion(scenes);
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
  setReady();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
