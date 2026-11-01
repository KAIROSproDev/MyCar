const STORAGE_KEY = "mycar_data_v2";

const defaultData = {
  vehicle: {
    brand: "", model: "", year: "", plate: "",
    odometer: "", fuelType: "Flex"
  },
  fuels: [],
  expenses: [],
  recurring: [],
  financing: null,
  maintenance: []
};

let data = loadData();

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...structuredClone(defaultData), ...saved } : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency", currency: "BRL"
  });
}

function number(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  return today().slice(0, 7);
}

function monthName(month) {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  }[char]));
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2600);
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(item => item.classList.remove("active"));
  document.querySelectorAll("[data-page]").forEach(item => item.classList.toggle("active", item.dataset.page === page));

  const selected = document.getElementById(`page-${page}`);
  if (selected) selected.classList.add("active");

  const titles = {
    dashboard: "Visão geral",
    fuel: "Abastecimentos",
    expenses: "Despesas",
    recurring: "Contas mensais",
    financing: "Financiamento",
    maintenance: "Manutenção",
    vehicle: "Meu veículo"
  };

  document.getElementById("page-title").textContent = titles[page] || "MyCar";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) showPage(pageButton.dataset.page);

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) deleteRecord(deleteButton.dataset.delete, deleteButton.dataset.id);

  const payButton = event.target.closest("[data-pay-recurring]");
  if (payButton) toggleRecurringPayment(payButton.dataset.payRecurring, payButton.dataset.month);

  const financeButton = event.target.closest("[data-pay-installment]");
  if (financeButton) payInstallment();

  const finishButton = event.target.closest("[data-finish-maintenance]");
  if (finishButton) finishMaintenance(finishButton.dataset.finishMaintenance);
});

// MODAIS

const backdrop = document.getElementById("modal-backdrop");
const modalForm = document.getElementById("modal-form");

function openModal(title, fields, submitText, onSubmit) {
  document.getElementById("modal-title").textContent = title;
  modalForm.innerHTML = `<div class="modal-form">${fields}
    <button class="primary-btn" type="submit">${submitText}</button>
  </div>`;

  backdrop.classList.add("open");

  modalForm.onsubmit = event => {
    event.preventDefault();
    const formData = new FormData(modalForm);
    onSubmit(Object.fromEntries(formData.entries()));
    closeModal();
  };
}

function closeModal() {
  backdrop.classList.remove("open");
  modalForm.innerHTML = "";
}

document.getElementById("close-modal").addEventListener("click", closeModal);
backdrop.addEventListener("click", event => {
  if (event.target === backdrop) closeModal();
});

function field(label, name, type = "text", placeholder = "", required = true, value = "") {
  return `
    <label>${label}
      <input name="${name}" type="${type}" placeholder="${placeholder}"
        value="${escapeHTML(value)}" ${required ? "required" : ""}>
    </label>`;
}

function selectField(label, name, options, selected = "") {
  return `
    <label>${label}
      <select name="${name}" required>
        ${options.map(option => `<option value="${escapeHTML(option)}" ${option === selected ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}
      </select>
    </label>`;
}

// ABASTECIMENTOS

document.getElementById("add-fuel").addEventListener("click", () => {
  openModal("Novo abastecimento", `
    ${field("Data", "date", "date", "", true, today())}
    ${field("Quilometragem atual (km)", "odometer", "number", "Ex: 85432")}
    ${field("Quantidade de litros", "liters", "number", "Ex: 40")}
    ${field("Preço por litro (R$)", "price", "number", "Ex: 5.89")}
    ${selectField("Combustível", "type", ["Gasolina", "Etanol", "Diesel", "GNV", "Outro"], "Gasolina")}
    <p class="modal-hint">Informe a quilometragem total que aparece no painel do veículo.</p>
  `, "Salvar abastecimento", values => {
    const liters = Number(values.liters);
    const price = Number(values.price);
    if (liters <= 0 || price <= 0) return toast("Informe valores válidos.");

    data.fuels.push({
      id: crypto.randomUUID(),
      date: values.date,
      odometer: Number(values.odometer),
      liters,
      price,
      total: liters * price,
      type: values.type
    });

    data.fuels.sort((a, b) => a.date.localeCompare(b.date));
    saveData();
    toast("Abastecimento registrado!");
  });
});

function renderFuel() {
  const fuels = [...data.fuels].sort((a, b) => b.date.localeCompare(a.date));
  const total = fuels.reduce((sum, item) => sum + item.total, 0);
  const liters = fuels.reduce((sum, item) => sum + item.liters, 0);
  const average = calculateConsumption();

  document.getElementById("fuel-total").textContent = money(total);
  document.getElementById("fuel-liters").textContent = `${number(liters)} L`;
  document.getElementById("fuel-average").textContent = average ? `${average.toFixed(1)} km/L` : "—";

  document.getElementById("fuel-table").innerHTML = fuels.map(item => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td>${number(item.odometer)} km</td>
      <td>${escapeHTML(item.type)}</td>
      <td>${number(item.liters)} L</td>
      <td><strong>${money(item.total)}</strong></td>
      <td><button class="delete-btn" data-delete="fuel" data-id="${item.id}">Excluir</button></td>
    </tr>
  `).join("");

  document.getElementById("fuel-empty").style.display = fuels.length ? "none" : "block";
}

function calculateConsumption() {
  const fuels = [...data.fuels]
    .filter(item => item.odometer > 0 && item.liters > 0)
    .sort((a, b) => a.odometer - b.odometer);

  if (fuels.length < 2) return 0;

  const first = fuels[0];
  const last = fuels[fuels.length - 1];
  const distance = last.odometer - first.odometer;
  const liters = fuels.slice(1).reduce((sum, item) => sum + item.liters, 0);

  if (distance <= 0 || liters <= 0) return 0;
  return distance / liters;
}

// DESPESAS

document.getElementById("add-expense").addEventListener("click", () => {
  openModal("Nova despesa", `
    ${field("Descrição", "description", "text", "Ex: Troca de óleo")}
    ${selectField("Categoria", "category", ["Seguro", "Documentação", "Manutenção", "Estacionamento", "Lavagem", "Outros"])}
    ${field("Data", "date", "date", "", true, today())}
    ${field("Valor (R$)", "value", "number", "Ex: 150")}
  `, "Salvar despesa", values => {
    if (Number(values.value) <= 0) return toast("Informe um valor válido.");
    data.expenses.push({
      id: crypto.randomUUID(),
      description: values.description,
      category: values.category,
      date: values.date,
      value: Number(values.value)
    });
    saveData();
    toast("Despesa registrada!");
  });
});

function renderExpenses() {
  const filter = document.getElementById("expense-filter").value;
  const expenses = [...data.expenses]
    .filter(item => filter === "all" || item.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("expense-table").innerHTML = expenses.map(item => `
    <tr>
      <td><strong>${escapeHTML(item.description)}</strong></td>
      <td>${escapeHTML(item.category)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${money(item.value)}</td>
      <td><button class="delete-btn" data-delete="expense" data-id="${item.id}">Excluir</button></td>
    </tr>
  `).join("");

  document.getElementById("expense-empty").style.display = expenses.length ? "none" : "block";
}

document.getElementById("expense-filter").addEventListener("change", renderExpenses);

// CONTAS MENSAIS / DESPESAS RECORRENTES

document.getElementById("add-recurring").addEventListener("click", () => {
  openModal("Nova conta mensal", `
    ${field("Nome da cobrança", "name", "text", "Ex: Seguro do veículo")}
    ${field("Valor mensal (R$)", "value", "number", "Ex: 350")}
    ${field("Dia do vencimento", "day", "number", "Ex: 10")}
    ${field("Primeiro mês de cobrança", "startMonth", "month", "", true, currentMonth())}
    <p class="modal-hint">A conta aparecerá todos os meses. Você precisará confirmar o pagamento de cada mês.</p>
  `, "Cadastrar conta", values => {
    const value = Number(values.value);
    const day = Number(values.day);

    if (value <= 0 || day < 1 || day > 31) {
      return toast("Confira o valor e o dia de vencimento.");
    }

    data.recurring.push({
      id: crypto.randomUUID(),
      name: values.name,
      value,
      day,
      startMonth: values.startMonth,
      payments: []
    });

    saveData();
    toast("Conta mensal cadastrada!");
  });
});

function isRecurringPaid(item, month) {
  return item.payments.includes(month);
}

function toggleRecurringPayment(id, month) {
  const item = data.recurring.find(entry => entry.id === id);
  if (!item) return;

  if (isRecurringPaid(item, month)) {
    item.payments = item.payments.filter(payment => payment !== month);
    toast("Pagamento desmarcado.");
  } else {
    item.payments.push(month);
    toast("Pagamento confirmado!");
  }

  saveData();
}

function renderRecurring() {
  const month = currentMonth();
  const list = data.recurring.filter(item => item.startMonth <= month);

  const paid = list.filter(item => isRecurringPaid(item, month));
  const pending = list.filter(item => !isRecurringPaid(item, month));
  const monthlyTotal = list.reduce((sum, item) => sum + item.value, 0);

  document.getElementById("recurring-total").textContent = money(monthlyTotal);
  document.getElementById("recurring-paid").textContent = paid.length;
  document.getElementById("recurring-pending").textContent = pending.length;

  document.getElementById("recurring-list").innerHTML = list.map(item => {
    const isPaid = isRecurringPaid(item, month);
    const overdue = !isPaid && Number(today().slice(8, 10)) > item.day;

    return `
      <article class="recurring-card">
        <div class="recurring-info">
          <h4>${escapeHTML(item.name)}</h4>
          <p>Vencimento: dia ${item.day} · ${monthName(month)}</p>
          <span class="status ${isPaid ? "paid" : overdue ? "overdue" : "pending"}">
            ${isPaid ? "✓ Pago" : overdue ? "Vencido" : "Pendente"}
          </span>
        </div>
        <div class="recurring-right">
          <strong class="recurring-price">${money(item.value)}</strong>
          <div class="recurring-actions">
            <button class="small-btn ${isPaid ? "paid-btn" : ""}" data-pay-recurring="${item.id}" data-month="${month}">
              ${isPaid ? "Desfazer" : "Confirmar pagamento"}
            </button>
            <button class="delete-btn" data-delete="recurring" data-id="${item.id}">Excluir</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.getElementById("recurring-empty").style.display = list.length ? "none" : "block";
}

// FINANCIAMENTO

document.getElementById("edit-financing").addEventListener("click", () => {
  const finance = data.financing || {};
  const alreadyPaid = finance.paid || 0;

  openModal("Configurar financiamento", `
    ${field("Valor de compra do veículo (R$)", "purchasePrice", "number", "Ex: 200000", true, finance.purchasePrice || "")}
    ${field("Valor já pago (R$)", "paid", "number", "Ex: 20000", true, alreadyPaid)}
    ${field("Valor da parcela mensal (R$)", "installment", "number", "Ex: 2400", true, finance.installment || "")}
    ${field("Dia do vencimento", "day", "number", "Ex: 15", true, finance.day || "10")}
    ${field("Primeiro mês das parcelas", "startMonth", "month", "", true, finance.startMonth || currentMonth())}
    <p class="modal-hint">O valor já pago pode incluir a entrada e parcelas que você pagou antes de cadastrar o MyCar. Os próximos pagamentos serão adicionados ao total automaticamente.</p>
  `, "Salvar financiamento", values => {
    const purchasePrice = Number(values.purchasePrice);
    const paid = Number(values.paid);
    const installment = Number(values.installment);
    const day = Number(values.day);

    if (purchasePrice <= 0 || paid < 0 || installment <= 0 || day < 1 || day > 31 || paid > purchasePrice) {
      return toast("Confira os valores informados.");
    }

    data.financing = {
      purchasePrice,
      paid,
      installment,
      day,
      startMonth: values.startMonth,
      payments: finance.payments || []
    };

    saveData();
    toast("Financiamento atualizado!");
  });
});

function payInstallment() {
  const finance = data.financing;
  if (!finance) return;

  const remaining = finance.purchasePrice - finance.paid;
  if (remaining <= 0) return toast("Veículo já quitado!");

  const amount = Math.min(finance.installment, remaining);

  if (!confirm(`Confirmar pagamento de ${money(amount)}?`)) return;

  finance.paid += amount;
  finance.payments.push({
    id: crypto.randomUUID(),
    date: today(),
    value: amount
  });

  saveData();
  toast("Parcela registrada com sucesso!");
}

function renderFinancing() {
  const container = document.getElementById("financing-content");
  const finance = data.financing;

  if (!finance) {
    container.innerHTML = `
      <section class="panel empty-state">
        <h3>Nenhum financiamento cadastrado</h3>
        <p style="margin:10px 0 18px">Configure os valores do seu veículo para acompanhar a quitação.</p>
        <button class="primary-btn" id="empty-finance-btn">Configurar financiamento</button>
      </section>`;
    document.getElementById("empty-finance-btn").addEventListener("click", () => {
      document.getElementById("edit-financing").click();
    });
    return;
  }

  const remaining = Math.max(0, finance.purchasePrice - finance.paid);
  const progress = Math.min(100, (finance.paid / finance.purchasePrice) * 100);
  const installmentsLeft = remaining > 0 ? Math.ceil(remaining / finance.installment) : 0;
  const isPaidOff = remaining <= 0;
  const payments = [...(finance.payments || [])].reverse();

  container.innerHTML = `
    <section class="finance-hero">
      <span class="eyebrow">SALDO DEVEDOR</span>
      <div class="balance">${money(remaining)}</div>
      <p>${isPaidOff ? "Parabéns! Seu veículo está quitado." : "Este é o valor que falta para quitar seu veículo."}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
      <p>${progress.toFixed(1)}% do veículo pago</p>
    </section>

    <div class="finance-stats">
      <article class="finance-stat"><span>Valor do veículo</span><strong>${money(finance.purchasePrice)}</strong></article>
      <article class="finance-stat"><span>Valor já pago</span><strong style="color:var(--green)">${money(finance.paid)}</strong></article>
      <article class="finance-stat"><span>Parcela mensal</span><strong>${money(finance.installment)}</strong></article>
    </div>

    <section class="panel">
      <div class="panel-heading"><div><span class="eyebrow">PLANEJAMENTO</span><h3>Situação do financiamento</h3></div></div>
      <div class="finance-details">
        <div class="finance-detail"><span>Parcelas estimadas restantes</span><strong>${installmentsLeft}</strong></div>
        <div class="finance-detail"><span>Vencimento mensal</span><strong>Dia ${finance.day}</strong></div>
        <div class="finance-detail"><span>Início do acompanhamento</span><strong>${monthName(finance.startMonth)}</strong></div>
        <div class="finance-detail"><span>Percentual quitado</span><strong>${progress.toFixed(1)}%</strong></div>
      </div>
      <p class="modal-hint" style="margin-top:15px">Estimativa simples: não considera juros futuros, seguros embutidos ou alterações no contrato bancário.</p>
      <button class="primary-btn" data-pay-installment ${isPaidOff ? "disabled" : ""} style="width:100%;margin-top:18px">
        ${isPaidOff ? "Veículo quitado ✓" : `Registrar pagamento de ${money(Math.min(finance.installment, remaining))}`}
      </button>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><span class="eyebrow">HISTÓRICO</span><h3>Parcelas registradas</h3></div></div>
      ${payments.length ? payments.map(payment => `
        <div class="finance-payment">
          <div><strong>Pagamento registrado</strong><p>${formatDate(payment.date)}</p></div>
          <strong style="color:var(--green)">${money(payment.value)}</strong>
        </div>
      `).join("") : '<div class="empty-state">Nenhuma parcela registrada pelo MyCar.</div>'}
    </section>`;
}

// MANUTENÇÃO

document.getElementById("add-maintenance").addEventListener("click", () => {
  openModal("Nova manutenção", `
    ${field("Serviço", "name", "text", "Ex: Troca de óleo")}
    ${field("Data prevista", "date", "date", "", true, today())}
    ${field("Quilometragem prevista (km)", "odometer", "number", "Ex: 90000", false)}
    ${field("Valor estimado (R$)", "value", "number", "Ex: 250", false)}
  `, "Salvar manutenção", values => {
    data.maintenance.push({
      id: crypto.randomUUID(),
      name: values.name,
      date: values.date,
      odometer: Number(values.odometer || 0),
      value: Number(values.value || 0),
      completed: false
    });
    saveData();
    toast("Manutenção cadastrada!");
  });
});

function finishMaintenance(id) {
  const item = data.maintenance.find(entry => entry.id === id);
  if (!item) return;
  item.completed = !item.completed;
  saveData();
  toast(item.completed ? "Manutenção concluída!" : "Manutenção reaberta.");
}

function renderMaintenance() {
  const list = [...data.maintenance].sort((a, b) => a.date.localeCompare(b.date));

  document.getElementById("maintenance-list").innerHTML = list.map(item => `
    <div class="recurring-card">
      <div class="recurring-info">
        <h4>${escapeHTML(item.name)}</h4>
        <p>Data: ${formatDate(item.date)} · ${item.odometer ? `${number(item.odometer)} km` : "Sem quilometragem"}</p>
        <p>Valor estimado: ${money(item.value)}</p>
        <span class="status ${item.completed ? "paid" : "pending"}">${item.completed ? "Concluída" : "Pendente"}</span>
      </div>
      <div class="recurring-actions">
        <button class="small-btn ${item.completed ? "paid-btn" : ""}" data-finish-maintenance="${item.id}">
          ${item.completed ? "Reabrir" : "Concluir"}
        </button>
        <button class="delete-btn" data-delete="maintenance" data-id="${item.id}">Excluir</button>
      </div>
    </div>
  `).join("");

  document.getElementById("maintenance-empty").style.display = list.length ? "none" : "block";
}

// VEÍCULO

function renderVehicle() {
  const form = document.getElementById("vehicle-form");
  Object.entries(data.vehicle).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input) input.value = value ?? "";
  });

  const name = [data.vehicle.brand, data.vehicle.model].filter(Boolean).join(" ");
  document.getElementById("top-vehicle-name").textContent = name || "Meu veículo";
}

document.getElementById("vehicle-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.target);
  data.vehicle = Object.fromEntries(form.entries());
  saveData();
  toast("Dados do veículo salvos!");
});

// EXCLUSÃO

function deleteRecord(type, id) {
  if (!confirm("Tem certeza que deseja excluir este registro?")) return;

  const collections = {
    fuel: "fuels",
    expense: "expenses",
    recurring: "recurring",
    maintenance: "maintenance"
  };

  const collection = collections[type];
  if (!collection) return;

  data[collection] = data[collection].filter(item => item.id !== id);
  saveData();
  toast("Registro excluído.");
}

// DASHBOARD

function renderDashboard() {
  const month = currentMonth();

  const fuels = data.fuels.filter(item => item.date?.startsWith(month));
  const expenses = data.expenses.filter(item => item.date?.startsWith(month));
  const recurring = data.recurring.filter(item =>
    item.startMonth <= month && isRecurringPaid(item, month)
  );

  const fuelTotal = fuels.reduce((sum, item) => sum + item.total, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.value, 0);
  const recurringTotal = recurring.reduce((sum, item) => sum + item.value, 0);
  const total = fuelTotal + expenseTotal + recurringTotal;

  const pending = data.recurring.filter(item =>
    item.startMonth <= month && !isRecurringPaid(item, month)
  );

  document.getElementById("stat-month-expenses").textContent = money(total);
  document.getElementById("stat-fuel-count").textContent = data.fuels.length;
  const average = calculateConsumption();
  document.getElementById("stat-consumption").textContent = average ? `${average.toFixed(1)} km/L` : "—";
  document.getElementById("stat-pending").textContent = pending.length;

  document.getElementById("dash-fuel").textContent = money(fuelTotal);
  document.getElementById("dash-expenses").textContent = money(expenseTotal);
  document.getElementById("dash-recurring").textContent = money(recurringTotal);
  document.getElementById("dash-total").textContent = money(total);

  document.getElementById("dashboard-pending").innerHTML = pending.length
    ? pending.slice(0, 5).map(item => `
      <div class="summary-line">
        <span>${escapeHTML(item.name)}</span>
        <strong>${money(item.value)}</strong>
      </div>
    `).join("")
    : "Nenhuma conta pendente neste mês.";

  const finance = data.financing;
  document.getElementById("dashboard-financing").innerHTML = finance
    ? `
      <div class="summary-line"><span>Saldo devedor</span><strong>${money(Math.max(0, finance.purchasePrice - finance.paid))}</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, finance.paid / finance.purchasePrice * 100)}%"></div></div>
      <small style="color:var(--muted)">${(Math.min(100, finance.paid / finance.purchasePrice * 100)).toFixed(1)}% quitado</small>
    `
    : "Nenhum financiamento cadastrado.";

  const activities = [
    ...data.fuels.map(item => ({ label: "Abastecimento", detail: item.type, date: item.date, value: item.total })),
    ...data.expenses.map(item => ({ label: item.description, detail: item.category, date: item.date, value: item.value })),
    ...data.maintenance.map(item => ({ label: item.name, detail: item.completed ? "Concluída" : "Manutenção", date: item.date, value: item.value }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  document.getElementById("recent-activity").innerHTML = activities.length
    ? activities.map(item => `
      <div class="summary-line">
        <span>${escapeHTML(item.label)} <small style="display:block;color:#777;margin-top:4px">${escapeHTML(item.detail)} · ${formatDate(item.date)}</small></span>
        <strong>${money(item.value)}</strong>
      </div>
    `).join("")
    : "Nenhuma atividade registrada.";
}

// BACKUP

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mycar-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado!");
});

document.getElementById("import-btn").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (!imported.vehicle || !Array.isArray(imported.fuels) ||
        !Array.isArray(imported.expenses) || !Array.isArray(imported.recurring)) {
      throw new Error("Arquivo inválido");
    }

    if (!confirm("Importar este backup substituirá os dados atuais. Continuar?")) return;

    data = { ...structuredClone(defaultData), ...imported };
    saveData();
    toast("Backup importado!");
  } catch {
    toast("Não foi possível importar esse arquivo.");
  } finally {
    event.target.value = "";
  }
});

// ATUALIZAÇÃO GERAL

function renderAll() {
  renderVehicle();
  renderFuel();
  renderExpenses();
  renderRecurring();
  renderFinancing();
  renderMaintenance();
  renderDashboard();
}

renderAll();

// SERVICE WORKER

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Service Worker não registrado:", error);
    });
  });
}

// ======================================
// DOAÇÕES AO DESENVOLVEDOR
// ======================================

const donationWallets = {
  bitcoin: {
    name: "Bitcoin",
    network: "Rede Bitcoin",
    address: "12y5kYVV2XaAdivMN9UyDfKJEQuQxjw9P8"
  },

  ethereum: {
    name: "Ethereum",
    network: "Rede Ethereum",
    address: "0x8418c225d7fd6feda42ea37603c7c8d024599d0e"
  },

  solana: {
    name: "Solana",
    network: "Rede Solana",
    address: "4tAnXXtK8vHoCHtRdQ2ZixB3YSLWhUrGe18Yn4C92uBK"
  },

  lightning: {
    name: "Bitcoin Lightning",
    network: "LNURL",
    address: "Inurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhqctjvd5x2erxd3sk6efnxglg8jg4"
  }
};

// Cria os elementos da área de doação
const donationElements = document.createElement("div");

donationElements.innerHTML = `
  <button class="floating-donate" id="open-donation">
    ♡ Doar ao desenvolvedor
  </button>

  <div class="donation-backdrop" id="donation-backdrop">
    <section class="donation-modal">

      <div class="donation-heading">
        <h2>♡ Apoie o MyCar</h2>

        <button class="close-modal" id="close-donation">
          ×
        </button>
      </div>

      <p class="donation-description">
        Gostou do MyCar? Você pode apoiar o desenvolvimento
        fazendo uma doação de qualquer valor.
        Agradeço muito pelo apoio!
      </p>

      <div class="donation-options">

        <button class="donation-option selected"
          data-wallet="bitcoin">
          <strong>₿ Bitcoin</strong>
          <span>Rede Bitcoin</span>
        </button>

        <button class="donation-option"
          data-wallet="ethereum">
          <strong>Ξ Ethereum</strong>
          <span>Rede Ethereum</span>
        </button>

        <button class="donation-option"
          data-wallet="solana">
          <strong>◎ Solana</strong>
          <span>Rede Solana</span>
        </button>

        <button class="donation-option"
          data-wallet="lightning">
          <strong>⚡ Lightning</strong>
          <span>Bitcoin LNURL</span>
        </button>

      </div>

      <div class="donation-address-box">

        <label id="donation-network">
          Endereço Bitcoin
        </label>

        <div class="donation-address" id="donation-address"></div>

        <button class="donation-copy" id="copy-donation">
          Copiar endereço
        </button>

      </div>

      <p class="donation-note">
        Após copiar o endereço, abra sua carteira,
        escolha a rede correspondente e envie o valor
        que desejar. Confira sempre a rede antes de enviar.
      </p>

    </section>
  </div>

  <button class="visit-counter" id="visit-counter"
    title="Acessos totais ao MyCar">
    ◉ <span id="visit-count">...</span> acessos
  </button>
`;

document.body.appendChild(donationElements);

// Abre e fecha a área de doação

const donationBackdrop =
  document.getElementById("donation-backdrop");

document.getElementById("open-donation").addEventListener("click", () => {
  donationBackdrop.classList.add("open");
});

document.getElementById("close-donation").addEventListener("click", () => {
  donationBackdrop.classList.remove("open");
});

donationBackdrop.addEventListener("click", event => {
  if (event.target === donationBackdrop) {
    donationBackdrop.classList.remove("open");
  }
});

// Seleção da criptomoeda

let selectedWallet = "bitcoin";

function selectDonationWallet(wallet) {
  const selected = donationWallets[wallet];

  if (!selected) return;

  selectedWallet = wallet;

  document.getElementById("donation-network").textContent =
    selected.name + " · " + selected.network;

  document.getElementById("donation-address").textContent =
    selected.address;

  document.querySelectorAll(".donation-option").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.wallet === wallet
    );
  });
}

document.querySelectorAll(".donation-option").forEach(button => {
  button.addEventListener("click", () => {
    selectDonationWallet(button.dataset.wallet);
  });
});

// Endereço inicial
selectDonationWallet("bitcoin");

// Copiar endereço

document.getElementById("copy-donation").addEventListener("click", async () => {
  const address = donationWallets[selectedWallet].address;
  const button = document.getElementById("copy-donation");

  try {
    await navigator.clipboard.writeText(address);

    button.textContent = "✓ Endereço copiado!";

    setTimeout(() => {
      button.textContent = "Copiar endereço";
    }, 2200);

  } catch (error) {
    const temporaryInput = document.createElement("textarea");

    temporaryInput.value = address;
    document.body.appendChild(temporaryInput);

    temporaryInput.select();
    document.execCommand("copy");

    temporaryInput.remove();

    button.textContent = "✓ Endereço copiado!";

    setTimeout(() => {
      button.textContent = "Copiar endereço";
    }, 2200);
  }
});


// ======================================
// CONTADOR GLOBAL DE ACESSOS
// ======================================

async function updateVisitCounter() {
  const counterElement = document.getElementById("visit-count");

  try {
    const response = await fetch(
      "https://counterapi.com/api/mycar-gestao-veiculo-2026/view/site-visits"
    );

    if (!response.ok) {
      throw new Error("Não foi possível consultar o contador.");
    }

    const result = await response.json();

    counterElement.textContent =
      Number(result.value).toLocaleString("pt-BR");

  } catch (error) {
    counterElement.textContent = "—";
    console.warn("Erro no contador de acessos:", error);
  }
}

updateVisitCounter();