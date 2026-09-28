document.querySelectorAll(".expand-button").forEach((button) => {
  button.addEventListener("click", () => {
    const details = document.getElementById(button.getAttribute("aria-controls"));
    const willOpen = details.hidden;
    details.hidden = !willOpen;
    button.classList.toggle("open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
  });
});

const rejectDialog = document.getElementById("reject-dialog");
const rejectForm = document.getElementById("reject-form");
const rejectTitle = document.getElementById("reject-title");

document.querySelectorAll(".reject-button").forEach((button) => {
  button.addEventListener("click", () => {
    rejectForm.action = button.dataset.rejectUrl;
    rejectTitle.textContent = `Reject payment for ${button.dataset.team}?`;
    rejectDialog.showModal();
  });
});

function closeRejectDialog() {
  rejectDialog.close();
  rejectForm.reset();
}

document.querySelector(".dialog-close")?.addEventListener("click", closeRejectDialog);
document.querySelector(".cancel-reject")?.addEventListener("click", closeRejectDialog);

rejectDialog?.addEventListener("click", (event) => {
  if (event.target === rejectDialog) closeRejectDialog();
});
