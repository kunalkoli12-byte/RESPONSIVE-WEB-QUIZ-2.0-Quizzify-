(() => {
  'use strict';

  const USERS_KEY = 'quizzify_users_v1';
  const SESSION_KEY = 'quizzify_current_user_v1';
  const PBKDF2_ITERATIONS = 210000;
  const MIN_PBKDF2_ITERATIONS = 100000;
  const MAX_PBKDF2_ITERATIONS = 1000000;

  const form = document.querySelector('#auth-form');
  const nameField = document.querySelector('#name-field');
  const confirmField = document.querySelector('#confirm-field');
  const fullNameInput = document.querySelector('#full-name');
  const emailInput = document.querySelector('#email');
  const passwordInput = document.querySelector('#password');
  const confirmInput = document.querySelector('#confirm-password');
  const submitButton = document.querySelector('#auth-submit');
  const message = document.querySelector('#form-message');
  const heading = document.querySelector('#auth-heading');
  const subheading = document.querySelector('#auth-subheading');
  const passwordHint = document.querySelector('#password-hint');
  const switchNote = document.querySelector('#auth-switch-note');
  const tabs = [...document.querySelectorAll('.auth-tab')];
  let mode = 'signin';

  function readUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw === null) return [];
    const users = JSON.parse(raw);
    if (!Array.isArray(users) || users.some((user) => !user || typeof user !== 'object' || typeof user.email !== 'string')) {
      throw new Error('Saved account data is invalid. Clear the Quizzify demo account storage and try again.');
    }
    return users;
  }

  function showMessage(text, kind = 'error') {
    message.textContent = text;
    message.dataset.kind = kind;
  }

  function clearMessage() {
    message.textContent = '';
    delete message.dataset.kind;
    [fullNameInput, emailInput, passwordInput, confirmInput].forEach((input) => input.removeAttribute('aria-invalid'));
  }

  function setMode(nextMode) {
    mode = nextMode;
    const registering = mode === 'register';
    nameField.hidden = !registering;
    confirmField.hidden = !registering;
    fullNameInput.required = registering;
    confirmInput.required = registering;
    passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
    passwordHint.textContent = registering ? 'At least 8 characters' : 'Keep it private';
    heading.textContent = registering ? 'Create your account' : 'Welcome back';
    subheading.textContent = registering ? 'A few details and you’re ready to practise.' : 'Sign in to continue your learning journey.';
    submitButton.innerHTML = registering ? 'Create account <span aria-hidden="true">→</span>' : 'Sign in <span aria-hidden="true">→</span>';
    switchNote.innerHTML = registering
      ? 'Already have an account? <button type="button" class="text-button" data-mode="signin">Sign in</button>'
      : 'New to Quizzify? <button type="button" class="text-button" data-mode="register">Create an account</button>';
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    // Rebind the switch in the helper text after replacing its content.
    switchNote.querySelector('[data-mode]').addEventListener('click', () => setMode(registering ? 'signin' : 'register'));
    clearMessage();
  }

  function bytesToHex(bytes) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
    if (!window.crypto?.subtle || !window.crypto?.getRandomValues) {
      throw new Error('Password hashing is unavailable in this browser context. Run the project using VS Code Live Server or another localhost server.');
    }
    if (saltHex && !/^[a-f0-9]{32}$/i.test(saltHex)) throw new Error('This saved account has invalid security data. Create a new demo account.');
    if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
      throw new Error('This saved account uses invalid security settings. Create a new demo account.');
    }
    const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g), (pair) => parseInt(pair, 16)) : crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt), iterations };
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function createSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, signedInAt: new Date().toISOString() }));
  }

  function normalizeUser(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      salt: user.salt,
      iterations: user.iterations,
      createdAt: user.createdAt
    };
  }

  async function register() {
    const name = fullNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmation = confirmInput.value;

    if (!name || !email || !password || !confirmation) return showMessage('Please complete all required fields.');
    if (name.length < 2) return markInvalid(fullNameInput, 'Please enter your full name (at least 2 characters).');
    if (!validateEmail(email)) return markInvalid(emailInput, 'Enter a valid email address.');
    if (password.length < 8) return markInvalid(passwordInput, 'Use a password with at least 8 characters.');
    if (password !== confirmation) return markInvalid(confirmInput, 'The passwords do not match.');

    const users = readUsers();
    if (users.some((user) => user.email?.toLowerCase() === email)) return markInvalid(emailInput, 'An account with this email already exists. Sign in instead.');

    submitButton.disabled = true;
    try {
      const credentials = await hashPassword(password);
      const user = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${bytesToHex(crypto.getRandomValues(new Uint8Array(8)))}`,
        name,
        email,
        passwordHash: credentials.hash,
        salt: credentials.salt,
        iterations: credentials.iterations,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      createSession(user);
      showMessage('Account created. Opening your quiz…', 'success');
      window.location.assign('./quiz.html');
    } finally {
      submitButton.disabled = false;
    }
  }

  async function signIn() {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!email || !password) return showMessage('Enter your email address and password.');
    if (!validateEmail(email)) return markInvalid(emailInput, 'Enter a valid email address.');

    const users = readUsers();
    const user = users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!user || !/^[a-f0-9]{64}$/i.test(user.passwordHash || '') || !/^[a-f0-9]{32}$/i.test(user.salt || '') || !Number.isInteger(user.iterations) || user.iterations < MIN_PBKDF2_ITERATIONS || user.iterations > MAX_PBKDF2_ITERATIONS) {
      return showMessage('No matching account was found. Check your details or create an account.');
    }

    submitButton.disabled = true;
    try {
      const credentials = await hashPassword(password, user.salt, user.iterations);
      if (credentials.hash !== user.passwordHash) return showMessage('The email or password is incorrect.');
      createSession(user);
      showMessage('Signed in successfully. Opening your quiz…', 'success');
      window.location.assign('./quiz.html');
    } finally {
      submitButton.disabled = false;
    }
  }

  function markInvalid(input, text) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    showMessage(text);
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  [fullNameInput, emailInput, passwordInput, confirmInput].forEach((input) => {
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    try {
      if (mode === 'register') await register();
      else await signIn();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  });

  setMode('signin');
})();
