 (async () => {
  try {
    const base = 'http://127.0.0.1:5000/api';
    // Login as seeded seller
    const loginRes = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '09171234568', password: 'seller123' })
    });
    const login = await loginRes.json();
    console.log('login status', loginRes.status, login);
    if (!login.token) return;
    const auth = { 'Authorization': `Bearer ${login.token}`, 'Content-Type': 'application/json' };

    // Get seller id from login.user or profile
    const sellerId = login.user && login.user._id ? login.user._id : (login.user && login.user.id ? login.user.id : null);
    console.log('sellerId', sellerId);
    if (!sellerId) {
      // try profile
      const profileRes = await fetch(`${base}/auth/profile`, { headers: auth });
      const profile = await profileRes.json();
      console.log('profile', profile);
    }

    // Fetch seller orders
    const ordersRes = await fetch(`${base}/orders/seller/${sellerId}`, { headers: auth });
    const orders = await ordersRes.json();
    console.log('orders status', ordersRes.status, 'count', Array.isArray(orders) ? orders.length : 0);
    if (!Array.isArray(orders) || orders.length === 0) return console.log('no orders for seller');

    const order = orders[0];
    console.log('using order', order._id || order.id || order.orderId, 'current deliveryStatus:', order.deliveryStatus);

    // Attempt to set to Pending
    const targetStatus = 'Pending';
    const putRes = await fetch(`${base}/orders/${order._id || order.id}/status`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ status: targetStatus })
    });
    const putBody = await putRes.json();
    console.log('put status', putRes.status, putBody);
  } catch (e) {
    console.error('error', e);
  }
})();
