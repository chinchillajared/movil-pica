function getMechanicKey() {
  return localStorage.getItem("mechanic_key") || "";
}

function getMechanicRefresh() {
  return localStorage.getItem("mechanic_refresh") || "";
}

function setMechanicSession(session) {
  if (session.token) localStorage.setItem("mechanic_key", session.token);
  if (session.refresh_token) localStorage.setItem("mechanic_refresh", session.refresh_token);
  if (session.user) localStorage.setItem("mechanic_user", JSON.stringify(session.user));
}

function getClientTokens() {
  return {
    access: localStorage.getItem("client_access") || "",
    refresh: localStorage.getItem("client_refresh") || "",
  };
}

function setClientTokens(tokens) {
  if (tokens.access_token) localStorage.setItem("client_access", tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem("client_refresh", tokens.refresh_token);
}

function getClientUser() {
  try {
    return JSON.parse(localStorage.getItem("client_user") || "null");
  } catch (e) {
    return null;
  }
}

function setClientUser(user) {
  if (user) localStorage.setItem("client_user", JSON.stringify(user));
  else localStorage.removeItem("client_user");
}

function clearClientSession() {
  localStorage.removeItem("client_access");
  localStorage.removeItem("client_refresh");
  localStorage.removeItem("client_user");
}

function clientHeaders() {
  const t = getClientTokens();
  return t.access ? { Authorization: "Bearer " + t.access } : {};
}

async function api(path, options = {}) {
  const opts = { ...options };
  opts.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);

  const url = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : "/" + path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch (e) { return text; } })() : null;
  if (!res.ok) {
    const err = new Error(extractErrorMessage(data, res));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function extractErrorMessage(data, res) {
  if (!data) return res.statusText || "Request failed";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => {
        if (typeof d === "string") return d;
        const where = Array.isArray(d.loc) ? d.loc.join(".") : "";
        return (where ? where + ": " : "") + (d.msg || JSON.stringify(d));
      })
      .join("; ");
  }
  if (data.detail) return JSON.stringify(data.detail);
  return res.statusText || "Request failed";
}

function showLoading() {
  var el = document.getElementById("loading-overlay");
  if (el) el.classList.remove("hidden");
}
function hideLoading() {
  var el = document.getElementById("loading-overlay");
  if (el) el.classList.add("hidden");
}

function mechanicHeaders() {
  const key = getMechanicKey();
  return key ? { "X-Mechanic-Key": key } : {};
}

function showMessage(msg) {
  return new Promise(function (resolve) {
    var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
    var overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-center justify-center";
    overlay.innerHTML =
      '<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">' +
        '<p class="text-slate-700 text-lg mb-6">' + msg + '</p>' +
        '<div class="flex justify-center">' +
          '<button id="message-ok" class="px-6 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium">' + t("dialog_ok") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("message-ok").addEventListener("click", function () {
      overlay.remove();
      resolve();
    });
  });
}

function showConfirm(msg) {
  return new Promise(function (resolve) {
    var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
    var overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-center justify-center";
    overlay.innerHTML =
      '<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full text-center">' +
        '<p class="text-slate-700 text-lg mb-6">' + msg + '</p>' +
        '<div class="flex justify-center gap-3">' +
          '<button id="confirm-cancel" class="px-6 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium">' + t("confirm_no") + '</button>' +
          '<button id="confirm-ok" class="px-6 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium">' + t("confirm_yes") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("confirm-cancel").addEventListener("click", function () {
      overlay.remove();
      resolve(false);
    });
    document.getElementById("confirm-ok").addEventListener("click", function () {
      overlay.remove();
      resolve(true);
    });
  });
}

window.API = {
  public: {
    createAppointment: (payload) => api("/api/appointments", { method: "POST", body: payload }),
    lookupAppointment: (phone, plate) => api(`/api/appointments/lookup?phone=${encodeURIComponent(phone)}&plate=${encodeURIComponent(plate)}`),
    getAppointmentTimes: (dateStr) => api(`/api/appointments/times?for_date=${encodeURIComponent(dateStr)}`),
    getTakenDates: (year, month, exclude) => api(`/api/appointments/taken-dates?year=${year}&month=${month}${exclude ? `&exclude=${encodeURIComponent(exclude)}` : ""}`),
    cancelAppointment: (number, payload) => api(`/api/appointments/${encodeURIComponent(number)}/cancel`, { method: "PATCH", body: payload }),
    updateAppointment: (number, payload) => api(`/api/appointments/${encodeURIComponent(number)}`, { method: "PUT", body: payload }),
    getActiveAnnouncements: () => api("/api/announcements/active"),
    getSchedule: () => api("/api/schedule"),
    getSiteSettings: () => api("/api/site/settings"),
  },
  auth: {
    register: (payload) => api("/api/auth/register", { method: "POST", body: payload }),
    login: (payload) => api("/api/auth/login", { method: "POST", body: payload }),
    refresh: (refreshToken) => api("/api/auth/refresh", { method: "POST", body: { refresh_token: refreshToken } }),
    me: () => api("/api/auth/me", { headers: clientHeaders() }),
    listVehicles: () => api("/api/auth/vehicles", { headers: clientHeaders() }),
    createVehicle: (payload) => api("/api/auth/vehicles", { method: "POST", body: payload, headers: clientHeaders() }),
    deleteVehicle: (id) => api(`/api/auth/vehicles/${id}`, { method: "DELETE", headers: clientHeaders() }),
  },
  mechanic: {
    bootstrapStatus: () => api("/api/mechanic/bootstrap"),
    bootstrap: (payload) => api("/api/mechanic/bootstrap", { method: "POST", body: payload }),
    login: (payload) => api("/api/mechanic/login", { method: "POST", body: payload }),
    refresh: (refreshToken) => api("/api/mechanic/refresh", { method: "POST", body: { refresh_token: refreshToken } }),
    me: () => api("/api/mechanic/me", { headers: mechanicHeaders() }),
    changePassword: (payload) => api("/api/mechanic/me/password", { method: "PUT", body: payload, headers: mechanicHeaders() }),
    listUsers: () => api("/api/mechanic/users", { headers: mechanicHeaders() }),
    createUser: (payload) => api("/api/mechanic/users", { method: "POST", body: payload, headers: mechanicHeaders() }),
    updateUser: (id, payload) => api(`/api/mechanic/users/${id}`, { method: "PUT", body: payload, headers: mechanicHeaders() }),
    deleteUser: (id) => api(`/api/mechanic/users/${id}`, { method: "DELETE", headers: mechanicHeaders() }),
    resetPassword: (id, payload) => api(`/api/mechanic/users/${id}/reset-password`, { method: "POST", body: payload, headers: mechanicHeaders() }),
    getGmailSettings: () => api("/api/mechanic/gmail/settings", { headers: mechanicHeaders() }),
    updateGmailSettings: (payload) => api("/api/mechanic/gmail/settings", { method: "PUT", body: payload, headers: mechanicHeaders() }),
    getGmailAuthUrl: () => api("/api/mechanic/gmail/auth-url", { headers: mechanicHeaders() }),
    testGmail: () => api("/api/mechanic/gmail/test", { method: "POST", headers: mechanicHeaders() }),
    deactivateGmail: () => api("/api/mechanic/gmail/deactivate", { method: "POST", headers: mechanicHeaders() }),
    listClients: () => api("/api/mechanic/clients", { headers: mechanicHeaders() }),
    sendEmail: (payload) => api("/api/mechanic/emails/send", { method: "POST", body: payload, headers: mechanicHeaders() }),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return api(`/api/mechanic/appointments${qs ? "?" + qs : ""}`, { headers: mechanicHeaders() });
    },
    create: (payload) => api("/api/mechanic/appointments", { method: "POST", body: payload, headers: mechanicHeaders() }),
    updateStatus: (number, status) =>
      api(`/api/mechanic/appointments/${encodeURIComponent(number)}`, {
        method: "PATCH",
        body: { status },
        headers: mechanicHeaders(),
      }),
    updateReservation: (number, payload) =>
      api(`/api/mechanic/appointments/${encodeURIComponent(number)}/reservation`, {
        method: "PUT",
        body: payload,
        headers: mechanicHeaders(),
      }),
    remove: (number) =>
      api(`/api/mechanic/appointments/${encodeURIComponent(number)}`, {
        method: "DELETE",
        headers: mechanicHeaders(),
      }),
    getCalendar: (year, month) => api(`/api/mechanic/calendar?year=${year}&month=${month}`, { headers: mechanicHeaders() }),
    listAnnouncements: () => api("/api/mechanic/announcements", { headers: mechanicHeaders() }),
    createAnnouncement: (payload) => api("/api/mechanic/announcements", { method: "POST", body: payload, headers: mechanicHeaders() }),
    updateAnnouncement: (id, payload) => api(`/api/mechanic/announcements/${id}`, { method: "PUT", body: payload, headers: mechanicHeaders() }),
    deleteAnnouncement: (id) => api(`/api/mechanic/announcements/${id}`, { method: "DELETE", headers: mechanicHeaders() }),
    getSchedule: () => api("/api/mechanic/schedule", { headers: mechanicHeaders() }),
    updateSchedule: (payload) => api("/api/mechanic/schedule", { method: "PUT", body: payload, headers: mechanicHeaders() }),
    getDaysOff: () => api("/api/mechanic/days-off", { headers: mechanicHeaders() }),
    addDayOff: (payload) => api("/api/mechanic/days-off", { method: "POST", body: payload, headers: mechanicHeaders() }),
    removeDayOff: (date) => api(`/api/mechanic/days-off/${encodeURIComponent(date)}`, { method: "DELETE", headers: mechanicHeaders() }),
    getAppointmentTime: () => api("/api/mechanic/appointment-time", { headers: mechanicHeaders() }),
    updateAppointmentTime: (payload) => api("/api/mechanic/appointment-time", { method: "PUT", body: payload, headers: mechanicHeaders() }),
    getSiteSettings: () => api("/api/mechanic/settings/site", { headers: mechanicHeaders() }),
    updateSiteSettings: (payload) => api("/api/mechanic/settings/site", { method: "PUT", body: payload, headers: mechanicHeaders() }),
    listVehicles: (q = "") =>
      api(`/api/mechanic/vehicles${q ? "?q=" + encodeURIComponent(q) : ""}`, { headers: mechanicHeaders() }),
    createVehicle: (payload) => api("/api/mechanic/vehicles", { method: "POST", body: payload, headers: mechanicHeaders() }),
    getVehicle: (id) => api(`/api/mechanic/vehicles/${id}`, { headers: mechanicHeaders() }),
    updateVehicle: (id, payload) => api(`/api/mechanic/vehicles/${id}`, { method: "PUT", body: payload, headers: mechanicHeaders() }),
    deleteVehicle: (id) => api(`/api/mechanic/vehicles/${id}`, { method: "DELETE", headers: mechanicHeaders() }),
    addVehicleVisit: (id, payload) =>
      api(`/api/mechanic/vehicles/${id}/visits`, { method: "POST", body: payload, headers: mechanicHeaders() }),
    updateVehicleVisit: (visitId, payload) =>
      api(`/api/mechanic/visits/${visitId}`, { method: "PUT", body: payload, headers: mechanicHeaders() }),
    deleteVehicleVisit: (visitId) =>
      api(`/api/mechanic/visits/${visitId}`, { method: "DELETE", headers: mechanicHeaders() }),
  },
};
