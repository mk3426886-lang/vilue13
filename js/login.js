document.addEventListener('vilue:app-ready', () => {
  const form = Vilue_Utils.qs('#login-form');
  const submitBtn = Vilue_Utils.qs('#login-submit');
  const togglePw = Vilue_Utils.qs('#toggle-password');
  const pwInput = Vilue_Utils.qs('#password');

  const params = new URLSearchParams(location.search);
  if (params.get('reason') === 'session_replaced') {
    Vilue_Utils.showToast(
      Vilue_I18n.getLang() === 'ar'
        ? 'تم تسجيل الدخول لحسابك من جهاز آخر'
        : 'Your account was signed in from another device',
      'default'
    );
  }

  togglePw.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = Vilue_Utils.qs('#identifier').value.trim();
    const password = Vilue_Utils.qs('#password').value;
    const idError = Vilue_Utils.qs('#identifier-error');
    idError.hidden = true;

    if (!identifier || !password) {
      Vilue_Utils.showToast(Vilue_I18n.t('common.required'), 'error');
      return;
    }

    Vilue_Utils.setLoading(submitBtn, true);
    try {
      await Vilue_Auth.login(identifier, password);
      Vilue_Utils.showToast('OK', 'success');
      window.location.href = 'home.html';
    } catch (err) {
      if (err.code === 'ACCOUNT_NOT_VERIFIED' && err.userId) {
        sessionStorage.setItem('vilue_pending_user_id', err.userId);
        sessionStorage.setItem('vilue_pending_contact', identifier);
        window.location.href = 'verify.html';
        return;
      }
      if (err.code === 'ACCOUNT_LOCKED') {
        const retry = err.retryAt ? new Date(err.retryAt).toLocaleTimeString(Vilue_I18n.getLang() === 'ar' ? 'ar-IQ' : 'en-US') : '';
        idError.textContent = Vilue_I18n.getLang() === 'ar'
          ? `محاولات دخول كثيرة فاشلة، حاول بعد: ${retry}`
          : `Too many failed attempts, try again after: ${retry}`;
        idError.hidden = false;
        return;
      }
      if (err.code === 'ACCOUNT_SUSPENDED') {
        const until = err.bannedUntil ? new Date(err.bannedUntil).toLocaleString(Vilue_I18n.getLang() === 'ar' ? 'ar-IQ' : 'en-US') : null;
        idError.textContent = Vilue_I18n.getLang() === 'ar'
          ? `حسابك موقوف${err.reason ? `: ${err.reason}` : ''}${until ? ` — حتى ${until}` : ' بشكل دائم'}`
          : `Your account is suspended${err.reason ? `: ${err.reason}` : ''}${until ? ` until ${until}` : ' permanently'}`;
        idError.hidden = false;
        return;
      }
      if (err.code === 'DEVICE_SWITCH_COOLDOWN') {
        const retry = err.retryAt ? new Date(err.retryAt) : null;
        const timeStr = retry ? retry.toLocaleString(Vilue_I18n.getLang() === 'ar' ? 'ar-IQ' : 'en-US') : '';
        idError.textContent = Vilue_I18n.getLang() === 'ar'
          ? `حسابك مسجّل دخول من جهاز آخر. يمكنك التبديل لهذا الجهاز بعد: ${timeStr}`
          : `Your account is signed in on another device. You can switch to this one after: ${timeStr}`;
        idError.hidden = false;
        return;
      }
      idError.textContent = err.code === 'INVALID_CREDENTIALS'
        ? (Vilue_I18n.getLang() === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials')
        : err.message;
      idError.hidden = false;
    } finally {
      Vilue_Utils.setLoading(submitBtn, false);
    }
  });
});

// معالجة زر الرجوع (بديل عن onclick="history.back()" الممنوع بالـ CSP)
document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'register.html';
      }
    });
  }
});