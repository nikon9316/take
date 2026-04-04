const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || null;
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
  if (!userId) {
    document.body.innerHTML = `<div class="shell"><div class="empty-state">Откройте админку из Telegram.</div></div>`;
    return;
  }

  await loadItems();
  bindPreview();
}

async function loadItems() {
  const res = await fetch(`${API_BASE}/menu?user_id=${userId}`);
  if (!res.ok) {
    document.body.innerHTML = `<div class="shell"><div class="empty-state">Нет доступа к админке.</div></div>`;
    return;
  }

  items = await res.json();
  renderStats();
  renderCategoryFilter();
  renderItems();

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  if (editId) {
    openEditModal(Number(editId));
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " сум";
}

function renderStats() {
  const total = items.length;
  const totalCategories = new Set(items.map(item => item.category)).size;
  const avgPrice = total ? Math.round(items.reduce((sum, item) => sum + Number(item.price || 0), 0) / total) : 0;

  statsRow.innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Товаров</div></div>
    <div class="stat-card"><div class="stat-value">${totalCategories}</div><div class="stat-label">Категорий</div></div>
    <div class="stat-card"><div class="stat-value">${formatPrice(avgPrice)}</div><div class="stat-label">Средняя цена</div></div>
  `;
}

function renderCategoryFilter() {
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
  const current = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="">Все категории</option>` +
    categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  categoryFilter.value = current;
}

function renderItems() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  const filtered = items.filter(item => {
    const matchQuery =
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query);
    const matchCategory = !category || item.category === category;
    return matchQuery && matchCategory;
  });

  if (!filtered.length) {
    itemsGrid.innerHTML = `<div class="empty-state">Ничего не найдено</div>`;
    return;
  }

  itemsGrid.innerHTML = filtered.map(item => `
    <article class="admin-card">
      <img src="${item.image || 'assets/logo.jpg'}" alt="${escapeHtml(item.name)}" class="admin-card-image">
      <div class="admin-card-body">
        <div class="admin-card-badge">${escapeHtml(item.badge || 'Без бейджа')}</div>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="admin-card-meta">${escapeHtml(item.category)} • ${formatPrice(item.price)}</div>
        <p>${escapeHtml(item.desc || '')}</p>
        <div class="admin-card-actions">
          <button class="secondary-btn" onclick="openEditModal(${item.id})">Редактировать</button>
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
    alert('Выберите файл');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload?user_id=${userId}`, {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    alert('Ошибка загрузки файла');
    return;
  }

  imageInput.value = data.image;
  updatePreview();
  alert('Фото загружено');
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

  let res;
  if (editingId) {
    res = await fetch(`${API_BASE}/menu/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    res = await fetch(`${API_BASE}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  if (!res.ok) {
    alert("Ошибка сохранения");
    return;
  }

  const response = await res.json();
  closeEditor();
  await loadItems();
  tg.sendData(JSON.stringify({
    admin_action: "admin_saved",
    item_name: response.item?.name || payload.name
  }));
}

async function deleteCurrentItem() {
  if (!editingId) return;
  const ok = confirm("Удалить товар?");
  if (!ok) return;

  const res = await fetch(`${API_BASE}/menu/${editingId}?user_id=${userId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("Ошибка удаления");
    return;
  }

  closeEditor();
  await loadItems();
}

function bindPreview() {
  [nameInput, categoryInput, priceInput, badgeInput, imageInput, descInput].forEach(el => {
    el.addEventListener("input", updatePreview);
  });

  imageFileInput.addEventListener('change', () => {
    const file = imageFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      previewImage.src = e.target.result;
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
  previewImage.src = imageInput.value.trim() || "assets/logo.jpg";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
