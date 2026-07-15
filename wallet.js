/**
 * wallet.js — On-Chain Wallet Module
 * OnChain Wallet MVP
 * wallet.js — Premium Wallet Module
 * Premium Wallet MVP
 *
 * Handles:
 *  - Wallet generation (ethers.js v6 HDNodeWallet)
 *  - Wallet import via seed phrase (BIP-39/BIP-44)
 *  - MetaMask provider integration
 *  - Real-time ETH balance refresh
 *  - Gas fee estimation
 *  - Send transaction flow (mock + optional MetaMask)
 *  - QR code generation for receive address
 *  - Token portfolio data (mock prices + real balances when connected)
 */

'use strict';

/* =====================================================
   CONSTANTS & CONFIG
   ===================================================== */

const DEMO_ADDRESS = '0x0f7E3f7eDded3C0d79daF27b5857F8491Cd2F574';
const DEMO_ENS = 'dianawalletdemo.eth';

/** Supported tokens with mock price data */
const TOKEN_DATA = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    color: '#627eea',
    icon: '<i class="fa-brands fa-ethereum"></i>',
    balance: 0,
    price: 3548.22,
    change24h: 3.21,
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    color: '#f7931a',
    icon: '<i class="fa-brands fa-bitcoin"></i>',
    balance: 13.67,
    price: 65821.40,
    change24h: 1.87,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775ca',
    icon: '<span style="font-weight:800;font-size:0.85rem">$</span>',
    balance: 0,
    price: 1.0001,
    change24h: 0.01,
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    color: '#2a5ada',
    icon: '<i class="fa-solid fa-link"></i>',
    balance: 0,
    price: 14.72,
    change24h: -0.84,
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    color: '#ff007a',
    icon: '<i class="fa-solid fa-droplet"></i>',
    balance: 0,
    price: 8.91,
    change24h: 2.15,
  },
];

/** Mock transaction history */
const MOCK_TRANSACTIONS = [
  {
    id: 'tx_new2',
    type: 'receive',
    asset: 'USDC',
    amount: 2500,
    usd: 2500.00,
    from: '0x3dC9…b2F7',
    to: DEMO_ADDRESS,
    hash: '0xe7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    timestamp: new Date('2026-07-15T06:30:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0011,
  },
   {
    id: 'tx_new2',
    type: 'receive',
    asset: 'USDC',
    amount: 725,
    usd: 725.00,
    from: '0x3dC9…b2F7',
    to: DEMO_ADDRESS,
    hash: '0xe7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    timestamp: new Date('2026-07-15T03:30:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0011,
  },
   {
    id: 'tx_new2',
    type: 'receive',
    asset: 'USDC',
    amount: 1000,
    usd: 1000.00,
    from: '0x3dC9…b2F7',
    to: DEMO_ADDRESS,
    hash: '0xe7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    timestamp: new Date('2026-07-06T16:30:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0011,
  },
  {
    id: 'tx_new1',
    type: 'receive',
    asset: 'USDC',
    amount: 4000,
    usd: 4000.00,
    from: '0x7aB1…e3C4',
    to: DEMO_ADDRESS,
    hash: '0xd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9',
    timestamp: new Date('2026-07-06T16:30:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0013,
  },
  {
    id: 'tx_new',
    type: 'receive',
    asset: 'USDC',
    amount: 500,
    usd: 500.00,
    from: '0x4fA2…d8B1',
    to: DEMO_ADDRESS,
    hash: '0xf1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    timestamp: new Date('2026-07-03T00:00:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0012,
  },
  {
    id: 'tx_000',
    type: 'receive',
    asset: 'BTC',
    amount: 0.009115,
    usd: 600.00,
    from: '0x9aB3…c4D5',
    to: DEMO_ADDRESS,
    hash: '0xabcdef1234567890',
    timestamp: new Date('2026-06-25T14:30:00Z').getTime(),
    status: 'confirmed',
    gas: 0.0001,
  },
  {
    id: 'tx_001',
    type: 'receive',
    asset: 'ETH',
    amount: 125.0,
    usd: 443527.50,
    from: '0x1aB2…9c3D',
    to: DEMO_ADDRESS,
    hash: '0xabc123def456aaa',
    timestamp: Date.now() - 1213200000,
    status: 'confirmed',
    gas: 0.0021,
  },
  {
    id: 'tx_002',
    type: 'send',
    asset: 'USDC',
    amount: 50000,
    usd: 50002.00,
    from: DEMO_ADDRESS,
    to: '0x9fE3…b4A1',
    hash: '0xdef789abc012bbb',
    timestamp: Date.now() - 1216800000,
    status: 'confirmed',
    gas: 0.0018,
  },
  {
    id: 'tx_003',
    type: 'swap',
    asset: 'BTC→ETH',
    amount: 2.5,
    usd: 164553.50,
    from: DEMO_ADDRESS,
    to: '0xUniswapRouter',
    hash: '0x112233aabbccdd',
    timestamp: Date.now() - 1296000000,
    status: 'confirmed',
    gas: 0.0054,
  },
  {
    id: 'tx_004',
    type: 'receive',
    asset: 'LINK',
    amount: 10000,
    usd: 147200,
    from: '0x5cF1…a2E8',
    to: DEMO_ADDRESS,
    hash: '0x998877665544aaa',
    timestamp: Date.now() - 1382400000,
    status: 'confirmed',
    gas: 0.0015,
  },
  {
    id: 'tx_005',
    type: 'send',
    asset: 'ETH',
    amount: 50.0,
    usd: 177411.00,
    from: DEMO_ADDRESS,
    to: '0x3dB5…e7F2',
    hash: '0xffeeddccbbaa9988',
    timestamp: Date.now() - 1468800000,
    status: 'confirmed',
    gas: 0.0021,
  },
  {
    id: 'tx_006',
    type: 'receive',
    asset: 'BTC',
    amount: 10.25,
    usd: 674669.35,
    from: '0x8aA0…c6D3',
    to: DEMO_ADDRESS,
    hash: '0x1122334455667788',
    timestamp: Date.now() - 1555200000,
    status: 'confirmed',
    gas: 0.0019,
  },
  {
    id: 'tx_007',
    type: 'send',
    asset: 'USDC',
    amount: 250000,
    usd: 250025.00,
    from: DEMO_ADDRESS,
    to: '0x2eC4…f8B9',
    hash: '0xaabbccddeeff1122',
    timestamp: Date.now() - 1641600000,
    status: 'confirmed',
    gas: 0.0022,
  },
  {
    id: 'tx_008',
    type: 'swap',
    asset: 'UNI→USDC',
    amount: 50000,
    usd: 445500.00,
    from: DEMO_ADDRESS,
    to: '0xUniswapRouter',
    hash: '0x99aabbccddeeff33',
    timestamp: Date.now() - 1728000000,
    status: 'confirmed',
    gas: 0.0048,
  },
  {
    id: 'tx_009',
    type: 'receive',
    asset: 'ETH',
    amount: 500.0,
    usd: 1774110.00,
    from: '0x7bD2…a1E5',
    to: DEMO_ADDRESS,
    hash: '0x44556677889900aa',
    timestamp: Date.now() - 1814400000,
    status: 'confirmed',
    gas: 0.0021,
  },
  {
    id: 'tx_010',
    type: 'send',
    asset: 'ETH',
    amount: 100.0,
    usd: 354822.00,
    from: DEMO_ADDRESS,
    to: '0x6aC3…b9D4',
    hash: '0xbbccddee1234ffaa',
    timestamp: Date.now() - 1900800000,
    status: 'confirmed',
    gas: 0.0021,
  },
];

/* =====================================================
   STATE
   ===================================================== */

const WalletState = {
  address: null,
  provider: null,
  signer: null,
  isMetaMask: false,
  ethBalance: null,
  gasPrice: null,
  generatedWallet: null,
};

/* =====================================================
   UTILITY
   ===================================================== */

function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function formatUSD(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNumber(n, decimals = 4) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* =====================================================
   WALLET GENERATION
   ===================================================== */

async function generateNewWallet() {
  if (typeof ethers === 'undefined') {
    throw new Error('Ethers.js not loaded');
  }
  const wallet = ethers.Wallet.createRandom();
  WalletState.generatedWallet = wallet;
  return {
    address: wallet.address,
    mnemonic: wallet.mnemonic.phrase,
    privateKey: wallet.privateKey,
  };
}





/* =====================================================
   BALANCE & GAS
   ===================================================== */

async function fetchETHBalance(address) {
  try {
    if (WalletState.provider) {
      const bal = await WalletState.provider.getBalance(address);
      return parseFloat(ethers.formatEther(bal));
    }
  } catch (_) { }
  // Fall back to mock balance
  return TOKEN_DATA.find(t => t.symbol === 'ETH')?.balance || 0;
}

async function fetchGasPrice() {
  try {
    if (WalletState.provider) {
      const feeData = await WalletState.provider.getFeeData();
      if (feeData.gasPrice) {
        const gwei = parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'));
        WalletState.gasPrice = gwei;
        return gwei;
      }
    }
  } catch (_) { }
  // Fallback mock gas (randomised)
  const mock = 18 + Math.random() * 12;
  WalletState.gasPrice = mock;
  return mock;
}

async function estimateGasFee(toAddress, amountEth) {
  const gwei = WalletState.gasPrice || await fetchGasPrice();
  const gasLimit = 21000; // standard ETH transfer; ERC-20 ~65000
  const ethFee = (gwei * gasLimit) / 1e9;
  const ethPrice = TOKEN_DATA.find(t => t.symbol === 'ETH')?.price || 3548;
  const usdFee = ethFee * ethPrice;
  return { gwei, gasLimit, ethFee, usdFee };
}

/* =====================================================
   SEND TRANSACTION (MOCK + REAL)
   ===================================================== */

async function sendTransaction({ to, amountEth, token }) {
  // Validate Ethereum address
  if (!ethers.isAddress(to)) throw new Error('Invalid recipient address.');
  if (isNaN(amountEth) || amountEth <= 0) throw new Error('Invalid amount.');

  // If MetaMask is connected, attempt real transaction
  if (WalletState.signer && token === 'ETH') {
    const tx = await WalletState.signer.sendTransaction({
      to,
      value: ethers.parseEther(String(amountEth)),
    });
    return { txHash: tx.hash, real: true };
  }

  // Mock transaction (demo mode)
  await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
  const fakeTxHash = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return { txHash: fakeTxHash, real: false };
}

/* =====================================================
   QR CODE GENERATION
   ===================================================== */

function generateQRCode(address) {
  const container = document.getElementById('qrcode-canvas');
  if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    container.textContent = 'QR library not loaded';
    return;
  }
  new QRCode(container, {
    text: `ethereum:${address}`,
    width: 176,
    height: 176,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
}

/* =====================================================
   DOM RENDERING
   ===================================================== */

/** Render the token list on the Wallet page */
function renderTokenList() {
  const container = document.getElementById('token-list');
  if (!container) return;
  container.innerHTML = '';

  TOKEN_DATA.forEach(token => {
    const usdValue = token.balance * token.price;
    const changeClass = token.change24h >= 0 ? 'pos' : 'neg';
    const changeSign = token.change24h >= 0 ? '+' : '';

    const item = document.createElement('div');
    item.className = 'token-item';
    item.innerHTML = `
      <div class="token-icon" style="background:${token.color}22;color:${token.color}">
        ${token.icon}
      </div>
      <div class="token-body">
        <div class="token-name">${AuthModule.sanitise(token.name)}</div>
        <div class="token-symbol">${AuthModule.sanitise(token.symbol)}</div>
      </div>
      <div class="token-balance">
        <div class="token-amount">${formatNumber(token.balance)} <small style="color:var(--text-muted);font-weight:500">${token.symbol}</small></div>
        <div class="token-usd">${formatUSD(usdValue)}</div>
        <div class="token-change ${changeClass}">${changeSign}${token.change24h.toFixed(2)}%</div>
      </div>
    `;
    container.appendChild(item);
  });
}

/** Render a transaction list into a container element */
function renderTransactions(containerId, transactions, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const list = limit ? transactions.slice(0, limit) : transactions;

  if (list.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:16px;text-align:center;font-size:0.85rem">No transactions yet.</p>';
    return;
  }

  list.forEach(tx => {
    const typeLabel = tx.type === 'receive' ? 'Received' : tx.type === 'send' ? 'Sent' : 'Swapped';
    const typeIcon = tx.type === 'receive'
      ? '<i class="fa-solid fa-arrow-down"></i>'
      : tx.type === 'send'
        ? '<i class="fa-solid fa-arrow-up"></i>'
        : '<i class="fa-solid fa-arrow-right-arrow-left"></i>';

    const amountPrefix = tx.type === 'send' ? '-' : tx.type === 'receive' ? '+' : '';

    const item = document.createElement('div');
    item.className = 'tx-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('title', `View transaction ${tx.hash}`);
    item.dataset.txId = tx.id;
    item.innerHTML = `
      <div class="tx-icon ${tx.type}">${typeIcon}</div>
      <div class="tx-body">
        <div class="tx-title">${typeLabel} ${AuthModule.sanitise(tx.asset)}</div>
        <div class="tx-sub">${formatTimeAgo(tx.timestamp)} · ${shortAddress(tx.type === 'send' ? tx.to : tx.from)}</div>
      </div>
      <div class="tx-amount">
        <div class="tx-val ${tx.type}">${amountPrefix}${formatNumber(tx.amount)} ${AuthModule.sanitise(tx.asset.split('→')[0])}</div>
        <div class="tx-usd">${formatUSD(tx.usd)}</div>
      </div>
      <div class="tx-status status-${tx.status}">${tx.status}</div>
    `;
    container.appendChild(item);
  });
}

/** Update gas display in real time */
async function updateGasDisplay() {
  const price = await fetchGasPrice();
  const el = document.getElementById('gas-price');
  const label = document.getElementById('gas-label');
  if (el) el.textContent = `${price.toFixed(1)} Gwei`;
  if (label) {
    const speed = price < 20 ? 'Low · ~30s' : price < 40 ? 'Standard · ~15s' : 'High · ~5s';
    label.textContent = speed;
    label.className = `stat-sub ${price < 20 ? 'positive' : price < 40 ? 'neutral' : 'negative'}`;
  }
}

/** Update wallet address across all displays */
function setWalletAddress(address) {
  WalletState.address = address;
  const displays = [
    'wallet-address-display',
    'receive-address-display',
  ];
  displays.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = address || 'Not connected';
  });
  if (address) generateQRCode(address);
}

/* =====================================================
   PUBLIC WALLET MODULE
   ===================================================== */

const WalletModule = {

  get state() { return WalletState; },
  get tokens() { return TOKEN_DATA; },
  get transactions() { return MOCK_TRANSACTIONS; },

  formatUSD,
  formatNumber,
  formatTimeAgo,
  formatDate,
  shortAddress,
  renderTokenList,
  renderTransactions,
  updateGasDisplay,
  setWalletAddress,
  generateQRCode,
  fetchGasPrice,
  estimateGasFee,
  sendTransaction,

  /** Initialise the wallet module */
  async init() {
    // Set default demo address
    setWalletAddress(DEMO_ADDRESS);
    renderTokenList();
    await updateGasDisplay();

    // Refresh gas every 15 seconds
    setInterval(updateGasDisplay, 15000);

    this._bindWalletButtons();
  },

  /** Bind wallet page interactive buttons */
  _bindWalletButtons() {

    /* ---- Copy address ---- */
    document.getElementById('copy-address-btn')?.addEventListener('click', () => {
      const addr = WalletState.address;
      if (addr) {
        navigator.clipboard.writeText(addr).then(() =>
          window.AppModule?.showToast('Address copied!', 'success')
        );
      }
    });

    document.getElementById('copy-receive-btn')?.addEventListener('click', () => {
      const addr = WalletState.address;
      if (addr) {
        navigator.clipboard.writeText(addr).then(() =>
          window.AppModule?.showToast('Address copied!', 'success')
        );
      }
    });





    /* ---- Refresh balances ---- */
    document.getElementById('refresh-balances-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refresh-balances-btn');
      if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Refreshing…';
      await updateGasDisplay();
      // Simulate async balance fetch
      await new Promise(r => setTimeout(r, 800));
      renderTokenList();
      if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh';
      window.AppModule?.showToast('Balances updated!', 'success');
    });
  },


};

window.WalletModule = WalletModule;
