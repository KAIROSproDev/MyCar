
// ======================================
// MYCAR - SISTEMA PRINCIPAL
// ======================================

const STORAGE_KEY = "mycar_data_v1";

const money = value =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value) || 0);

const todayISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000)
    .toISOString().slice(0, 10);
};

const dateBR = value =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";

const monthKey = date => (date || "").slice(0, 7);

const uid = () =>
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 7);

// ======================================
// BANCO DE DADOS LOCAL
// ======================================

function defaultData() {
  return {
    vehicle: {
      name: "Meu veículo",
      brand: "",
      model: "",
      year: "",
      plate: "",
      km: 0,
      fuelType: "Flex"
    },
    fuel: [],
    expenses: [],
    maintenance: []
  };
}

function loadData() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (!saved || typeof saved !== "object") {
      return defaultData();
    }

    return {
      ...defaultData(),
      ...saved,
      vehicle: {
        ...defaultData().vehicle,
        ...(saved.vehicle || {})
      },
      fuel: Array.isArray(saved.fuel) ? saved.fuel : [],
      expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
      maintenance: Array.isArray(saved.maintenance)
        ? saved.maintenance
        : []
    };

  } catch {
    return defaultData();
  }
}

let data = loadData();
let activeModal = null;
let toastTimer;

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    renderAll();

  } catch (error) {
    notify("Erro ao salvar. Verifique o espaço disponível.");
    console.error(error);
  }
}

// ======================================
// FUNÇÕES AUXILIARES
// ======================================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function sum(items, field) {
  return items.reduce(
    (total, item) =>
      total + (Number(item[field]) || 0),
    0
  );
}

function currentMonthItems(items) {
  return items.filter(
    item => monthKey(item.date) === monthKey(todayISO())
  );
}

function notify(message) {
  const element = document.getElementById("toast");

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 2600);
}

// ======================================
// CÁLCULOS
// ======================================

function allCosts() {
  const fuelCosts = data.fuel.map(item => ({
    ...item,
    kind: "fuel",
    title: "Abastecimento",
    amount: Number(item.total)
  }));

  const otherCosts = data.expenses.map(item => ({
    ...item,
    kind: "expense",
    title: item.description,
    amount: Number(item.amount)
  }));

  return [...fuelCosts, ...otherCosts].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "")
  );
}

// Calcula o consumo estimado entre abastecimentos
function consumption() {
  const entries = [...data.fuel]
    .filter(item =>
      Number(item.km) > 0 &&
      Number(item.liters) > 0
    )
    .sort((a, b) => Number(a.km) - Number(b.km));

  if (entries.length < 2) {
    return null;
  }

  let liters = 0;
  let distance = 0;

  for (let i = 1; i < entries.length; i++) {
    const difference =
      Number(entries[i].km) -
      Number(entries[i - 1].km);

    if (difference > 0) {
      distance += difference;
      liters += Number(entries[i].liters);
    }
  }

  if (!distance || !liters) {
    return null;
  }

  return distance / liters;
}

function nextMaintenance() {
  const pending = data.maintenance
    .filter(item => !item.done)
    .map(item => ({
      ...item,
      days: item.date
        ? Math.ceil(
            (new Date(item.date + "T23:59:59") - new Date()) /
            86400000
          )
        : 99999
    }))
    .sort((a, b) => a.days - b.days);

  return pending[0] || null;
}

// ======================================
// RENDERIZAÇÃO GERAL
// ======================================

function renderAll() {
  renderVehicle();
  renderDashboard();
  renderFuel();
  renderExpenses();
  renderMaintenance();
}

// ======================================
// VEÍCULO
// ======================================

function renderVehicle() {
  const vehicle = data.vehicle;

  const name =
    [vehicle.brand, vehicle.model]
      .filter(Boolean)
      .join(" ") ||
    vehicle.name ||
    "Meu veículo";

  setText("hero-vehicle", name);

  setText(
    "hero-details",
    [
      vehicle.year,
      vehicle.fuelType,
      Number(vehicle.km || 0).toLocaleString("pt-BR") + " km"
    ].filter(Boolean).join(" • ")
  );

  setText(
    "hero-plate",
    (vehicle.plate || "SEM PLACA").toUpperCase()
  );

  setText("profile-name", name);

  setText(
    "profile-plate",
    vehicle.plate
      ? "Placa " + vehicle.plate
      : "Placa não informada"
  );

  setText(
    "profile-km",
    Number(vehicle.km || 0).toLocaleString("pt-BR") + " km"
  );

  const form = document.getElementById("vehicle-form");

  Object.entries(vehicle).forEach(([key, value]) => {
    if (form.elements[key]) {
      form.elements[key].value = value ?? "";
    }
  });
}

// ======================================
// DASHBOARD
// ======================================

function renderDashboard() {
  const costs = allCosts();

  const monthly = costs.filter(
    item => monthKey(item.date) === monthKey(todayISO())
  );

  setText("stat-month", money(sum(monthly, "amount")));

  setText("stat-fuel", data.fuel.length);

  const average = consumption();

  setText(
    "stat-consumption",
    average
      ? average.toFixed(1).replace(".", ",") + " km/L"
      : "—"
  );

  const next = nextMaintenance();

  setText(
    "stat-next",
    next ? next.title : "Nenhuma"
  );

  setText(
    "stat-next-sub",
    next
      ? next.date
        ? "Data: " + dateBR(next.date)
        : next.km
          ? "Em " + Number(next.km).toLocaleString("pt-BR") + " km"
          : "Agendada"
      : "Cadastre uma manutenção"
  );

  // Gastos recentes

  const recent = document.getElementById("recent-expenses");

  recent.innerHTML = costs.slice(0, 5).map(item => `
    <div class="activity-row">

      <div class="activity-icon">
        ${item.kind === "fuel" ? "⛽" : "↗"}
      </div>

      <div class="activity-main">
        <strong>${escapeHTML(item.title)}</strong>
        <small>${dateBR(item.date)}</small>
      </div>

      <span class="activity-value">
        ${money(item.amount)}
      </span>

    </div>
  `).join("") ||
    '<div class="empty-state">Seus lançamentos aparecerão aqui.</div>';

  // Lembretes

  const reminders = document.getElementById(
    "dashboard-reminders"
  );

  const list = data.maintenance
    .filter(item => !item.done)
    .sort((a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999")
    )
    .slice(0, 4);

  reminders.innerHTML = list.map(item => `
    <div class="reminder-row">
      <span class="reminder-mark"></span>

      <div class="reminder-main">
        <strong>${escapeHTML(item.title)}</strong>
        <small>
          ${item.date
            ? dateBR(item.date)
            : item.km
              ? Number(item.km).toLocaleString("pt-BR") + " km"
              : "Sem data definida"}
        </small>
      </div>
    </div>
  `).join("") ||
    '<div class="empty-state">Nenhum lembrete por enquanto.</div>';

  setText(
    "today-label",
    new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    }).toUpperCase()
  );
}

// ======================================
// ABASTECIMENTOS
// ======================================

function renderFuel() {
  const total = sum(data.fuel, "total");
  const liters = sum(data.fuel, "liters");

  setText(
    "fuel-total-liters",
    liters.toFixed(1).replace(".", ",") + " L"
  );

  setText("fuel-total-cost", money(total));

  setText(
    "fuel-average-price",
    money(liters ? total / liters : 0)
  );

  setText(
    "fuel-count",
    data.fuel.length + " registros"
  );

  const tbody = document.getElementById("fuel-table");

  tbody.innerHTML = [...data.fuel]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(item => `
      <tr>
        <td>${dateBR(item.date)}</td>
        <td>${escapeHTML(item.station || "—")}</td>
        <td>${Number(item.km).toLocaleString("pt-BR")} km</td>
        <td>${Number(item.liters).toLocaleString("pt-BR")} L</td>
        <td><strong>${money(item.total)}</strong></td>
        <td>
          <button class="delete-btn"
            data-delete="fuel"
            data-id="${item.id}">
            Excluir
          </button>
        </td>
      </tr>
    `).join("");

  document.getElementById("fuel-empty").style.display =
    data.fuel.length ? "none" : "block";
}

// ======================================
// DESPESAS
// ======================================

function renderExpenses() {
  const total = sum(data.expenses, "amount");

  const monthly = sum(
    currentMonthItems(data.expenses),
    "amount"
  );

  setText("expense-total", money(total));
  setText("expense-month", money(monthly));
  setText("expense-count", data.expenses.length);

  const filter = document.getElementById("expense-filter").value;

  const rows = [...data.expenses]
    .filter(item =>
      filter === "all" || item.category === filter
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("expense-table").innerHTML =
    rows.map(item => `
      <tr>
        <td>${dateBR(item.date)}</td>
        <td>${escapeHTML(item.description)}</td>
        <td>${escapeHTML(item.category)}</td>
        <td><strong>${money(item.amount)}</strong></td>
        <td>
          <button class="delete-btn"
            data-delete="expenses"
            data-id="${item.id}">
            Excluir
          </button>
        </td>
      </tr>
    `).join("");

  document.getElementById("expense-empty").style.display =
    rows.length ? "none" : "block";
}

// ======================================
// MANUTENÇÃO
// ======================================

function renderMaintenance() {
  const pending = data.maintenance.filter(item => !item.done);
  const done = data.maintenance.filter(item => item.done);
  const next = nextMaintenance();

  setText("maintenance-pending", pending.length);
  setText("maintenance-done", done.length);

  setText(
    "maintenance-next",
    next ? next.title : "Nenhum"
  );

  const list = document.getElementById("maintenance-list");

  const sorted = [...data.maintenance].sort(
    (a, b) =>
      (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
      (a.date || "9999").localeCompare(b.date || "9999")
  );

  list.innerHTML = sorted.map(item => {
    const late =
      !item.done &&
      item.date &&
      new Date(item.date + "T23:59:59") < new Date();

    const date = item.date
      ? new Date(item.date + "T12:00:00")
      : null;

    return `
      <div class="maintenance-item">

        <div class="maintenance-date">
          ${date
            ? `<strong>${date.getDate().toString().padStart(2, "0")}</strong>
               <small>${date.toLocaleDateString("pt-BR", {month:"short"}).toUpperCase()}</small>`
            : `<strong>—</strong><small>KM</small>`}
        </div>

        <div class="maintenance-details">
          <strong>${escapeHTML(item.title)}</strong>
          <small>
            ${item.date ? dateBR(item.date) : "Sem data"}
            ${item.km ? " • " + Number(item.km).toLocaleString("pt-BR") + " km" : ""}
            ${item.notes ? " • " + escapeHTML(item.notes) : ""}
          </small>
        </div>

        <span class="status ${item.done ? "done" : late ? "late" : ""}">
          ${item.done ? "Concluída" : late ? "Atrasada" : "Pendente"}
        </span>

        <div class="maintenance-actions">
          ${!item.done
            ? `<button class="secondary-btn" data-done="${item.id}">Concluir</button>`
            : ""}
          <button class="delete-btn"
            data-delete="maintenance"
            data-id="${item.id}">✕</button>
        </div>

      </div>
    `;
  }).join("") ||
    '<div class="empty-state">Nenhuma manutenção cadastrada.</div>';
}

// ======================================
// FORMULÁRIOS DOS REGISTROS
// ======================================

const modalTemplates = {
  fuel: {
    title: "Registrar abastecimento",
    fields: [
      ["date", "Data", "date", todayISO(), true],
      ["station", "Posto", "text", "", false],
      ["km", "Quilometragem (km)", "number", "", true],
      ["liters", "Quantidade (litros)", "number", "", true],
      ["price", "Preço por litro (R$)", "number", "", true],
      ["total", "Valor total (R$)", "number", "", true]
    ]
  },

  expense: {
    title: "Adicionar despesa",
    fields: [
      ["date", "Data", "date", todayISO(), true],
      ["description", "Descrição", "text", "", true],
      ["category", "Categoria", "select", "", true],
      ["amount", "Valor (R$)", "number", "", true],
      ["notes", "Observações", "text", "", false]
    ]
  },

  maintenance: {
    title: "Agendar manutenção",
    fields: [
      ["title", "O que precisa ser feito?", "text", "", true],
      ["date", "Data prevista", "date", "", false],
      ["km", "Quilometragem prevista", "number", "", false],
      ["notes", "Observações", "text", "", false]
    ]
  }
};

function openModal(type) {
  activeModal = type;

  const config = modalTemplates[type];

  setText("modal-title", config.title);

  const fields = document.getElementById("modal-fields");

  fields.innerHTML = config.fields.map(
    ([name, label, inputType, value, required]) => {

      let control;

      if (inputType === "select") {
        control = `
          <select name="${name}" required>
            <option value="">Selecione</option>
            ${[
              "Manutenção",
              "Documentação",
              "Seguro",
              "Estacionamento",
              "Multa",
              "Outros"
            ].map(item => `<option>${item}</option>`).join("")}
          </select>
        `;
      } else {
        control = `
          <input
            name="${name}"
            type="${inputType}"
            ${value ? `value="${value}"` : ""}
            ${inputType === "number" ? 'min="0" step="any"' : ""}
            ${required ? "required" : ""}
            placeholder="${inputType === "number" ? "0" : ""}"
          >
        `;
      }

      return `
        <label class="field ${name === "notes" ? "full" : ""}">
          ${label}
          ${control}
        </label>
      `;
    }
  ).join("");

  // Calcula automaticamente o preço total do abastecimento

  if (type === "fuel") {
    const total = fields.querySelector('[name="total"]');
    const liters = fields.querySelector('[name="liters"]');
    const price = fields.querySelector('[name="price"]');

    const calculate = () => {
      if (liters.value && price.value) {
        total.value = (
          Number(liters.value) * Number(price.value)
        ).toFixed(2);
      }
    };

    liters.addEventListener("input", calculate);
    price.addEventListener("input", calculate);
  }

  document.getElementById("modal-backdrop").classList.add("show");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("show");
  activeModal = null;
}

// ======================================
// SALVAR NOVOS REGISTROS
// ======================================

document.getElementById("record-form").addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const item = Object.fromEntries(formData.entries());

    item.id = uid();

    if (activeModal === "fuel") {
      item.km = Number(item.km);
      item.liters = Number(item.liters);
      item.price = Number(item.price);
      item.total = Number(item.total);

      if (!item.total && item.liters && item.price) {
        item.total = item.liters * item.price;
      }

      data.fuel.push(item);

      if (item.km > Number(data.vehicle.km || 0)) {
        data.vehicle.km = item.km;
      }

    } else if (activeModal === "expense") {
      item.amount = Number(item.amount);
      data.expenses.push(item);

    } else if (activeModal === "maintenance") {
      item.km = Number(item.km) || 0;
      item.done = false;

      data.maintenance.push(item);
    }

    closeModal();
    form.reset();

    saveData();
    notify("Registro salvo com sucesso!");
  }
);

// ======================================
// NAVEGAÇÃO
// ======================================

function showPage(page) {
  document.querySelectorAll(".page").forEach(element => {
    element.classList.toggle(
      "active",
      element.id === "page-" + page
    );
  });

  document.querySelectorAll(".nav-item[data-page]").forEach(element => {
    element.classList.toggle(
      "active",
      element.dataset.page === page
    );
  });

  const titles = {
    dashboard: "Visão geral",
    fuel: "Abastecimentos",
    expenses: "Despesas",
    maintenance: "Manutenção",
    vehicle: "Meu veículo"
  };

  setText("page-title", titles[page] || "MyCar");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ======================================
// EVENTOS DE CLIQUE
// ======================================

document.addEventListener("click", event => {

  const pageButton = event.target.closest("[data-page]");

  if (pageButton) {
    showPage(pageButton.dataset.page);
    return;
  }

  const modalButton = event.target.closest("[data-open-modal]");

  if (modalButton) {
    openModal(modalButton.dataset.openModal);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");

  if (deleteButton) {
    if (confirm("Deseja realmente excluir este registro?")) {
      const type = deleteButton.dataset.delete;
      const id = deleteButton.dataset.id;

      data[type] = data[type].filter(item => item.id !== id);

      saveData();
      notify("Registro excluído.");
    }

    return;
  }

  const doneButton = event.target.closest("[data-done]");

  if (doneButton) {
    const item = data.maintenance.find(
      item => item.id === doneButton.dataset.done
    );

    if (item) {
      item.done = true;
      saveData();
      notify("Manutenção concluída!");
    }
  }
});

// ======================================
// VEÍCULO
// ======================================

document.getElementById("vehicle-form").addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    data.vehicle = {
      ...data.vehicle,
      ...Object.fromEntries(formData.entries())
    };

    data.vehicle.km = Number(data.vehicle.km) || 0;

    saveData();
    notify("Veículo atualizado!");
  }
);

// ======================================
// MODAL
// ======================================

document.getElementById("close-modal")
  .addEventListener("click", closeModal);

document.getElementById("cancel-modal")
  .addEventListener("click", closeModal);

document.getElementById("modal-backdrop")
  .addEventListener("click", event => {
    if (event.target.id === "modal-backdrop") {
      closeModal();
    }
  });

// ======================================
// FILTRO DE DESPESAS
// ======================================

document.getElementById("expense-filter")
  .addEventListener("change", renderExpenses);

// ======================================
// BACKUP
// ======================================

function exportBackup() {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `mycar-backup-${todayISO()}.json`;

  link.click();

  URL.revokeObjectURL(url);

  notify("Backup exportado!");
}

document.getElementById("backup-btn")
  .addEventListener("click", exportBackup);

document.getElementById("export-btn")
  .addEventListener("click", exportBackup);

// ======================================
// IMPORTAR BACKUP
// ======================================

document.getElementById("import-btn")
  .addEventListener("click", () => {
    document.getElementById("import-file").click();
  });

document.getElementById("import-file")
  .addEventListener("change", async event => {

    const file = event.target.files[0];

    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());

      if (
        !imported.vehicle ||
        !Array.isArray(imported.fuel) ||
        !Array.isArray(imported.expenses) ||
        !Array.isArray(imported.maintenance)
      ) {
        throw new Error("Formato inválido");
      }

      if (confirm("Importar este backup substituirá os dados atuais. Continuar?")) {
        data = imported;
        saveData();
        notify("Backup importado!");
      }

    } catch (error) {
      notify("Não foi possível ler esse backup.");
    }

    event.target.value = "";
  });

// ======================================
// APAGAR TODOS OS DADOS
// ======================================

document.getElementById("clear-btn")
  .addEventListener("click", () => {

    if (confirm(
      "ATENÇÃO: todos os dados deste aparelho serão apagados. Deseja continuar?"
    )) {
      data = defaultData();
      saveData();
      notify("Dados apagados.");
    }
  });

// ======================================
// INICIALIZAÇÃO
// ======================================

renderAll();

// Registra o aplicativo para funcionamento offline

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(error => console.error("Erro no Service Worker:", error));
  });
}
