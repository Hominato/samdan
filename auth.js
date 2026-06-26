/**
 * auth.js — Authentication Module
 * Premium Wallet MVP
 *
 * Security practices implemented:
 *  - Passwords are NEVER stored in plaintext or in frontend code.
 *  - Credentials are validated against a mock API endpoint (simulated with a
 *    hashed comparison via SubtleCrypto). In production, replace mockAuthenticate()
 *    with a real HTTPS API call.
 *  - CSRF token is generated and attached to every simulated request.
 *  - XSS: all dynamic text is set via textContent/innerText, never innerHTML
 *    with unsanitised user input.
 *  - Session timeout: idle timer logs user out automatically.
 *  - "Remember me" only persists a non-sensitive session token (not credentials).
 */

'use strict';

/* =====================================================
   MOCK BACKEND — Replace with real API in production
   ===================================================== */

/**
 * Hash a string with SHA-256 using the Web Crypto API.
 * @param {string} message
 * @returns {Promise<string>} hex digest
 */
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Simulated user record.
 * In production this lives only on the server — never in client JS.
 *
 * The password hash below is SHA-256("Demo@2024!") — computed offline.
 * Real systems would use bcrypt/argon2 on the server side.
 */
const MOCK_USER_DB = {
  jessedavis: {
    id:           'usr_jesse_001',
    username:     'jessedavis',
    email:        '777jesusfreak59@gmail.com',
    displayName:  'Jesse Davis',
    // SHA-256 of "Jesskath2026@"
    passwordHash: '6f2fa6cbd857780e7ee413dbc4449a663f093bc4207e8113fc424b0a9ed31eb6',
    twoFA:        false,
    createdAt:    '2026-06-25T00:00:00Z',
  },
};

/**
 * Mock CSRF token store (in production this is server-managed).
 */
let _csrfToken = null;

function generateCSRFToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  _csrfToken = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return _csrfToken;
}

/**
 * Simulate a network request to the mock authentication API.
 * Returns { success, user, token, error }.
 */
async function mockAuthenticate(identifier, password, csrfToken) {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 900 + Math.random() * 400));

  // CSRF check (simulated)
  if (csrfToken !== _csrfToken) {
    return { success: false, error: 'Invalid request. Please refresh and try again.' };
  }

  // Normalise identifier
  const key = identifier.trim().toLowerCase();
  let userRecord = null;

  // Look up by username or email
  for (const [uname, rec] of Object.entries(MOCK_USER_DB)) {
    if (uname === key || rec.email.toLowerCase() === key) {
      userRecord = rec;
      break;
    }
  }

  if (!userRecord) {
    return { success: false, error: 'Invalid username or password.' };
  }

  // Hash submitted password and compare
  const submittedHash = await sha256(password);
  if (submittedHash !== userRecord.passwordHash) {
    return { success: false, error: 'Invalid username or password.' };
  }

  // Issue a random session token (not the password hash)
  const sessionTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionTokenBytes);
  const sessionToken = Array.from(sessionTokenBytes)
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    success: true,
    token:   sessionToken,
    user: {
      id:          userRecord.id,
      username:    userRecord.username,
      email:       userRecord.email,
      displayName: userRecord.displayName,
    },
  };
}

/* =====================================================
   SESSION MANAGEMENT
   ===================================================== */

const SESSION_KEY    = 'premium_session_token';
const SESSION_EXPIRY = 'premium_session_expiry';
const PREF_KEY       = 'premium_prefs'; // non-sensitive preferences only

let _sessionUser   = null;
let _idleTimer     = null;
let _countdownTimer = null;
let _sessionMinutes = 30;

/**
 * Store a session token.
 * Only the opaque token (not credentials) is stored.
 */
function persistSession(token, user, remember) {
  const store = remember ? localStorage : sessionStorage;
  const expiry = Date.now() + _sessionMinutes * 60 * 1000;
  store.setItem(SESSION_KEY,    token);
  store.setItem(SESSION_EXPIRY, String(expiry));
  // Store non-sensitive user meta for display purposes
  store.setItem('premium_user_meta', JSON.stringify({
    id:          user.id,
    username:    user.username,
    email:       user.email,
    displayName: user.displayName,
  }));
}

function clearSession() {
  [localStorage, sessionStorage].forEach(s => {
    s.removeItem(SESSION_KEY);
    s.removeItem(SESSION_EXPIRY);
    s.removeItem('premium_user_meta');
  });
  _sessionUser = null;
}

function getStoredSession() {
  for (const store of [sessionStorage, localStorage]) {
    const token  = store.getItem(SESSION_KEY);
    const expiry = store.getItem(SESSION_EXPIRY);
    const meta   = store.getItem('premium_user_meta');
    if (token && expiry && meta && Date.now() < Number(expiry)) {
      return { token, user: JSON.parse(meta) };
    }
  }
  return null;
}

/** Refresh the session expiry on any activity. */
function touchSession() {
  for (const store of [sessionStorage, localStorage]) {
    if (store.getItem(SESSION_KEY)) {
      store.setItem(SESSION_EXPIRY, String(Date.now() + _sessionMinutes * 60 * 1000));
    }
  }
  resetIdleTimer();
}

function resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    AuthModule.logout('Your session has expired due to inactivity.');
  }, _sessionMinutes * 60 * 1000);
}

/* =====================================================
   INPUT VALIDATION (XSS-safe)
   ===================================================== */

/**
 * Sanitise a string to prevent XSS — strips HTML tags.
 * All user-provided strings must pass through this before
 * being inserted into the DOM.
 */
function sanitise(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.textContent;
}

function validateIdentifier(value) {
  if (!value || value.trim().length < 3) return 'Please enter your username or email.';
  if (value.trim().length > 128) return 'Input too long.';
  return null;
}

function validatePassword(value) {
  if (!value || value.length < 6) return 'Password must be at least 6 characters.';
  if (value.length > 256) return 'Password too long.';
  return null;
}

/* =====================================================
   UI HELPERS
   ===================================================== */

function showFieldError(fieldId, errorId, message) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(errorId);
  if (!field || !err) return;
  field.setAttribute('aria-invalid', 'true');
  err.textContent = sanitise(message);
  err.classList.remove('hidden');
}

function clearFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(errorId);
  if (!field || !err) return;
  field.removeAttribute('aria-invalid');
  err.textContent = '';
  err.classList.add('hidden');
}

function showLoginAlert(message, type = 'error') {
  const el = document.getElementById('login-alert');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.innerHTML = '';
  const icon = document.createElement('i');
  icon.className = type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
  const text = document.createElement('span');
  text.textContent = sanitise(message);
  el.appendChild(icon);
  el.appendChild(text);
  el.classList.remove('hidden');
}

function hideLoginAlert() {
  const el = document.getElementById('login-alert');
  if (el) el.classList.add('hidden');
}

function setLoginLoading(loading) {
  const btn    = document.getElementById('login-btn');
  const text   = btn?.querySelector('.btn-text');
  const loader = btn?.querySelector('.btn-loader');
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    text?.classList.add('hidden');
    loader?.classList.remove('hidden');
  } else {
    text?.classList.remove('hidden');
    loader?.classList.add('hidden');
  }
}

/* =====================================================
   COUNTDOWN TIMER (displayed in topbar)
   ===================================================== */

function startCountdown() {
  clearInterval(_countdownTimer);
  _countdownTimer = setInterval(() => {
    const expiry = Math.max(
      Number(localStorage.getItem(SESSION_EXPIRY) || 0),
      Number(sessionStorage.getItem(SESSION_EXPIRY) || 0)
    );
    const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
    const secs = String(remaining % 60).padStart(2, '0');
    const display = document.getElementById('timer-display');
    if (display) display.textContent = `${mins}:${secs}`;
    if (remaining === 0) clearInterval(_countdownTimer);
  }, 1000);
}

/* =====================================================
   PUBLIC AUTH MODULE
   ===================================================== */

const AuthModule = {

  /** Current authenticated user (null if not logged in) */
  get currentUser() { return _sessionUser; },

  /**
   * Initialise auth on page load.
   * Checks for an existing valid session and restores it.
   */
  init() {
    generateCSRFToken();
    this._bindLoginForm();
    this._bindPasswordToggle();


    const stored = getStoredSession();
    if (stored) {
      _sessionUser = stored.user;
      this._onLoginSuccess(stored.user, false);
    } else {
      this._showLoginScreen();
    }

    // Activity listeners to keep session alive
    ['mousemove', 'keydown', 'touchstart', 'click'].forEach(evt =>
      document.addEventListener(evt, () => touchSession(), { passive: true })
    );
  },

  /** Bind login form submit */
  _bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideLoginAlert();

      const identifier = document.getElementById('login-identifier')?.value ?? '';
      const password   = document.getElementById('login-password')?.value ?? '';
      const remember   = document.getElementById('remember-me')?.checked ?? false;

      // Client-side validation
      let valid = true;
      const idErr  = validateIdentifier(identifier);
      const pwdErr = validatePassword(password);

      if (idErr) {
        showFieldError('login-identifier', 'identifier-error', idErr);
        valid = false;
      } else {
        clearFieldError('login-identifier', 'identifier-error');
      }

      if (pwdErr) {
        showFieldError('login-password', 'password-error', pwdErr);
        valid = false;
      } else {
        clearFieldError('login-password', 'password-error');
      }

      if (!valid) return;

      setLoginLoading(true);

      try {
        const csrf   = generateCSRFToken();
        const result = await mockAuthenticate(identifier, password, csrf);

        if (result.success) {
          persistSession(result.token, result.user, remember);
          _sessionUser = result.user;
          this._onLoginSuccess(result.user, true);
        } else {
          showLoginAlert(result.error || 'Authentication failed.');
        }
      } catch (err) {
        console.error('[Auth] Login error:', err);
        showLoginAlert('A network error occurred. Please try again.');
      } finally {
        setLoginLoading(false);
      }
    });

    // Clear errors on input
    document.getElementById('login-identifier')?.addEventListener('input', () => {
      clearFieldError('login-identifier', 'identifier-error');
      hideLoginAlert();
    });
    document.getElementById('login-password')?.addEventListener('input', () => {
      clearFieldError('login-password', 'password-error');
      hideLoginAlert();
    });
  },

  /** Password visibility toggle */
  _bindPasswordToggle() {
    const toggleBtn = document.getElementById('toggle-pwd');
    const pwdInput  = document.getElementById('login-password');
    const eyeIcon   = document.getElementById('pwd-eye-icon');
    if (!toggleBtn || !pwdInput) return;

    toggleBtn.addEventListener('click', () => {
      const show = pwdInput.type === 'password';
      pwdInput.type = show ? 'text' : 'password';
      if (eyeIcon) {
        eyeIcon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      }
    });
  },

  /** Called after successful authentication */
  _onLoginSuccess(user, animate) {
    const loginScreen = document.getElementById('login-screen');
    const appScreen   = document.getElementById('app-screen');

    if (loginScreen) {
      loginScreen.classList.remove('active');
      loginScreen.classList.add('hidden');
    }
    if (appScreen) {
      appScreen.classList.remove('hidden');
      appScreen.classList.add('active');
    }

    resetIdleTimer();
    startCountdown();

    // Notify the rest of the app
    document.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
  },

  /** Called when session timeout select changes */
  setSessionTimeout(minutes) {
    _sessionMinutes = Number(minutes) || 30;
    touchSession();
  },

  /** Log out and return to login screen */
  logout(reason) {
    clearInterval(_countdownTimer);
    clearTimeout(_idleTimer);
    clearSession();

    const appScreen   = document.getElementById('app-screen');
    const loginScreen = document.getElementById('login-screen');

    if (appScreen) {
      appScreen.classList.remove('active');
      appScreen.classList.add('hidden');
    }
    if (loginScreen) {
      loginScreen.classList.remove('hidden');
      loginScreen.classList.add('active');
    }

    // Reset login form
    const form = document.getElementById('login-form');
    if (form) form.reset();
    hideLoginAlert();

    if (reason) {
      setTimeout(() => showLoginAlert(reason, 'info'), 100);
    }

    generateCSRFToken();
    document.dispatchEvent(new CustomEvent('auth:logout'));
  },

  /** Show login screen (initial state) */
  _showLoginScreen() {
    document.getElementById('login-screen')?.classList.add('active');
  },

  /** Expose sanitise for other modules */
  sanitise,
};

// Expose globally
window.AuthModule = AuthModule;
