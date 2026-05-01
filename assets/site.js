document.documentElement.classList.add("js");

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
  ".section-card, .mini-card, .service-card, .product-card, .promo-grid, .wide-image, .contact-form, .nav-links a, .button"
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

const revealItems = Array.from(document.querySelectorAll(".reveal, .reveal-card"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".crew-grid, .service-grid, .product-grid").forEach((group) => {
  group.querySelectorAll(".reveal, .reveal-card").forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 210)}ms`);
  });
});

if ("IntersectionObserver" in window && !reduceMotion) {
  const revealElement = (item) => {
    item.classList.add("is-visible");
  };

  const isInRevealRange = (item) => {
    const rect = item.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.92 && rect.bottom > window.innerHeight * 0.08;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
  );

  const revealVisibleItems = () => {
    revealItems.forEach((item) => {
      if (!item.classList.contains("is-visible") && isInRevealRange(item)) {
        revealElement(item);
        observer.unobserve(item);
      }
    });
  };

  revealItems.forEach((item) => {
    if (isInRevealRange(item)) {
      revealElement(item);
    } else {
      observer.observe(item);
    }
  });

  let revealTicking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (revealTicking) {
        return;
      }

      revealTicking = true;
      window.requestAnimationFrame(() => {
        revealVisibleItems();
        revealTicking = false;
      });
    },
    { passive: true }
  );
  window.addEventListener("load", revealVisibleItems, { once: true });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
