const searchInput = document.getElementById("event-search");
const filterButtons = [...document.querySelectorAll("[data-category]")];
const cards = [...document.querySelectorAll(".event-card")];
const resultCount = document.getElementById("event-result-count");
const noEvents = document.getElementById("no-events");
let selectedCategory = "all";

function filterEvents() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;

  cards.forEach((card) => {
    const matchesText = card.dataset.name.includes(query);
    const matchesCategory = selectedCategory === "all" || card.dataset.category === selectedCategory;
    const show = matchesText && matchesCategory;
    card.hidden = !show;
    if (show) visible += 1;
  });

  resultCount.textContent = `${visible} event${visible === 1 ? "" : "s"} available`;
  noEvents.hidden = visible !== 0;
}

searchInput.addEventListener("input", filterEvents);
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    filterEvents();
  });
});

const events = JSON.parse(document.getElementById("event-data").textContent);
const dialog = document.getElementById("event-dialog");

document.querySelectorAll(".event-details-button").forEach((button) => {
  button.addEventListener("click", () => {
    const event = events[Number(button.dataset.eventIndex)];
    document.getElementById("dialog-category").textContent = `${event.category} / Event ${event.number}`;
    document.getElementById("dialog-name").textContent = event.name;
    document.getElementById("dialog-type").textContent = event.type;
    document.getElementById("dialog-tagline").textContent = `“${event.tagline}”`;
    document.getElementById("dialog-time").textContent = event.time;
    document.getElementById("dialog-fee").textContent = `₹${event.fee}`;
    document.getElementById("dialog-prize").textContent = `₹${event.prize.toLocaleString("en-IN")}`;
    dialog.showModal();
  });
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
