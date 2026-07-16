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

// Debug panel elements and helpers
const debugPanel = document.getElementById('debugPanel');
// Only show debug panel in development contexts:
// - window.DEBUG === true
// - running on localhost/127.0.0.1/0.0.0.0/[::1]
// - url query param `?debug=1` or `?debug=true`
// - localStorage 'wrench_debug' === '1'
function isDevMode() {
    try {
        if (window.DEBUG === true) return true;
        const hostname = window.location.hostname || '';
        const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname);
        if (isLocalhost) return true;
        const params = new URLSearchParams(window.location.search || '');
        const p = params.get('debug');
        if (p === '1' || p === 'true') return true;
        if (localStorage.getItem('wrench_debug') === '1') return true;
        return false;
    } catch (e) {
        return false;
    }
}
function setDebugStatus(text) {
    try {
        if (debugPanel) {
            const el = debugPanel.querySelector('.status');
            if (el) el.textContent = text;
            if (isDevMode()) debugPanel.classList.remove('hidden');
        }
        console.log('[DEBUG] ' + text);
    } catch (e) { /* ignore */ }
}
function setDebugError(err) {
    try {
        if (debugPanel) {
            const el = debugPanel.querySelector('.error');
            if (el) el.textContent = typeof err === 'string' ? err : (err && err.message ? err.message : String(err));
            if (isDevMode()) debugPanel.classList.remove('hidden');
        }
        console.error('[DEBUG ERROR]', err);
    } catch (e) { /* ignore */ }
}
function updateDebugUser(user) {
    try {
        if (debugPanel) {
            const el = debugPanel.querySelector('.user');
            if (el) el.textContent = user ? `${user.email || 'unknown'} (${user.uid || 'no-uid'})` : 'none';
            if (isDevMode()) debugPanel.classList.remove('hidden');
        }
    } catch (e) { /* ignore */ }
}

let editVehicleId = null;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let vehiclesUnsubscribe = null; // Firestore onSnapshot unsubscribe

function isFirebaseAuthSupportedContext() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname);
    return protocol === 'https:' || (protocol === 'http:' && isLocalhost);
}

function showAuthSetupError(message) {
    showMessage(message, 'error');
    setDebugError(message);
}

function getAuthErrorMessage(err) {
    if (!err) return 'Unknown authentication error.';
    if (err.code === 'auth/unauthorized-domain') {
        return 'This domain is not authorized in Firebase Authentication. Add your current site host in Firebase Console → Authentication → Settings → Authorized domains.';
    }
    return err.message || String(err);
}

function buildFirebaseConfig() {
    const config = Object.assign({}, window.FIREBASE_CONFIG);
    const hostname = window.location.hostname;
    const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname);
    config.authDomain = isLocalhost ? 'localhost' : (hostname || config.authDomain);
    return config;
}

// Initialize Firebase if config is provided (firebase-config.js should set window.FIREBASE_CONFIG)
function initFirebaseIfAvailable() {
    try {
        setDebugStatus('Checking Firebase configuration...');
        if (!window.FIREBASE_CONFIG) {
            showAuthSetupError('Firebase config not found. Create firebase-config.js from firebase-config.example.js and reload the page.');
            return;
        }

        if (!isFirebaseAuthSupportedContext()) {
            showAuthSetupError('Firebase Auth requires a secure context. Open the app through http://localhost, http://127.0.0.1, or https:// instead of file://.');
            return;
        }

        const firebaseConfig = buildFirebaseConfig();
        firebaseApp = firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firebaseDb = firebase.firestore();
        setDebugStatus('Firebase initialized');

        // Auth UI bindings
        const signupBtn = document.getElementById('signupBtn');
        if (signupBtn) {
            signupBtn.addEventListener('click', () => {
                const email = document.getElementById('authEmail').value.trim();
                const password = document.getElementById('authPassword').value;
                if (!email || !password) { showMessage('Email and password are required to sign up.', 'error'); return; }
                firebaseAuth.createUserWithEmailAndPassword(email, password)
                    .then((cred) => {
                        if (cred && cred.user) {
                            cred.user.sendEmailVerification()
                                .then(() => { showMessage('Account created. Verification email sent. Please check your inbox.', 'success'); setDebugStatus('Verification email sent'); })
                                .catch((e) => { showMessage('Account created. Could not send verification email automatically.', 'info'); setDebugError(e); });
                        }
                    })
                    .catch((err) => { showMessage(getAuthErrorMessage(err), 'error'); setDebugError(err); });
            });
        }

        const signinBtn = document.getElementById('signinBtn');
        if (signinBtn) {
            signinBtn.addEventListener('click', () => {
                const email = document.getElementById('authEmail').value.trim();
                const password = document.getElementById('authPassword').value;
                if (!email || !password) { showMessage('Email and password are required to sign in.', 'error'); return; }
                firebaseAuth.signInWithEmailAndPassword(email, password).catch((err) => { showMessage(getAuthErrorMessage(err), 'error'); setDebugError(err); });
            });
        }

        const googleSignInBtn = document.getElementById('googleSignInBtn');
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                firebaseAuth.signInWithPopup(provider).catch((err) => { showMessage(getAuthErrorMessage(err), 'error'); setDebugError(err); });
            });
        }

        const signoutBtn = document.getElementById('signoutBtn');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', () => {
                firebaseAuth.signOut();
            });
        }

        const resetBtn = document.getElementById('resetPasswordBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const email = (document.getElementById('authEmail') || {}).value || '';
                if (!email) { showMessage('Enter your email address to send a password reset link.', 'error'); return; }
                firebaseAuth.sendPasswordResetEmail(email)
                    .then(() => { showMessage('Password reset email sent. Check your inbox.', 'success'); setDebugStatus('Password reset email sent'); })
                    .catch((err) => { showMessage(getAuthErrorMessage(err), 'error'); setDebugError(err); });
            });
        }

        const resendVerifyBtn = document.getElementById('resendVerifyBtn');
        if (resendVerifyBtn) {
            resendVerifyBtn.addEventListener('click', () => {
                if (!firebaseAuth.currentUser) { showMessage('No signed-in user to verify.', 'error'); return; }
                firebaseAuth.currentUser.sendEmailVerification()
                    .then(() => { showMessage('Verification email sent. Check your inbox.', 'success'); setDebugStatus('Verification email resent'); })
                    .catch((err) => { showMessage(getAuthErrorMessage(err), 'error'); setDebugError(err); });
            });
        }

        firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;
            const signedInPanel = document.getElementById('signedInPanel');
            const signedOutPanel = document.getElementById('signedOutPanel');
            const userEmail = document.getElementById('userEmail');
            const emailVerifiedBadge = document.getElementById('emailVerifiedBadge');
            const protectedNotice = document.getElementById('protectedNotice');
            const dashboardPanel = document.getElementById('dashboardPanel');
            const vehiclesPanel = document.getElementById('vehiclesPanel');

            if (vehiclesUnsubscribe) {
                try { vehiclesUnsubscribe(); } catch (e) { /* ignore */ }
                vehiclesUnsubscribe = null;
            }

            if (user) {
                signedOutPanel.style.display = 'none';
                signedInPanel.style.display = 'flex';
                userEmail.textContent = user.email || '';
                updateDebugUser(user);
                setDebugStatus('Signed in');

                const vehicleFormSection = document.getElementById('vehicleFormSection');

                if (protectedNotice) protectedNotice.classList.add('hidden');
                if (dashboardPanel) dashboardPanel.classList.remove('hidden');
                if (vehiclesPanel) vehiclesPanel.classList.remove('hidden');
                if (vehicleFormSection) vehicleFormSection.classList.remove('hidden');

                if (emailVerifiedBadge) {
                    emailVerifiedBadge.textContent = user.emailVerified ? 'Email verified' : 'Unverified email';
                }
                if (resendVerifyBtn) {
                    if (user.emailVerified) {
                        resendVerifyBtn.classList.add('hidden');
                    } else {
                        resendVerifyBtn.classList.remove('hidden');
                    }
                }

                // Check for legacy data and attach real-time listener to user's vehicles
                try {
                    const collectionRef = firebaseDb.collection('users').doc(user.uid).collection('vehicles');
                    vehiclesUnsubscribe = collectionRef.onSnapshot((snapshot) => {
                        const vehicles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                        localStorage.setItem('vehicles', JSON.stringify(vehicles));
                        renderVehicles();
                        showMessage(`Loaded ${vehicles.length} vehicles from cloud`, 'success');
                    }, (err) => {
                        console.warn('Vehicle collection snapshot error', err);
                        setDebugError(err);
                    });

                    // Detect legacy vehicles array on the user document and surface migrate button in settings
                    checkLegacyOnUserDoc(user.uid).catch((e) => { /* ignore */ });
                } catch (err) {
                    console.error('Failed to attach vehicles listener', err);
                    setDebugError(err);
                }
            } else {
                signedOutPanel.style.display = 'block';
                signedInPanel.style.display = 'none';
                userEmail.textContent = '';

                const vehicleFormSection = document.getElementById('vehicleFormSection');
                if (vehicleFormSection) vehicleFormSection.classList.add('hidden');

                if (protectedNotice) protectedNotice.classList.remove('hidden');
                if (dashboardPanel) dashboardPanel.classList.add('hidden');
                if (vehiclesPanel) vehiclesPanel.classList.add('hidden');

                showMessage('Signed out. You can sign in to sync data across devices.', 'info');
                updateDebugUser(null);
                setDebugStatus('Signed out');
                renderVehicles();
            }
        });
    } catch (err) {
        console.warn('Firebase init failed or not configured', err);
        setDebugError(err);
    }
}

// Attempt init on load
window.addEventListener('load', () => {
    initFirebaseIfAvailable();
});

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
    // Always keep a local copy
    localStorage.setItem("vehicles", JSON.stringify(vehicles));

    // If user is signed in, persist to Firestore users/{uid}/vehicles subcollection
    if (firebaseDb && currentUser) {
        try {
            const collectionRef = firebaseDb.collection('users').doc(currentUser.uid).collection('vehicles');
            // Read remote docs to determine deletes
            collectionRef.get().then((remoteSnap) => {
                const remoteIds = new Set(remoteSnap.docs.map((d) => d.id));
                const batch = firebaseDb.batch();
                const localIds = new Set();

                vehicles.forEach((v) => {
                    const docRef = collectionRef.doc(v.id);
                    const data = Object.assign({}, v);
                    batch.set(docRef, data);
                    localIds.add(v.id);
                    remoteIds.delete(v.id);
                });

                // Delete any remote docs no longer present locally
                remoteIds.forEach((id) => {
                    batch.delete(collectionRef.doc(id));
                });

                if (localIds.size === 0 && remoteSnap.docs.length === 0) {
                    // Nothing to commit
                    return;
                }

                batch.commit().then(() => console.log('Synced vehicles to vehicles subcollection'))
                    .catch((err) => console.warn('Failed to sync vehicles to subcollection', err));
            }).catch((err) => console.warn('Failed to fetch remote vehicles for sync', err));
        } catch (err) {
            console.warn('Firestore save error', err);
        }
    }
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

    return { totalSpend, byVehicle, months, monthlyTotals };
}

function renderDashboard(vehicles) {
    const reminderEntries = collectReminderEntries(vehicles);
    const overdueCount = reminderEntries.filter((entry) => entry.status === "overdue").length;
    const soonCount = reminderEntries.filter((entry) => entry.status === "soon").length;
    const { totalSpend, byVehicle, months, monthlyTotals } = summarizeExpenses(vehicles);

    // Compute current month and year spending
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let thisMonthTotal = 0;
    let thisYearTotal = 0;
    monthlyTotals.forEach((amt, key) => {
        thisYearTotal += key.startsWith(`${now.getFullYear()}-`) ? amt : 0;
    });
    thisMonthTotal = monthlyTotals.get(thisMonthKey) || 0;

    // Vehicle needing attention (first overdue, otherwise first soon)
    const attentionEntry = reminderEntries.find((e) => e.status === 'overdue') || reminderEntries.find((e) => e.status === 'soon') || null;

    // Most recent service across all vehicles
    let mostRecentService = null;
    vehicles.forEach((v) => {
        v.maintenance.forEach((m) => {
            if (!m.date) return;
            const d = new Date(m.date);
            if (Number.isNaN(d.getTime())) return;
            if (!mostRecentService || d > new Date(mostRecentService.date)) {
                mostRecentService = { date: m.date, vehicleName: v.nickname || `${v.year} ${v.make} ${v.model}`, label: m.serviceType || 'Maintenance' };
            }
        });
    });

    dashboardSummary.innerHTML = `
        <div class="dashboard-card">
            <span class="muted">Vehicles</span>
            <div class="value">${vehicles.length}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Maintenance due soon</span>
            <div class="value">${overdueCount > 0 ? overdueCount + ' overdue' : (soonCount > 0 ? soonCount + ' soon' : 'None')}< /div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Spending (This month)</span>
            <div class="value">${formatCurrency(thisMonthTotal)}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Spending (This year)</span>
            <div class="value">${formatCurrency(thisYearTotal)}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Vehicle needing attention</span>
            <div class="value">${attentionEntry ? escapeHtml(attentionEntry.vehicleName) : 'None'}</div>
        </div>
        <div class="dashboard-card">
            <span class="muted">Most recent service</span>
            <div class="value">${mostRecentService ? `${escapeHtml(mostRecentService.label)} • ${formatDateString(mostRecentService.date)}` : 'No service yet'}</div>
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

// Migration helper: convert users/{uid}.vehicles array (legacy) into users/{uid}/vehicles subcollection documents
async function migrateVehiclesArrayToSubcollection() {
    if (!firebaseDb || !currentUser) {
        showMessage('Firebase not configured or not signed in. Sign in to run migration.', 'error');
        return;
    }

    try {
        const userDocRef = firebaseDb.collection('users').doc(currentUser.uid);
        const doc = await userDocRef.get();
        if (!doc.exists) {
            showMessage('No user document found for current user.', 'error');
            return;
        }
        const data = doc.data() || {};
        if (!Array.isArray(data.vehicles) || data.vehicles.length === 0) {
            showMessage('No legacy vehicles array found on user document.', 'info');
            return;
        }

        const vehicles = data.vehicles;
        const collectionRef = userDocRef.collection('vehicles');
        const batch = firebaseDb.batch();
        vehicles.forEach((v) => {
            const id = v.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const docRef = collectionRef.doc(id);
            batch.set(docRef, Object.assign({}, v, { id }));
        });
        // Remove the legacy field
        batch.update(userDocRef, { vehicles: firebase.firestore.FieldValue.delete() });

        await batch.commit();
        showMessage(`Migrated ${vehicles.length} vehicles to subcollection.`, 'success');
    } catch (err) {
        console.error('Migration failed', err);
        showMessage('Migration failed. See console for details.', 'error');
    }
}

// Expose helper for manual invocation from browser console
window.migrateVehiclesToSubcollection = migrateVehiclesArrayToSubcollection;

// UI hook for migration button (legacy main button is hidden in UI; prefer settings modal)
const migrateBtn = document.getElementById('migrateBtn');
if (migrateBtn) {
    migrateBtn.addEventListener('click', async () => {
        if (!confirm('This will migrate legacy vehicles stored in users/{uid}.vehicles into the vehicles subcollection for the signed-in user. Proceed?')) {
            return;
        }
        migrateBtn.disabled = true;
        migrateBtn.textContent = 'Migrating...';
        try {
            await migrateVehiclesArrayToSubcollection();
        } catch (err) {
            console.error('Migration button failed', err);
            showMessage('Migration failed. See console for details.', 'error');
        } finally {
            migrateBtn.disabled = false;
            migrateBtn.textContent = 'Migrate legacy data';
        }
    });
}

// Settings modal and tools
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const settingsExportJsonBtn = document.getElementById('settingsExportJsonBtn');
const settingsExportCsvBtn = document.getElementById('settingsExportCsvBtn');
const settingsMigrateBtn = document.getElementById('settingsMigrateBtn');
const settingsClearAllBtn = document.getElementById('settingsClearAllBtn');

if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
}
if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
}
if (settingsExportJsonBtn) {
    settingsExportJsonBtn.addEventListener('click', () => {
        exportJson();
        showMessage('Export started: JSON', 'success');
    });
}
if (settingsExportCsvBtn) {
    settingsExportCsvBtn.addEventListener('click', () => {
        exportCsv();
        showMessage('Export started: CSV', 'success');
    });
}
if (settingsMigrateBtn) {
    settingsMigrateBtn.addEventListener('click', async () => {
        if (!confirm('This will migrate legacy vehicles stored in users/{uid}.vehicles into the vehicles subcollection for the signed-in user. Proceed?')) {
            return;
        }
        settingsMigrateBtn.disabled = true;
        settingsMigrateBtn.textContent = 'Migrating...';
        try {
            await migrateVehiclesArrayToSubcollection();
        } catch (err) {
            console.error('Settings migration failed', err);
            showMessage('Migration failed. See console for details.', 'error');
        } finally {
            settingsMigrateBtn.disabled = false;
            settingsMigrateBtn.textContent = 'Migrate legacy data';
        }
    });
}

if (settingsClearAllBtn) {
    settingsClearAllBtn.addEventListener('click', async () => {
        const confirmText = prompt('Type DELETE to confirm clearing all local vehicle data. This action cannot be undone.');
        if (confirmText !== 'DELETE') {
            showMessage('Clear aborted.', 'info');
            return;
        }
        // Clear local data
        localStorage.removeItem('vehicles');
        resetVehicleForm();
        renderVehicles();
        showMessage('All local vehicle data has been removed.', 'success');

        // Offer to clear cloud data if signed in
        if (firebaseDb && currentUser) {
            if (confirm('Also delete all cloud-synced vehicle documents for the signed-in account? This is irreversible.')) {
                try {
                    const collectionRef = firebaseDb.collection('users').doc(currentUser.uid).collection('vehicles');
                    const snap = await collectionRef.get();
                    const batch = firebaseDb.batch();
                    snap.docs.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                    showMessage('Cloud vehicle documents deleted.', 'success');
                } catch (err) {
                    console.error('Failed to delete cloud vehicles', err);
                    showMessage('Failed to delete cloud vehicles. See console for details.', 'error');
                }
            }
        }
    });
}

// Check for legacy vehicles array on user doc and show migrate button when appropriate
async function checkLegacyOnUserDoc(uid) {
    try {
        if (!firebaseDb || !uid) return false;
        const userDocRef = firebaseDb.collection('users').doc(uid);
        const doc = await userDocRef.get();
        if (!doc.exists) return false;
        const data = doc.data() || {};
        const hasLegacy = Array.isArray(data.vehicles) && data.vehicles.length > 0;
        if (hasLegacy && settingsMigrateBtn) {
            settingsMigrateBtn.classList.remove('hidden');
        } else if (settingsMigrateBtn) {
            // Show migrate in dev mode for convenience
            if (isDevMode()) {
                settingsMigrateBtn.classList.remove('hidden');
            } else {
                settingsMigrateBtn.classList.add('hidden');
            }
        }
        return hasLegacy;
    } catch (err) {
        console.warn('Legacy check failed', err);
        return false;
    }
}

// Debug panel close button
const debugCloseBtn = document.getElementById('debugCloseBtn');
if (debugCloseBtn) {
    debugCloseBtn.addEventListener('click', () => {
        try { if (debugPanel) debugPanel.classList.add('hidden'); } catch (e) { }
    });
}

setDebugStatus('Ready');