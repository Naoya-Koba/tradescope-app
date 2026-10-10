(function (root) {
  'use strict';
  // Display only. Never use the returned label for storage, matching or totals.
  const labels = Object.freeze(Object.fromEntries([
    [['gmo', 'GMO', 'acc_gmo_fx', 'GMOクリック証券'], 'GMO FXneo'],
    [['sbi', 'SBI', 'acc_sbi_sec', 'SBI証券'], 'SBI証券'],
    [['lightfx', 'Light FX', 'LIGHT FX', 'acc_lightfx_fx'], 'LIGHT FX'],
    [['minano', 'acc_minna_fx', 'みんなのFX'], 'みんなのFX'],
    [['sbivc', 'acc_sbivc_crypto', 'SBI VC', 'SBI VCトレード'], 'SBI VC'],
    [['smbc', 'acc_smbc_bank', '三井住友銀行'], '三井住友銀行']
  ].flatMap(([identities, label]) => identities.map(identity => [identity, label]))));
  function displayAccountName(identity) {
    const value = String(identity ?? '');
    return Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value;
  }
  const api = Object.freeze({ displayAccountName });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.TradeScopeAccountUI = api;
    // Static HTML labels retain their form IDs and option values.
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-account-label]').forEach(element => {
        element.textContent = displayAccountName(element.dataset.accountLabel);
      });
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
