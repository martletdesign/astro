// Host-owned specimen controller. No transport, authentication, or durable storage.
const form = document.querySelector('#registration');
const summary = document.querySelector('#summary');
const errors = document.querySelector('#summary-errors');
const retry = document.querySelector('#retry');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit');
const reset = document.querySelector('#reset-button');
const dialog = document.querySelector('#discard');
let busy = false, dirty = false, attempt = 0, discardConfirmed = false;
let returnTarget;
const modeButton = document.querySelector('#appearance');
modeButton.addEventListener('click', () => {
  const dark = modeButton.getAttribute('aria-pressed') !== 'true';
  document.documentElement.setAttribute('data-martlet', dark ? 'dark' : 'light');
  modeButton.setAttribute('aria-pressed', String(dark));
  modeButton.textContent = dark ? 'Light appearance' : 'Dark appearance';
});
function pending(value) {
  busy = value;
  form.setAttribute('aria-busy', String(value));
  for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = value;
  submit.setAttribute('aria-disabled', String(value));
  reset.disabled = value;
  retry.disabled = value;
}
function clearErrors() {
  summary.hidden = true; retry.hidden = true; errors.replaceChildren();
  for (const target of form.querySelectorAll('[aria-invalid]')) target.removeAttribute('aria-invalid');
  for (const error of form.querySelectorAll('.martlet-error')) error.hidden = true;
}
function addError(id, message) {
  document.getElementById(id).setAttribute('aria-invalid', 'true');
  const li = document.createElement('li'); const link = document.createElement('a');
  link.href = '#' + id; link.textContent = message; li.append(link); errors.append(li);
  document.getElementById(id === 'attendance-group' ? 'attendance-error' : id + '-error').hidden = false;
}
function focusSummary(title) {
  document.querySelector('#summary-title').textContent = title;
  summary.hidden = false; summary.focus();
}
async function register() {
  if (busy) return;
  const retryStarted = summary.contains(document.activeElement);
  clearErrors();
  if (retryStarted) submit.focus();
  if (!form.elements.namedItem('name').value.trim()) addError('name', 'Enter your name.');
  if (!form.elements.namedItem('email').value.trim() || !form.elements.namedItem('email').validity.valid) addError('email', 'Enter a valid email address.');
  if (!form.elements.namedItem('attendance').value) addError('attendance-group', 'Choose how you will attend.');
  if (errors.children.length) { focusSummary('Check your registration'); return; }
  pending(true); status.textContent = 'Registering…';
  await new Promise(done => setTimeout(done, 1000));
  pending(false);
  if (++attempt === 1) {
    retry.hidden = false; status.textContent = 'Registration failed. Your entries are retained.';
    focusSummary('Registration failed. Retry your registration.');
  } else {
    summary.hidden = true; retry.hidden = true;
    status.textContent = 'Registration recorded for this example. Nothing was sent.';
    dirty = false;
  }
}
form.addEventListener('submit', event => { event.preventDefault(); void register(); });
retry.addEventListener('click', () => { void register(); });
errors.addEventListener('click', event => {
  const link = event.target.closest('a'); if (!link) return;
  event.preventDefault(); document.getElementById(link.hash.slice(1)).focus();
});
form.addEventListener('input', () => { dirty = true; status.textContent = 'Your changes have not been recorded.'; });
form.addEventListener('reset', event => {
  if (busy) { event.preventDefault(); return; }
  if (dirty && !discardConfirmed) {
    event.preventDefault(); returnTarget = document.activeElement;
    dialog.returnValue = 'keep'; dialog.showModal(); return;
  }
  clearErrors(); dirty = false; discardConfirmed = false; attempt = 0;
  status.textContent = 'Not submitted.';
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'discard') { discardConfirmed = true; form.reset(); }
  returnTarget?.focus();
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

// Only enable the local demonstration after all handlers are installed. A failed
// or blocked script must never submit form values to the hosting server.
form.noValidate = true;
for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = false;
submit.disabled = false;
reset.disabled = false;
document.querySelector('#default-button').disabled = false;
document.querySelector('#form-fallback').hidden = true;
