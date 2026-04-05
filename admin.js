const tg = window.Telegram?.WebApp || null;

if (tg) {
  try {
    tg.ready();
    tg.expand();
  } catch (e) {
    console.warn("Telegram WebApp init warning:", e);
  }
}

const initData = tg?.initData || "";
const userId = tg?.initDataUnsafe?.user?.id || null;
const API_BASE = `${window.location.origin}/api/admin`;

let items = [];
let editingId = null;

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statsRow = document.getElementById("statsRow");
const itemsGrid = document.getElementById("itemsGrid");

const editorModal = document.getElementById("editorModal");
const modalTitle = document.getElementById("modalTitle");
const deleteBtn = document.getElementById("deleteBtn");

const nameInput = document.getElementById("nameInput");
const categoryInput = document.getElementById("categoryInput");
const priceInput = document.getElementById("priceInput");
const badgeInput = document.getElementById("badgeInput");
const imageInput = document.getElementById("imageInput");
const imageFileInput = document.getElementById("imageFileInput");
const descInput = document.getElementById("descInput");

const previewImage = document.getElementById("previewImage");
const previewBadge = document.getElementById("previewBadge");
const previewName = document.getElementById("previewName");
const previewDesc = document.getElementById("previewDesc");
const previewPrice = document.getElementById("previewPrice");

init();

async function init() {
  if (!tg || !initData) {
    renderFatalState(
      "Откройте админку именно внутри Telegram Mini App, а не в обычном браузере."
    );
    return;
  }

  if (!userId) {
    renderFatalState(
      "Telegram открыл Mini App, но не передал данные пользователя. Закройте и откройте админку заново из бота."
    );
    return;
  }

  bindPreview();
  await loadItems();
}

function renderFatalState(message) {
  document.body.innerHTML = `
    <div class="shell">
      <div class="empty-state">${escapeHtml(message)}</div>
    </div>
  `;
}

function getAdminHeaders(contentType = "application/json") {
  const headers = {};

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  if (initData) {
    headers["X-Telegram-Init-Data"] = initData;
  }

  return headers;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function loadItems() {
  try {
    const res = await fetch(`${API_BASE}/menu?user_id=${encodeURIComponent(userId)}`, {
      headers: getAdminHeaders(null)
    });

    const data = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error === "forbidden"
        ? "Нет доступа к админке."
        : "Не удалось загрузить товары.";
      renderFatalState(msg);
      return;
    }

    items = Array.isArray(data) ? data : [];
    renderStats();
    renderCategoryFilter();
    renderItems();

    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (editId) {
      openEditModal(Number(editId));
    }
  } catch (error) {
    console.error("loadItems error:", error);
    renderFatalState("Ошибка загрузки админки. Проверьте сервер и попробуйте снова.");
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0)) + " сум";
}

function renderStats() {
  const total = items.length;
  const totalCategories = new Set(items.map(item => item.category).filter(Boolean)).size;
  const avgPrice = total
    ? Math.round(items.reduce((sum, item) => sum + Number(item.price || 0), 0) / total)
    : 0;

  statsRow.innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Товаров</div></div>
    <div class="stat-card"><div class="stat-value">${totalCategories}</div><div class="stat-label">Категорий</div></div>
    <div class="stat-card"><div class="stat-value">${formatPrice(avgPrice)}</div><div class="stat-label">Средняя цена</div></div>
  `;
}

function renderCategoryFilter() {
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
  const current = categoryFilter.value;

  categoryFilter.innerHTML =
    `<option value="">Все категории</option>` +
    categories
      .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");

  categoryFilter.value = current;
}

function renderItems() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const filtered = items.filter(item => {
    const name = String(item.name || "").toLowerCase();
    const itemCategory = String(item.category || "").toLowerCase();
    const desc = String(item.desc || "").toLowerCase();

    const matchQuery =
      name.includes(query) ||
      itemCategory.includes(query) ||
      desc.includes(query);

    const matchCategory = !category || item.category === category;
    return matchQuery && matchCategory;
  });

  if (!filtered.length) {
    itemsGrid.innerHTML = `<div class="empty-state">Ничего не найдено</div>`;
    return;
  }

  itemsGrid.innerHTML = filtered.map(item => `
    <article class="admin-card">
      <img
        src="${escapeAttr(item.image || 'assets/logo.jpg')}"
        alt="${escapeAttr(item.name || 'Товар')}"
        class="admin-card-image"
        onerror="this.onerror=null;this.src='assets/logo.jpg';"
      >
      <div class="admin-card-body">
        <div class="admin-card-badge">${escapeHtml(item.badge || "Без бейджа")}</div>
        <h3>${escapeHtml(item.name || "")}</h3>
        <div class="admin-card-meta">
          ${escapeHtml(item.category || "Без категории")} • ${formatPrice(item.price)}
        </div>
        <p>${escapeHtml(item.desc || "")}</p>
        <div class="admin-card-actions">
          <button class="secondary-btn" onclick="openEditModal(${Number(item.id)})">Редактировать</button>
        </div>
      </div>
    </article>
  `).join("");
}

function openCreateModal() {
  editingId = null;
  modalTitle.textContent = "Новый товар";
  deleteBtn.classList.add("hidden");

  nameInput.value = "";
  categoryInput.value = "";
  priceInput.value = "";
  badgeInput.value = "";
  imageInput.value = "";
  imageFileInput.value = "";
  descInput.value = "";

  updatePreview();
  editorModal.classList.remove("hidden");
}

function openEditModal(id) {
  const item = items.find(x => Number(x.id) === Number(id));
  if (!item) return;

  editingId = item.id;
  modalTitle.textContent = `Редактирование #${item.id}`;
  deleteBtn.classList.remove("hidden");

  nameInput.value = item.name || "";
  categoryInput.value = item.category || "";
  priceInput.value = item.price || "";
  badgeInput.value = item.badge || "";
  imageInput.value = item.image || "";
  imageFileInput.value = "";
  descInput.value = item.desc || "";

  updatePreview();
  editorModal.classList.remove("hidden");
}

function closeEditor() {
  editorModal.classList.add("hidden");
}

async function uploadSelectedImage() {
  const file = imageFileInput.files[0];
  if (!file) {
    alert("Выберите файл");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/upload?user_id=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: initData ? { "X-Telegram-Init-Data": initData } : {},
      body: formData
    });

    const data = await safeJson(res);

    if (!res.ok || !data?.ok) {
      alert("Ошибка загрузки файла");
      return;
    }

    imageInput.value = data.image || "";
    updatePreview();
    alert("Фото загружено");
  } catch (error) {
    console.error("uploadSelectedImage error:", error);
    alert("Ошибка загрузки файла");
  }
}

async function saveCurrentItem() {
  const payload = {
    user_id: userId,
    name: nameInput.value.trim(),
    category: categoryInput.value.trim(),
    price: Number(priceInput.value || 0),
    badge: badgeInput.value.trim(),
    image: imageInput.value.trim(),
    desc: descInput.value.trim()
  };

  if (!payload.name) {
    alert("Введите название");
    return;
  }

  try {
    let res;

    if (editingId) {
      res = await fetch(`${API_BASE}/menu/${editingId}`, {
        method: "PUT",
        headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch(`${API_BASE}/menu`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      });
    }

    const response = await safeJson(res);

    if (!res.ok || !response?.ok) {
      alert("Ошибка сохранения");
      return;
    }

    closeEditor();
    await loadItems();

    if (tg?.sendData) {
      try {
        tg.sendData(JSON.stringify({
          admin_action: "admin_saved",
          item_name: response.item?.name || payload.name
        }));
      } catch (e) {
        console.warn("tg.sendData warning:", e);
      }
    }
  } catch (error) {
    console.error("saveCurrentItem error:", error);
    alert("Ошибка сохранения");
  }
}

async function deleteCurrentItem() {
  if (!editingId) return;

  const ok = confirm("Удалить товар?");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/menu/${editingId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: getAdminHeaders(null)
    });

    const data = await safeJson(res);

    if (!res.ok || (data && data.ok === false)) {
      alert("Ошибка удаления");
      return;
    }

    closeEditor();
    await loadItems();
  } catch (error) {
    console.error("deleteCurrentItem error:", error);
    alert("Ошибка удаления");
  }
}

function bindPreview() {
  [nameInput, categoryInput, priceInput, badgeInput, imageInput, descInput].forEach(el => {
    el.addEventListener("input", updatePreview);
  });

  imageFileInput.addEventListener("change", () => {
    const file = imageFileInput.files[0];
    if (!file) {
      updatePreview();
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      previewImage.src = e.target?.result || "assets/logo.jpg";
    };
    reader.readAsDataURL(file);
  });

  updatePreview();
}

function updatePreview() {
  previewName.textContent = nameInput.value.trim() || "Название";
  previewDesc.textContent = descInput.value.trim() || "Описание товара";
  previewBadge.textContent = badgeInput.value.trim() || "Бейдж";
  previewPrice.textContent = formatPrice(Number(priceInput.value || 0));

  const src = imageInput.value.trim() || "assets/logo.jpg";
  previewImage.src = src;
  previewImage.onerror = () => {
    previewImage.onerror = null;
    previewImage.src = "assets/logo.jpg";
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
