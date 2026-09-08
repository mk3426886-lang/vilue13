/**
 * Vilue — wallet module (frontend)
 * Every call here hits the real backend — deposits/withdrawals/transfers
 * change real balances in Supabase.
 */

window.Vilue_Wallet = (() => {
  async function getMyWallet() {
    return Vilue_Api.request('/wallet/me', { headers: Vilue_Auth.authHeader() });
  }

  async function getMyTransactions() {
    return Vilue_Api.request('/wallet/transactions', { headers: Vilue_Auth.authHeader() });
  }

  async function sendTwoFactorCode() {
    return Vilue_Api.request('/wallet/2fa/send-code', { method: 'POST', headers: Vilue_Auth.authHeader() });
  }

  async function deposit({ amountSlon, method, senderAccountName, note, receiptImageBase64 }) {
    return Vilue_Api.request('/wallet/deposit', {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
      body: { amountSlon, method, senderAccountName, note, receiptImageBase64 },
    });
  }

  async function withdraw({ amountSlon, method, accountName, phone, transferNumber, code }) {
    return Vilue_Api.request('/wallet/withdraw', {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
      body: { amountSlon, method, accountName, phone, transferNumber, code },
    });
  }

  async function cancelWithdrawal(transactionId) {
    return Vilue_Api.request(`/wallet/withdraw/${transactionId}/cancel`, {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
    });
  }

  async function transfer({ receiverId, amountSlon, code }) {
    return Vilue_Api.request('/wallet/transfer', {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
      body: { receiverId, amountSlon, code },
    });
  }

  async function lookupRecipient(displayId) {
    return Vilue_Api.request(`/wallet/lookup-recipient?displayId=${encodeURIComponent(displayId)}`, {
      headers: Vilue_Auth.authHeader(),
    });
  }

  return { getMyWallet, getMyTransactions, sendTwoFactorCode, deposit, withdraw, cancelWithdrawal, transfer, lookupRecipient };
})();
