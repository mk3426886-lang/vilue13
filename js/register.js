async function populateGovernorates() {
  try {
    const lang = (window.Vilue_I18n && typeof Vilue_I18n.getLang === 'function') ? Vilue_I18n.getLang() : 'ar';
    const res = await fetch(`/locales/${lang}.json`);
    const dict = await res.json();
    const select = document.querySelector('#governorate');
    if (!select) return;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = (window.Vilue_I18n && typeof Vilue_I18n.t === 'function')
      ? Vilue_I18n.t('auth.governoratePlaceholder')
      : 'اختر المحافظة';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.innerHTML = '';
    select.appendChild(placeholder);

    (dict.governorates || []).forEach((gov) => {
      const opt = document.createElement('option');
      opt.value = gov;
      opt.textContent = gov;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Error loading governorates:", e);
  }
}

function initRegisterEvents() {
  alert('1) الكود بدا يشتغل — initRegisterEvents');

  // 1. تفعيل زر الرجوع
  const backBtn = document.getElementById('back-btn') || document.querySelector('.back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'login.html';
      }
    });
  }

  // 2. معالجة إرسال النموذج ومنع الـ Refresh
  const form = document.getElementById('register-form');
  const submitBtn = document.getElementById('register-submit');

  if (!form) {
    alert('2) خطأ: ما لقيت الفورم #register-form بالصفحة!');
    return;
  }
  alert('2) الفورم موجود، وربطت زر الإرسال بنجاح');

  form.addEventListener('submit', async (e) => {
    alert('3) ضغطت متابعة — الفورم استقبل الضغطة');
    e.preventDefault();
    e.stopPropagation();

    const name = (document.getElementById('name')?.value || '').trim();
    const contact = (document.getElementById('contact')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const governorate = document.getElementById('governorate')?.value || '';
    const referralId = (document.getElementById('referralId')?.value || '').trim();
    const termsAccepted = document.getElementById('terms')?.checked || false;

    const contactError = document.getElementById('contact-error');
    const confirmError = document.getElementById('confirm-error');
    const referralError = document.getElementById('referral-error');
    [contactError, confirmError, referralError].forEach((el) => { if (el) el.hidden = true; });

    let hasError = false;

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValidEmail(contact)) {
      if (contactError) {
        contactError.textContent = (window.Vilue_I18n && Vilue_I18n.getLang() === 'en')
          ? 'Enter a valid email address'
          : 'أدخل بريداً إلكترونياً صحيحاً';
        contactError.hidden = false;
      }
      hasError = true;
    }

    if (password !== confirmPassword || password.length < 8) {
      if (confirmError) {
        confirmError.textContent = (window.Vilue_I18n && Vilue_I18n.getLang() === 'en')
          ? 'Passwords do not match or are shorter than 8 characters'
          : 'كلمتا المرور غير متطابقتين أو أقصر من 8 أحرف';
        confirmError.hidden = false;
      }
      hasError = true;
    }

    if (!/^\d{6,12}$/.test(referralId)) {
      if (referralError) {
        referralError.textContent = 'أدخل معرّفاً صحيحاً (أرقام فقط)';
        referralError.hidden = false;
      }
      hasError = true;
    }

    if (!name || !governorate || !termsAccepted) {
      if (window.Vilue_Utils && typeof Vilue_Utils.showToast === 'function') {
        Vilue_Utils.showToast('جميع الحقول الحيوية مطلوبة', 'error');
      } else {
        alert('جميع الحقول مطلوبة');
      }
      hasError = true;
    }

    alert('4) نتيجة التحقق من الحقول — فيه خطأ؟ ' + hasError + ' | governorate=' + governorate + ' | terms=' + termsAccepted);

    if (hasError) return false;

    if (window.Vilue_Utils && typeof Vilue_Utils.setLoading === 'function') {
      Vilue_Utils.setLoading(submitBtn, true);
    }

    alert('5) راح أتصل بـ Vilue_Auth.register الآن — Vilue_Auth موجود؟ ' + !!window.Vilue_Auth);

    try {
      if (window.Vilue_Auth && typeof Vilue_Auth.register === 'function') {
        const lang = (window.Vilue_I18n && typeof Vilue_I18n.getLang === 'function') ? Vilue_I18n.getLang() : 'ar';
        const result = await Vilue_Auth.register({
          name, email: contact, password, referralId,
          country: 'IQ', governorate, lang,
        });
        alert('6) نجح التسجيل! userId=' + (result && result.userId));
        sessionStorage.setItem('vilue_pending_user_id', result.userId || 'demo');
        sessionStorage.setItem('vilue_pending_contact', contact);
        window.location.href = 'verify.html';
      } else {
        alert('5-خطأ) Vilue_Auth.register مو موجود أو مو دالة!');
      }
    } catch (err) {
      alert('خطأ فعلي وصل! code=' + err.code + ' | message=' + err.message);
      if (err.code === 'DUPLICATE_ACCOUNT') {
        if (contactError) {
          contactError.textContent = 'هذا الحساب مستخدم بالفعل';
          contactError.hidden = false;
        }
      } else if (err.code === 'REFERRAL_NOT_FOUND' || err.code === 'REFERRAL_REQUIRED') {
        if (referralError) {
          referralError.textContent = err.code === 'REFERRAL_NOT_FOUND' ? 'لا يوجد مستخدم بهذا المعرّف' : 'رمز الإحالة مطلوب';
          referralError.hidden = false;
        }
      } else {
        if (window.Vilue_Utils && typeof Vilue_Utils.showToast === 'function') {
          Vilue_Utils.showToast(err.message || 'حدث خطأ غير متوقع', 'error');
        }
      }
    } finally {
      if (window.Vilue_Utils && typeof Vilue_Utils.setLoading === 'function') {
        Vilue_Utils.setLoading(submitBtn, false);
      }
    }
    return false;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await populateGovernorates();
  initRegisterEvents();
});