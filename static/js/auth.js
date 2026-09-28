/* ============================================================
   ASSEMBLE — auth pages (login.html / register.html)
   Depends on helpers from js/main.js:
     initImageSlots, validateField, showToast, generateCodename
   ============================================================ */

/* ---- shared helpers ---- */
function fieldTest(el, fn) {
  return validateField(el, fn);
}

/* ============================================================
   LOGIN PAGE
   ============================================================ */
function initLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return; // not on this page

  initImageSlots();

  const emailField = document.getElementById('f-email');
  const passField = document.getElementById('f-password');
  const emailInput = document.getElementById('email');
  const passInput = document.getElementById('password');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailOk = fieldTest(emailField, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value));
    const passOk = fieldTest(passField, passInput.value.length >= 6);

    if (emailOk && passOk) {
      showToast('Access Granted', `Welcome back, ${emailInput.value.split('@')[0]}. Redirecting to squad hub...`);
      form.reset();
    } else {
      showToast('Access Denied', 'Check the highlighted fields and try again.');
    }
  });

  const forgot = document.getElementById('forgot-link');
  if (forgot) {
    forgot.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('No Backend Wired Up', "This is a static demo — password reset isn't connected to anything yet.");
    });
  }
}

/* ============================================================
   REGISTER PAGE
   ============================================================ */
function initRegisterPage() {
  const form = document.getElementById('register-form');
  if (!form) return; // not on this page

  initImageSlots();

  const resultBox = document.getElementById('reg-result');
  const resultCodename = document.getElementById('result-codename');
  const resultId = document.getElementById('result-id');

  const fields = {
    teamname: { el: document.getElementById('f-teamname'), input: document.getElementById('teamname'), test: v => v.trim().length > 1 },
    leader: { el: document.getElementById('f-leader'), input: document.getElementById('leader'), test: v => v.trim().length > 1 },
    size: { el: document.getElementById('f-size'), input: document.getElementById('size'), test: v => v !== '' },
    email: { el: document.getElementById('f-email'), input: document.getElementById('email'), test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    phone: { el: document.getElementById('f-phone'), input: document.getElementById('phone'), test: v => /^\d{10}$/.test(v.replace(/\D/g, '')) },
    college: { el: document.getElementById('f-college'), input: document.getElementById('college'), test: v => v.trim().length > 1 },
    domain: { el: document.getElementById('f-domain'), input: document.getElementById('domain'), test: v => v !== '' },
    mode: { el: document.getElementById('f-mode'), input: document.getElementById('mode'), test: v => v !== '' },
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let allOk = true;
    Object.values(fields).forEach(f => {
      const ok = fieldTest(f.el, f.test(f.input.value));
      if (!ok) allOk = false;
    });

    if (!allOk) {
      showToast('Incomplete Form', 'Fill in every field to assemble your squad.');
      resultBox.classList.remove('show');
      return;
    }

    const codename = generateCodename();
    const regId = 'REG-' + Math.random().toString(36).slice(2, 7).toUpperCase();

    resultCodename.textContent = codename;
    resultId.textContent = `REG-ID: ${regId}`;
    resultBox.classList.add('show');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    showToast('Squad Registered', `${fields.teamname.input.value} is assembled as "${codename}".`);
    form.reset();
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initLoginPage();
  initRegisterPage();
});
