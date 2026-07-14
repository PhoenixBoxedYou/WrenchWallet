const fieldIds = [
    "nicknameInput",
    "yearInput",
    "makeInput",
    "modelInput",
    "mileageInput",
    "vinInput",
    "plateInput",
    "fuelInput",
    "engineInput",
    "purchaseDateInput",
    "purchasePriceInput",
    "insuranceExpiryInput",
    "registrationExpiryInput"
];

const saveButton = document.getElementById("saveVehicleBtn");
const cancelEditButton = document.getElementById("cancelEditBtn");
const exportJsonButton = document.getElementById("exportJsonBtn");
const exportCsvButton = document.getElementById("exportCsvBtn");
const clearAllButton = document.getElementById("clearAllBtn");
const vehicleDisplay = document.getElementById("vehicleDisplay");
const formMessage = document.getElementById("formMessage");
const dashboardSummary = document.getElementById("dashboardSummary");
const reminderList = document.getElementById("reminderList");
const expenseList = document.getElementById("expenseList");

let editVehicleId = null;

function loadVehicles() {
    const stored = localStorage.getItem("vehicles");
    if (!stored) {
        return [];
    }

    try {
        const parsed = JSON.parse(stored);
        return (Array.isArray(parsed) ? parsed : [parsed]).map((vehicle) => ({
            id: vehicle.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            nickname: vehicle.nickname || vehicle.nickName || "",
            year: vehicle.year || "",
            make: vehicle.make || "",
            model: vehicle.model || "",
            mileage: vehicle.mileage || "",
            vin: vehicle.vin || "",
            plate: vehicle.plate || "",
            fuelType: vehicle.fuelType || vehicle.fuel || "",
            engineSize: vehicle.engineSize || "",
            purchaseDate: vehicle.purchaseDate || "",
            purchasePrice: vehicle.purchasePrice || "",
            insuranceExpiry: vehicle.insuranceExpiry || "",
            registrationExpiry: vehicle.registrationExpiry || "",
            createdAt: vehicle.createdAt || new Date().toISOString(),
            updatedAt: vehicle.updatedAt || new Date().toISOString(),
            maintenance: Array.isArray(vehicle.maintenance) ? vehicle.maintenance : []
        }));
    } catch (error) {
        console.error("Failed to parse stored vehicles:", error);
        return [];
    }
}

function saveVehicles(vehicles) {
    localStorage.setItem("vehicles", JSON.stringify(vehicles));
}

function formatDateString(value) {
    if (!value) {
        return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function showMessage(message, type = "info") {
    formMessage.textContent = message;
    formMessage.className = `message ${type}`;
    if (message) {
        window.clearTimeout(showMessage.timeout);
        showMessage.timeout = window.setTimeout(() => {
            formMessage.textContent = "";
            formMessage.className = "message";
        }, 5000);
    }
}

function getInputValue(id) {
    return document.getElementById(id).value.trim();
}

function setInputValue(id, value) {
    document.getElementById(id).value = value || "";
}

function gatherVehicleForm() {
    return {
        nickname: getInputValue("nicknameInput"),
        year: getInputValue("yearInput"),
        make: getInputValue("makeInput"),
        model: getInputValue("modelInput"),
        mileage: getInputValue("mileageInput"),
        vin: getInputValue("vinInput"),
        plate: getInputValue("plateInput"),
        fuelType: getInputValue("fuelInput"),
        engineSize: getInputValue("engineInput"),
        purchaseDate: getInputValue("purchaseDateInput"),
        purchasePrice: getInputValue("purchasePriceInput"),
        insuranceExpiry: getInputValue("insuranceExpiryInput"),
        registrationExpiry: getInputValue("registrationExpiryInput")
    };
}

function validateVehicleData(vehicle) {
    const errors = [];

    if (!vehicle.year) {
        errors.push("Year is required.");
    }
    if (!vehicle.make) {
        errors.push("Make is required.");
    }
    if (!vehicle.model) {
        errors.push("Model is required.");
    }
    if (!vehicle.mileage) {
        errors.push("Mileage is required.");
    }

    const year = Number(vehicle.year);
    if (vehicle.year && (Number.isNaN(year) || year < 1900 || year > 2100)) {
        errors.push("Please enter a valid year.");
    }

    const mileage = Number(vehicle.mileage);
    if (vehicle.mileage && (Number.isNaN(mileage) || mileage < 0)) {
        errors.push("Mileage must be a non-negative number.");
    }

    ["purchaseDate", "insuranceExpiry", "registrationExpiry"].forEach((field) => {
        const value = vehicle[field];
        if (value && Number.isNaN(new Date(value).getTime())) {
            errors.push(`${field.replace(/([A-Z])/g, " $1")} is not a valid date.`);
        }
    });

    return errors;
}

function resetVehicleForm() {
    fieldIds.forEach((id) => setInputValue(id, ""));
    editVehicleId = null;
    saveButton.textContent = "Save Vehicle";
    cancelEditButton.classList.add("hidden");
    showMessage("Ready to add a new vehicle.", "info");
}

function createReminderSummary(vehicle) {
    const upcoming = vehicle.maintenance
        .filter((entry) => entry.nextDueDate || entry.nextDueMileage)
        .map((entry) => {
            const nextDate = entry.nextDueDate ? new Date(entry.nextDueDate) : null;
            const nextMileage = entry.nextDueMileage ? Number(entry.nextDueMileage) : null;
            return {
                nextDate,
                nextMileage,
                label: entry.serviceType || "Maintenance"
            };
        });

    if (!upcoming.length) {
        return { text: "No upcoming service reminders set.", status: "neutral" };
    }

    const now = new Date();
    let soonest = null;

    upcoming.forEach((entry) => {
        if (entry.nextDate && !Number.isNaN(entry.nextDate.getTime())) {
            const days = Math.round((entry.nextDate - now) / (1000 * 60 * 60 * 24));
            const score = days;
            const candidate = { date: entry.nextDate, mileage: entry.nextMileage, label: entry.label, score, type: "date" };
            soonest = !soonest || candidate.score < soonest.score ? candidate : soonest;
        }
        if (entry.nextMileage !== null && !Number.isNaN(entry.nextMileage)) {
            const diff = Number(vehicle.mileage) ? Number(entry.nextMileage) - Number(vehicle.mileage) : null;
            if (diff !== null) {
                const candidate = { date: entry.nextDate, mileage: entry.nextMileage, label: entry.label, score: diff, type: "mileage" };
                soonest = !soonest || candidate.score < soonest.score ? candidate : soonest;
            }
        }
    });

    if (!soonest) {
        return { text: "No upcoming service reminders set.", status: "neutral" };
    }

    let status = "scheduled";
    const parts = [];
    if (soonest.type === "date") {
        const days = Math.round((soonest.date - now) / (1000 * 60 * 60 * 24));
        parts.push(`Next due on ${formatDateString(soonest.date.toISOString())}`);
        if (days <= 30) {
            status = "urgent";
            parts.push(`(${days} days)`);
        }
    }

    if (soonest.type === "mileage") {
        parts.push(`Next due at ${soonest.mileage} miles`);
        const diff = Number(soonest.mileage) - Number(vehicle.mileage);
        if (diff <= 500) {
            status = "urgent";
            parts.push(`(${diff >= 0 ? diff + " miles away" : "overdue"})`);
        }
    }

    return { text: parts.join(" "), status };
}

function buildVehicleCard(vehicle, index) {
    const card = document.createElement("article");
    card.className = "vehicle-card";
    card.dataset.vehicleId = vehicle.id;

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("div");
    title.className = "card-title";
    const displayName = vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    title.innerHTML = `<h3>${displayName}</h3><p class="muted">${vehicle.year} ${vehicle.make} ${vehicle.model}</p>`;
    header.appendChild(title);

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "card-actions";
    buttonGroup.innerHTML = `
        <button type="button" class="button secondary" data-action="edit" data-id="${vehicle.id}">Edit</button>
        <button type="button" class="button secondary danger" data-action="delete" data-id="${vehicle.id}">Delete</button>
        <button type="button" class="button" data-action="toggleMaintenance" data-id="${vehicle.id}">Add / Manage Service</button>
    `;
    header.appendChild(buttonGroup);
    card.appendChild(header);

    const details = document.createElement("div");
    details.className = "vehicle-details";
    details.innerHTML = `
        <div class="detail-row"><span>Current Mileage</span><strong>${vehicle.mileage || "—"}</strong></div>
        <div class="detail-row"><span>VIN</span><strong>${vehicle.vin || "—"}</strong></div>
        <div class="detail-row"><span>Plate</span><strong>${vehicle.plate || "—"}</strong></div>
        <div class="detail-row"><span>Fuel</span><strong>${vehicle.fuelType || "—"}</strong></div>
        <div class="detail-row"><span>Engine</span><strong>${vehicle.engineSize || "—"}</strong></div>
        <div class="detail-row"><span>Purchase</span><strong>${formatDateString(vehicle.purchaseDate)}</strong></div>
        <div class="detail-row"><span>Price</span><strong>${vehicle.purchasePrice ? `$${Number(vehicle.purchasePrice).toFixed(2)}` : "—"}</strong></div>
        <div class="detail-row"><span>Insurance Expires</span><strong>${formatDateString(vehicle.insuranceExpiry)}</strong></div>
        <div class="detail-row"><span>Registration Expires</span><strong>${formatDateString(vehicle.registrationExpiry)}</strong></div>
    `;
    card.appendChild(details);

    const reminder = createReminderSummary(vehicle);
    const reminderRow = document.createElement("div");
    reminderRow.className = `reminder ${reminder.status}`;
    reminderRow.textContent = reminder.text;
    card.appendChild(reminderRow);

    const serviceSummary = document.createElement("div");
    serviceSummary.className = "service-summary";
    const lastService = vehicle.maintenance.length
        ? vehicle.maintenance.reduce((latest, entry) => {
              const entryDate = entry.date ? new Date(entry.date) : null;
              if (entryDate && (!latest || entryDate > latest)) {
                  return entryDate;
              }
              return latest;
          }, null)
        : null;
    serviceSummary.innerHTML = `
        <div><strong>${vehicle.maintenance.length}</strong> maintenance records</div>
        <div><strong>${lastService ? formatDateString(lastService.toISOString()) : "No service yet"}</strong></div>
    `;
    card.appendChild(serviceSummary);

    const maintenanceSection = document.createElement("section");
    maintenanceSection.className = "maintenance-section hidden";

    const maintenanceHeader = document.createElement("div");
    maintenanceHeader.className = "maintenance-header";
    maintenanceHeader.innerHTML = `<h4>Service & Maintenance</h4><p>Add a service event or update an existing record.</p>`;
    maintenanceSection.appendChild(maintenanceHeader);

    const maintenanceForm = document.createElement("form");
    maintenanceForm.className = "maintenance-form";
    maintenanceForm.innerHTML = `
        <input type="hidden" class="maintenance-id" value="">
        <div class="form-grid small-grid">
            <label>Service Type<input type="text" class="maintenance-service" placeholder="Oil change, Tires, Inspection"></label>
            <label>Date<input type="date" class="maintenance-date"></label>
            <label>Mileage<input type="number" min="0" class="maintenance-mileage" placeholder="Mileage at service"></label>
            <label>Cost<input type="number" min="0" step="0.01" class="maintenance-cost" placeholder="Cost"></label>
            <label>Shop<input type="text" class="maintenance-shop" placeholder="Service center or mechanic"></label>
            <label>Next due date<input type="date" class="maintenance-next-date"></label>
            <label>Next due mileage<input type="number" min="0" class="maintenance-next-mileage" placeholder="Next service mileage"></label>
        </div>
        <label class="full-width">Notes<textarea class="maintenance-notes" rows="3" placeholder="Optional notes about the service"></textarea></label>
        <div class="form-actions small-actions">
            <button type="button" class="button" data-action="saveMaintenance" data-id="${vehicle.id}">Save Service</button>
            <button type="button" class="button secondary" data-action="resetMaintenance" data-id="${vehicle.id}">Reset</button>
        </div>
        <div class="maintenance-message message"></div>
    `;
    maintenanceSection.appendChild(maintenanceForm);

    const maintenanceList = document.createElement("div");
    maintenanceList.className = "maintenance-list";

    if (!vehicle.maintenance.length) {
        maintenanceList.innerHTML = `<p class="muted">No maintenance records have been added yet.</p>`;
    } else {
        vehicle.maintenance.slice().reverse().forEach((entry) => {
            const entryCard = document.createElement("div");
            entryCard.className = "maintenance-card";
            entryCard.innerHTML = `
                <div class="maintenance-card-header">
                    <div>
                        <strong>${entry.serviceType || "Maintenance"}</strong>
                        <p class="muted">${formatDateString(entry.date)} · ${entry.mileage ? `${entry.mileage} miles` : "Mileage unknown"}</p>
                    </div>
                    <div class="maintenance-card-actions">
                        <button type="button" class="button secondary" data-action="editMaintenance" data-vehicle-id="${vehicle.id}" data-maintenance-id="${entry.id}">Edit</button>
                        <button type="button" class="button danger" data-action="deleteMaintenance" data-vehicle-id="${vehicle.id}" data-maintenance-id="${entry.id}">Delete</button>
                    </div>
                </div>
                <div class="maintenance-info">
                    <div><span>Cost</span>${entry.cost ? `$${Number(entry.cost).toFixed(2)}` : "—"}</div>
                    <div><span>Shop</span>${entry.shop || "—"}</div>
                    <div><span>Next Due</span>${entry.nextDueDate ? formatDateString(entry.nextDueDate) : "—"}${entry.nextDueMileage ? ` / ${entry.nextDueMileage} miles` : ""}</div>
                </div>
                <p class="maintenance-notes-preview">${entry.notes ? entry.notes : "No notes."}</p>
            `;
            maintenanceList.appendChild(entryCard);
        });
    }

    maintenanceSection.appendChild(maintenanceList);
    card.appendChild(maintenanceSection);

    const helperFooter = document.createElement("div");
    helperFooter.className = "card-footer";
    helperFooter.textContent = `Stored on ${formatDateString(vehicle.createdAt)} | Last updated ${formatDateString(vehicle.updatedAt)}`;
    card.appendChild(helperFooter);

    attachMaintenanceHandlers(card, vehicle);

    return card;
}

function attachMaintenanceHandlers(card, vehicle) {
    const toggleButton = card.querySelector("button[data-action='toggleMaintenance']");
    const maintenanceSection = card.querySelector(".maintenance-section");
    const maintenanceForm = card.querySelector(".maintenance-form");
    const maintenanceMessage = card.querySelector(".maintenance-message");

    toggleButton.addEventListener("click", () => {
        maintenanceSection.classList.toggle("hidden");
    });

    maintenanceForm.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }

        if (action === "saveMaintenance") {
            const serviceType = maintenanceForm.querySelector(".maintenance-service").value.trim();
            const date = maintenanceForm.querySelector(".maintenance-date").value;
            const mileage = maintenanceForm.querySelector(".maintenance-mileage").value;
            const cost = maintenanceForm.querySelector(".maintenance-cost").value;
            const shop = maintenanceForm.querySelector(".maintenance-shop").value.trim();
            const notes = maintenanceForm.querySelector(".maintenance-notes").value.trim();
            const nextDueDate = maintenanceForm.querySelector(".maintenance-next-date").value;
            const nextDueMileage = maintenanceForm.querySelector(".maintenance-next-mileage").value;
            const maintenanceIdInput = maintenanceForm.querySelector(".maintenance-id");
            const existingId = maintenanceIdInput.value || null;

            const validation = [];
            if (!serviceType) {
                validation.push("Service type is required.");
            }
            if (date && Number.isNaN(new Date(date).getTime())) {
                validation.push("Service date must be valid.");
            }
            if (mileage && (Number.isNaN(Number(mileage)) || Number(mileage) < 0)) {
                validation.push("Service mileage must be a positive number.");
            }
            if (cost && (Number.isNaN(Number(cost)) || Number(cost) < 0)) {
                validation.push("Service cost must be a positive number.");
            }
            if (nextDueMileage && (Number.isNaN(Number(nextDueMileage)) || Number(nextDueMileage) < 0)) {
                validation.push("Next due mileage must be a positive number.");
            }
            if (validation.length) {
                maintenanceMessage.textContent = validation.join(" ");
                maintenanceMessage.className = "maintenance-message message error";
                return;
            }

            const vehicles = loadVehicles();
            const existingVehicle = vehicles.find((item) => item.id === vehicle.id);
            if (!existingVehicle) {
                maintenanceMessage.textContent = "Unable to find the selected vehicle.";
                maintenanceMessage.className = "maintenance-message message error";
                return;
            }

            const newEntry = {
                id: existingId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                serviceType,
                date,
                mileage: mileage || "",
                cost: cost || "",
                shop,
                notes,
                nextDueDate: nextDueDate || "",
                nextDueMileage: nextDueMileage || ""
            };

            if (existingId) {
                const maintenanceIndex = existingVehicle.maintenance.findIndex((entry) => entry.id === existingId);
                if (maintenanceIndex >= 0) {
                    existingVehicle.maintenance[maintenanceIndex] = newEntry;
                }
            } else {
                existingVehicle.maintenance.push(newEntry);
            }

            existingVehicle.updatedAt = new Date().toISOString();
            saveVehicles(vehicles);
            renderVehicles();
            showMessage("Service record saved successfully.", "success");
        }

        if (action === "resetMaintenance") {
            maintenanceForm.reset();
            maintenanceForm.querySelector(".maintenance-id").value = "";
            maintenanceMessage.textContent = "";
            maintenanceMessage.className = "maintenance-message message";
        }
    });

    card.addEventListener("click", (event) => {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }

        if (action === "editMaintenance") {
            const entryId = event.target.dataset.maintenanceId;
            const entry = vehicle.maintenance.find((item) => item.id === entryId);
            if (!entry) {
                return;
            }

            maintenanceSection.classList.remove("hidden");
            maintenanceForm.querySelector(".maintenance-id").value = entry.id;
            maintenanceForm.querySelector(".maintenance-service").value = entry.serviceType || "";
            maintenanceForm.querySelector(".maintenance-date").value = entry.date || "";
            maintenanceForm.querySelector(".maintenance-mileage").value = entry.mileage || "";
            maintenanceForm.querySelector(".maintenance-cost").value = entry.cost || "";
            maintenanceForm.querySelector(".maintenance-shop").value = entry.shop || "";
            maintenanceForm.querySelector(".maintenance-notes").value = entry.notes || "";
            maintenanceForm.querySelector(".maintenance-next-date").value = entry.nextDueDate || "";
            maintenanceForm.querySelector(".maintenance-next-mileage").value = entry.nextDueMileage || "";
            maintenanceMessage.textContent = "Editing selected service record.";
            maintenanceMessage.className = "maintenance-message message info";
        }

        if (action === "deleteMaintenance") {
            const entryId = event.target.dataset.maintenanceId;
            const vehicles = loadVehicles();
            const existingVehicle = vehicles.find((item) => item.id === vehicle.id);
            if (!existingVehicle) {
                return;
            }
            existingVehicle.maintenance = existingVehicle.maintenance.filter((item) => item.id !== entryId);
            existingVehicle.updatedAt = new Date().toISOString();
            saveVehicles(vehicles);
            renderVehicles();
            showMessage("Maintenance record deleted.", "success");
        }
    });
}

function escapeHtml(value) {
    const safeValue = value === null || value === undefined ? "" : value;
    return String(safeValue).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function formatCurrency(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function getReminderState(vehicle, entry) {
    const now = new Date();
    let status = "scheduled";
    let sortScore = Number.POSITIVE_INFINITY;

    if (entry.nextDueDate) {
        const dueDate = new Date(entry.nextDueDate);
        if (!Number.isNaN(dueDate.getTime())) {
            const days = Math.round((dueDate - now) / (1000 * 60 * 60 * 24));
            if (days < 0) {
                status = "overdue";
                sortScore = days;
            } else if (days <= 30) {
                status = status === "overdue" ? "overdue" : "soon";
                sortScore = days;
            } else {
                sortScore = Math.min(sortScore, days);
            }
        }
    }

    if (entry.nextDueMileage) {
        const nextMileage = Number(entry.nextDueMileage);
        const currentMileage = Number(vehicle.mileage) || 0;
        const milesAway = nextMileage - currentMileage;
        if (!Number.isNaN(nextMileage)) {
            if (milesAway <= 0) {
                status = "overdue";
                sortScore = Math.min(sortScore, milesAway);
            } else if (milesAway <= 500) {
                status = status === "overdue" ? "overdue" : "soon";
                sortScore = Math.min(sortScore, milesAway);
            } else {
                sortScore = Math.min(sortScore, milesAway);
            }
        }
    }

    return { status, sortScore };
}

function collectReminderEntries(vehicles) {
    const reminderEntries = [];

    vehicles.forEach((vehicle) => {
        vehicle.maintenance.forEach((entry) => {
            if (!entry.nextDueDate && !entry.nextDueMileage) {
                return;
            }

            const state = getReminderState(vehicle, entry);
            const parts = [];
            if (entry.nextDueDate) {
                parts.push(`Due ${formatDateString(entry.nextDueDate)}`);
            }
            if (entry.nextDueMileage) {
                parts.push(`${entry.nextDueMileage} miles`);
            }

            reminderEntries.push({
                ...state,
                vehicle,
                entry,
                vehicleName: vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
                detail: parts.join(" • "),
                label: entry.serviceType || "Maintenance"
            });
        });
    });

    return reminderEntries.sort((a, b) => {
        const severity = { overdue: 0, soon: 1, scheduled: 2 };
        return severity[a.status] - severity[b.status] || a.sortScore - b.sortScore || a.vehicleName.localeCompare(b.vehicleName);
    });
}

function summarizeExpenses(vehicles) {
    const totalSpend = vehicles.reduce((accumulator, vehicle) => accumulator + vehicle.maintenance.reduce((sum, entry) => sum + Number(entry.cost || 0), 0), 0);
    const byVehicle = vehicles
        .map((vehicle) => ({
            id: vehicle.id,
            name: vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            total: vehicle.maintenance.reduce((sum, entry) => sum + Number(entry.cost || 0), 0),
            count: vehicle.maintenance.length
        }))
        .filter((vehicle) => vehicle.total > 0 || vehicle.count > 0)
        .sort((a, b) => b.total - a.total);

    const monthlyTotals = new Map();
    vehicles.forEach((vehicle) => {
        vehicle.maintenance.forEach((entry) => {
            if (!entry.date) {
                return;
            }
            const date = new Date(entry.date);
            if (Number.isNaN(date.getTime())) {
                return;
            }
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + Number(entry.cost || 0));
        });
    });

    const months = Array.from(monthlyTotals.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-6)
        .map(([monthKey, amount]) => ({
            label: new Date(`${monthKey}-01`).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
            amount
        }));

    return { totalSpend, byVehicle, months };
}

function renderDashboard(vehicles) {
    const reminderEntries = collectReminderEntries(vehicles);
    const overdueCount = reminderEntries.filter((entry) => entry.status === "overdue").length;
    const soonCount = reminderEntries.filter((entry) => entry.status === "soon").length;
    const { totalSpend, byVehicle, months } = summarizeExpenses(vehicles);

    dashboardSummary.innerHTML = `
        <div class="dashboard-card">
            <span class="muted">Vehicles</span>
            <div class="value">${vehicles.length}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Overdue reminders</span>
            <div class="value">${overdueCount}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Upcoming reminders</span>
            <div class="value">${soonCount}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Total spend</span>
            <div class="value">${formatCurrency(totalSpend)}</div>
        </div>
    `;

    reminderList.innerHTML = reminderEntries.length
        ? reminderEntries.map((entry) => `
            <div class="dashboard-item ${entry.status}">
                <div class="dashboard-item-header">
                    <div>
                        <strong>${escapeHtml(entry.label)}</strong>
                        <p>${escapeHtml(entry.vehicleName)}</p>
                    </div>
                    <span class="dashboard-pill">${entry.status === "overdue" ? "Overdue" : entry.status === "soon" ? "Soon" : "Scheduled"}</span>
                </div>
                <p>${escapeHtml(entry.detail)}</p>
            </div>
        `).join("")
        : '<div class="dashboard-item"><p>No service reminders are set yet.</p></div>';

    expenseList.innerHTML = `
        <div class="dashboard-item">
            <div class="dashboard-item-header">
                <div>
                    <strong>Total maintenance spend</strong>
                    <p>${formatCurrency(totalSpend)}</p>
                </div>
                <span class="dashboard-pill">${vehicles.length} vehicles</span>
            </div>
        </div>
        ${byVehicle.length ? byVehicle.map((vehicle) => `
            <div class="dashboard-item">
                <div class="dashboard-item-header">
                    <div>
                        <strong>${escapeHtml(vehicle.name)}</strong>
                        <p>${vehicle.count} service record${vehicle.count === 1 ? "" : "s"}</p>
                    </div>
                    <span class="dashboard-pill">${formatCurrency(vehicle.total)}</span>
                </div>
            </div>
        `).join("") : '<div class="dashboard-item"><p>No maintenance costs recorded yet.</p></div>'}
        ${months.length ? `
            <div class="dashboard-item">
                <div class="dashboard-item-header">
                    <div>
                        <strong>Recent monthly spend</strong>
                        <p>${months.map((month) => `${month.label}: ${formatCurrency(month.amount)}`).join(" • ")}</p>
                    </div>
                </div>
            </div>
        ` : ""}
    `;
}

function renderVehicles() {
    const vehicles = loadVehicles();
    vehicleDisplay.innerHTML = "";
    if (!vehicles.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <h3>No vehicles saved yet.</h3>
            <p>Enter a vehicle above to begin tracking your fleet and maintenance history.</p>
        `;
        vehicleDisplay.appendChild(emptyState);
        renderDashboard(vehicles);
        return;
    }

    vehicles.forEach((vehicle, index) => {
        vehicleDisplay.appendChild(buildVehicleCard(vehicle, index));
    });

    renderDashboard(vehicles);
}

function populateFormForEdit(vehicleId) {
    const vehicles = loadVehicles();
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
        return;
    }

    editVehicleId = vehicle.id;
    fieldIds.forEach((id) => setInputValue(id, vehicle[id.replace(/Input$/, "")] || ""));
    saveButton.textContent = "Update Vehicle";
    cancelEditButton.classList.remove("hidden");
    showMessage("Editing vehicle record. Save to apply changes.", "info");
}

function deleteVehicle(vehicleId) {
    const vehicles = loadVehicles();
    const updated = vehicles.filter((item) => item.id !== vehicleId);
    saveVehicles(updated);
    renderVehicles();
    showMessage("Vehicle deleted.", "success");
}

function exportJson() {
    const vehicles = loadVehicles();
    const blob = new Blob([JSON.stringify(vehicles, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wrench-wallet-vehicles-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
}

function exportCsv() {
    const vehicles = loadVehicles();
    const headers = [
        "Nickname",
        "Year",
        "Make",
        "Model",
        "Mileage",
        "VIN",
        "License Plate",
        "Fuel Type",
        "Engine Size",
        "Purchase Date",
        "Purchase Price",
        "Insurance Expiry",
        "Registration Expiry",
        "Maintenance Count",
        "Last Updated"
    ];
    const rows = vehicles.map((vehicle) => [
        vehicle.nickname,
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.mileage,
        vehicle.vin,
        vehicle.plate,
        vehicle.fuelType,
        vehicle.engineSize,
        vehicle.purchaseDate,
        vehicle.purchasePrice,
        vehicle.insuranceExpiry,
        vehicle.registrationExpiry,
        vehicle.maintenance.length,
        vehicle.updatedAt
    ]);

    const csv = [headers, ...rows]
        .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wrench-wallet-vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
}

saveButton.addEventListener("click", () => {
    const vehicleData = gatherVehicleForm();
    const errors = validateVehicleData(vehicleData);

    if (errors.length) {
        showMessage(errors.join(" "), "error");
        return;
    }

    const vehicles = loadVehicles();
    if (editVehicleId) {
        const existingIndex = vehicles.findIndex((item) => item.id === editVehicleId);
        if (existingIndex >= 0) {
            vehicles[existingIndex] = {
                ...vehicles[existingIndex],
                ...vehicleData,
                updatedAt: new Date().toISOString()
            };
            saveVehicles(vehicles);
            showMessage("Vehicle updated successfully.", "success");
            resetVehicleForm();
            renderVehicles();
            return;
        }
    }

    const newVehicle = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...vehicleData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        maintenance: []
    };

    vehicles.push(newVehicle);
    saveVehicles(vehicles);
    resetVehicleForm();
    renderVehicles();
    showMessage("Vehicle saved successfully.", "success");
});

cancelEditButton.addEventListener("click", () => {
    resetVehicleForm();
});

exportJsonButton.addEventListener("click", exportJson);
exportCsvButton.addEventListener("click", exportCsv);

clearAllButton.addEventListener("click", () => {
    if (!confirm("Clear all saved vehicles and maintenance records?")) {
        return;
    }
    localStorage.removeItem("vehicles");
    resetVehicleForm();
    renderVehicles();
    showMessage("All saved vehicle data has been removed.", "success");
});

vehicleDisplay.addEventListener("click", (event) => {
    const action = event.target.dataset.action;
    if (!action) {
        return;
    }

    const vehicleId = event.target.dataset.id;
    if (action === "edit") {
        populateFormForEdit(vehicleId);
    }
    if (action === "delete") {
        if (confirm("Delete this vehicle and all its service records?")) {
            deleteVehicle(vehicleId);
        }
    }
});

renderVehicles();
showMessage("Ready to manage your vehicles.", "info");
