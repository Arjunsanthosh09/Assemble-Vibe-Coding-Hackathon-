const memberCount = document.getElementById("total-members");

function updateMemberForms() {
  if (!memberCount) return;

  const total = Number(memberCount.value);

  document.querySelectorAll("[data-member]").forEach((section) => {
    const memberNumber = Number(section.dataset.member);
    const visible = memberNumber <= total;

    section.hidden = !visible;
    section.querySelectorAll("[data-required]").forEach((field) => {
      field.required = visible;
    });
  });
}

memberCount?.addEventListener("change", updateMemberForms);
updateMemberForms();

const qrImage = document.getElementById("payment-qr");
const qrMissing = document.getElementById("qr-missing");

qrImage?.addEventListener("error", () => {
  qrImage.hidden = true;
  if (qrMissing) qrMissing.hidden = false;
});

const screenshotInput = document.getElementById("payment-screenshot");
const screenshotPreview = document.getElementById("screenshot-preview");
const uploadCopy = document.getElementById("upload-copy");
const fileError = document.getElementById("file-error");
const maximumFileSize = 2 * 1024 * 1024;
const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

screenshotInput?.addEventListener("change", () => {
  const file = screenshotInput.files[0];
  if (!file) return;

  fileError.textContent = "";

  if (!allowedTypes.includes(file.type)) {
    fileError.textContent = "Choose a PNG, JPG, JPEG or WebP image.";
    screenshotInput.value = "";
    return;
  }

  if (file.size > maximumFileSize) {
    fileError.textContent = "The screenshot must be 2 MB or smaller.";
    screenshotInput.value = "";
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  screenshotPreview.src = previewUrl;
  screenshotPreview.hidden = false;
  uploadCopy.hidden = true;

  screenshotPreview.onload = () => URL.revokeObjectURL(previewUrl);
});

const transactionInput = document.getElementById("transaction-id");
transactionInput?.addEventListener("input", () => {
  transactionInput.value = transactionInput.value.toUpperCase().replace(/\s/g, "");
});
