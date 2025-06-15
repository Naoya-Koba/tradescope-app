// === 入力欄フォーマットとキーボード対応 ===
document.querySelectorAll('.month-card input').forEach(input => {
  // 初期表示の整形
  formatCurrencyInput(input);

  // ¥マークを消させない
  input.addEventListener('beforeinput', e => {
    if (input.selectionStart === 0 && e.inputType === 'deleteContentBackward') {
      e.preventDefault();
    }
  });

  // フォーカスアウト時に整形
  input.addEventListener('blur', () => {
    formatCurrencyInput(input);
  });

  // Enterキー（iPhoneの確定など）でも整形
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
});

function formatCurrencyInput(input) {
  const raw = input.value.replace(/[¥,]/g, '').trim();
  const num = parseInt(raw);
  if (!isNaN(num)) {
    input.value = '¥' + num.toLocaleString();
    input.classList.toggle('positive', num > 0);
    input.classList.toggle('negative', num < 0);
  } else {
    input.value = '¥0';
    input.classList.remove('positive', 'negative');
  }
}
