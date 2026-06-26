/**
 * app.js — Main Application Orchestrator
 * OnChain Wallet MVP
 *
 * Responsibilities:
 *  - Page routing & navigation
 *  - Chart initialisation (Chart.js)
 *  - Dark/light theme management
 *  - Send transaction UI flow
 *  - Transaction history filtering
 *  - Toast notification system
 *  - Settings persistence (non-sensitive, localStorage only)
 *  - Mobile sidebar toggle
 *  - Session countdown relay
 */

'use strict';

/* =====================================================
   CONSTANTS
   ===================================================== */

const PAGES = ['dashboard', 'wallet', 'send', 'receive', 'history', 'settings'];

const PAGE_TITLES = {
  dashboard: ['Dashboard', 'Overview'],
  wallet:    ['Wallet',    'Address & Assets'],
  send:      ['Send',      'Transfer Crypto'],
  receive:   ['Receive',   'Deposit Funds'],
  history:   ['History',   'Transaction Log'],
  settings:  ['Settings',  'Preferences & Security'],
};

/* =====================================================
   APP STATE
   ===================================================== */

let _currentPage     = 'dashboard';
let _perfChart       = null;
let _allocChart      = null;
let _allTransactions = [];
let _visibleTxCount  = 5;
let _theme           = 'dark';

/* =====================================================
   TOAST NOTIFICATIONS
   ===================================================== */

let _toastCounter = 0;

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check',
    error:   'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info',
  };

  const id   = `toast-${++_toastCounter}`;
  const toast = document.createElement('div');
  toast.id        = id;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${AuthModule.sanitise(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* =====================================================
   NAVIGATION / ROUTING
   ===================================================== */

function navigateTo(page) {
  if (!PAGES.includes(page)) return;
  _currentPage = page;

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show/hide page sections
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) {
      el.classList.toggle('active', p === page);
      el.classList.toggle('hidden', p !== page);
    }
  });

  // Update topbar
  const [title, crumb] = PAGE_TITLES[page] || [page, ''];
  const titleEl  = document.getElementById('page-title');
  const crumbEl  = document.getElementById('breadcrumb');
  if (titleEl) titleEl.textContent = title;
  if (crumbEl) crumbEl.textContent = crumb;
  document.title = `${title} — OnChain Wallet`;

  // Page-specific actions
  if (page === 'dashboard') initDashboardCharts();
  if (page === 'wallet')    WalletModule.renderTokenList();
  if (page === 'history')   renderFullHistory();
  if (page === 'receive')   WalletModule.generateQRCode(WalletModule.state.address || '0x742d35Cc6634C0532925a3b8D4C9B5DfBE1234AB');

  // Close mobile sidebar
  closeMobileSidebar();
}

/* =====================================================
   PRICE TICKER
   ===================================================== */

function initPriceTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  const items = WalletModule.tokens.map(t => {
    const sign = t.change24h >= 0 ? '+' : '';
    const cls  = t.change24h >= 0 ? 'pos' : 'neg';
    return `<span class="ticker-item">
      <span class="ticker-sym">${t.symbol}</span>
      <span class="ticker-price">$${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(t.price)}</span>
      <span class="ticker-chg ${cls}">${sign}${t.change24h.toFixed(2)}%</span>
    </span>`;
  });

  // Double the items for seamless infinite scroll
  const html = [...items, ...items].join('');
  track.innerHTML = html;
}

/* =====================================================
   GREETING (time-aware)
   ===================================================== */

function getGreeting(name) {
  const h = new Date().getHours();
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${period}, <strong>${AuthModule.sanitise(name)}</strong> 👋 — Here's your portfolio snapshot.`;
}

function updateWelcomeBanner(user) {
  const el = document.querySelector('.welcome-text');
  if (el) el.innerHTML = getGreeting(user.displayName?.split(' ')[0] || 'Steven');
}

/* =====================================================
   CHARTS
   ===================================================== */

function generatePerformanceData(range) {
  const points   = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const labels   = [];
  const data     = [];
  let   value    = 2400000;
  const now      = new Date();

  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    value += (Math.random() - 0.42) * 30000;
    value  = Math.max(2400000, Math.min(2600000, value));
    data.push(Math.round(value));
  }
  // Ensure the last point is exactly $2.5M
  data[data.length - 1] = 2500000;
  return { labels, data };
}

function initDashboardCharts() {
  initPerformanceChart('7d');
  initAllocationChart();
}

function initPerformanceChart(range) {
  const canvas = document.getElementById('performance-chart');
  if (!canvas) return;

  if (_perfChart) _perfChart.destroy();

  const { labels, data } = generatePerformanceData(range);
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8892a4' : '#64748b';

  const gradient = canvas.getContext('2d').createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0,   'rgba(124,92,252,0.35)');
  gradient.addColorStop(1,   'rgba(124,92,252,0)');

  _perfChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor:     '#7c5cfc',
        borderWidth:     2.5,
        fill:            true,
        backgroundColor: gradient,
        tension:         0.45,
        pointRadius:     0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#7c5cfc',
        pointHoverBorderColor:     '#fff',
        pointHoverBorderWidth:     2,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:  { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? 'rgba(22,24,34,0.96)' : 'rgba(255,255,255,0.96)',
          borderColor:     'rgba(124,92,252,0.4)',
          borderWidth:     1,
          titleColor:      textColor,
          bodyColor:       isDark ? '#f0f2f8' : '#0d1117',
          padding:         12,
          callbacks: {
            label: ctx => ' ' + WalletModule.formatUSD(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 8 },
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: textColor,
            font:  { size: 11 },
            callback: v => '$' + (v / 1e6).toFixed(1) + 'M',
          },
        },
      },
    },
  });
}

function initAllocationChart() {
  const canvas = document.getElementById('allocation-chart');
  if (!canvas) return;

  if (_allocChart) _allocChart.destroy();

  const tokens   = WalletModule.tokens;
  const values   = tokens.map(t => t.balance * t.price);
  const total    = values.reduce((a, b) => a + b, 0);
  const labels   = tokens.map(t => t.symbol);
  const colors   = tokens.map(t => t.color);

  _allocChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data:             values,
        backgroundColor:  colors.map(c => c + 'cc'),
        borderColor:      colors,
        borderWidth:      2,
        hoverOffset:      8,
        hoverBorderWidth: 3,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: document.documentElement.getAttribute('data-theme') !== 'light'
            ? 'rgba(22,24,34,0.96)' : 'rgba(255,255,255,0.96)',
          borderColor: 'rgba(124,92,252,0.3)',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${((ctx.parsed / total) * 100).toFixed(1)}% · ${WalletModule.formatUSD(ctx.parsed)}`,
          },
        },
      },
    },
  });

  // Render legend
  const legend = document.getElementById('allocation-legend');
  if (legend) {
    legend.innerHTML = '';
    tokens.forEach((t, i) => {
      const pct  = ((values[i] / total) * 100).toFixed(1);
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-label">
          <span class="legend-dot" style="background:${t.color}"></span>
          ${AuthModule.sanitise(t.symbol)}
        </span>
        <span class="legend-pct">${pct}%</span>
      `;
      legend.appendChild(item);
    });
  }
}

/* =====================================================
   SEND FLOW
   ===================================================== */

let _pendingSend = null;

/** Validate a Bitcoin address (P2PKH, P2SH, Bech32 mainnet) */
function isBtcAddress(addr) {
  return /^(1|3)[a-zA-HJ-NP-Z0-9]{25,34}$/.test(addr) ||
         /^bc1[a-zA-HJ-NP-Z0-9]{6,87}$/.test(addr);
}

/** Update the recipient field UI based on the selected token */
function _updateRecipientFieldForToken(token, toInput) {
  const hint  = document.getElementById('send-to-hint');
  const label = document.getElementById('send-to-label');
  if (token === 'BTC') {
    if (toInput) toInput.placeholder = 'bc1... or 1... or 3...';
    if (label)   label.textContent   = 'Recipient Bitcoin Address';
    if (hint)    hint.innerHTML      = '<i class="fa-brands fa-bitcoin" style="color:#f7931a"></i> Only native Bitcoin (BTC) addresses accepted — starting with <strong>1</strong>, <strong>3</strong>, or <strong>bc1</strong>.';
  } else {
    if (toInput) toInput.placeholder = '0x...';
    if (label)   label.textContent   = 'Recipient Address';
    if (hint)    hint.textContent    = '';
  }
}


function initSendForm() {
  const form    = document.getElementById('send-form');
  const toInput = document.getElementById('send-to');
  const amtInput = document.getElementById('send-amount');
  const tokenSel = document.getElementById('send-token');

  if (!form) return;

  // Live gas estimation on input change
  let _gasDebounce = null;
  function triggerGasEstimate() {
    clearTimeout(_gasDebounce);
    _gasDebounce = setTimeout(async () => {
      const token  = tokenSel?.value;
      const amount = parseFloat(amtInput?.value) || 0;
      if (amount <= 0) return;
      const gas = await WalletModule.estimateGasFee(toInput?.value || '0x0', amount);
      const gasFeeEl   = document.getElementById('gas-fee-display');
      const gasTotalEl = document.getElementById('gas-total-display');
      const activationFee = 2400;
      const tokenPrice = WalletModule.tokens.find(t => t.symbol === token)?.price || 1;

      if (token === 'BTC') {
        const btcPrice  = WalletModule.tokens.find(t => t.symbol === 'BTC')?.price || 65821;
        const btcFee    = gas.usdFee / btcPrice;
        if (gasFeeEl) gasFeeEl.textContent = `${btcFee.toFixed(8)} BTC`;
      } else {
        if (gasFeeEl) gasFeeEl.textContent = `${gas.ethFee.toFixed(6)} ETH`;
      }

      if (gasTotalEl) gasTotalEl.textContent = WalletModule.formatUSD(
        gas.usdFee + activationFee + amount * tokenPrice
      );
    }, 400);
  }

  amtInput?.addEventListener('input', triggerGasEstimate);
  tokenSel?.addEventListener('change', () => {
    triggerGasEstimate();
    _updateRecipientFieldForToken(tokenSel.value, toInput);
  });

  // Initialise field state for default selected token
  _updateRecipientFieldForToken(tokenSel?.value, toInput);

  // Max amount button
  document.getElementById('send-max-btn')?.addEventListener('click', () => {
    const token = tokenSel?.value;
    const t     = WalletModule.tokens.find(t => t.symbol === token);
    if (t && amtInput) {
      amtInput.value = t.balance.toFixed(6);
      triggerGasEstimate();
    }
  });

  // Form submit → show confirmation modal
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const alertEl = document.getElementById('send-alert');
    if (alertEl) alertEl.classList.add('hidden');

    const to     = (toInput?.value || '').trim();
    const amount = parseFloat(amtInput?.value);
    const token  = tokenSel?.value;

    // Validate
    let valid = true;

    if (!to) {
      showFieldError('send-to', 'send-to-error', 'Recipient address is required.');
      valid = false;
    } else if (token === 'BTC') {
      if (!isBtcAddress(to)) {
        showFieldError('send-to', 'send-to-error', 'Invalid Bitcoin address. Must be a valid BTC address (starting with 1, 3, or bc1).');
        valid = false;
      } else {
        clearSendFieldError('send-to', 'send-to-error');
      }
    } else if (typeof ethers !== 'undefined' && !ethers.isAddress(to)) {
      showFieldError('send-to', 'send-to-error', 'Invalid Ethereum address.');
      valid = false;
    } else {
      clearSendFieldError('send-to', 'send-to-error');
    }

    if (!amount || amount <= 0) {
      showFieldError('send-amount', 'send-amount-error', 'Enter a valid amount.');
      valid = false;
    } else {
      clearSendFieldError('send-amount', 'send-amount-error');
    }

    const activationCodeInput = document.getElementById('send-activation-code');
    const actCode = activationCodeInput?.value?.trim() || '';
    if (!actCode) {
      showFieldError('send-activation-code', 'send-activation-error', 'Activation code is required.');
      valid = false;
    } else {
      clearSendFieldError('send-activation-code', 'send-activation-error');
    }

    if (!valid) return;

    // Confirm toggle
    const confirmEnabled = document.getElementById('confirm-toggle')?.checked !== false;

    _pendingSend = { to, amount, token };

    if (confirmEnabled) {
      openSendConfirmModal({ to, amount, token });
    } else {
      await executeSend();
    }
  });

  // Confirm modal actions
  document.getElementById('confirm-send-btn')?.addEventListener('click', async () => {
    document.getElementById('send-confirm-overlay')?.classList.add('hidden');
    await executeSend();
  });

  document.getElementById('cancel-send-btn')?.addEventListener('click', () => {
    document.getElementById('send-confirm-overlay')?.classList.add('hidden');
    _pendingSend = null;
  });

  document.getElementById('close-send-modal')?.addEventListener('click', () => {
    document.getElementById('send-confirm-overlay')?.classList.add('hidden');
  });
}

function showFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  if (input) input.setAttribute('aria-invalid', 'true');
  if (err)   { err.textContent = message; err.classList.remove('hidden'); }
}

function clearSendFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const err   = document.getElementById(errorId);
  if (input) input.removeAttribute('aria-invalid');
  if (err)   err.classList.add('hidden');
}

async function openSendConfirmModal({ to, amount, token }) {
  const details = document.getElementById('confirm-details');
  if (!details) return;

  const actCode = document.getElementById('send-activation-code')?.value || 'N/A';
  const tokenData = WalletModule.tokens.find(t => t.symbol === token);
  const gas = await WalletModule.estimateGasFee(to, amount);
  const usdValue = amount * (tokenData?.price || 1);
  const activationFee = 2400;

  let gasFeeLabel;
  if (token === 'BTC') {
    const btcPrice = WalletModule.tokens.find(t => t.symbol === 'BTC')?.price || 65821;
    const btcFee   = gas.usdFee / btcPrice;
    gasFeeLabel = `${btcFee.toFixed(8)} BTC · ${WalletModule.formatUSD(gas.usdFee)}`;
  } else {
    gasFeeLabel = `${gas.ethFee.toFixed(6)} ETH · ${WalletModule.formatUSD(gas.usdFee)}`;
  }

  details.innerHTML = `
    <div class="confirm-row"><span>Asset</span><span>${AuthModule.sanitise(token)}</span></div>
    <div class="confirm-row"><span>Recipient</span><span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem">${AuthModule.sanitise(to)}</span></div>
    <div class="confirm-row"><span>Amount</span><span>${WalletModule.formatNumber(amount)} ${AuthModule.sanitise(token)}</span></div>
    <div class="confirm-row"><span>Activation Code</span><span>${AuthModule.sanitise(actCode)}</span></div>
    <div class="confirm-row"><span>USD Value</span><span>${WalletModule.formatUSD(usdValue)}</span></div>
    <div class="confirm-row"><span>Network Fee</span><span>${gasFeeLabel}</span></div>
    <div class="confirm-row"><span>Activation Fee</span><span>${WalletModule.formatUSD(activationFee)}</span></div>
    <div class="confirm-row"><span style="font-weight:700">Total (USD)</span><span style="font-weight:700;color:var(--accent-light)">${WalletModule.formatUSD(usdValue + gas.usdFee + activationFee)}</span></div>
  `;

  document.getElementById('send-confirm-overlay')?.classList.remove('hidden');
}

async function executeSend() {
  if (!_pendingSend) return;
  const { to, amount, token } = _pendingSend;
  _pendingSend = null;

  const btn = document.getElementById('send-btn');
  const text   = btn?.querySelector('.btn-text');
  const loader = btn?.querySelector('.btn-loader');
  if (btn) btn.disabled = true;
  text?.classList.add('hidden');
  loader?.classList.remove('hidden');

  try {
    const result = await WalletModule.sendTransaction({ to, amountEth: amount, token });
    const shortHash = result.txHash.slice(0, 14) + '…' + result.txHash.slice(-6);
    showToast(`✅ Transaction sent! Hash: ${shortHash}`, 'success', 6000);

    // Reset form
    document.getElementById('send-form')?.reset();
    const gasFeeEl = document.getElementById('gas-fee-display');
    const gasTotalEl = document.getElementById('gas-total-display');
    if (gasFeeEl)   gasFeeEl.textContent   = '-- ETH';
    if (gasTotalEl) gasTotalEl.textContent = '--';

  } catch (err) {
    const alertEl = document.getElementById('send-alert');
    if (alertEl) {
      alertEl.className = 'alert alert-error';
      alertEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${AuthModule.sanitise(err.message)}`;
      alertEl.classList.remove('hidden');
    }
  } finally {
    if (btn) btn.disabled = false;
    text?.classList.remove('hidden');
    loader?.classList.add('hidden');
  }
}

/* =====================================================
   TRANSACTION HISTORY (FULL PAGE)
   ===================================================== */

function renderFullHistory() {
  _allTransactions = WalletModule.transactions;
  applyTxFilter();
}

function applyTxFilter() {
  const typeFilter  = document.getElementById('tx-filter-type')?.value  || 'all';
  const assetFilter = document.getElementById('tx-filter-asset')?.value || 'all';

  let filtered = _allTransactions;
  if (typeFilter  !== 'all') filtered = filtered.filter(tx => tx.type  === typeFilter);
  if (assetFilter !== 'all') filtered = filtered.filter(tx => tx.asset.startsWith(assetFilter));

  WalletModule.renderTransactions('full-tx-list', filtered.slice(0, _visibleTxCount));

  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.classList.toggle('hidden', _visibleTxCount >= filtered.length);
  }
}

/* =====================================================
   THEME MANAGEMENT
   ===================================================== */

function applyTheme(theme) {
  _theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('onchain_prefs_theme', theme);

  const isDark = theme === 'dark';

  // Update all theme icons
  ['theme-icon', 'theme-icon-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });

  // Update settings buttons
  document.getElementById('theme-dark-btn')?.classList.toggle('active', isDark);
  document.getElementById('theme-light-btn')?.classList.toggle('active', !isDark);

  // Redraw charts (colours change)
  if (_perfChart || _allocChart) {
    setTimeout(() => {
      if (_currentPage === 'dashboard') initDashboardCharts();
    }, 100);
  }
}

function toggleTheme() {
  applyTheme(_theme === 'dark' ? 'light' : 'dark');
}

/* =====================================================
   MOBILE SIDEBAR
   ===================================================== */

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.remove('hidden');
  document.getElementById('hamburger-btn')?.classList.add('open');
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.add('hidden');
  document.getElementById('hamburger-btn')?.classList.remove('open');
}

/* =====================================================
   SETTINGS
   ===================================================== */

function loadPreferences() {
  const theme = localStorage.getItem('onchain_prefs_theme') || 'dark';
  applyTheme(theme);

  const timeout = localStorage.getItem('onchain_prefs_timeout') || '30';
  const timeoutEl = document.getElementById('timeout-select');
  if (timeoutEl) timeoutEl.value = timeout;
  AuthModule.setSessionTimeout(Number(timeout));
}

function initSettings() {
  // Theme buttons (settings page)
  document.getElementById('theme-dark-btn')?.addEventListener('click',  () => applyTheme('dark'));
  document.getElementById('theme-light-btn')?.addEventListener('click', () => applyTheme('light'));

  // Topbar theme toggles
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  // Session timeout
  document.getElementById('timeout-select')?.addEventListener('change', (e) => {
    const val = e.target.value;
    AuthModule.setSessionTimeout(Number(val));
    localStorage.setItem('onchain_prefs_timeout', val);
    showToast(`Session timeout set to ${val} minutes.`, 'info');
  });

  // Network select
  document.getElementById('network-select')?.addEventListener('change', (e) => {
    const name = e.target.value;
    const badge = document.getElementById('network-name');
    if (badge) badge.textContent = name;
    showToast(`Switched to ${name}`, 'info');
  });
}

/* =====================================================
   MAIN INIT
   ===================================================== */

const AppModule = {

  showToast,

  init() {
    loadPreferences();
    this._bindNavigation();
    this._bindLogout();
    this._bindMobile();
    this._bindAuthEvents();
    initSendForm();
    initSettings();

    // Init auth (will show login or restore session)
    AuthModule.init();
  },

  _bindAuthEvents() {
    document.addEventListener('auth:login', async ({ detail }) => {
      await this._onLogin(detail.user);
    });
    document.addEventListener('auth:logout', () => {
      // Clean up charts
      _perfChart?.destroy();
      _allocChart?.destroy();
      _perfChart = _allocChart = null;
    });
  },

  async _onLogin(user) {
    // Populate wallet & dashboard
    await WalletModule.init();
    WalletModule.renderTransactions('dashboard-tx-list', WalletModule.transactions, 5);
    navigateTo('dashboard');

    // Price ticker & personalised greeting
    initPriceTicker();
    updateWelcomeBanner(user);

    // Bind transaction click → Etherscan
    this._bindTxClicks();

    // Greet user
    setTimeout(() => {
      const name = user.displayName?.split(' ')[0] || 'Steven';
      showToast(`Welcome back, ${AuthModule.sanitise(name)}! 👋`, 'success');
    }, 500);
  },

  /** Open Etherscan for any clicked tx-item */
  _bindTxClicks() {
    document.addEventListener('click', (e) => {
      const item = e.target.closest('.tx-item[data-tx-id]');
      if (!item) return;
      const txId = item.dataset.txId;
      const tx   = WalletModule.transactions.find(t => t.id === txId);
      if (!tx) return;
      const url = `https://etherscan.io/tx/${tx.hash}`;
      showToast(`Opening Etherscan for ${tx.hash.slice(0, 14)}…`, 'info', 3000);
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  },

  _bindNavigation() {
    // Sidebar nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
      });
    });

    // Dashboard quick-action buttons
    document.getElementById('dash-send-btn')?.addEventListener('click', () => navigateTo('send'));
    document.getElementById('dash-receive-btn')?.addEventListener('click', () => navigateTo('receive'));
    document.getElementById('view-all-txns')?.addEventListener('click', () => navigateTo('history'));

    // Chart range tabs
    document.querySelectorAll('.chart-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        initPerformanceChart(tab.dataset.range);
      });
    });

    // Transaction history filters
    document.getElementById('tx-filter-type')?.addEventListener('change', () => {
      _visibleTxCount = 5;
      applyTxFilter();
    });
    document.getElementById('tx-filter-asset')?.addEventListener('change', () => {
      _visibleTxCount = 5;
      applyTxFilter();
    });

    document.getElementById('load-more-btn')?.addEventListener('click', () => {
      _visibleTxCount += 5;
      applyTxFilter();
    });

    // Forgot password (mock)
    document.getElementById('forgot-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      const alertEl = document.getElementById('login-alert');
      if (alertEl) {
        alertEl.className = 'alert alert-info';
        alertEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Password reset would be handled by a secure backend in production.';
        alertEl.classList.remove('hidden');
      }
    });
  },

  _bindLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      AuthModule.logout();
      showToast('You have been signed out.', 'info');
    });
  },

  _bindMobile() {
    document.getElementById('hamburger-btn')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar?.classList.contains('open')) {
        closeMobileSidebar();
      } else {
        openMobileSidebar();
      }
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => AppModule.init());
window.AppModule = AppModule;
