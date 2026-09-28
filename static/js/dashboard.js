const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".dash-links");
const toast = document.querySelector(".coming-toast");
let toastTimer;

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".coming-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    clearTimeout(toastTimer);
    toast?.classList.add("show");
    toastTimer = setTimeout(() => toast?.classList.remove("show"), 2400);
  });
});

const notificationToggle = document.getElementById("notification-toggle");
const notificationDrawer = document.getElementById("notification-drawer");

function setNotificationDrawer(open) {
  if (!notificationDrawer || !notificationToggle) return;
  notificationDrawer.hidden = !open;
  notificationToggle.setAttribute("aria-expanded", String(open));
}

notificationToggle?.addEventListener("click", (event) => {
  event.stopPropagation();
  setNotificationDrawer(notificationDrawer.hidden);
});

notificationDrawer?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => setNotificationDrawer(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNotificationDrawer(false);
});

function restorePageScrolling() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.classList.remove("menu-open", "nav-open", "no-scroll");
}

window.addEventListener("pageshow", restorePageScrolling);

window.addEventListener("load", function () {
  restorePageScrolling();
});