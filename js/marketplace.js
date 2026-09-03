/**
 * Vilue — marketplace module (frontend)
 */

const Vilue_Marketplace = (() => {
  async function browse({ category, search } = {}) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString();
    return Vilue_Api.request(`/marketplace/products${qs ? `?${qs}` : ''}`);
  }

  async function getProduct(productId) {
    return Vilue_Api.request(`/marketplace/products/${productId}`);
  }

  async function create({ title, description, priceSlon, category, imageBase64, isDigital, deliveryContent }) {
    return Vilue_Api.request('/marketplace/products', {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
      body: { title, description, priceSlon, category, imageBase64, isDigital, deliveryContent },
    });
  }

  async function mine() {
    return Vilue_Api.request('/marketplace/my-listings', { headers: Vilue_Auth.authHeader() });
  }

  async function myPurchases() {
    return Vilue_Api.request('/marketplace/my-purchases', { headers: Vilue_Auth.authHeader() });
  }

  async function buy(productId) {
    return Vilue_Api.request(`/marketplace/products/${productId}/buy`, {
      method: 'POST', headers: Vilue_Auth.authHeader(),
    });
  }

  // ---- Admin ----
  async function adminCreate({ title, description, priceSlon, category, imageBase64 }) {
    return Vilue_Api.request('/marketplace/admin/products', {
      method: 'POST',
      headers: Vilue_Auth.authHeader(),
      body: { title, description, priceSlon, category, imageBase64 },
    });
  }

  async function adminListPending() {
    return Vilue_Api.request('/marketplace/admin/pending', { headers: Vilue_Auth.authHeader() });
  }

  async function adminReview(productId, action, note) {
    return Vilue_Api.request(`/marketplace/admin/products/${productId}/review`, {
      method: 'POST', headers: Vilue_Auth.authHeader(), body: { action, note },
    });
  }

  function readImageAsBase64(fileInput) {
    return new Promise((resolve, reject) => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return { browse, getProduct, create, mine, myPurchases, buy, adminCreate, adminListPending, adminReview, readImageAsBase64 };
})();
