const year = document.getElementById("current-year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

const toggle = document.querySelector(".menu-toggle");
const menu = document.getElementById("primary-menu");

if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  menu.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement) {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

const lightTargets = document.querySelectorAll(
  ".section-card, .service-card, .product-card, .promo-grid, .wide-image, .contact-form, .nav-links a, .button"
);

lightTargets.forEach((target) => {
  target.addEventListener("pointerdown", () => {
    target.classList.add("is-lit");
    window.setTimeout(() => target.classList.remove("is-lit"), 650);
  });
});

const navSectionLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));

const setActiveNavLink = (hash) => {
  navSectionLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === hash;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

navSectionLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const hash = link.getAttribute("href");
    if (hash) {
      setActiveNavLink(hash);
    }
  });
});

if (window.location.hash) {
  setActiveNavLink(window.location.hash);
}

const navSections = navSectionLinks
  .map((link) => {
    const hash = link.getAttribute("href");
    return hash ? document.querySelector(hash) : null;
  })
  .filter(Boolean);

if ("IntersectionObserver" in window && navSections.length) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visibleEntry) {
        setActiveNavLink(`#${visibleEntry.target.id}`);
      }
    },
    { rootMargin: "-25% 0px -55% 0px", threshold: [0.12, 0.32, 0.55] }
  );

  navSections.forEach((section) => navObserver.observe(section));
}

// ── Contact form: AJAX submission via Formspree ──────────────────────────────
const contactForm = document.querySelector(".contact-form");

function showToast(message, isError = false) {
  const existing = document.getElementById("bdt-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "bdt-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%) translateY(16px)",
    zIndex: "9999",
    padding: "14px 24px",
    borderRadius: "999px",
    border: isError
      ? "1px solid rgba(255, 100, 100, 0.5)"
      : "1px solid rgba(201, 168, 76, 0.55)",
    background: isError
      ? "rgba(80, 10, 10, 0.92)"
      : "rgba(12, 10, 6, 0.92)",
    color: isError ? "#ffaaaa" : "#f5e9bf",
    fontFamily: "DM Sans, Arial, sans-serif",
    fontSize: "0.82rem",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    boxShadow: isError
      ? "0 8px 32px rgba(0,0,0,0.5), 0 0 18px rgba(180,30,30,0.18)"
      : "0 8px 32px rgba(0,0,0,0.5), 0 0 18px rgba(201,168,76,0.18)",
    backdropFilter: "blur(12px)",
    opacity: "0",
    transition: "opacity 280ms ease, transform 280ms ease",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(8px)";
    setTimeout(() => toast.remove(), 320);
  }, isError ? 5000 : 3500);
}

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitBtn = contactForm.querySelector('[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }

    try {
      const response = await fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        contactForm.reset();
        showToast("✦ Message sent — we'll be in touch", false);
      } else {
        const data = await response.json().catch(() => ({}));
        const msg =
          data.errors && data.errors.length
            ? data.errors.map((e) => e.message).join(", ")
            : "Something went wrong. Please try again.";
        showToast(msg, true);
      }
    } catch {
      showToast("Network error — please check your connection.", true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}
// ─────────────────────────────────────────────────────────────────────────────

const revealItems = Array.from(document.querySelectorAll(".reveal, .reveal-card"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".service-grid, .product-grid").forEach((group) => {
  group.querySelectorAll(".reveal, .reveal-card").forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 210)}ms`);
  });
});

const showAllRevealItems = () => {
  document.documentElement.classList.remove("reveal-enabled");
  revealItems.forEach((item) => {
    item.classList.remove("reveal-pending");
    item.classList.add("is-visible");
  });
};

const enableRevealAnimations = () => {
  if (!revealItems.length || reduceMotion || !("IntersectionObserver" in window)) {
    showAllRevealItems();
    return;
  }

  const queueReveal = (item) => {
    if (item.classList.contains("is-visible")) {
      return;
    }

    item.classList.add("reveal-pending");
    window.requestAnimationFrame(() => item.classList.add("is-visible"));
  };

  const isInInitialRevealRange = (item) => {
    const rect = item.getBoundingClientRect();
    return rect.top < window.innerHeight * 1.08 && rect.bottom > -window.innerHeight * 0.08;
  };

  const initiallyVisibleItems = revealItems.filter(isInInitialRevealRange);
  initiallyVisibleItems.forEach((item) => item.classList.add("reveal-pending"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          queueReveal(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.01, rootMargin: "0px 0px 20% 0px" }
  );

  revealItems.forEach((item) => {
    if (!initiallyVisibleItems.includes(item)) {
      observer.observe(item);
    }
  });

  // The enhancement class is added only after every observer and fallback is ready.
  document.documentElement.classList.add("reveal-enabled");
  window.requestAnimationFrame(() => {
    initiallyVisibleItems.forEach((item) => item.classList.add("is-visible"));
  });
};

try {
  enableRevealAnimations();
} catch {
  showAllRevealItems();
}
