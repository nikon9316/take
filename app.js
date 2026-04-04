const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || null;
const API_BASE = `${window.location.origin}/api`;

const STORAGE_KEYS = {
  CART: "take_cart_v12",
  ORDER_TYPE: "take_order_type_v12",
  CATEGORY: "take_category_v12",
  PAYMENT: "take_payment_v12"
};

let products = [];
let categories = ["Все"];

let state = {
  orderType: localStorage.getItem(STORAGE_KEYS.ORDER_TYPE) || "",
  selectedCategory: localStorage.getItem(STORAGE_KEYS.CATEGORY) || "Все",
  paymentMethod: localStorage.getItem(STORAGE_KEYS.PAYMENT) || "cash",
  cart: loadCart(),
  currentScreen: "main",
  address: "",
  orders: []
};

const orderTypeModal = document.getElementById("orderTypeModal");
const addressModal = document.getElementById("addressModal");
const addressModalInput = document.getElementById("addressModalInput");
const orderTypeButton = document.getElementById("orderTypeButton");
const categoryTabs = document.getElementById("categoryTabs");
const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");

const mainScreen = document.getElementById("mainScreen");
const cartScreen = document.getElementById("cartScreen");
const ordersScreen = document.getElementById("ordersScreen");

const savedAddressCard = document.getElementById("savedAddressCard");
const savedAddressText = document.getElementById("savedAddressText");

const cartBar = document.getElementById("cartBar");
const cartBarCount = document.getElementById("cartBarCount");
const cartBarSubtitle = document.getElementById("cartBarSubtitle");

const cartItems = document.getElementById("cartItems");
const cartAddressBlock = document.getElementById("cartAddressBlock");
const cartAddressText = document.getElementById("cartAddressText");

const itemsTotalText = document.getElementById("itemsTotalText");
const grandTotalText = document.getElementById("grandTotalText");
const checkoutBar = document.getElementById("checkoutBar");
const checkoutBtnTotal = document.getElementById("checkoutBtnTotal");

const payUzcardBtn = document.getElementById("payUzcardBtn");
const payHumoBtn = document.getElementById("payHumoBtn");
const payCashBtn = document.getElementById("payCashBtn");
const ordersList = document.getElementById("ordersList");

init();

async function init() {
  await loadMenu();
  await loadUserProfile();
  await loadOrderHistory();

  updateOrderTypeUI();
  updateAddressUI();
  updatePaymentUI();

  if (!state.orderType) {
    orderTypeModal.classList.add("show");
  } else {
    orderTypeModal.classList.remove("show");
  }

  renderCategoryTabs();
  renderProducts();
  updateCartBar();
  updateCartScreen();
  renderOrders();
}

async function loadMenu() {
  const res = await fetch(`${API_BASE}/menu`);
  products = await res.json();
  categories = ["Все", ...new Set(products.map(p => p.category))];
}

async function loadUserProfile() {
  if (!userId) return;
  const res = await fetch(`${API_BASE}/user/${userId}`);
  const user = await res.json();
  state.address = user.address || "";
}

async function loadOrderHistory() {
  if (!userId) return;
  const res = await fetch(`${API_BASE}/orders/history/${userId}`);
  if (!res.ok) return;
  state.orders = await res.json();
}

async function saveAddressToServer(address) {
  if (!userId) return;
  await fetch(`${API_BASE}/address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, address })
  });
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CART)) || {};
  } catch {
    return {};
  }
}

function saveCart() {
  localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
}

function clearCart() {
  state.cart = {};
  saveCart();
  renderProducts();
  updateCartBar();
  updateCartScreen();
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " сум";
}

function getProductCount(productId) {
  return state.cart[productId]?.qty || 0;
}

function getCartItemsArray() {
  return Object.values(state.cart);
}

function getItemsTotal() {
  return getCartItemsArray().reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getGrandTotal() {
  return getItemsTotal();
}

function getTotalCount() {
  return getCartItemsArray().reduce((sum, item) => sum + item.qty, 0);
}

function openOrderTypeModal() {
  orderTypeModal.classList.add("show");
}

function selectOrderType(type) {
  state.orderType = type;
  localStorage.setItem(STORAGE_KEYS.ORDER_TYPE, type);
  updateOrderTypeUI();
  orderTypeModal.classList.remove("show");
  updateAddressUI();
  updateCartScreen();

  if (type === "delivery" && !state.address.trim()) {
    openAddressModal();
  }
}

function updateOrderTypeUI() {
  orderTypeButton.innerHTML =
    (state.orderType === "pickup" ? "Самовывоз" : "Доставка") + ` <span>▾</span>`;
}

function setPaymentMethod(method) {
  state.paymentMethod = method;
  localStorage.setItem(STORAGE_KEYS.PAYMENT, method);
  updatePaymentUI();
}

function updatePaymentUI() {
  payUzcardBtn.classList.toggle("active", state.paymentMethod === "click_uzcard");
  payHumoBtn.classList.toggle("active", state.paymentMethod === "click_humo");
  payCashBtn.classList.toggle("active", state.paymentMethod === "cash");
}

function openAddressModal() {
  addressModalInput.value = state.address || "";
  addressModal.classList.add("show");
}

function closeAddressModal() {
  addressModal.classList.remove("show");
}

async function saveAddressFromModal() {
  const value = addressModalInput.value.trim();
  if (!value) {
    alert("Введите адрес");
    return;
  }

  state.address = value;
  await saveAddressToServer(value);

  closeAddressModal();
  updateAddressUI();
  updateCartScreen();
}

function updateAddressUI() {
  const showAddress = state.orderType === "delivery" && state.address.trim();

  savedAddressCard.classList.toggle("hidden", !showAddress);
  cartAddressBlock.classList.toggle("hidden", state.orderType !== "delivery");

  if (showAddress) {
    savedAddressText.textContent = state.address;
    cartAddressText.textContent = state.address;
  } else {
    savedAddressText.textContent = "";
    cartAddressText.textContent = "Адрес не указан";
  }
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = categories.map(cat => `
    <button
      class="category-tab ${state.selectedCategory === cat ? "active" : ""}"
      onclick="setCategory('${cat.replace(/'/g, "\\'")}')"
    >
      ${cat}
    </button>
  `).join("");
}

function setCategory(category) {
  state.selectedCategory = category;
  localStorage.setItem(STORAGE_KEYS.CATEGORY, category);
  renderCategoryTabs();
  renderProducts();
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = products.filter(product => {
    const byCategory =
      state.selectedCategory === "Все" || product.category === state.selectedCategory;

    const bySearch =
      product.name.toLowerCase().includes(query) ||
      product.desc.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);

    return byCategory && bySearch;
  });

  if (!filtered.length) {
    productGrid.innerHTML = `<div class="empty-state">Ничего не найдено</div>`;
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const count = getProductCount(product.id);
    const imageSrc = product.image?.startsWith('/') ? product.image : product.image;

    return `
      <article class="product-card">
        <div class="product-image-wrap">
          <img class="product-image" src="${imageSrc}" alt="${product.name}">
          <div class="product-badge">${product.badge}</div>
        </div>

        <div class="product-body">
          <h3 class="product-title">${product.name}</h3>
          <p class="product-desc">${product.desc}</p>
          <div class="product-price">${formatPrice(product.price)}</div>

          <div class="product-footer">
            ${
              count > 0
                ? `
                <div class="counter">
                  <button class="counter-btn" onclick="changeQty(${product.id}, -1)">−</button>
                  <span class="counter-value">${count}</span>
                  <button class="counter-btn" onclick="changeQty(${product.id}, 1)">+</button>
                </div>
                `
                : `
                <button class="add-btn" onclick="changeQty(${product.id}, 1)">Добавить</button>
                `
            }
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function changeQty(productId, delta) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (!state.cart[productId]) {
    state.cart[productId] = {
      id: product.id,
      name: product.name,
      desc: product.desc,
      price: product.price,
      image: product.image,
      qty: 0
    };
  }

  state.cart[productId].qty += delta;

  if (state.cart[productId].qty <= 0) {
    delete state.cart[productId];
  }

  saveCart();
  renderProducts();
  updateCartBar();
  updateCartScreen();
}

function hideAllScreens() {
  mainScreen.classList.remove("active");
  cartScreen.classList.remove("active");
  ordersScreen.classList.remove("active");
}

function updateCartBar() {
  const count = getTotalCount();
  const total = getItemsTotal();

  if (count === 0 || state.currentScreen !== "main") {
    cartBar.classList.add("hidden");
    return;
  }

  cartBar.classList.remove("hidden");
  cartBarCount.textContent = count;
  cartBarSubtitle.textContent = formatPrice(total);
}

function openCartScreen() {
  state.currentScreen = "cart";
  hideAllScreens();
  cartScreen.classList.add("active");
  cartBar.classList.add("hidden");

  if (getCartItemsArray().length > 0) {
    checkoutBar.classList.remove("hidden");
  }

  updateCartScreen();
}

async function openOrdersScreen() {
  state.currentScreen = "orders";
  hideAllScreens();
  ordersScreen.classList.add("active");
  cartBar.classList.add("hidden");
  checkoutBar.classList.add("hidden");
  await loadOrderHistory();
  renderOrders();
}

function backToMain() {
  state.currentScreen = "main";
  hideAllScreens();
  mainScreen.classList.add("active");
  checkoutBar.classList.add("hidden");
  updateCartBar();
}

function updateCartScreen() {
  const items = getCartItemsArray();

  cartAddressBlock.classList.toggle("hidden", state.orderType !== "delivery");

  if (!items.length) {
    cartItems.innerHTML = `<div class="empty-state">В корзине пока пусто</div>`;
    checkoutBar.classList.add("hidden");
  } else {
    cartItems.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="${item.image}" alt="${item.name}">
        </div>

        <div>
          <h3 class="cart-item-title">${item.name}</h3>
          <p class="cart-item-desc">${item.desc}</p>

          <div class="cart-item-bottom">
            <div class="cart-item-price">${formatPrice(item.price * item.qty)}</div>

            <div class="counter">
              <button class="counter-btn" onclick="changeQty(${item.id}, -1)">−</button>
              <span class="counter-value">${item.qty}</span>
              <button class="counter-btn" onclick="changeQty(${item.id}, 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    `).join("");

    if (state.currentScreen === "cart") {
      checkoutBar.classList.remove("hidden");
    }
  }

  if (state.orderType === "delivery") {
    cartAddressText.textContent = state.address || "Адрес не указан";
  }

  const total = getGrandTotal();
  itemsTotalText.textContent = formatPrice(total);
  grandTotalText.textContent = formatPrice(total);
  checkoutBtnTotal.textContent = formatPrice(total);
}

function paymentStatusBadge(order) {
  if (order.payment_status === "paid") {
    return `<span class="order-badge success">Оплачено</span>`;
  }
  if (order.payment_status === "pending") {
    return `<span class="order-badge pending">Ожидает оплаты</span>`;
  }
  if (order.payment_status === "cancelled") {
    return `<span class="order-badge cancelled">Отменено</span>`;
  }
  return `<span class="order-badge">${order.payment_method === 'cash' ? 'Наличными' : 'Не оплачено'}</span>`;
}

function paymentMethodLabel(code) {
  return {
    cash: "Наличными",
    click_uzcard: "Uzcard",
    click_humo: "Humo"
  }[code] || code;
}

function orderItemsText(order) {
  return (order.items || []).map(item => `• ${item.name} x${item.qty}`).join("\n");
}

function renderOrders() {
  if (!state.orders.length) {
    ordersList.innerHTML = `<div class="empty-state">У вас пока нет заказов</div>`;
    return;
  }

  ordersList.innerHTML = state.orders.map(order => `
    <div class="order-card">
      <div class="order-card-head">
        <div>
          <h3 class="order-card-title">Заказ #${order.order_id}</h3>
          <div class="order-meta">${order.created_at}</div>
        </div>
        ${paymentStatusBadge(order)}
      </div>
      <div class="order-meta-row">
        <div class="order-meta">${order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'} · ${paymentMethodLabel(order.payment_method)}</div>
        <div class="order-total">${formatPrice(order.total)}</div>
      </div>
      <div class="order-items">${orderItemsText(order)}</div>
      ${order.address ? `<div class="order-meta">📍 ${order.address}</div>` : ''}
      <div class="order-meta">Статус заказа: ${order.status}</div>
    </div>
  `).join("");
}

async function createCashOrder(payload) {
  const res = await fetch(`${API_BASE}/orders/cash`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function createCardOrder(payload) {
  const res = await fetch(`${API_BASE}/orders/card-init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function waitForPaid(orderId, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    if (res.ok) {
      const order = await res.json();
      if (order.payment_status === "paid") {
        return true;
      }
      if (order.payment_status === "cancelled") {
        return false;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}

async function submitOrder() {
  const items = getCartItemsArray();

  if (!items.length) {
    alert("Добавьте товар");
    return;
  }

  if (!userId) {
    alert("Не удалось определить пользователя Telegram");
    return;
  }

  if (state.orderType === "delivery" && !state.address.trim()) {
    openAddressModal();
    return;
  }

  const payload = {
    user_id: userId,
    items: items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: item.qty
    })),
    total: getGrandTotal(),
    items_total: getItemsTotal(),
    delivery_type: state.orderType,
    address: state.orderType === "delivery" ? state.address : "",
    payment_method: state.paymentMethod
  };

  if (state.paymentMethod === "cash") {
    const result = await createCashOrder(payload);
    if (!result.ok) {
      alert("Не удалось оформить заказ");
      return;
    }
    clearCart();
    await loadOrderHistory();
    renderOrders();
    tg.showAlert(`✅ Заказ #${result.order_id} отправлен`);
    backToMain();
    return;
  }

  const result = await createCardOrder(payload);
  if (!result.ok) {
    alert("Не удалось создать онлайн-платеж");
    return;
  }

  const clickParams = result.click;

  if (typeof createPaymentRequest !== "function") {
    alert("Click checkout не загрузился");
    return;
  }

  createPaymentRequest({
    service_id: clickParams.service_id,
    merchant_id: clickParams.merchant_id,
    amount: clickParams.amount,
    transaction_param: clickParams.transaction_param,
    merchant_user_id: clickParams.merchant_user_id,
    card_type: clickParams.card_type,
  }, async function(data) {
    if (data && data.status === 2) {
      const paid = await waitForPaid(result.order_id, 12);
      if (paid) {
        clearCart();
        await loadOrderHistory();
        renderOrders();
        tg.showAlert(`✅ Онлайн-оплата прошла успешно. Заказ #${result.order_id} принят.`);
        backToMain();
      } else {
        tg.showAlert("Платеж создан. Проверяем подтверждение от платежной системы.");
      }
      return;
    }

    if (data && data.status < 0) {
      tg.showAlert("❌ Ошибка оплаты. Попробуйте снова.");
      return;
    }

    tg.showAlert("Платеж открыт или обрабатывается.");
  });
}
