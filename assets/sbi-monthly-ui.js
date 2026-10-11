(function (root) {
  'use strict';
  function createController({ adapter, drafts, legacyData, onSaved }) {
    const data = root.TradeScopeDataStorage, resolver = root.TradeScopeMonthlyResolver;
    const service = root.TradeScopeSbiMonthlySave.createService(adapter);
    const inputView = root.TradeScopeSbiInput;
    const fields = [['realizedPnL', '実現損益', 'number'], ['deposit', '入金', 'number'], ['withdrawal', '出金', 'number'],
      ['foreignAssetValue', '評価額', 'number'], ['foreignUnrealizedPnl', '評価損益', 'number'], ['foreignDate', '取得日', 'date'],
      ['cashBalance', '残高', 'number'], ['cashDate', '取得日', 'date']];
    function savedDraft(resolved) {
      return { foreignAssetValue: resolved.foreign?.assetValue ?? '', foreignUnrealizedPnl: resolved.foreign?.unrealizedPnl ?? '',
        foreignDate: resolved.foreign?.snapshotAsOf?.slice(0, 10) ?? '', cashBalance: resolved.cash?.cashBalance ?? '',
        cashDate: resolved.cash?.snapshotAsOf?.slice(0, 10) ?? '', realizedPnL: resolved.state?.realizedPnl ?? '',
        deposit: resolved.state?.deposit ?? '', withdrawal: resolved.state?.withdrawal ?? '' };
    }
    function renderCard(account, view, targetMonth, label, monthlyView = null) {
      let models = null, resolved = null;
      try { models = data.createRepository({ getItem: key => adapter.getItem(key) }).read();
        resolved = resolver.resolve(models, legacyData(), targetMonth); } catch (_) { /* Fail closed; never seed. */ }
      const baseline = savedDraft(resolved || {});
      drafts.initialize(targetMonth, baseline);
      const card = document.createElement('div'); card.className = 'account-card';
      card.innerHTML = '<button type="button" class="account-toggle" data-account-toggle="sbi" aria-expanded="false"><div class="account-title"><div class="account-color-dot"></div><span class="sbi-account-label"></span></div><span class="account-toggle-icon">▼</span></button><div class="account-body" data-account-body="sbi"><div class="sbi-domestic-input"><div class="sbi-domestic-heading">国内証券 <span class="sbi-import-status"></span></div><dl><div><dt>評価額</dt><dd class="sbi-domestic-value"></dd></div><div><dt>評価損益</dt><dd class="sbi-domestic-pnl"></dd></div></dl><p class="sbi-domestic-date"></p></div></div>';
      card.querySelector('.sbi-account-label').textContent = label;
      card.querySelector('.account-color-dot').style.backgroundColor = account.color;
      card.querySelector('.sbi-domestic-value').textContent = inputView.formatYen(view.marketValue);
      card.querySelector('.sbi-domestic-pnl').textContent = inputView.formatYen(view.unrealizedPnl, true);
      card.querySelector('.sbi-import-status').textContent = '';
      const date = card.querySelector('.sbi-domestic-date'); date.textContent = view.snapshotAsOf ? `取得日：${view.snapshotAsOf.slice(0, 10).replace(/-/g, '/')}` : ''; date.hidden = !date.textContent;
      const body = card.querySelector('.account-body');
      const values = drafts.read(targetMonth);
      const controls = {};
      const amountGroup = root.TradeScopeMonthlyInputUI.readOnlyField(document, 'assetValue', '評価額', null, 'sbi-monthly');
      const pnlGroup = root.TradeScopeMonthlyInputUI.readOnlyField(document, 'unrealizedPnL', '評価損益', null, 'sbi-monthly');
      const amountInput = amountGroup.children[1], pnlInput = pnlGroup.children[1];
      body.append(amountGroup, pnlGroup);
      const breakdown = document.createElement('details'); breakdown.className = 'sbi-asset-breakdown';
      const summary = document.createElement('summary'); summary.textContent = '資産内訳'; breakdown.appendChild(summary);
      breakdown.appendChild(card.querySelector('.sbi-domestic-input'));
      breakdown.addEventListener('toggle', () => { if(body.classList.contains('open'))body.style.maxHeight=`${body.scrollHeight}px`; });
      for (const [field, title, type] of fields) {
        const destination = ['realizedPnL', 'deposit', 'withdrawal'].includes(field) ? body : breakdown;
        if (['foreignAssetValue', 'cashBalance'].includes(field)) {
          const heading = document.createElement('div'); heading.className = 'sbi-manual-heading';
          heading.textContent = field === 'foreignAssetValue' ? '外国証券' : '現金・預り金'; destination.appendChild(heading);
        }
        const group = document.createElement('div'); group.className = 'form-group';
        const labelElement = document.createElement('label'), control = document.createElement('input');
        control.id = `sbi-draft-${field}`; control.type = type; control.className = 'input-account';
        control.dataset.account = 'sbi'; control.dataset.field = field; control.dataset.draft = 'sbi';
        control.value = values[field] ?? ''; if (type === 'number') { control.step = 'any'; control.placeholder = '—'; }
        labelElement.htmlFor = control.id; labelElement.textContent = title; group.append(labelElement, control);
        if (type === 'number') { const suffix = document.createElement('span'); suffix.className = 'suffix'; suffix.textContent = '¥'; group.appendChild(suffix); }
        destination.appendChild(group); controls[field] = control;
      }
      body.appendChild(breakdown);
      const actions = document.createElement('div'); actions.className = 'sbi-monthly-actions';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'sbi-monthly-save btn btn-primary btn-block monthly-account-save'; button.textContent = '保存';
      const status = document.createElement('span'); status.className = 'sbi-monthly-status'; status.setAttribute('role', 'status');
      const error = document.createElement('p'); error.className = 'sbi-monthly-error'; error.setAttribute('role', 'alert');
      let busy = false, saved = resolved?.source === 'canonical' && resolved.completeness.complete;
      const unavailable = !models ? '取込データを確認できません'
        : resolved?.source === 'conflict' ? 'この月には従来方式のSBI入力が保存されています'
        : resolver.domesticCandidates(models, targetMonth).length > 1 ? '国内証券の取込候補が複数あります'
        : view.status !== 'ready' ? '国内証券データを取り込んでください'
        : view.marketValue === null || view.unrealizedPnl === null ? '国内証券の評価額・評価損益が不足しています' : '';
      function refresh() {
        const current = drafts.read(targetMonth), csv = root.TradeScopeCSV;
        const decimal = value => { try{return csv.decimal(value);}catch(_){return null;} };
        const sum = values => { const known=values.map(decimal).filter(value=>value!==null);return known.length?csv.sum(known):null; };
        const amount=sum([view.marketValue, current.foreignAssetValue, current.cashBalance]);
        const pnl=sum([view.unrealizedPnl, current.foreignUnrealizedPnl]);
        amountInput.value=amount??'';pnlInput.value=pnl??'';
        const unchanged = fields.every(([field]) => String(drafts.read(targetMonth)[field] ?? '') === String(baseline[field] ?? ''));
        button.hidden = saved && unchanged; button.disabled = busy || Boolean(unavailable);
        status.textContent = button.hidden ? '保存済み' : busy ? '保存中…' : '';
        error.hidden = !error.textContent;
        if (body.classList.contains('open')) body.style.maxHeight = `${body.scrollHeight}px`;
      }
      error.textContent = unavailable;
      for (const [field] of fields) controls[field].addEventListener('input', () => {
        drafts.set(targetMonth, field, controls[field].value); error.textContent = unavailable; refresh();
      });
      button.addEventListener('click', () => {
        if (busy || unavailable || button.hidden) return;
        busy = true; refresh();
        try {
          const result = service.save({ ...drafts.read(targetMonth), targetMonth, domesticImportBatchId: view.importBatchId }, { expectedModels: models });
          // Only verified service success changes the UI; failed saves leave the Draft intact.
          if (result.status === 'saved') { saved = true; drafts.clearMonth(targetMonth); onSaved(targetMonth); }
        } catch (failure) { error.textContent = failure.message; }
        finally { busy = false; refresh(); }
      });
      actions.append(button, status); body.append(actions, error); refresh(); return card;
    }
    return Object.freeze({ renderCard });
  }
  root.TradeScopeSbiMonthlyUI = Object.freeze({ createController });
})(typeof globalThis !== 'undefined' ? globalThis : this);
