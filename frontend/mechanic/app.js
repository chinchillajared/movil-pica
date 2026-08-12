function $(id) {
  return document.getElementById(id);
}

function escapeHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function buildInfoTag(label, value) {
  var tag = document.createElement("span");
  tag.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white text-sm";
  tag.innerHTML = "<span class='font-bold text-slate-800'>" + escapeHTML(label) + "</span> <span class='text-slate-600'>" + escapeHTML(value == null || value === "" ? "—" : value) + "</span>";
  return tag;
}

function tagsRow(items) {
  var wrap = document.createElement("div");
  wrap.className = "flex flex-wrap justify-center gap-2";
  items.forEach(function (it) {
    wrap.appendChild(buildInfoTag(it.label, it.value));
  });
  return wrap;
}

function t(key) {
  return window.I18N ? window.I18N.t(key) : key;
}

function todayISO() {
  var d = new Date();
  var tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

var currentView = null;
var calPollTimer = null;

function startCalPoll() {
  stopCalPoll();
  calPollTimer = setInterval(function () {
    renderCal();
    if (calSelectedDate) showCalDay(calSelectedDate);
  }, 15000);
}

function stopCalPoll() {
  if (calPollTimer) {
    clearInterval(calPollTimer);
    calPollTimer = null;
  }
}

window.addEventListener("focus", function () {
  if (currentView === "calendar") {
    renderCal();
    if (calSelectedDate) showCalDay(calSelectedDate);
  }
});

function showView(viewName) {
  var views = document.querySelectorAll("[id^='view-']");
  views.forEach(function (v) { v.classList.add("hidden"); });
  var landingView = $("view-landing");
  if (viewName === "landing") {
    if (landingView) landingView.classList.remove("hidden");
    currentView = "landing";
    stopCalPoll();
    localStorage.setItem("mechanic_current_view", "landing");
  } else {
    var target = $("view-" + viewName);
    if (target) target.classList.remove("hidden");
    if (landingView) landingView.classList.add("hidden");
    currentView = viewName;
    localStorage.setItem("mechanic_current_view", viewName);
    if (viewName === "vehicle-detail" && currentVehicleId != null) {
      localStorage.setItem("mechanic_current_vehicle", String(currentVehicleId));
    }
    if (viewName === "calendar") startCalPoll();
    else stopCalPoll();
  }
  var backHome = $("back-home-btn");
  if (backHome) backHome.classList.toggle("hidden", viewName === "landing");
  document.querySelectorAll(".sidebar-link[data-view]").forEach(function (link) {
    link.classList.toggle("active", link.dataset.view === viewName);
  });
}

function homeDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function homeDateString(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function loadHomeDashboard() {
  var appointmentsEl = $("home-appointments");
  if (!appointmentsEl) return;
  var today = homeDateOnly(new Date());
  var weekStart = new Date(today);
  var day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  Promise.all([
    window.API.mechanic.list(),
    window.API.mechanic.listVehicles().catch(function () { return []; }),
  ]).then(function (results) {
    var appointments = results[0] || [];
    var weekAppointments = appointments.filter(function (a) {
      var date = new Date(String(a.appointment_date) + "T12:00:00");
      return a.status !== "cancelled" && date >= weekStart && date <= weekEnd;
    }).sort(function (a, b) {
      return String(a.appointment_date + " " + a.appointment_time).localeCompare(String(b.appointment_date + " " + b.appointment_time));
    });
    var pending = appointments.filter(function (a) { return a.status === "pending"; });
    var next = appointments.filter(function (a) {
      var date = new Date(String(a.appointment_date) + "T" + String(a.appointment_time || "00:00"));
      return a.status !== "cancelled" && a.status !== "completed" && date >= new Date();
    }).sort(function (a, b) {
      return String(a.appointment_date + " " + a.appointment_time).localeCompare(String(b.appointment_date + " " + b.appointment_time));
    })[0];

    $("home-week-count").textContent = weekAppointments.length;
    $("home-pending-count").textContent = pending.length;
    $("home-next-date").textContent = next
      ? formatLongDate(String(next.appointment_date)) + " · " + (function () { var tv = to12(next.appointment_time); return tv.hour + ":" + tv.minute + " " + tv.ampm; })()
      : t("home_no_appointments");
    $("home-next-client").textContent = next ? [next.first_name, next.last_name].filter(Boolean).join(" ") + " · " + (next.plate || "") : "";

    appointmentsEl.innerHTML = "";
    var empty = $("home-appointments-empty");
    if (!weekAppointments.length) {
      empty.classList.remove("hidden");
    } else {
      empty.classList.add("hidden");
      weekAppointments.slice(0, 6).forEach(function (a) {
        var row = document.createElement("div");
        row.className = "flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5";
        var time = document.createElement("div");
        time.className = "w-16 shrink-0 text-sm font-bold text-slate-900";
        var tv = to12(a.appointment_time);
        time.textContent = tv.hour + ":" + tv.minute + " " + tv.ampm;
        var info = document.createElement("div");
        info.className = "min-w-0 flex-1";
        info.innerHTML = "<div class='truncate text-sm font-semibold text-slate-800'>" + escapeHTML([a.first_name, a.last_name].filter(Boolean).join(" ") || "—") + "</div><div class='truncate text-xs text-slate-500'>" + escapeHTML(a.plate || "—") + " · " + escapeHTML(formatLongDate(String(a.appointment_date))) + "</div>";
        var badge = document.createElement("span");
        badge.className = "shrink-0 rounded-full px-2 py-1 text-xs font-semibold " + statusBadgeClass(a.status);
        badge.textContent = statusLabel(a.status);
        row.appendChild(time);
        row.appendChild(info);
        row.appendChild(badge);
        appointmentsEl.appendChild(row);
      });
    }
    loadHomeReminders();
  }).catch(function () {
    $("home-week-count").textContent = "—";
    $("home-pending-count").textContent = "—";
    loadHomeReminders();
  });
}

function renderHomeReminders(items) {
  var list = $("home-reminders");
  var empty = $("home-reminders-empty");
  if (!list || !empty) return;
  list.innerHTML = "";
  empty.classList.toggle("hidden", items.length > 0);
  items.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5";
    var text = document.createElement("p");
    text.className = "flex-1 text-sm text-slate-700";
    text.textContent = item.text;
    var done = document.createElement("button");
    done.type = "button";
    done.className = "text-xs font-semibold text-brand-700 hover:text-brand-900";
    done.textContent = t("home_mark_done");
    done.addEventListener("click", function () {
      window.API.mechanic.updateReminder(item.id, { is_completed: true }).then(loadHomeReminders);
    });
    row.appendChild(text);
    row.appendChild(done);
    list.appendChild(row);
  });
}

function loadHomeReminders() {
  window.API.mechanic.listReminders().then(function (items) {
    renderHomeReminders(items || []);
  }).catch(function () {
    renderHomeReminders([]);
  });
}

function initHomeDashboard() {
  loadHomeDashboard();
  var add = $("home-add-reminder");
  var form = $("home-reminder-form");
  var input = $("home-reminder-input");
  if (add && form && !add.dataset.wired) {
    add.dataset.wired = "1";
    add.addEventListener("click", function () {
      form.classList.toggle("hidden");
      form.classList.toggle("flex");
      if (!form.classList.contains("hidden")) input.focus();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      window.API.mechanic.createReminder({ text: text }).then(function () {
        input.value = "";
        form.classList.add("hidden");
        form.classList.remove("flex");
        loadHomeReminders();
      });
    });
  }
  var calendar = $("home-calendar-btn");
  if (calendar && !calendar.dataset.wired) { calendar.dataset.wired = "1"; calendar.addEventListener("click", function () { $("sidebar-calendar").click(); }); }
  var vehicles = $("home-vehicles-btn");
  if (vehicles && !vehicles.dataset.wired) { vehicles.dataset.wired = "1"; vehicles.addEventListener("click", function () { $("sidebar-vehicles").click(); }); }
}

function flash(msg, isError) {
  var existing = $("flash-msg");
  if (existing) existing.remove();
  var el = document.createElement("div");
  el.id = "flash-msg";
  el.className =
    "fixed bottom-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white " +
    (isError ? "bg-red-600" : "bg-green-600");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3500);
}

function showErrorBox(id, msg) {
  var el = $(id);
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("hidden");
}

function hideBox(id) {
  var el = $(id);
  if (el) el.classList.add("hidden");
}

function showSuccessBox(id, msg) {
  var el = $(id);
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("hidden");
}

function setMechanicKey(token) {
  if (token) localStorage.setItem("mechanic_key", token);
}

function clearMechanicSession() {
  localStorage.removeItem("mechanic_key");
  localStorage.removeItem("mechanic_refresh");
  localStorage.removeItem("mechanic_user");
  localStorage.removeItem("mechanic_current_view");
  localStorage.removeItem("mechanic_current_vehicle");
}

function getMechanicUser() {
  try {
    return JSON.parse(localStorage.getItem("mechanic_user") || "null");
  } catch (e) {
    return null;
  }
}

function setMechanicUser(u) {
  if (u) localStorage.setItem("mechanic_user", JSON.stringify(u));
  else localStorage.removeItem("mechanic_user");
}

function openModal(title, content) {
  closeModal();
  var overlay = document.createElement("div");
  overlay.id = "app-modal-overlay";
  overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto";
  var box = document.createElement("div");
  box.className = "bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8";
  box.innerHTML =
    '<div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">' +
    '<h3 class="text-lg font-bold text-slate-800"></h3>' +
    '<button type="button" data-close class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>' +
    "</div>" +
    '<div class="p-5" data-body></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector("h3").textContent = title || "";
  box.querySelector("[data-close]").addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  return { overlay: overlay, body: box.querySelector("[data-body]") };
}

function closeModal() {
  var o = $("app-modal-overlay");
  if (o) o.remove();
}

function readFileAsDataURL(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(new Error("read error")); };
    reader.readAsDataURL(file);
  });
}

function fileToDataURL(input, maxBytes, onChange) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (maxBytes && file.size > maxBytes) {
    flash(t("vehicles_photo_too_large"), true);
    input.value = "";
    return;
  }
  readFileAsDataURL(file).then(onChange).catch(function () {
    input.value = "";
  });
}

function to12(v) {
  var parts = String(v || "08:00").split(":");
  var h = parseInt(parts[0], 10) || 0;
  var m = parts[1] || "00";
  var ampm = h < 12 ? "AM" : "PM";
  var hour = h % 12;
  if (hour === 0) hour = 12;
  return { hour: hour, minute: String(m).padStart(2, "0"), ampm: ampm };
}

function from12(hour, minute, ampm) {
  var h = parseInt(hour, 10) % 12;
  if (ampm === "PM") h += 12;
  return String(h).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function hmToMin(hhmm) {
  var p = String(hhmm || "00:00").split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
}

function buildTimeField(container, value, onChange) {
  container.innerHTML = "";
  var v = to12(value);
  var state = { hour: v.hour, minute: parseInt(v.minute, 10), ampm: v.ampm };

  function normalizeHour(h) {
    if (isNaN(h)) return state.hour;
    h = Math.round(h);
    if (h < 1) h = 1;
    if (h > 12) h = 12;
    return h;
  }

  function normalizeMinute(m) {
    if (isNaN(m)) return state.minute;
    m = Math.round(m / 5) * 5;
    if (m < 0) m = 0;
    if (m > 55) m = 55;
    return m;
  }

  function commit() {
    state.hour = normalizeHour(parseInt(hourField.input.value, 10));
    state.minute = normalizeMinute(parseInt(minField.input.value, 10));
    hourField.input.value = state.hour;
    minField.input.value = String(state.minute).padStart(2, "0");
    onChange(from12(state.hour, String(state.minute).padStart(2, "0"), state.ampm));
  }

  function stepHour(delta) {
    state.hour = normalizeHour(state.hour + delta);
    hourField.input.value = state.hour;
    commit();
  }

  function stepMinute(delta) {
    state.minute = normalizeMinute(state.minute + delta);
    minField.input.value = String(state.minute).padStart(2, "0");
    commit();
  }

  function makeStepper(initial, label) {
    var box = document.createElement("div");
    box.className = "inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden";
    var dec = document.createElement("button");
    dec.type = "button";
    dec.className = "w-7 h-9 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-base leading-none";
    dec.textContent = "−";
    dec.setAttribute("aria-label", label);
    var input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 2;
    input.setAttribute("aria-label", label);
    input.className = "w-8 h-9 text-center text-sm font-semibold text-slate-700 bg-transparent outline-none focus:bg-brand-50";
    input.value = String(initial);
    var inc = document.createElement("button");
    inc.type = "button";
    inc.className = "w-7 h-9 text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-base leading-none";
    inc.textContent = "+";
    inc.setAttribute("aria-label", label);
    box.appendChild(dec);
    box.appendChild(input);
    box.appendChild(inc);
    return { box: box, input: input, dec: dec, inc: inc };
  }

  var wrap = document.createElement("div");
  wrap.className = "inline-flex items-center gap-1.5 flex-wrap";
  var hourField = makeStepper(state.hour, t("settings_hour"));
  wrap.appendChild(hourField.box);
  var colon = document.createElement("span");
  colon.className = "text-slate-400 font-semibold";
  colon.textContent = ":";
  wrap.appendChild(colon);
  var minField = makeStepper(String(state.minute).padStart(2, "0"), t("settings_minute"));
  wrap.appendChild(minField.box);

  hourField.dec.addEventListener("click", function () { stepHour(-1); });
  hourField.inc.addEventListener("click", function () { stepHour(1); });
  minField.dec.addEventListener("click", function () { stepMinute(-5); });
  minField.inc.addEventListener("click", function () { stepMinute(5); });

  hourField.input.addEventListener("change", commit);
  minField.input.addEventListener("change", commit);
  hourField.input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") { e.preventDefault(); stepHour(1); }
    if (e.key === "ArrowDown") { e.preventDefault(); stepHour(-1); }
  });
  minField.input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") { e.preventDefault(); stepMinute(5); }
    if (e.key === "ArrowDown") { e.preventDefault(); stepMinute(-5); }
  });

  var ampm = document.createElement("div");
  ampm.className = "inline-flex rounded-lg bg-slate-100 p-0.5";
  ["AM", "PM"].forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button";
    b.dataset.ampm = p;
    b.textContent = p;
    b.className = state.ampm === p
      ? "px-3 py-1.5 text-xs font-semibold rounded-md bg-brand-600 text-white"
      : "px-3 py-1.5 text-xs font-semibold rounded-md text-slate-600 hover:bg-white";
    b.addEventListener("click", function () {
      state.ampm = p;
      ampm.querySelectorAll("button").forEach(function (x) {
        var on = x.dataset.ampm === p;
        x.className = on
          ? "px-3 py-1.5 text-xs font-semibold rounded-md bg-brand-600 text-white"
          : "px-3 py-1.5 text-xs font-semibold rounded-md text-slate-600 hover:bg-white";
      });
      commit();
    });
    ampm.appendChild(b);
  });
  wrap.appendChild(ampm);

  container.appendChild(wrap);
}

function monthNamesES() {
  return ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
}

function weekdayNamesES() {
  return ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
}

function dayLabel(i) {
  var keys = ["settings_dow_sun", "settings_dow_mon", "settings_dow_tue", "settings_dow_wed", "settings_dow_thu", "settings_dow_fri", "settings_dow_sat"];
  var fb = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var v = window.I18N ? window.I18N.t(keys[i]) : keys[i];
  return v && v !== keys[i] ? v : fb[i];
}

function formatLongDate(dateStr) {
  return window.formatAppDate ? window.formatAppDate(dateStr) : dateStr;
}

function formatDMY(dateStr) {
  if (!dateStr) return "";
  var p = String(dateStr).split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}

function attachDatePicker(trigger, wrap, initialDate, onChange) {
  var year = initialDate ? parseInt(initialDate.slice(0, 4), 10) : new Date().getFullYear();
  var month = initialDate ? parseInt(initialDate.slice(5, 7), 10) - 1 : new Date().getMonth();
  var selected = initialDate || todayISO();
  var monthNames = monthNamesES();

  function buildCalendar(overlay, close) {
    var box = document.createElement("div");
    box.className = "bg-white rounded-2xl shadow-2xl w-full max-w-xs p-4 select-none";
    var top = document.createElement("div");
    top.className = "flex items-center justify-between mb-1";
    var topTitle = document.createElement("span");
    topTitle.className = "text-sm font-bold text-slate-800";
    topTitle.textContent = t("visits_date");
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "text-slate-500 hover:text-slate-800 text-sm font-medium";
    closeBtn.textContent = t("dialog_close");
    closeBtn.addEventListener("click", function () { if (close) close(); });
    top.appendChild(topTitle);
    top.appendChild(closeBtn);
    box.appendChild(top);

    var header = document.createElement("div");
    header.className = "flex items-center justify-between mb-2";
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 text-lg leading-none";
    prev.textContent = "‹";
    var label = document.createElement("span");
    label.className = "font-bold text-sm";
    label.textContent = monthNames[month] + " " + year;
    var next = document.createElement("button");
    next.type = "button";
    next.className = "w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 text-lg leading-none";
    next.textContent = "›";
    header.appendChild(prev);
    header.appendChild(label);
    header.appendChild(next);
    box.appendChild(header);

    var hrow = document.createElement("div");
    hrow.className = "grid grid-cols-7 text-center text-xs font-semibold text-slate-500 mb-1";
    for (var d = 0; d < 7; d++) {
      var hc = document.createElement("div");
      hc.textContent = dayLabel(d);
      hrow.appendChild(hc);
    }
    box.appendChild(hrow);

    var grid = document.createElement("div");
    grid.className = "grid grid-cols-7 gap-1 text-center";
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div"));
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "w-8 h-8 rounded-lg text-sm font-medium " + (dateStr === selected ? "bg-brand-600 text-white" : "hover:bg-slate-100 text-slate-700");
      cell.textContent = day;
      cell.addEventListener("click", (function (ds) {
        return function () {
          selected = ds;
          if (onChange) onChange(ds);
          overlay.remove();
        };
      })(dateStr));
      grid.appendChild(cell);
    }
    box.appendChild(grid);

    prev.addEventListener("click", function () {
      month--;
      if (month < 0) { month = 11; year--; }
      box.innerHTML = "";
      buildCalendar(overlay, close);
    });
    next.addEventListener("click", function () {
      month++;
      if (month > 11) { month = 0; year++; }
      box.innerHTML = "";
      buildCalendar(overlay, close);
    });

    overlay.appendChild(box);
  }

  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    var overlay = document.createElement("div");
    overlay.id = "app-date-overlay";
    overlay.className = "fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4";
    function close() { overlay.remove(); }
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) close(); });
    buildCalendar(overlay, close);
    document.body.appendChild(overlay);
  });

  return {
    getValue: function () { return selected; },
    setValue: function (ds) {
      selected = ds;
      if (ds) {
        year = parseInt(ds.slice(0, 4), 10);
        month = parseInt(ds.slice(5, 7), 10) - 1;
      }
      if (onChange) onChange(ds);
    },
  };
}

function statusLabel(s) {
  var map = {
    pending: "status_pending",
    confirmed: "status_confirmed",
    completed: "status_completed",
    cancelled: "status_cancelled",
  };
  return t(map[s] || s);
}

function statusBadgeClass(s) {
  var map = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return map[s] || "bg-slate-100 text-slate-600";
}

function photoThumb(src, onClick) {
  var wrap = document.createElement("div");
  wrap.className = "relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200";
  var img = document.createElement("img");
  img.src = src;
  img.className = "w-full h-full object-cover cursor-pointer";
  if (onClick) img.addEventListener("click", onClick);
  wrap.appendChild(img);
  return wrap;
}

function viewPhoto(src) {
  if (!src) return;
  var overlay = document.createElement("div");
  overlay.id = "app-photo-overlay";
  overlay.className = "fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4";
  overlay.innerHTML =
    '<div class="bg-white rounded-2xl p-2 max-w-full max-h-full overflow-auto">' +
      '<img class="max-w-full max-h-[85vh] rounded-lg" src="' + escapeHTML(src) + '" />' +
      '<button type="button" id="photo-close" class="block mx-auto mt-2 px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium">' + escapeHTML(t("dialog_close")) + '</button>' +
    '</div>';
  function close() { overlay.remove(); }
  overlay.querySelector("#photo-close").addEventListener("click", close);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
}

var STATUS_SQUARE = {
  pending: "bg-yellow-400 text-slate-900",
  confirmed: "bg-blue-500 text-white",
  completed: "bg-green-500 text-white",
  cancelled: "bg-red-500 text-white",
};
var STATUS_PRIORITY = ["pending", "confirmed", "completed", "cancelled"];

function pickStatus(statuses) {
  for (var i = 0; i < STATUS_PRIORITY.length; i++) {
    if (statuses.indexOf(STATUS_PRIORITY[i]) !== -1) return STATUS_PRIORITY[i];
  }
  return null;
}

/* ================================================================
   LOGIN / FIRST-RUN SETUP
   ================================================================ */

function initLoginPage() {
  var loginForm = $("login-form");
  var setupForm = $("setup-form");
  var setupLogoDataUrl = "";

  var setupLogoBtn = $("setup-logo-btn");
  if (setupLogoBtn) {
    setupLogoBtn.addEventListener("click", function () {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        fileToDataURL(input, 2 * 1024 * 1024, function (dataUrl) {
          setupLogoDataUrl = dataUrl;
          var preview = $("setup-logo-preview");
          if (preview) { preview.src = dataUrl; preview.classList.remove("hidden"); }
        });
        input.remove();
      });
      input.click();
    });
  }

  window.API.mechanic.bootstrapStatus().then(function (status) {
    if (status.needs_setup) {
      if (setupForm) setupForm.classList.remove("hidden");
    } else {
      if (loginForm) loginForm.classList.remove("hidden");
    }
  }).catch(function () {
    if (loginForm) loginForm.classList.remove("hidden");
  });

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("login-email").value.trim();
      var password = $("login-password").value;
      hideBox("form-error");
      var btn = loginForm.querySelector("button[type=submit]");
      btn.disabled = true;
      window.API.mechanic.login({ email: email, password: password }).then(function (res) {
        setMechanicSession(res);
        window.location.href = "/mechanic/dashboard.html";
      }).catch(function (err) {
        btn.disabled = false;
        showErrorBox("form-error", err.message || t("client_invalid_credentials"));
      });
    });
  }

  if (setupForm) {
    setupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var payload = {
        name: $("setup-name").value.trim(),
        email: $("setup-email").value.trim(),
        password: $("setup-password").value,
        logo_data_url: setupLogoDataUrl,
      };
      hideBox("setup-error");
      var btn = setupForm.querySelector("button[type=submit]");
      btn.disabled = true;
      window.API.mechanic.bootstrap(payload).then(function (res) {
        setMechanicSession(res);
        window.location.href = "/mechanic/dashboard.html";
      }).catch(function (err) {
        btn.disabled = false;
        showErrorBox("setup-error", err.message || t("error_generic"));
      });
    });
  }
}

function setMechanicSession(res) {
  if (res.token) setMechanicKey(res.token);
  if (res.refresh_token) localStorage.setItem("mechanic_refresh", res.refresh_token);
  if (res.user) setMechanicUser(res.user);
}

/* ================================================================
   CREATE APPOINTMENT (create.html)
   ================================================================ */

function initCreatePage() {
  var calMonth = new Date().getMonth();
  var calYear = new Date().getFullYear();
  var selectedDate = null;
  var selectedTime = null;
  var currentStep = 1;
  var scheduleDays = null;
  var phoneCode = "+506";

  var monthNames = monthNamesES();
  var dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  function loadSchedule() {
    return window.API.mechanic.getSchedule().then(function (s) {
      scheduleDays = s.days || [];
    }).catch(function () {
      scheduleDays = null;
    });
  }

  function slotsForDate(dateStr) {
    if (!scheduleDays) {
      return ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    }
    var d = new Date(String(dateStr) + "T00:00:00");
    var entry = null;
    for (var i = 0; i < scheduleDays.length; i++) {
      if (scheduleDays[i].day === d.getDay()) { entry = scheduleDays[i]; break; }
    }
    if (!entry) return [];
    var shm = String(entry.start_time).split(":");
    var ehm = String(entry.end_time).split(":");
    var start = parseInt(shm[0], 10) * 60 + parseInt(shm[1] || "0", 10);
    var end = parseInt(ehm[0], 10) * 60 + parseInt(ehm[1] || "0", 10);
    var ls = entry.lunch_start ? parseInt(entry.lunch_start.split(":")[0], 10) * 60 + parseInt(entry.lunch_start.split(":")[1] || "0", 10) : null;
    var le = entry.lunch_end ? parseInt(entry.lunch_end.split(":")[0], 10) * 60 + parseInt(entry.lunch_end.split(":")[1] || "0", 10) : null;
    var slots = [];
    var t = start;
    while (t < end) {
      var h = Math.floor(t / 60);
      var m = t % 60;
      var timeStr = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      if (ls === null || le === null || t < ls || t >= le) slots.push(timeStr);
      t += 60;
    }
    return slots;
  }

  function renderCalendar() {
    var grid = $("cal-days");
    var monthYear = $("cal-month-year");
    if (!grid) return;
    grid.innerHTML = "";
    if (monthYear) monthYear.textContent = monthNames[calMonth] + " " + calYear;

    var firstDay = new Date(calYear, calMonth, 1).getDay();
    var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    var headers = $("cal-day-headers");
    if (headers) {
      headers.innerHTML = "";
      dayNames.forEach(function (d) {
        var c = document.createElement("div");
        c.className = "text-xs font-semibold text-slate-500 uppercase py-1 tracking-wide";
        c.textContent = d;
        headers.appendChild(c);
      });
    }

    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    window.API.public.getTakenDates(calYear, calMonth + 1).then(function (taken) {
      drawCreateCalendar(grid, firstDay, daysInMonth, taken || [], todayStart, now);
    }).catch(function () {
      drawCreateCalendar(grid, firstDay, daysInMonth, [], todayStart, now);
    });
  }

  function drawCreateCalendar(grid, firstDay, daysInMonth, takenDates, todayStart, now) {
    var takenSet = {};
    takenDates.forEach(function (d) { takenSet[d] = true; });
    for (var i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div"));
    for (var d = 1; d <= daysInMonth; d++) {
      let dateStr = calYear + "-" + String(calMonth + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      var date = new Date(calYear, calMonth, d);
      date.setHours(0, 0, 0, 0);
      var isToday = date.getTime() === todayStart;
      var isPast = date.getTime() < todayStart;
      var daySlots = slotsForDate(dateStr);
      var lastSlot = daySlots.length ? hmToMin(daySlots[daySlots.length - 1]) : 0;
      var allPassed = isToday && (now.getHours() * 60 + now.getMinutes() + 60) > lastSlot;
      var disabled = isPast || daySlots.length === 0 || takenSet[dateStr] || allPassed;

      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "w-full py-2 rounded-lg text-sm font-medium transition";
      if (disabled) {
        cell.className += " text-slate-300 cursor-not-allowed";
        cell.disabled = true;
      } else if (dateStr === selectedDate) {
        cell.className += " bg-brand-600 text-white";
      } else if (isToday) {
        cell.className += " bg-brand-50 text-brand-700 font-bold border border-brand-300";
      } else {
        cell.className += " bg-green-50 hover:bg-green-100 text-slate-800 cursor-pointer border border-green-200";
      }
      cell.textContent = d;
      if (!disabled) {
        cell.addEventListener("click", function () {
          selectedDate = dateStr;
          selectedTime = null;
          renderCalendar();
          var next = $("step1-next");
          if (next) next.disabled = false;
        });
      }
      grid.appendChild(cell);
    }
  }

  function renderTimeSlots() {
    var grid = $("hour-grid");
    if (!grid) return;
    grid.innerHTML = "";
    var slots = selectedDate ? slotsForDate(selectedDate) : [];
    var step2Error = $("step2-error");
    if (step2Error) step2Error.classList.add("hidden");
    if (slots.length === 0) {
      if (step2Error) {
        step2Error.textContent = "No hay horarios disponibles para este día.";
        step2Error.classList.remove("hidden");
      }
      return;
    }
    slots.forEach(function (h) {
      var btn = document.createElement("button");
      btn.type = "button";
      var selected = h === selectedTime;
      var tv = to12(h);
      btn.className = selected
        ? "py-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-700 font-semibold text-lg"
        : "py-4 rounded-xl border-2 border-slate-300 font-semibold text-lg bg-white hover:bg-slate-50 transition text-slate-800";
      btn.textContent = tv.hour + ":" + tv.minute + " " + tv.ampm;
      btn.addEventListener("click", function () {
        selectedTime = h;
        renderTimeSlots();
        var next = $("step2-next");
        if (next) next.disabled = false;
      });
      grid.appendChild(btn);
    });
  }

  function showStep(step) {
    currentStep = step;
    for (var i = 1; i <= 3; i++) {
      var el = $("step-" + i);
      if (el) {
        if (i === step) el.classList.remove("hidden");
        else el.classList.add("hidden");
      }
    }
    if (step === 1) renderCalendar();
    if (step === 2) {
      var dateDisplay = $("step2-date-display");
      if (dateDisplay && selectedDate) {
        dateDisplay.textContent = formatLongDate(selectedDate);
      }
      renderTimeSlots();
    }
    if (step === 3) {
      var finalDate = $("final-date-display");
      var finalTime = $("final-time-display");
      if (finalDate && selectedDate) {
        finalDate.textContent = formatLongDate(selectedDate);
      }
      if (finalTime && selectedTime) {
        var tv2 = to12(selectedTime);
        finalTime.textContent = tv2.hour + ":" + tv2.minute + " " + tv2.ampm;
      }
    }
  }

  var calPrev = $("cal-prev");
  if (calPrev) {
    calPrev.addEventListener("click", function () {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
  }

  var calNext = $("cal-next");
  if (calNext) {
    calNext.addEventListener("click", function () {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });
  }

  var step1Next = $("step1-next");
  if (step1Next) step1Next.addEventListener("click", function () { if (selectedDate) showStep(2); });
  var step2Next = $("step2-next");
  if (step2Next) step2Next.addEventListener("click", function () { if (selectedTime) showStep(3); });
  var step2Back = $("step2-back");
  if (step2Back) step2Back.addEventListener("click", function () { showStep(1); });
  var step3Back = $("step3-back");
  if (step3Back) step3Back.addEventListener("click", function () { showStep(2); });

  var phoneBtn = $("phone-code-btn");
  var phoneDropdown = $("phone-code-dropdown");
  if (phoneBtn && phoneDropdown) {
    phoneBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      phoneDropdown.classList.toggle("hidden");
    });
    phoneDropdown.querySelectorAll(".code-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        phoneCode = opt.dataset.value;
        phoneBtn.querySelector("[data-value]").textContent = opt.textContent.trim();
        phoneDropdown.classList.add("hidden");
      });
    });
    document.addEventListener("click", function () {
      if (phoneDropdown) phoneDropdown.classList.add("hidden");
    });
  }

  var shareBtn = $("share-location");
  if (shareBtn) {
    shareBtn.addEventListener("click", function () {
      var locStatus = $("location-status");
      if (!navigator.geolocation) return;
      if (locStatus) {
        locStatus.classList.remove("hidden");
        locStatus.textContent = "Obteniendo ubicación...";
      }
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var addr = $("address");
        if (addr) addr.value = lat.toFixed(6) + ", " + lng.toFixed(6);
        var link = $("maps-link");
        if (link) {
          link.href = "https://www.google.com/maps?q=" + lat + "," + lng;
          link.classList.remove("hidden");
        }
        if (locStatus) locStatus.textContent = "Ubicación obtenida";
      }, function () {
        if (locStatus) locStatus.textContent = "No se pudo obtener la ubicación.";
      });
    });
  }

  var createForm = $("create-form");
  if (createForm) {
    createForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var firstName = $("first_name").value.trim();
      var lastName = $("last_name").value.trim();
      var phone = $("phone").value.trim();
      var plate = $("plate").value.trim();

      if (!firstName || !lastName || !phone || !plate) {
        showErrorBox("form-error", "Todos los campos son obligatorios.");
        return;
      }
      hideBox("form-error");

      var payload = {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        country_code: phoneCode,
        plate: plate,
        email: $("email").value.trim() || null,
        address: $("address").value.trim(),
        appointment_date: selectedDate,
        appointment_time: selectedTime,
      };

      var submitBtn = createForm.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      showLoading();
      window.API.mechanic.create(payload).then(function (data) {
        hideLoading();
        if (submitBtn) submitBtn.disabled = false;
        var num = (data && (data.appointment_number || (data.appointment && data.appointment.number))) || "#";
        var st = $("create-success-tags");
        if (st) {
          st.innerHTML = "";
          st.appendChild(buildInfoTag(t("your_number"), num));
          st.appendChild(buildInfoTag(t("label_plate"), plate));
        }
        var s3 = $("step-3");
        if (s3) s3.classList.add("hidden");
        var success = $("create-success");
        if (success) success.classList.remove("hidden");
      }).catch(function (err) {
        hideLoading();
        if (submitBtn) submitBtn.disabled = false;
        showErrorBox("form-error", err.message || "Error al agendar cita.");
      });
    });
  }

  var customerGuestBtn = $("customer-guest");
  var customerRegBtn = $("customer-registered");
  var regWrap = $("registered-client-wrap");
  var regVehicleSelect = $("registered-vehicle-select");

  function setCustomerType(type) {
    var isRegistered = type === "registered";
    if (regWrap) regWrap.classList.toggle("hidden", !isRegistered);
    if (customerGuestBtn) {
      customerGuestBtn.className = "px-5 py-2 text-sm font-semibold rounded-md " + (isRegistered ? "text-slate-600 hover:text-slate-800" : "bg-white text-brand-700 shadow-sm");
    }
    if (customerRegBtn) {
      customerRegBtn.className = "px-5 py-2 text-sm font-semibold rounded-md " + (isRegistered ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-800");
    }
  }

  if (customerGuestBtn) customerGuestBtn.addEventListener("click", function () { setCustomerType("guest"); });
  if (customerRegBtn) customerRegBtn.addEventListener("click", function () { setCustomerType("registered"); });

  var allClients = [];
  var clientSearch = $("client-search");
  var clientSearchResults = $("client-search-results");
  var clientSearchEmpty = $("client-search-empty");

  function renderClientResults(filter) {
    if (!clientSearchResults) return;
    clientSearchResults.innerHTML = "";
    if (clientSearchEmpty) clientSearchEmpty.classList.add("hidden");
    var q = (filter || "").toLowerCase().trim();
    if (!q) return;
    var matches = allClients.filter(function (c) {
      var first = (c.first_name || "").toLowerCase();
      var last = (c.last_name || "").toLowerCase();
      var phone = String(c.phone || "").toLowerCase();
      return first.indexOf(q) !== -1 || last.indexOf(q) !== -1 || (first + " " + last).indexOf(q) !== -1 || phone.indexOf(q) !== -1;
    });
    if (matches.length === 0) {
      if (clientSearchEmpty) {
        clientSearchEmpty.textContent = t("appointment_no_clients_found");
        clientSearchEmpty.classList.remove("hidden");
      }
      return;
    }
    matches.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full text-left px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50";
      var name = document.createElement("span");
      name.className = "block font-medium text-slate-800";
      name.textContent = c.first_name + " " + c.last_name;
      btn.appendChild(name);
      btn.appendChild(tagsRow([{ label: t("label_phone"), value: (c.country_code || "") + " " + c.phone }]));
      btn.addEventListener("click", function () {
        if (clientSearch) clientSearch.value = c.first_name + " " + c.last_name;
        if (clientSearchResults) clientSearchResults.innerHTML = "";
        if (clientSearchEmpty) clientSearchEmpty.classList.add("hidden");
        fillRegisteredClient(c);
      });
      clientSearchResults.appendChild(btn);
    });
  }

  if (clientSearch) {
    clientSearch.addEventListener("input", function () {
      renderClientResults(clientSearch.value);
    });
  }

  window.API.mechanic.listClients().then(function (clients) {
    allClients = clients || [];
  }).catch(function () {});

  function fillRegisteredClient(client) {
    var first = $("first_name");
    var last = $("last_name");
    var phoneInput = $("phone");
    var email = $("email");
    if (first) first.value = client.first_name || "";
    if (last) last.value = client.last_name || "";
    if (phoneInput) phoneInput.value = client.phone || "";
    if (email) email.value = client.email || "";
    phoneCode = client.country_code || "+506";
    var pcBtn = $("phone-code-btn");
    if (pcBtn) {
      pcBtn.setAttribute("data-value", phoneCode);
      var known = { "+506": "\uD83C\uDDE8\uD83C\uDDF7", "+1": "\uD83C\uDDFA\uD83C\uDDF8" };
      pcBtn.childNodes[0].textContent = (known[phoneCode] || "") + " " + phoneCode;
    }
    if (regVehicleSelect) {
      regVehicleSelect.disabled = false;
      regVehicleSelect.innerHTML = '<option value="">' + t("appointment_vehicle_other") + '</option>';
      window.API.mechanic.listClientVehicles(client.id).then(function (vehicles) {
        (vehicles || []).forEach(function (v) {
          var opt = document.createElement("option");
          opt.value = v.plate;
          opt.textContent = v.plate + (v.make || v.model ? " — " + [v.make, v.model].filter(Boolean).join(" ") : "");
          regVehicleSelect.appendChild(opt);
        });
      }).catch(function () {});
    }
  }

  if (regVehicleSelect) {
    regVehicleSelect.addEventListener("change", function () {
      var plateInput = $("plate");
      if (plateInput) plateInput.value = regVehicleSelect.value;
    });
  }

  loadSchedule().then(function () { showStep(1); });
}

/* ================================================================
   DASHBOARD AUTH + GEAR MENU
   ================================================================ */

var currentUser = null;
var calState = { year: new Date().getFullYear(), month: new Date().getMonth() };
var calSelectedDate = null;

function ensureMechanicAuth() {
  var key = getMechanicKey();
  if (!key) {
    window.location.href = "/mechanic/";
    return Promise.reject(new Error("no session"));
  }
  return window.API.mechanic.me().catch(function (err) {
    if (err.status === 401) {
      var refresh = getMechanicRefresh();
      if (refresh) {
        return window.API.mechanic.refresh(refresh).then(function (r) {
          setMechanicKey(r.access_token);
          return window.API.mechanic.me();
        });
      }
      throw err;
    }
    throw err;
  }).then(function (u) {
    currentUser = u;
    setMechanicUser(u);
    return u;
  }).catch(function () {
    clearMechanicSession();
    window.location.href = "/mechanic/";
    throw new Error("redirect");
  });
}

function initGearMenu() {
  var gear = $("account-gear");
  var dropdown = $("account-dropdown");
  if (gear && dropdown) {
    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
    });
    document.addEventListener("click", function () {
      dropdown.classList.add("hidden");
    });
  }

  var logoutBtn = $("account-menu-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      clearMechanicSession();
      window.location.href = "/mechanic/";
    });
  }

  var backHome = $("back-home-btn");
  if (backHome) {
    backHome.addEventListener("click", function () {
      if (currentView === "vehicle-detail") {
        showView("vehicles");
        renderVehiclesList();
      } else {
        showView("landing");
      }
    });
  }
}

function openAccountModal() {
  var m = openModal(t("client_my_account"), "");
  var u = currentUser || getMechanicUser() || {};
  var info = document.createElement("div");
  info.className = "mb-5";
  info.appendChild(tagsRow([
    { label: t("field_name"), value: u.name || "" },
    { label: t("client_email"), value: u.email || "" },
    { label: t("users_role"), value: u.role || "" },
  ]));
  m.body.appendChild(info);

  var form = document.createElement("form");
  form.className = "space-y-4";
  form.innerHTML =
    '<h4 class="font-semibold text-slate-700">' + escapeHTML(t("mechanic_change_password")) + "</h4>" +
    '<div><label class="field-label">' + escapeHTML(t("users_current_password")) + '</label><input id="pw-current" type="password" class="field-input" autocomplete="current-password" required></div>' +
    '<div><label class="field-label">' + escapeHTML(t("users_new_password")) + '</label><input id="pw-new" type="password" class="field-input" autocomplete="new-password" minlength="8" required></div>' +
    '<div id="pw-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("mechanic_change_password")) + "</button>";
  m.body.appendChild(form);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("pw-error");
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    window.API.mechanic.changePassword({
      current_password: $("pw-current").value,
      new_password: $("pw-new").value,
    }).then(function () {
      btn.disabled = false;
      closeModal();
      flash("Contraseña actualizada.");
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("pw-error", err.message || t("error_generic"));
    });
  });
}

function handleGmailQuery() {
  var params = new URLSearchParams(window.location.search);
  var g = params.get("gmail");
  if (!g) return;
  var msgs = {
    activated: "Gmail activado correctamente.",
    error: "No se pudo activar Gmail. Revisa las credenciales y la URI de redirección.",
    invalid_state: "Solicitud inválida.",
    expired: "La solicitud expiró. Intenta de nuevo.",
  };
  if (msgs[g]) flash(msgs[g], g !== "activated");
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

/* ================================================================
   DASHBOARD CALENDAR
   ================================================================ */

function renderCal() {
  var grid = $("cal-grid");
  if (!grid) return;
  grid.innerHTML = "";
  var year = calState.year;
  var month = calState.month;
  var monthNames = monthNamesES();
  var calMonthYear = $("cal-month-year");
  if (calMonthYear) calMonthYear.textContent = monthNames[month] + " " + year;

  var dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  dayNames.forEach(function (d) {
    var cell = document.createElement("div");
    cell.className = "text-xs font-semibold text-slate-400 py-2";
    cell.textContent = d;
    grid.appendChild(cell);
  });

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  window.API.mechanic.getCalendar(year, month + 1).then(function (bookings) {
    var byDate = {};
    (bookings || []).forEach(function (b) {
      byDate[b.date] = b.statuses || [];
    });
    for (var i = 0; i < firstDay; i++) {
      grid.appendChild(document.createElement("div"));
    }
    for (var d = 1; d <= daysInMonth; d++) {
      let dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      var statuses = byDate[dateStr] || [];
      var status = statuses.length ? pickStatus(statuses) : null;
      var cell = document.createElement("div");
      if (status) {
        cell.className = "p-2 rounded-lg cursor-pointer text-sm " + (STATUS_SQUARE[status] || "bg-brand-600 text-white");
      } else {
        cell.className = "p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-sm border border-transparent";
      }
      cell.innerHTML = String(d);
      cell.addEventListener("click", function () {
        showCalDay(dateStr);
      });
      grid.appendChild(cell);
    }
  }).catch(function () {
    for (var i = 0; i < firstDay; i++) {
      grid.appendChild(document.createElement("div"));
    }
    for (var d = 1; d <= daysInMonth; d++) {
      grid.appendChild(document.createElement("div"));
    }
  });
}

function refreshCalDay(dateStr) {
  renderCal();
  showCalDay(dateStr);
}

function showCalDay(dateStr) {
  calSelectedDate = dateStr;
  var sel = $("cal-selected");
  if (!sel) return;
  sel.classList.remove("hidden");
  var selDate = $("cal-selected-date");
  if (selDate) selDate.textContent = formatLongDate(dateStr);
  var card = $("cal-appt-card");
  var noAppt = $("cal-no-appt");
  var details = $("cal-appt-details");
  if (card) card.classList.add("hidden");
  if (noAppt) noAppt.classList.remove("hidden");
  if (details) details.innerHTML = "";

  Promise.all([
    window.API.mechanic.list(),
    window.API.mechanic.getAppointmentTime().catch(function () {
      return { unit: "hours", value: 2 };
    }),
  ]).then(function (results) {
    var appts = results[0] || [];
    var apptTime = results[1];
    var list = (appts || []).filter(function (a) {
      return String(a.appointment_date) === dateStr;
    });
    if (details) details.innerHTML = "";
    if (list.length === 0) {
      if (noAppt) noAppt.classList.remove("hidden");
      if (card) card.classList.add("hidden");
      return;
    }
    if (noAppt) noAppt.classList.add("hidden");
    if (card) card.classList.remove("hidden");
    list.forEach(function (a) {
      if (details) details.appendChild(buildApptRow(a, apptTime));
    });
  }).catch(function () {
    if (noAppt) noAppt.classList.remove("hidden");
    if (card) card.classList.add("hidden");
  });
}

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function hourLabel12(h) {
  var h12 = h % 12 || 12;
  var ampm = h < 12 ? "AM" : (h >= 24 ? "AM" : "PM");
  return h12 + ":00 " + ampm;
}

function reservedPeriodText(a, apptTime) {
  var unit = (apptTime && apptTime.unit) || "hours";
  var value = (apptTime && apptTime.value) || 2;
  var text = "";
  var base = formatLongDate(String(a.appointment_date));
  if (unit === "days") {
    if (value > 1) {
      var end = new Date(String(a.appointment_date) + "T12:00:00");
      end.setDate(end.getDate() + value - 1);
      var endStr = end.getFullYear() + "-" + pad2(end.getMonth() + 1) + "-" + pad2(end.getDate());
      text = base + " - " + formatLongDate(endStr) + " (" + value + " " + t("cal_reserved_days") + ")";
    } else {
      text = base + " (1 " + t("cal_reserved_days") + ")";
    }
  } else {
    var tv = to12(a.appointment_time);
    var startHour = parseInt(String(a.appointment_time).split(":")[0], 10);
    var startLabel = tv.hour + ":" + tv.minute + " " + tv.ampm;
    var endLabel = hourLabel12(startHour + value);
    text = base + ", " + startLabel + " - " + endLabel + " (" + value + " " + t("cal_reserved_hours") + ")";
  }
  var extra = (a.reserved_dates || []).slice().sort();
  if (extra.length) {
    var extraParts = extra.map(function (d) { return formatLongDate(d); });
    text += " + " + extra.length + " " + t("cal_reserved_extra") + ": " + extraParts.join(", ");
  }
  return text;
}

function buildApptRow(a, apptTime) {
  var row = document.createElement("div");
  row.className = "py-3 border-b border-slate-100";

  var info = document.createElement("div");
  info.className = "flex flex-wrap items-center justify-between gap-2 mb-3";
  var tv = to12(a.appointment_time);
  info.appendChild(tagsRow([
    { label: t("cal_name"), value: a.first_name + " " + a.last_name },
    { label: t("cal_time"), value: tv.hour + ":" + tv.minute + " " + tv.ampm },
    { label: t("cal_plate"), value: a.plate },
    { label: t("cal_number"), value: a.appointment_number },
    { label: t("cal_address"), value: a.address || t("cal_no_location") },
  ]));
  var badge = document.createElement("span");
  badge.className = "text-xs px-2 py-1 rounded-full " + statusBadgeClass(a.status);
  badge.textContent = statusLabel(a.status);
  info.appendChild(badge);
  row.appendChild(info);
  if (a.vehicle_id != null) {
    var viewLink = document.createElement("button");
    viewLink.type = "button";
    viewLink.className = "cal-vehicle-link text-blue-600 hover:text-blue-800 underline text-xs font-medium mb-3";
    viewLink.dataset.vehicleId = a.vehicle_id;
    viewLink.textContent = t("cal_view_details");
    row.appendChild(viewLink);
  }

  var viewLink = row.querySelector(".cal-vehicle-link");
  if (viewLink) {
    viewLink.addEventListener("click", function () {
      currentVehicleId = Number(viewLink.dataset.vehicleId);
      vehicleDetailBackView = "calendar";
      showView("vehicle-detail");
      renderVehicleDetail(currentVehicleId);
    });
  }

  var actions = document.createElement("div");
  actions.className = "flex flex-wrap items-center gap-2";

  if (a.status === "pending") {
    actions.appendChild(rowBtn("Confirmar", "btn-secondary", function () {
      window.API.mechanic.updateStatus(a.appointment_number, "confirmed").then(function () {
        flash("Cita confirmada.");
        refreshCalDay(String(a.appointment_date));
      }).catch(function (err) { flash(err.message, true); });
    }));
    actions.appendChild(rowBtn("Cancelar", "btn-secondary", function () {
      window.API.mechanic.updateStatus(a.appointment_number, "cancelled").then(function () {
        flash("Cita cancelada.");
        refreshCalDay(String(a.appointment_date));
      }).catch(function (err) { flash(err.message, true); });
    }));
  }
  if (a.status === "confirmed") {
    actions.appendChild(rowBtn("Completar", "btn-secondary", function () {
      window.API.mechanic.updateStatus(a.appointment_number, "completed").then(function () {
        flash("Cita completada.");
        refreshCalDay(String(a.appointment_date));
      }).catch(function (err) { flash(err.message, true); });
    }));
  }
  actions.appendChild(rowBtn(t("mechanic_delete"), "btn-danger", function () {
    showConfirm(t("mechanic_delete_confirm")).then(function (ok) {
      if (!ok) return;
      window.API.mechanic.remove(a.appointment_number).then(function () {
        flash("Cita eliminada.");
        refreshCalDay(String(a.appointment_date));
      }).catch(function (err) { flash(err.message, true); });
    });
  }));

  row.appendChild(actions);

  var reserved = document.createElement("div");
  reserved.className = "mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2";
  var reservedInfo = document.createElement("div");
  reservedInfo.className = "flex flex-wrap justify-center gap-2";
  reservedInfo.appendChild(buildInfoTag(t("cal_reserved"), reservedPeriodText(a, apptTime)));
  reserved.appendChild(reservedInfo);
  reserved.appendChild(rowBtn(t("cal_reserved_edit"), "btn-secondary", function () {
    openReservationPicker(a, function () {
      refreshCalDay(String(a.appointment_date));
    });
  }));
  row.appendChild(reserved);

  return row;
}

function openReservationPicker(appt, onSave) {
  Promise.all([
    window.API.mechanic.getSchedule(),
    window.API.mechanic.list(),
    window.API.mechanic.getDaysOff(),
    window.API.mechanic.getAppointmentTime().catch(function () { return { unit: "hours", value: 2 }; }),
  ]).then(function (r) {
    var working = ((r[0] && r[0].days) || []).map(function (d) { return d.day; });
    var blocked = buildBlockedSet(appt, r[1] || [], r[2] || [], r[3]);
    buildReservationPicker(appt, working, blocked, onSave);
  }).catch(function () {
    buildReservationPicker(appt, [], {}, onSave);
  });
}

function buildBlockedSet(appt, appts, daysOff, apptTime) {
  var blocked = {};
  (daysOff || []).forEach(function (d) { blocked[String(d.day_off).slice(0, 10)] = true; });
  var unit = (apptTime && apptTime.unit) || "hours";
  var value = (apptTime && apptTime.value) || 2;
  var baseDate = String(appt.appointment_date).slice(0, 10);

  function blockRange(o) {
    if (unit === "days") {
      var start = new Date(String(o.appointment_date) + "T12:00:00");
      for (var i = 0; i < value; i++) {
        var dd = new Date(start);
        dd.setDate(start.getDate() + i);
        blocked[dd.getFullYear() + "-" + pad2(dd.getMonth() + 1) + "-" + pad2(dd.getDate())] = true;
      }
    }
  }

  (appts || []).forEach(function (o) {
    if (o.status === "cancelled" || o.status === "completed") return;
    var isSelf = o.appointment_number === appt.appointment_number;
    if (isSelf) {
      blockRange(o);
      delete blocked[baseDate];
      (o.reserved_dates || []).forEach(function (d) { delete blocked[String(d).slice(0, 10)]; });
    } else {
      blocked[String(o.appointment_date).slice(0, 10)] = true;
      (o.reserved_dates || []).forEach(function (d) { blocked[String(d).slice(0, 10)] = true; });
      blockRange(o);
    }
  });
  return blocked;
}

function buildReservationPicker(appt, workingDowList, blockedSet, onSave) {
  var m = openModal(t("cal_reserved_edit"), "");
  var baseDate = String(appt.appointment_date).slice(0, 10);
  var year = parseInt(baseDate.slice(0, 4), 10);
  var month = parseInt(baseDate.slice(5, 7), 10) - 1;
  var workingSet = {};
  workingDowList.forEach(function (d) { workingSet[d] = true; });
  var selected = {};
  (appt.reserved_dates || []).forEach(function (d) { selected[d] = true; });
  var monthNames = monthNamesES();
  var dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function ds(y, mo, d) { return y + "-" + pad(mo + 1) + "-" + pad(d); }

  function render() {
    var head = document.createElement("div");
    head.className = "flex items-center justify-between mb-2";
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn-secondary !px-3 !py-1";
    prev.textContent = "←";
    var label = document.createElement("span");
    label.className = "font-semibold";
    label.textContent = monthNames[month] + " " + year;
    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn-secondary !px-3 !py-1";
    next.textContent = "→";
    head.appendChild(prev);
    head.appendChild(label);
    head.appendChild(next);
    m.body.innerHTML = "";
    m.body.appendChild(head);

    var sub = document.createElement("p");
    sub.className = "text-xs text-slate-500 mb-3";
    sub.textContent = t("cal_reserved_subtitle");
    m.body.appendChild(sub);

    var grid = document.createElement("div");
    grid.className = "grid grid-cols-7 gap-1 text-center";
    dayNames.forEach(function (d) {
      var c = document.createElement("div");
      c.className = "text-xs font-semibold text-slate-400 py-1";
      c.textContent = d;
      grid.appendChild(c);
    });

    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < firstDow; i++) grid.appendChild(document.createElement("div"));
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var dateStr = ds(year, month, d);
      var isBase = dateStr === baseDate;
      var working = !!workingSet[date.getDay()];
      var isSel = !!selected[dateStr];
      var blocked = !isSel && !!blockedSet[dateStr];
      var cell = document.createElement("button");
      cell.type = "button";
      cell.textContent = d;
      if (isBase) {
        cell.className = "p-2 rounded-lg text-sm font-semibold cursor-not-allowed border bg-brand-50 text-brand-700 border-brand-300";
        cell.disabled = true;
      } else if (isSel) {
        cell.className = "p-2 rounded-lg text-sm font-semibold transition border bg-brand-600 text-white border-brand-600";
      } else if (blocked) {
        cell.className = "p-2 rounded-lg text-sm text-slate-300 cursor-not-allowed border border-red-200 bg-red-50";
        cell.disabled = true;
      } else if (!working) {
        cell.className = "p-2 rounded-lg text-sm text-slate-300 cursor-not-allowed border border-slate-200 bg-slate-50";
        cell.disabled = true;
      } else {
        cell.className = "p-2 rounded-lg text-sm transition border bg-green-50 hover:bg-green-100 text-slate-800 border-green-200 cursor-pointer";
      }
      if (!isBase && !blocked && working) {
        cell.addEventListener("click", (function (dateStr) {
          return function () {
            if (selected[dateStr]) delete selected[dateStr];
            else selected[dateStr] = true;
            render();
          };
        })(dateStr));
      }
      grid.appendChild(cell);
    }
    m.body.appendChild(grid);

    var legend = document.createElement("div");
    legend.className = "mt-3 flex items-center gap-4 text-xs text-slate-500";
    var lg1 = document.createElement("span");
    lg1.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-brand-50 border border-brand-300 align-middle'></span> " + escapeHTML(t("cal_reserved_legend_base"));
    var lg2 = document.createElement("span");
    lg2.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-brand-600 align-middle'></span> " + escapeHTML(t("cal_reserved_legend_extra"));
    var lg3 = document.createElement("span");
    lg3.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-green-200 align-middle'></span> " + escapeHTML(t("cal_reserved_legend_work"));
    var lg4 = document.createElement("span");
    lg4.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-red-50 border border-red-200 align-middle'></span> " + escapeHTML(t("cal_reserved_legend_taken"));
    legend.appendChild(lg1);
    legend.appendChild(lg2);
    legend.appendChild(lg3);
    legend.appendChild(lg4);
    m.body.appendChild(legend);

    var footer = document.createElement("div");
    footer.className = "mt-4 flex items-center justify-between gap-2";
    var count = document.createElement("span");
    count.className = "text-sm text-slate-600 font-medium";
    var n = Object.keys(selected).length;
    count.textContent = n === 0 ? t("cal_reserved_no_extra") : n + " " + t("cal_reserved_extra");
    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-primary";
    saveBtn.textContent = t("cal_reserved_save");
    saveBtn.addEventListener("click", function () {
      saveBtn.disabled = true;
      window.API.mechanic.updateReservation(appt.appointment_number, {
        reserved_dates: Object.keys(selected).sort(),
      }).then(function () {
        closeModal();
        flash(t("cal_reserved_saved"));
        if (onSave) onSave();
      }).catch(function (err) {
        saveBtn.disabled = false;
        flash(err.message || t("error_generic"), true);
      });
    });
    footer.appendChild(count);
    footer.appendChild(saveBtn);
    m.body.appendChild(footer);

    prev.addEventListener("click", function () {
      month--;
      if (month < 0) { month = 11; year--; }
      render();
    });
    next.addEventListener("click", function () {
      month++;
      if (month > 11) { month = 0; year++; }
      render();
    });
  }
  render();
}

function rowBtn(label, cls, onClick) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = cls + " !px-4 !py-2 text-sm";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function smallBtn(label, cls, onClick) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = cls + " !px-2 !py-1 text-xs";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function makeUploadButton(label, onChange) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-secondary !px-4 !py-2 text-sm";
  btn.textContent = label;
  btn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      fileToDataURL(input, 3 * 1024 * 1024, onChange);
      input.remove();
    });
    input.click();
  });
  return btn;
}

function wireCalendarNav() {
  var prev = $("cal-prev");
  var next = $("cal-next");
  if (prev) {
    prev.addEventListener("click", function () {
      calState.month--;
      if (calState.month < 0) { calState.month = 11; calState.year--; }
      renderCal();
    });
  }
  if (next) {
    next.addEventListener("click", function () {
      calState.month++;
      if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCal();
    });
  }
}

/* ================================================================
   ANNOUNCEMENTS
   ================================================================ */

var announceEditingId = null;
var announceColor = "#fde68a";
var announceMode = "hours";

function setAnnounceColorSelection(selectedBtn) {
  document.querySelectorAll("#announce-colors button").forEach(function (b) {
    b.style.boxShadow = "";
    b.style.color = "";
    b.textContent = "";
    b.classList.remove("border-4");
    b.classList.add("border-2");
  });
  if (selectedBtn) {
    selectedBtn.style.boxShadow = "0 0 0 3px rgba(15, 23, 42, 0.9)";
    selectedBtn.style.color = "#0f172a";
    selectedBtn.textContent = "✓";
    selectedBtn.classList.add("border-4");
    selectedBtn.classList.remove("border-2");
  }
}

function findAnnounceColorBtn() {
  var found = null;
  document.querySelectorAll("#announce-colors button").forEach(function (b) {
    if (b.dataset.color === announceColor) found = b;
  });
  return found;
}

function initAnnouncementForm() {
  var colors = document.querySelectorAll("#announce-colors button");
  setAnnounceColorSelection(findAnnounceColorBtn());
  colors.forEach(function (btn) {
    btn.onclick = function () {
      announceColor = btn.dataset.color;
      setAnnounceColorSelection(btn);
    };
  });

  var modeHours = $("announce-mode-hours");
  var modePerm = $("announce-mode-permanent");
  if (modeHours && modePerm) {
    modeHours.onclick = function () {
      announceMode = "hours";
      modeHours.className = "px-5 py-2 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
      modePerm.className = "px-5 py-2 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
      var wrap = $("announce-hours-wrap");
      if (wrap) wrap.classList.remove("hidden");
    };
    modePerm.onclick = function () {
      announceMode = "permanent";
      modePerm.className = "px-5 py-2 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
      modeHours.className = "px-5 py-2 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
      var wrap = $("announce-hours-wrap");
      if (wrap) wrap.classList.add("hidden");
    };
  }

  var form = $("announce-form");
  if (form) {
    form.onsubmit = function (e) {
      e.preventDefault();
      var text = $("announce-text").value.trim();
      if (!text) {
        showErrorBox("announce-error", t("error_required"));
        return;
      }
      hideBox("announce-error");
      var payload = {
        text: text,
        bg_color: announceColor,
        is_permanent: announceMode === "permanent",
        duration_hours: announceMode === "permanent" ? 24 : parseInt($("announce-duration").value, 10) || 24,
      };
      var promise = announceEditingId
        ? window.API.mechanic.updateAnnouncement(announceEditingId, payload)
        : window.API.mechanic.createAnnouncement(payload);
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      promise.then(function () {
        btn.disabled = false;
        resetAnnounceForm();
        loadAnnouncements();
        flash("Anuncio guardado.");
      }).catch(function (err) {
        btn.disabled = false;
        showErrorBox("announce-error", err.message || t("error_generic"));
      });
    };
  }

  var cancelEdit = $("announce-cancel-edit");
  if (cancelEdit) {
    cancelEdit.onclick = function () {
      resetAnnounceForm();
    };
  }
}

function resetAnnounceForm() {
  announceEditingId = null;
  var text = $("announce-text");
  if (text) text.value = "";
  var duration = $("announce-duration");
  if (duration) duration.value = 24;
  var cancelEdit = $("announce-cancel-edit");
  if (cancelEdit) cancelEdit.classList.add("hidden");
  var saveBtn = $("announce-save-btn");
  if (saveBtn) saveBtn.textContent = t("announce_save");
  var heading = document.querySelector("#announce-form h2");
  if (heading) heading.textContent = t("announce_new_title");
  hideBox("announce-error");
}

function remainingAnnounceHours(a) {
  if (a.is_permanent) return null;
  var dur = a.duration_hours || 0;
  var created = a.created_at ? new Date(a.created_at).getTime() : Date.now();
  var elapsed = (Date.now() - created) / 3600000;
  return Math.max(0, Math.ceil(dur - elapsed));
}

function loadAnnouncements() {
  var list = $("announce-list");
  var empty = $("announce-empty");
  var error = $("announce-error");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  hideBox("announce-error");
  window.API.mechanic.listAnnouncements().then(function (announcements) {
    if (announcements.length === 0) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    announcements.forEach(function (a, idx) {
      if (idx > 0) {
        var sep = document.createElement("div");
        sep.className = "flex items-center gap-3 my-2";
        sep.innerHTML = "<div class='flex-1 border-t-2 border-slate-200'></div><span class='text-[10px] uppercase tracking-wide text-slate-400 font-semibold shrink-0'>" + escapeHTML(t("announce_divider")) + "</span><div class='flex-1 border-t-2 border-slate-200'></div>";
        list.appendChild(sep);
      }
      var row = document.createElement("div");
      row.className = "rounded-lg border border-slate-200 p-4 shadow-sm";
      row.style.backgroundColor = a.bg_color || "#fff";
      var remain = remainingAnnounceHours(a);
      var isActive = a.is_active && (a.is_permanent || remain > 0);
      var remainingLabel = a.is_permanent ? t("announce_permanent") : (remain + "h");
      var header = document.createElement("div");
      header.className = "flex items-start justify-between gap-2";
      var info = document.createElement("div");
      info.className = "text-sm space-y-1";
      info.appendChild(tagsRow([
        { label: t("announce_state"), value: isActive ? t("announce_active") : t("announce_inactive") },
        { label: t("announce_remaining"), value: remainingLabel },
      ]));
      var textP = document.createElement("p");
      textP.className = "font-medium text-slate-800 mt-1";
      textP.textContent = a.text;
      info.appendChild(textP);
      header.appendChild(info);
      var actions = document.createElement("div");
      actions.className = "flex gap-2 shrink-0";
      var editBtn = smallBtn(t("announce_edit"), "btn-secondary", function () {
        editAnnouncement(a);
      });
      var delBtn = smallBtn(t("announce_delete"), "btn-danger", function () {
        showConfirm(t("delete_confirm_announce")).then(function (ok) {
          if (!ok) return;
          window.API.mechanic.deleteAnnouncement(a.id).then(function () {
            loadAnnouncements();
            flash("Anuncio eliminado.");
          }).catch(function (err) { flash(err.message, true); });
        });
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      header.appendChild(actions);
      row.appendChild(header);
      list.appendChild(row);
    });
  }).catch(function (err) {
    showErrorBox("announce-error", err.message || t("error_generic"));
  });
}

function editAnnouncement(a) {
  announceEditingId = a.id;
  var text = $("announce-text");
  if (text) text.value = a.text;
  var duration = $("announce-duration");
  if (duration) duration.value = a.duration_hours;
  announceColor = a.bg_color || "#fde68a";
  setAnnounceColorSelection(findAnnounceColorBtn());
  if (a.is_permanent) {
    announceMode = "permanent";
    var mp = $("announce-mode-permanent");
    var mh = $("announce-mode-hours");
    if (mp) mp.className = "px-5 py-2 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
    if (mh) mh.className = "px-5 py-2 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
    var wrap = $("announce-hours-wrap");
    if (wrap) wrap.classList.add("hidden");
  } else {
    announceMode = "hours";
    var mh2 = $("announce-mode-hours");
    var mp2 = $("announce-mode-permanent");
    if (mh2) mh2.className = "px-5 py-2 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
    if (mp2) mp2.className = "px-5 py-2 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
    var wrap2 = $("announce-hours-wrap");
    if (wrap2) wrap2.classList.remove("hidden");
  }
  var cancelEdit = $("announce-cancel-edit");
  if (cancelEdit) cancelEdit.classList.remove("hidden");
  var saveBtn = $("announce-save-btn");
  if (saveBtn) saveBtn.textContent = t("announce_update");
  var heading = document.querySelector("#announce-form h2");
  if (heading) heading.textContent = t("announce_update");
  $("announce-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ================================================================
   CLIENTS + EMAIL
   ================================================================ */

var clientsData = [];
var clientsSearchTimer = null;

function loadClients() {
  var list = $("clients-list");
  if (!list) return;
  hideBox("clients-error");
  window.API.mechanic.listClients().then(function (clients) {
    clientsData = clients || [];
    renderClients();
  }).catch(function (err) {
    showErrorBox("clients-error", err.message || t("error_generic"));
  });
}

function renderClients() {
  var list = $("clients-list");
  var empty = $("clients-empty");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  var q = $("clients-search") ? $("clients-search").value.trim().toLowerCase() : "";
  if (!q) {
    if (empty) {
      empty.textContent = t("clients_hint");
      empty.classList.remove("hidden");
    }
    return;
  }
  var filtered = clientsData.filter(function (c) {
    var hay = (c.first_name + " " + c.last_name + " " + (c.email || "") + " " + (c.phone || "") + " " + (c.country_code || "")).toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  if (filtered.length === 0) {
    if (empty) {
      empty.textContent = t("clients_no_results");
      empty.classList.remove("hidden");
    }
    return;
  }
  filtered.forEach(function (c) {
    var row = document.createElement("div");
    row.className = "rounded-xl border border-slate-200 p-4 bg-white flex flex-wrap items-center justify-between gap-3";
    var info = document.createElement("div");
    var name = document.createElement("p");
    name.className = "font-medium text-slate-800";
    name.textContent = c.first_name + " " + c.last_name;
    info.appendChild(name);
    info.appendChild(tagsRow([
      { label: t("client_email"), value: c.email || "—" },
      { label: t("label_phone"), value: (c.country_code || "") + " " + (c.phone || "") },
    ]));
    row.appendChild(info);
    var right = document.createElement("div");
    right.className = "flex items-center gap-2 flex-wrap";
    right.appendChild(smallBtn(t("clients_email"), "btn-secondary", function () {
      openEmailModal(c.email);
    }));
    if (currentUser && currentUser.role === "admin") {
      right.appendChild(smallBtn(t("clients_delete"), "btn-danger", function () {
        showConfirm(t("clients_delete_confirm") + " '" + escapeHTML(c.first_name + " " + c.last_name) + "'?").then(function (ok) {
          if (!ok) return;
          window.API.mechanic.deleteClient(c.id).then(function () {
            loadClients();
            flash(t("clients_deleted"));
          }).catch(function (err) { flash(err.message, true); });
        });
      }));
    }
    row.appendChild(right);
    list.appendChild(row);
  });
}

function openEmailModal(toEmail) {
  var m = openModal(t("clients_email"), "");
  var form = document.createElement("form");
  form.className = "space-y-4";
  form.innerHTML =
    '<div><label class="field-label">Para</label><input id="email-to" type="email" class="field-input" value="' + escapeHTML(toEmail || "") + '"></div>' +
    '<div><label class="field-label">' + escapeHTML(t("email_subject")) + '</label><input id="email-subject" type="text" class="field-input" required></div>' +
    '<div><label class="field-label">' + escapeHTML(t("email_body")) + '</label><textarea id="email-body" class="field-input" rows="5" required></textarea></div>' +
    '<div id="email-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("email_send")) + "</button>";
  m.body.appendChild(form);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("email-error");
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    window.API.mechanic.sendEmail({
      to_email: $("email-to").value.trim(),
      subject: $("email-subject").value.trim(),
      body: $("email-body").value,
    }).then(function () {
      btn.disabled = false;
      closeModal();
      flash(t("email_sent"));
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("email-error", err.message || t("error_generic"));
    });
  });
}

/* ================================================================
   USERS (admin)
   ================================================================ */

function loadUsers() {
  var list = $("users-list");
  var empty = $("users-empty");
  var error = $("users-error");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  hideBox("users-error");
  window.API.mechanic.listUsers().then(function (users) {
    if (users.length === 0) {
      if (empty) empty.classList.remove("hidden");
      return;
    }
    users.forEach(function (u) {
      var row = document.createElement("div");
      row.className = "rounded-xl border border-slate-200 p-4 bg-white flex flex-wrap items-center justify-between gap-3";
      var info = document.createElement("div");
      var roleLabel = u.role === "admin" ? t("users_role_admin") : t("users_role_mechanic");
      var name = document.createElement("p");
      name.className = "font-medium text-slate-800";
      name.textContent = u.name;
      info.appendChild(name);
      info.appendChild(tagsRow([
        { label: t("client_email"), value: u.email },
        { label: t("users_role"), value: roleLabel },
      ]));
      row.appendChild(info);
      var badge = document.createElement("span");
      badge.className = "text-xs px-2 py-1 rounded-full " + (u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700");
      badge.textContent = u.is_active ? t("announce_active") : t("users_inactive");
      var right = document.createElement("div");
      right.className = "flex items-center gap-2 flex-wrap";
      right.appendChild(badge);
      if (!(currentUser && u.id === currentUser.id)) {
        right.appendChild(smallBtn(t("users_edit"), "btn-secondary", function () { openUserModal(u); }));
        right.appendChild(smallBtn(t("users_reset"), "btn-secondary", function () { openResetPasswordModal(u); }));
        right.appendChild(smallBtn(t("users_delete"), "btn-danger", function () {
          showConfirm(t("users_delete_confirm") + " '" + u.name + "'?").then(function (ok) {
            if (!ok) return;
            window.API.mechanic.deleteUser(u.id).then(function () {
              loadUsers();
              flash("Usuario eliminado.");
            }).catch(function (err) { flash(err.message, true); });
          });
        }));
      }
      row.appendChild(right);
      list.appendChild(row);
    });
  }).catch(function (err) {
    showErrorBox("users-error", err.message || t("error_generic"));
  });
}

function openUserModal(u) {
  var editing = !!u;
  var m = openModal(editing ? t("users_edit") : t("users_add"), "");
  var form = document.createElement("form");
  form.className = "space-y-4";
  form.innerHTML =
    '<div><label class="field-label">' + escapeHTML(t("users_name")) + '</label><input id="u-name" type="text" class="field-input" value="' + escapeHTML(u ? u.name : "") + '" required></div>' +
    '<div><label class="field-label">Email</label><input id="u-email" type="email" class="field-input" value="' + escapeHTML(u ? u.email : "") + '" required' + (editing ? " disabled" : "") + "></div>" +
    (editing ? "" : '<div><label class="field-label">' + escapeHTML(t("users_password")) + '</label><input id="u-password" type="password" class="field-input" minlength="8" required></div>') +
    '<div><label class="field-label">' + escapeHTML(t("users_role")) + '</label><select id="u-role" class="field-input"><option value="mechanic">' + escapeHTML(t("users_role_mechanic")) + '</option><option value="admin">' + escapeHTML(t("users_role_admin")) + "</option></select></div>" +
    (editing ? '<div class="flex items-center gap-2"><input id="u-active" type="checkbox" class="w-4 h-4"' + (u.is_active ? " checked" : "") + '><label for="u-active" class="text-sm text-slate-700">' + escapeHTML(t("announce_active")) + "</label></div>" : "") +
    '<div id="u-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("vehicles_save")) + "</button>";
  m.body.appendChild(form);
  var roleSel = $("u-role");
  if (editing && u.role === "admin") roleSel.value = "admin";

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("u-error");
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    var payload = {
      name: $("u-name").value.trim(),
      role: $("u-role").value,
    };
    var promise;
    if (editing) {
      payload.is_active = $("u-active") ? $("u-active").checked : true;
      promise = window.API.mechanic.updateUser(u.id, payload);
    } else {
      payload.email = $("u-email").value.trim();
      payload.password = $("u-password").value;
      promise = window.API.mechanic.createUser(payload);
    }
    promise.then(function () {
      btn.disabled = false;
      closeModal();
      loadUsers();
      flash("Usuario guardado.");
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("u-error", err.message || t("error_generic"));
    });
  });
}

function openResetPasswordModal(u) {
  var m = openModal(t("users_reset") + " — " + u.name, "");
  var form = document.createElement("form");
  form.className = "space-y-4";
  form.innerHTML =
    '<div><label class="field-label">' + escapeHTML(t("users_new_password")) + '</label><input id="rp-new" type="password" class="field-input" minlength="8" required></div>' +
    '<div id="rp-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("users_reset")) + "</button>";
  m.body.appendChild(form);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("rp-error");
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    window.API.mechanic.resetPassword(u.id, { new_password: $("rp-new").value }).then(function () {
      btn.disabled = false;
      closeModal();
      flash("Contraseña restablecida.");
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("rp-error", err.message || t("error_generic"));
    });
  });
}

/* ================================================================
   VEHICLES
   ================================================================ */

var vehiclesSearchTimer = null;
var currentVehicleId = null;
var vehicleDetailBackView = "vehicles";

function ownersLabel(owners) {
  if (!owners || !owners.length) return "";
  return owners.map(function (o) { return o.first_name + " " + o.last_name; }).join(", ");
}

function renderVehiclesList(q) {
  var list = $("vehicles-list");
  var empty = $("vehicles-empty");
  var error = $("vehicles-error");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  hideBox("vehicles-error");
  if (q === undefined) {
    q = $("vehicles-search") ? $("vehicles-search").value.trim() : "";
  }
  if (!q) {
    if (empty) {
      empty.textContent = t("vehicles_hint");
      empty.classList.remove("hidden");
    }
    return;
  }
  window.API.mechanic.listVehicles(q).then(function (vehicles) {
    if (vehicles.length === 0) {
      if (empty) {
        empty.textContent = t("vehicles_no_results");
        empty.classList.remove("hidden");
      }
      return;
    }
    vehicles.forEach(function (v) {
      var row = document.createElement("div");
      row.className = "rounded-xl border border-slate-200 p-4 bg-white cursor-pointer hover:shadow-sm flex items-center justify-between gap-3";
      var left = document.createElement("div");
      left.className = "flex items-center gap-3 min-w-0";
      if (v.front_photo) {
        var thumb = document.createElement("img");
        thumb.src = v.front_photo;
        thumb.className = "w-12 h-12 rounded-lg object-cover border border-slate-200";
        left.appendChild(thumb);
      }
      var info = document.createElement("div");
      info.className = "min-w-0";
      var plateEl = document.createElement("p");
      plateEl.className = "font-medium text-slate-800";
      plateEl.textContent = v.plate;
      info.appendChild(plateEl);
      var makeModel = [v.make, v.model].filter(Boolean).join(" ") || "—";
      if (v.year) makeModel += " (" + v.year + ")";
      var tagItems = [
        { label: t("vehicles_model"), value: makeModel },
        { label: t("vehicles_services"), value: v.services_count },
      ];
      if (v.owners && v.owners.length) tagItems.push({ label: t("vehicles_owner"), value: ownersLabel(v.owners) });
      info.appendChild(tagsRow(tagItems));
      left.appendChild(info);
      row.appendChild(left);
      var arrow = document.createElement("span");
      arrow.className = "text-slate-400";
      arrow.textContent = "→";
      row.appendChild(arrow);
      row.addEventListener("click", function () {
        currentVehicleId = v.id;
        vehicleDetailBackView = "vehicles";
        showView("vehicle-detail");
        renderVehicleDetail(v.id);
      });
      list.appendChild(row);
    });
  }).catch(function (err) {
    showErrorBox("vehicles-error", err.message || t("error_generic"));
  });
}

function renderVehicleDetail(vehicleId) {
  var body = $("vehicle-detail-body");
  var error = $("vehicle-detail-error");
  if (!body) return;
  body.innerHTML = "";
  hideBox("vehicle-detail-error");
  window.API.mechanic.getVehicle(vehicleId).then(function (v) {
    var title = $("vehicle-detail-title");
    if (title) title.textContent = t("vehicles_detail_title");

    var top = document.createElement("div");
    top.className = "overflow-hidden rounded-xl border border-slate-200 bg-white";
    var photoBanner = document.createElement("div");
    photoBanner.className = "mx-auto mt-3 aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-slate-200 bg-slate-100";
    var img = document.createElement("img");
    img.src = v.front_photo || "/icons/car.svg";
    img.alt = v.plate;
    img.className = "h-full w-full cursor-pointer " + (v.front_photo ? "object-cover" : "object-contain p-12");
    img.addEventListener("click", function () { if (v.front_photo) viewPhoto(v.front_photo); });
    photoBanner.appendChild(img);
    top.appendChild(photoBanner);

    var info = document.createElement("div");
    info.className = "grid grid-cols-1 gap-3 p-4 sm:grid-cols-2";
    var items = [
      { label: t("vehicles_plate"), value: v.plate },
      { label: t("vehicles_make"), value: v.make || "—" },
      { label: t("vehicles_model"), value: v.model || "—" },
      { label: t("vehicles_year"), value: v.year != null ? v.year : "—" },
      { label: t("vehicles_color"), value: v.color || "—" },
    ];
    if (v.owners && v.owners.length) {
      items.push({ label: t("vehicles_owner"), value: ownersLabel(v.owners) });
    }
    items.forEach(function (it) {
      var field = document.createElement("div");
      field.className = "rounded-lg bg-slate-50 px-3 py-2.5";
      field.innerHTML = "<div class='text-xs font-semibold uppercase tracking-wide text-slate-500'>" + escapeHTML(it.label) + "</div><div class='mt-1 text-sm font-semibold text-slate-900 break-words'>" + escapeHTML(it.value) + "</div>";
      if (it.label === t("vehicles_owner")) field.className += " sm:col-span-2";
      info.appendChild(field);
    });
    top.appendChild(info);
    body.appendChild(top);

    var panel = document.createElement("div");
    panel.className = "mt-6";
    body.appendChild(panel);
    renderHistoryPanel(panel, v);
  }).catch(function (err) {
    showErrorBox("vehicle-detail-error", err.message || t("error_generic"));
  });
}

function renderHistoryPanel(panel, vehicle) {
  panel.innerHTML = "";
  var head = document.createElement("div");
  head.className = "flex flex-wrap items-center justify-between gap-3 mb-1";
  var h = document.createElement("h3");
  h.className = "text-lg font-semibold";
  h.textContent = t("services_title");
  head.appendChild(h);
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-primary";
  addBtn.textContent = t("services_add");
  addBtn.addEventListener("click", function () {
    openServiceModal(vehicle, null, function () {
      renderVehicleDetail(vehicle.id);
      flash(t("services_created"));
    });
  });
  head.appendChild(addBtn);
  panel.appendChild(head);

  var records = vehicle.service_history || [];
  if (records.length === 0) {
    var p = document.createElement("p");
    p.className = "text-slate-500 text-sm mt-3";
    p.textContent = t("services_empty");
    panel.appendChild(p);
    return;
  }
  records.forEach(function (r) {
    var item = document.createElement("div");
    item.className = "rounded-xl border border-slate-200 p-4 bg-white cursor-pointer hover:shadow-sm flex items-center gap-3 mt-3";
    var info = document.createElement("div");
    info.className = "min-w-0 flex-1";
    var title = document.createElement("p");
    title.className = "font-medium text-slate-800";
    title.textContent = r.title || "—";
    info.appendChild(title);
    var tagItems = [
      { label: t("field_date"), value: formatLongDate(String(r.created_at || "").slice(0, 10)) },
    ];
    if (r.mileage != null && r.mileage !== "") {
      tagItems.push({ label: t("services_mileage"), value: r.mileage + " " + (r.mileage_unit || "km") });
    }
    info.appendChild(tagsRow(tagItems));
    item.appendChild(r.mileage_photo
      ? thumbHTML(r.mileage_photo)
      : (function () { var sp = document.createElement("span"); sp.className = "w-12 h-12 shrink-0 rounded-lg border border-slate-200 bg-slate-50"; return sp; })());
    item.appendChild(info);
    var total = document.createElement("span");
    total.className = "text-sm font-semibold text-slate-700 whitespace-nowrap";
    var sym = (r.price_rows && r.price_rows.length) ? currencySymbol(r.price_rows[0].currency || "CRC") : "₡";
    total.textContent = t("services_total") + ": " + sym + " " + formatMoney(r.total);
    item.appendChild(total);
    item.addEventListener("click", function () {
      openServiceDetail(r.id, vehicle);
    });
    panel.appendChild(item);
  });
}

function thumbHTML(src) {
  var span = document.createElement("span");
  span.className = "w-12 h-12 shrink-0";
  span.innerHTML = "<img src='" + escapeHTML(src) + "' class='w-12 h-12 rounded-lg object-cover border border-slate-200'>";
  return span;
}

function formatMoney(n) {
  if (n == null || isNaN(Number(n))) return "0";
  var s = Number(n).toFixed(2).replace(/\.?0+$/, "");
  var parts = s.split(".");
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return intPart + (parts.length > 1 ? "." + parts[1] : "");
}

function currencySymbol(cur) {
  return cur === "USD" ? "$" : "₡";
}

function sanitizeAmount(v) {
  var s = String(v == null ? "" : v).replace(/[^\d.]/g, "");
  var parts = s.split(".");
  var intPart = (parts[0] || "").replace(/^0+(?=\d)/, "");
  var decPart = parts.length > 1 ? "." + parts.slice(1).join("").slice(0, 2) : "";
  return intPart + decPart;
}

function formatThousands(v) {
  var s = sanitizeAmount(v);
  var parts = s.split(".");
  var intPart = parts[0] ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
  return intPart + (parts.length > 1 ? "." + parts[1] : "");
}

function openVehicleModal(vehicle) {
  var editing = !!vehicle;
  var m = openModal(editing ? t("vehicles_edit_title") : t("vehicles_add_title"), "");
  var form = document.createElement("form");
  form.className = "space-y-4";
  var photoHtml = "";
  if (vehicle && vehicle.front_photo) {
    photoHtml = "<div id='v-photo-preview' class='w-32 h-32 rounded-lg overflow-hidden border border-slate-200'><img src='" + vehicle.front_photo + "' class='w-full h-full object-cover'></div>";
  }
  form.innerHTML =
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_plate")) + '</label><input id="v-plate" type="text" class="field-input uppercase" value="' + escapeHTML(vehicle ? vehicle.plate : "") + '" required></div>' +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_make")) + '</label><input id="v-make" type="text" class="field-input" value="' + escapeHTML(vehicle ? vehicle.make : "") + '"></div>' +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_model")) + '</label><input id="v-model" type="text" class="field-input" value="' + escapeHTML(vehicle ? vehicle.model : "") + '"></div>' +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_year")) + '</label><input id="v-year" type="number" min="1900" max="2200" class="field-input" value="' + (vehicle && vehicle.year ? vehicle.year : "") + '"></div>' +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_color")) + '</label><input id="v-color" type="text" class="field-input" value="' + escapeHTML(vehicle ? vehicle.color : "") + '"></div>' +
    "</div>" +
    '<div><label class="field-label">' + escapeHTML(t("vehicles_front_photo")) + "</label>" +
    '<div id="v-photo-zone">' + photoHtml + "</div></div>" +
    '<div id="v-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("vehicles_save")) + "</button>";
  m.body.appendChild(form);

  var newPhoto = null;
  var photoZone = $("v-photo-zone");
  if (photoZone) {
    photoZone.appendChild(makeUploadButton(t("vehicles_choose_photo"), function (dataUrl) {
      newPhoto = dataUrl;
      var prev = $("v-photo-preview");
      if (prev) prev.remove();
      var wrap = document.createElement("div");
      wrap.id = "v-photo-preview";
      wrap.className = "w-32 h-32 rounded-lg overflow-hidden border border-slate-200";
      wrap.innerHTML = "<img src='" + dataUrl + "' class='w-full h-full object-cover'>";
      photoZone.insertBefore(wrap, photoZone.firstChild);
    }));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("v-error");
    var payload = {
      plate: $("v-plate").value.trim(),
      make: $("v-make").value.trim(),
      model: $("v-model").value.trim(),
      year: $("v-year").value ? parseInt($("v-year").value, 10) : null,
      color: $("v-color").value.trim(),
      front_photo: newPhoto || (vehicle ? vehicle.front_photo || "" : ""),
    };
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    var promise = editing
      ? window.API.mechanic.updateVehicle(vehicle.id, payload)
      : window.API.mechanic.createVehicle(payload);
    promise.then(function (created) {
      btn.disabled = false;
      closeModal();
      if (currentVehicleId) {
        currentVehicleId = created ? created.id : vehicle.id;
        showView("vehicle-detail");
        renderVehicleDetail(currentVehicleId);
      } else {
        showView("vehicles");
        renderVehiclesList();
      }
      flash(editing ? t("vehicles_updated") : t("vehicles_created"));
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("v-error", err.message || t("error_generic"));
    });
  });
}

/* ================================================================
   SERVICE HISTORY (Historial de Servicios)
   ================================================================ */

function openServiceModal(vehicle, record, onSaved) {
  var editing = !!record;
  var m = openModal(editing ? t("services_edit_title") : t("services_add_title"), "");
  buildServiceForm(m.body, vehicle, record, function () {
    closeModal();
    if (onSaved) onSaved();
  }, closeModal);
}

function openServiceDetail(recordId, vehicle) {
  var m = openModal("", "");
  var box = m.overlay.querySelector(".max-w-xl");
  if (box) {
    box.classList.remove("max-w-xl");
    box.classList.add("max-w-3xl");
  }
  var state = { recordId: recordId, vehicle: vehicle || null, record: null, editing: false };
  var header = document.createElement("div");
  header.id = "service-detail-header";
  m.body.appendChild(header);

  function load() {
    window.API.mechanic.getServiceRecord(recordId).then(function (r) {
      state.record = r;
      render();
    }).catch(function (err) {
      flash(err.message, true);
      closeModal();
    });
  }

  function render() {
    header.innerHTML = "";
    if (!state.record) return;
    if (state.editing) {
      buildServiceForm(header, state.vehicle, state.record, function () {
        state.editing = false;
        load();
        flash(t("services_updated"));
      }, function () {
        state.editing = false;
        render();
      });
      return;
    }
    var r = state.record;
    var title = document.createElement("h3");
    title.className = "text-lg font-bold text-slate-800 flex items-center gap-2 flex-wrap";
    title.textContent = r.title || "—";
    header.appendChild(title);
    var meta = document.createElement("div");
    meta.className = "mt-1";
    var tagItems = [
      { label: t("visits_date"), value: formatLongDate(String(r.created_at || "").slice(0, 10)) },
    ];
    if (r.mileage != null && r.mileage !== "") {
      tagItems.push({ label: t("services_mileage"), value: String(r.mileage) + " " + (r.mileage_unit || "km") });
    }
    meta.appendChild(tagsRow(tagItems));
    header.appendChild(meta);

    if (r.diagnosis) header.appendChild(sectionText(t("services_diagnosis"), r.diagnosis));

    if (r.mileage_photo) {
      var ph = document.createElement("div");
      ph.className = "mt-3";
      var pl = document.createElement("p");
      pl.className = "text-xs font-medium text-slate-500 mb-1";
      pl.textContent = t("services_mileage_photo");
      ph.appendChild(pl);
      ph.appendChild(photoThumb(r.mileage_photo, function () { viewPhoto(r.mileage_photo); }));
      header.appendChild(ph);
    }

    if (r.other_photos && r.other_photos.length) {
      var op = document.createElement("div");
      op.className = "mt-3";
      var opl = document.createElement("p");
      opl.className = "text-xs font-medium text-slate-500 mb-1";
      opl.textContent = t("services_other_photos");
      op.appendChild(opl);
      var og = document.createElement("div");
      og.className = "flex flex-wrap gap-2";
      r.other_photos.forEach(function (src) {
        og.appendChild(photoThumb(src, function () { viewPhoto(src); }));
      });
      op.appendChild(og);
      header.appendChild(op);
    }

    if (r.price_rows && r.price_rows.length) {
      header.appendChild(renderPricesTable(r.price_rows));
    }

    var actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100";
    actions.appendChild(smallBtn(t("services_edit_title"), "btn-secondary", function () {
      state.editing = true;
      render();
    }));
    actions.appendChild(smallBtn(t("services_delete"), "btn-danger", function () {
      showConfirm(t("services_delete_confirm")).then(function (ok) {
        if (!ok) return;
        window.API.mechanic.deleteServiceRecord(r.id).then(function () {
          closeModal();
          if (currentVehicleId) renderVehicleDetail(currentVehicleId);
          flash(t("services_deleted"));
        }).catch(function (err) { flash(err.message, true); });
      });
    }));
    header.appendChild(actions);
  }
  load();
}

function renderPricesTable(rows) {
  var wrap = document.createElement("div");
  wrap.className = "mt-4 overflow-hidden rounded-xl border border-slate-200";
  var table = document.createElement("table");
  table.className = "w-full text-sm";
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  hr.className = "bg-slate-50 text-slate-500";
  hr.innerHTML =
    "<th class='text-left px-3 py-2 font-semibold'>" + escapeHTML(t("services_price_type")) + "</th>" +
    "<th class='text-left px-3 py-2 font-semibold'>" + escapeHTML(t("services_price_description")) + "</th>" +
    "<th class='text-right px-3 py-2 font-semibold'>" + escapeHTML(t("services_price_amount")) + "</th>";
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = document.createElement("tbody");
  var laborTotal = 0;
  var partsTotal = 0;
  rows.forEach(function (row) {
    var tr = document.createElement("tr");
    tr.className = "border-t border-slate-100";
    var amt = row.amount != null && row.amount !== "" ? Number(row.amount) : 0;
    if (row.kind === "parts") partsTotal += amt;
    else laborTotal += amt;
    var kindLabel = row.kind === "parts" ? t("services_price_parts") : t("services_price_labor");
    var kindCls = row.kind === "parts" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800";
    tr.innerHTML =
      "<td class='px-3 py-2'><span class='text-xs font-semibold px-2 py-0.5 rounded-full " + kindCls + "'>" + escapeHTML(kindLabel) + "</span></td>" +
      "<td class='px-3 py-2 text-slate-700'>" + escapeHTML(row.description || "—") + "</td>" +
      "<td class='px-3 py-2 text-right font-medium text-slate-800'>" + escapeHTML(currencySymbol(row.currency || "CRC") + " " + formatMoney(amt)) + "</td>";
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  var foot = document.createElement("div");
  foot.className = "flex flex-wrap items-center justify-end gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200";
  var sym = rows.length ? currencySymbol(rows[0].currency || "CRC") : "₡";
  foot.appendChild(buildInfoTag(t("services_total_labor"), sym + " " + formatMoney(laborTotal)));
  foot.appendChild(buildInfoTag(t("services_total_parts"), sym + " " + formatMoney(partsTotal)));
  foot.appendChild(buildInfoTag(t("services_total"), sym + " " + formatMoney(laborTotal + partsTotal)));
  wrap.appendChild(foot);
  return wrap;
}

function buildServiceForm(container, vehicle, record, onSaved, onCancel) {
  var editing = !!record;
  var form = document.createElement("form");
  form.className = "space-y-4";
  container.innerHTML = "";
  container.appendChild(form);

  var state = {
    title: record ? record.title || "" : "",
    diagnosis: record ? record.diagnosis || "" : "",
    mileage: record && record.mileage != null && record.mileage !== "" ? String(record.mileage) : "",
    mileage_unit: record && record.mileage_unit ? record.mileage_unit : "km",
    mileage_photo: record ? record.mileage_photo || "" : "",
    other_photos: record ? (record.other_photos || []) : [],
    rows: record && record.price_rows ? record.price_rows.map(function (r) {
      return { kind: r.kind || "labor", currency: r.currency || "CRC", description: r.description || "", amount: r.amount != null && r.amount !== "" ? String(r.amount) : "" };
    }) : [],
  };

  function fieldLabel(text, required) {
    var label = document.createElement("label");
    label.className = "field-label" + (required ? " required" : "");
    label.textContent = text;
    return label;
  }

  var titleField = document.createElement("div");
  titleField.appendChild(fieldLabel(t("services_title_field"), true));
  var titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "field-input";
  titleInput.placeholder = t("services_title_field");
  titleInput.value = state.title;
  titleField.appendChild(titleInput);
  form.appendChild(titleField);

  var diagField = document.createElement("div");
  diagField.appendChild(fieldLabel(t("services_diagnosis")));
  var diagTa = document.createElement("textarea");
  diagTa.className = "field-input";
  diagTa.rows = 3;
  diagTa.value = state.diagnosis;
  diagField.appendChild(diagTa);
  form.appendChild(diagField);

  var mileWrap = document.createElement("div");
  mileWrap.appendChild(fieldLabel(t("services_mileage")));
  var mileGrid = document.createElement("div");
  mileGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";
  var mileBox = document.createElement("div");
  var mileInput = document.createElement("input");
  mileInput.id = "svc-mileage";
  mileInput.type = "number";
  mileInput.min = "0";
  mileInput.step = "1";
  mileInput.className = "field-input";
  mileInput.value = state.mileage;
  mileInput.addEventListener("input", function () { state.mileage = mileInput.value; });
  mileBox.appendChild(mileInput);
  mileGrid.appendChild(mileBox);

  var unitBox = document.createElement("div");
  unitBox.className = "inline-flex rounded-lg bg-slate-100 p-1 w-full";
  var unitKm = document.createElement("button");
  unitKm.type = "button";
  unitKm.textContent = t("visits_mileage_unit_km");
  var unitMi = document.createElement("button");
  unitMi.type = "button";
  unitMi.textContent = t("visits_mileage_unit_mi");
  unitBox.appendChild(unitKm);
  unitBox.appendChild(unitMi);
  function setMileageUnit(u) {
    state.mileage_unit = u;
    var active = "flex-1 px-4 py-2 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
    var idle = "flex-1 px-4 py-2 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
    unitKm.className = u === "km" ? active : idle;
    unitMi.className = u === "mi" ? active : idle;
  }
  unitKm.addEventListener("click", function () { setMileageUnit("km"); });
  unitMi.addEventListener("click", function () { setMileageUnit("mi"); });
  setMileageUnit(state.mileage_unit);
  mileGrid.appendChild(unitBox);
  mileWrap.appendChild(mileGrid);

  var photoBox = document.createElement("div");
  photoBox.className = "mt-2 flex flex-wrap items-center gap-2";
  var photoPreview = document.createElement("div");
  photoPreview.className = "flex flex-wrap gap-2";
  function renderPhoto() {
    photoPreview.innerHTML = "";
    if (state.mileage_photo) {
      var wrap = document.createElement("div");
      wrap.className = "relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200";
      var img = document.createElement("img");
      img.src = state.mileage_photo;
      img.className = "w-full h-full object-cover cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(state.mileage_photo); });
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full leading-none";
      rm.textContent = "×";
      rm.addEventListener("click", function () { state.mileage_photo = ""; renderPhoto(); renderPhotoReq(); });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      photoPreview.appendChild(wrap);
    }
  }
  renderPhoto();
  photoBox.appendChild(photoPreview);
  var photoReq = document.createElement("span");
  photoReq.className = "text-red-500 font-bold text-base";
  photoReq.textContent = "*";
  photoReq.title = t("services_mileage_photo_required");
  photoBox.appendChild(photoReq);
  function renderPhotoReq() {
    photoReq.style.display = state.mileage_photo ? "none" : "";
  }
  renderPhotoReq();
  photoBox.appendChild(makeUploadButton(t("services_mileage_photo_btn"), function (dataUrl) {
    state.mileage_photo = dataUrl;
    renderPhoto();
    renderPhotoReq();
  }));
  mileWrap.appendChild(photoBox);
  form.appendChild(mileWrap);

  form.appendChild(priceRowsForm(state));

  var errBox = document.createElement("div");
  errBox.id = "service-error";
  errBox.className = "hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3";
  form.appendChild(errBox);

  var submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn-primary flex-1";
  submitBtn.textContent = t("services_save");
  var cancelBtn = rowBtn(t("btn_cancel"), "btn-secondary", onCancel);
  var btnRow = document.createElement("div");
  btnRow.className = "flex gap-2";
  btnRow.appendChild(submitBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("service-error");
    var title = titleInput.value.trim();
    if (!title) {
      showErrorBox("service-error", t("services_title_required"));
      return;
    }
    if (!state.mileage_photo) {
      showErrorBox("service-error", t("services_mileage_photo_required"));
      return;
    }
    var payload = {
      title: title,
      diagnosis: diagTa.value,
      mileage: state.mileage === "" ? null : parseInt(state.mileage, 10),
      mileage_unit: state.mileage_unit,
      mileage_photo: state.mileage_photo,
      other_photos: state.other_photos || [],
      price_rows: state.rows.map(function (r) {
        return {
          kind: r.kind,
          currency: r.currency || state.currency || "CRC",
          description: r.description,
          amount: r.amount === "" ? null : parseFloat(sanitizeAmount(r.amount)),
        };
      }),
    };
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    var promise = editing
      ? window.API.mechanic.updateServiceRecord(record.id, payload)
      : window.API.mechanic.createServiceRecord(vehicle.id, payload);
    promise.then(function () {
      if (onSaved) onSaved();
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("service-error", err.message || t("error_generic"));
    });
  });
}

function priceRowsForm(state) {
  var wrap = document.createElement("div");
  var h = document.createElement("h4");
  h.className = "font-semibold text-slate-700 text-sm";
  h.textContent = t("services_prices_title");
  wrap.appendChild(h);

  if (!state.currency) state.currency = state.rows.length ? (state.rows[0].currency || "CRC") : "CRC";

  var curBox = document.createElement("div");
  curBox.className = "mt-2 flex flex-wrap items-center gap-2";
  var curLabel = document.createElement("span");
  curLabel.className = "text-xs font-medium text-slate-500";
  curLabel.textContent = t("services_currency");
  curBox.appendChild(curLabel);
  var curToggle = document.createElement("div");
  curToggle.className = "inline-flex rounded-lg bg-slate-100 p-1";
  var curCrc = document.createElement("button");
  curCrc.type = "button";
  curCrc.textContent = t("services_currency_crc");
  var curUsd = document.createElement("button");
  curUsd.type = "button";
  curUsd.textContent = t("services_currency_usd");
  curToggle.appendChild(curCrc);
  curToggle.appendChild(curUsd);
  function setCurrency(c) {
    state.currency = c;
    state.rows.forEach(function (r) { r.currency = c; });
    render();
  }
  curCrc.addEventListener("click", function () { setCurrency("CRC"); });
  curUsd.addEventListener("click", function () { setCurrency("USD"); });
  curBox.appendChild(curToggle);
  wrap.appendChild(curBox);

  var list = document.createElement("div");
  list.className = "space-y-2 mt-3";

  var btnsRow = document.createElement("div");
  btnsRow.className = "flex flex-wrap items-center gap-2 mt-3";
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-secondary !px-4 !py-2 text-sm";
  addBtn.textContent = t("services_price_add");
  btnsRow.appendChild(addBtn);

  var otherBtn = document.createElement("button");
  otherBtn.type = "button";
  otherBtn.className = "btn-secondary !px-4 !py-2 text-sm";
  otherBtn.textContent = t("services_other_photos");
  btnsRow.appendChild(otherBtn);

  var otherBox = document.createElement("div");
  otherBox.className = "flex flex-wrap gap-2 mt-2";
  function renderOtherPhotos() {
    otherBox.innerHTML = "";
    (state.other_photos || []).forEach(function (src, i) {
      var pw = document.createElement("div");
      pw.className = "relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200";
      var img = document.createElement("img");
      img.src = src;
      img.className = "w-full h-full object-cover cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(src); });
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full leading-none";
      rm.textContent = "×";
      rm.addEventListener("click", function () { state.other_photos.splice(i, 1); renderOtherPhotos(); });
      pw.appendChild(img);
      pw.appendChild(rm);
      otherBox.appendChild(pw);
    });
  }
  renderOtherPhotos();
  otherBtn.addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      files.forEach(function (f) {
        if (f.size > 3 * 1024 * 1024) { flash(t("vehicles_photo_too_large"), true); return; }
        readFileAsDataURL(f).then(function (dataUrl) {
          state.other_photos.push(dataUrl);
          renderOtherPhotos();
        }).catch(function () {});
      });
      input.remove();
    });
    input.click();
  });

  function totals() {
    var labor = 0;
    var parts = 0;
    state.rows.forEach(function (r) {
      var amt = r.amount && !isNaN(parseFloat(r.amount)) ? parseFloat(r.amount) : 0;
      if (r.kind === "parts") parts += amt;
      else labor += amt;
    });
    return { labor: labor, parts: parts, total: labor + parts };
  }

  var foot = null;
  function renderFoot() {
    var tot = totals();
    if (foot) foot.remove();
    foot = document.createElement("div");
    foot.className = "flex flex-wrap items-center justify-end gap-2 mt-2";
    var sym = currencySymbol(state.currency || "CRC");
    foot.appendChild(buildInfoTag(t("services_total_labor"), sym + " " + formatMoney(tot.labor)));
    foot.appendChild(buildInfoTag(t("services_total_parts"), sym + " " + formatMoney(tot.parts)));
    foot.appendChild(buildInfoTag(t("services_total"), sym + " " + formatMoney(tot.total)));
    list.appendChild(foot);
  }

  function render() {
    list.innerHTML = "";
    if (state.rows.length === 0) {
      var empty = document.createElement("p");
      empty.className = "text-slate-500 text-sm";
      empty.textContent = t("services_prices_empty");
      list.appendChild(empty);
    }
    state.rows.forEach(function (row, idx) {
      var tr = document.createElement("div");
      tr.className = "rounded-xl border border-slate-200 p-3 bg-white";
      var typeBtns = document.createElement("div");
      typeBtns.className = "inline-flex rounded-lg bg-slate-100 p-1 mb-2";
      ["labor", "parts"].forEach(function (kind) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = kind === "parts" ? t("services_price_parts") : t("services_price_labor");
        var on = row.kind === kind;
        b.className = "px-4 py-1.5 text-xs font-semibold rounded-md " + (on ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-800");
        b.addEventListener("click", function () { row.kind = kind; render(); });
        typeBtns.appendChild(b);
      });
      tr.appendChild(typeBtns);
      var fields = document.createElement("div");
      fields.className = "grid grid-cols-1 sm:grid-cols-2 gap-2";
      var descBox = document.createElement("div");
      var descLabel = document.createElement("p");
      descLabel.className = "text-xs font-medium text-slate-500 mb-1";
      descLabel.textContent = t("services_price_description");
      var desc = document.createElement("input");
      desc.type = "text";
      desc.className = "field-input";
      desc.placeholder = t("services_price_description");
      desc.value = row.description;
      desc.addEventListener("input", function () { row.description = desc.value; });
      descBox.appendChild(descLabel);
      descBox.appendChild(desc);
      fields.appendChild(descBox);
      var amtBox = document.createElement("div");
      var amtLabel = document.createElement("p");
      amtLabel.className = "text-xs font-medium text-slate-500 mb-1";
      amtLabel.textContent = t("services_price_amount");
      var amtWrap = document.createElement("div");
      amtWrap.className = "flex items-center gap-1";
      var sym = document.createElement("span");
      sym.className = "text-slate-500 font-medium";
      sym.textContent = currencySymbol(row.currency || "CRC");
      var amt = document.createElement("input");
      amt.type = "text";
      amt.inputMode = "decimal";
      amt.className = "field-input";
      amt.placeholder = "0";
      amt.value = formatThousands(row.amount || "");
      amt.addEventListener("input", function () {
        var clean = sanitizeAmount(amt.value);
        row.amount = clean;
        amt.value = formatThousands(clean);
        renderFoot();
      });
      amtWrap.appendChild(sym);
      amtWrap.appendChild(amt);
      amtBox.appendChild(amtLabel);
      amtBox.appendChild(amtWrap);
      fields.appendChild(amtBox);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-danger !px-3 !py-2 text-sm sm:col-span-2 justify-self-end";
      rm.textContent = "×";
      rm.addEventListener("click", function () { state.rows.splice(idx, 1); render(); });
      fields.appendChild(rm);
      tr.appendChild(fields);
      list.appendChild(tr);
    });
    renderFoot();
  }
  addBtn.addEventListener("click", function () {
    state.rows.push({ kind: "labor", currency: state.currency || "CRC", description: "", amount: "" });
    render();
  });
  var active = "px-4 py-1.5 text-sm font-semibold rounded-md bg-white text-brand-700 shadow-sm";
  var idle = "px-4 py-1.5 text-sm font-semibold rounded-md text-slate-600 hover:text-slate-800";
  curCrc.className = (state.currency || "CRC") === "CRC" ? active : idle;
  curUsd.className = (state.currency || "CRC") === "USD" ? active : idle;
  wrap.appendChild(list);
  wrap.appendChild(btnsRow);
  wrap.appendChild(otherBox);
  render();
  return wrap;
}

function sectionText(label, text) {
  var wrap = document.createElement("div");
  wrap.className = "mb-3";
  var h = document.createElement("h4");
  h.className = "font-semibold text-slate-700 text-sm";
  h.textContent = label;
  var p = document.createElement("p");
  p.className = "text-sm text-slate-600 whitespace-pre-wrap";
  p.textContent = text;
  wrap.appendChild(h);
  wrap.appendChild(p);
  return wrap;
}


/* ================================================================
   SETTINGS
   ================================================================ */

var settingsDays = [];
var apptTimeState = { unit: "hours", value: 2 };
var gmailLoaded = false;
var whatsappLoaded = false;
var settingsWired = false;

function initSettingsView() {
  if (!settingsWired) {
    wireSettingsTabs();
    wireScheduleSectionTabs();
    settingsWired = true;
  }
  initSettingsSchedule();
  initSettingsDaysOff();
  initApptTime();
  initGmail();
  initWhatsapp();
}

function wireSettingsTabs() {
  var tabs = ["schedule", "appttime", "integrations"];
  tabs.forEach(function (name) {
    var btn = $("settings-tab-" + name);
    if (btn) {
      btn.addEventListener("click", function () {
        setSettingsTab(name);
        if (name === "schedule") initSettingsSchedule();
        if (name === "appttime") initApptTime();
        if (name === "integrations") { initGmail(); initWhatsapp(); }
      });
    }
  });
}

function setSettingsTab(name) {
  ["schedule", "appttime", "integrations"].forEach(function (n) {
    var panel = $("settings-panel-" + n);
    if (panel) panel.classList.toggle("hidden", n !== name);
    var btn = $("settings-tab-" + n);
    if (btn) {
      btn.classList.toggle("border-brand-600", n === name);
      btn.classList.toggle("text-brand-700", n === name);
      btn.classList.toggle("border-transparent", n !== name);
      btn.classList.toggle("text-slate-500", n !== name);
    }
  });
}

function wireScheduleSectionTabs() {
  var btns = document.querySelectorAll(".schedule-tab-btn");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      setScheduleSection(b.dataset.scheduleSection);
      if (b.dataset.scheduleSection === "daysoff") initSettingsDaysOff();
    });
  });
}

function setScheduleSection(name) {
  var wd = $("schedule-section-workdays");
  var doff = $("schedule-section-daysoff");
  if (wd) wd.classList.toggle("hidden", name !== "workdays");
  if (doff) doff.classList.toggle("hidden", name !== "daysoff");
  document.querySelectorAll(".schedule-tab-btn").forEach(function (b) {
    var on = b.dataset.scheduleSection === name;
    b.classList.toggle("bg-white", on);
    b.classList.toggle("text-brand-700", on);
    b.classList.toggle("shadow-sm", on);
    b.classList.toggle("text-slate-600", !on);
  });
}

function initSettingsSchedule() {
  var saveBtn = $("settings-save");
  if (saveBtn) saveBtn.onclick = saveSchedule;
  window.API.mechanic.getSchedule().then(function (s) {
    settingsDays = (s.days || []).map(function (d) {
      return {
        day: d.day,
        start_time: d.start_time,
        end_time: d.end_time,
        lunch_start: d.lunch_start || null,
        lunch_end: d.lunch_end || null,
      };
    });
    renderSettingsDays();
    renderSettingsPresets();
  }).catch(function (err) {
    showErrorBox("settings-error", err.message || t("error_generic"));
  });
}

function renderSettingsPresets() {
  var box = $("settings-presets");
  if (!box) return;
  box.innerHTML = "";
  var label = document.createElement("span");
  label.className = "text-sm text-slate-600 font-medium";
  label.textContent = t("settings_presets");
  box.appendChild(label);
  [["07:00", "15:00"], ["08:00", "16:00"], ["09:00", "17:00"], ["10:00", "18:00"]].forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "px-3 py-1.5 rounded-full border text-sm border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-brand-500";
    b.textContent = formatTimeRange(p[0], p[1]);
    b.addEventListener("click", function () { applyPreset(p[0], p[1]); });
    box.appendChild(b);
  });
  var sep = document.createElement("span");
  sep.className = "w-px h-5 bg-slate-200";
  box.appendChild(sep);
  var allOn = document.createElement("button");
  allOn.type = "button";
  allOn.className = "btn-secondary !px-3 !py-1.5 text-xs";
  allOn.textContent = t("settings_activate_all");
  allOn.addEventListener("click", activateAllDays);
  box.appendChild(allOn);
  var allOff = document.createElement("button");
  allOff.type = "button";
  allOff.className = "btn-secondary !px-3 !py-1.5 text-xs";
  allOff.textContent = t("settings_deactivate_all");
  allOff.addEventListener("click", deactivateAllDays);
  box.appendChild(allOff);
}

function formatTimeRange(s, e) {
  var a = to12(s), b = to12(e);
  return a.hour + ":" + a.minute + " " + a.ampm + " – " + b.hour + ":" + b.minute + " " + b.ampm;
}

function applyPreset(start, end) {
  if (settingsDays.length === 0) {
    flash(t("settings_preset_no_days"), true);
    return;
  }
  settingsDays.forEach(function (d) {
    d.start_time = start;
    d.end_time = end;
  });
  renderSettingsDays();
  flash(t("settings_preset_applied"));
}

function activateAllDays() {
  [1, 2, 3, 4, 5, 6, 0].forEach(function (i) {
    var found = settingsDays.some(function (d) { return d.day === i; });
    if (!found) {
      settingsDays.push({ day: i, start_time: "08:00", end_time: "17:00", lunch_start: null, lunch_end: null });
    }
  });
  renderSettingsDays();
  flash(t("settings_activate_all_done"));
}

function deactivateAllDays() {
  settingsDays = [];
  renderSettingsDays();
}

function renderSettingsDays() {
  var container = $("settings-days");
  if (!container) return;
  container.innerHTML = "";
  var order = [1, 2, 3, 4, 5, 6, 0];
  order.forEach(function (i) {
    var entry = null;
    for (var k = 0; k < settingsDays.length; k++) {
      if (settingsDays[k].day === i) { entry = settingsDays[k]; break; }
    }
    container.appendChild(buildDayRow(i, entry));
  });
}

function buildDayRow(day, entry) {
  var row = document.createElement("div");
  row.className = "rounded-xl border border-slate-200 p-4 bg-white";
  var active = !!entry;

  var head = document.createElement("div");
  head.className = "flex items-center justify-between";
  var label = document.createElement("span");
  label.className = "font-semibold text-slate-700";
  label.textContent = dayLabel(day);
  head.appendChild(label);
  var toggleWrap = document.createElement("div");
  toggleWrap.className = "flex items-center gap-2";
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", active ? "true" : "false");
  toggle.setAttribute("aria-label", dayLabel(day));
  toggle.className = "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
    (active ? "bg-brand-600" : "bg-slate-300");
  var knob = document.createElement("span");
  knob.className = "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
    (active ? "translate-x-[22px]" : "translate-x-0.5");
  toggle.appendChild(knob);
  var stateLabel = document.createElement("span");
  stateLabel.className = "text-xs font-semibold " + (active ? "text-brand-700" : "text-slate-400");
  stateLabel.textContent = active ? t("announce_active") : t("users_inactive");
  toggle.addEventListener("click", function () {
    if (active) {
      settingsDays = settingsDays.filter(function (d) { return d.day !== day; });
    } else {
      settingsDays.push({ day: day, start_time: "08:00", end_time: "17:00", lunch_start: null, lunch_end: null });
    }
    renderSettingsDays();
  });
  toggleWrap.appendChild(toggle);
  toggleWrap.appendChild(stateLabel);
  head.appendChild(toggleWrap);
  row.appendChild(head);

  if (!active) return row;

  function timeField(parent, labelKey) {
    var wrap = document.createElement("div");
    var p = document.createElement("p");
    p.className = "text-xs font-medium text-slate-500 mb-1";
    p.textContent = t(labelKey);
    var sel = document.createElement("div");
    wrap.appendChild(p);
    wrap.appendChild(sel);
    parent.appendChild(wrap);
    return sel;
  }

  function updateInvalid() {
    var invalidHours = entry.start_time >= entry.end_time;
    var invalidLunch = !!(entry.lunch_start && entry.lunch_end && entry.lunch_start >= entry.lunch_end);
    var msg = invalidHours ? t("settings_invalid_hours") : invalidLunch ? t("settings_invalid_lunch") : "";
    invalidHint.textContent = msg;
    invalidHint.classList.toggle("hidden", !msg);
    row.classList.toggle("border-red-300", !!msg);
  }

  var invalidHint = document.createElement("p");
  invalidHint.className = "hidden mt-2 text-xs text-red-600 font-medium";
  row.appendChild(invalidHint);

  var timeRow = document.createElement("div");
  timeRow.className = "mt-3 flex flex-wrap items-end gap-3";
  row.appendChild(timeRow);
  buildTimeField(timeField(timeRow, "settings_start_time"), entry.start_time, function (v) {
    entry.start_time = v;
    updateInvalid();
  });
  buildTimeField(timeField(timeRow, "settings_end_time"), entry.end_time, function (v) {
    entry.end_time = v;
    updateInvalid();
  });

  var lunchBtn = document.createElement("button");
  lunchBtn.type = "button";
  lunchBtn.className = "mt-3 btn-secondary text-sm";
  lunchBtn.textContent = t("settings_lunch_time") + (entry.lunch_start ? " ✓" : "");
  lunchBtn.addEventListener("click", function () {
    if (entry.lunch_start) {
      entry.lunch_start = null;
      entry.lunch_end = null;
    } else {
      entry.lunch_start = "12:00";
      entry.lunch_end = "13:00";
    }
    renderSettingsDays();
  });
  row.appendChild(lunchBtn);

  if (entry.lunch_start) {
    var lunchRow = document.createElement("div");
    lunchRow.className = "mt-2 flex flex-wrap items-end gap-3";
    row.appendChild(lunchRow);
    buildTimeField(timeField(lunchRow, "settings_lunch_start"), entry.lunch_start, function (v) {
      entry.lunch_start = v;
      updateInvalid();
    });
    buildTimeField(timeField(lunchRow, "settings_lunch_end"), entry.lunch_end, function (v) {
      entry.lunch_end = v;
      updateInvalid();
    });
  }

  updateInvalid();

  var order = [1, 2, 3, 4, 5, 6, 0];
  var others = settingsDays.filter(function (d) { return order.indexOf(d.day) > order.indexOf(day); });
  if (others.length) {
    var copyBlock = document.createElement("div");
    copyBlock.className = "mt-4 pt-3 border-t border-slate-100";
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-secondary text-sm";
    copyBtn.textContent = t("settings_copy_following");
    copyBtn.addEventListener("click", function () {
      others.forEach(function (d) {
        d.start_time = entry.start_time;
        d.end_time = entry.end_time;
        d.lunch_start = entry.lunch_start;
        d.lunch_end = entry.lunch_end;
      });
      flash(t("settings_apply_done"));
      renderSettingsDays();
    });
    copyBlock.appendChild(copyBtn);
    row.appendChild(copyBlock);
  }
  return row;
}

function saveSchedule() {
  hideBox("settings-error");
  hideBox("settings-success");
  if (settingsDays.length === 0) {
    showErrorBox("settings-error", t("settings_no_days"));
    return;
  }
  for (var i = 0; i < settingsDays.length; i++) {
    var d = settingsDays[i];
    if (d.start_time >= d.end_time) {
      showErrorBox("settings-error", t("settings_invalid_hours"));
      return;
    }
    if (d.lunch_start && d.lunch_end && d.lunch_start >= d.lunch_end) {
      showErrorBox("settings-error", t("settings_invalid_lunch"));
      return;
    }
  }
  var payload = settingsDays.map(function (d) {
    var o = { day: d.day, start_time: d.start_time, end_time: d.end_time };
    if (d.lunch_start) o.lunch_start = d.lunch_start;
    if (d.lunch_end) o.lunch_end = d.lunch_end;
    return o;
  });
  var btn = $("settings-save");
  if (btn) btn.disabled = true;
  window.API.mechanic.updateSchedule({ days: payload }).then(function () {
    if (btn) btn.disabled = false;
    showSuccessBox("settings-success", t("settings_saved"));
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    showErrorBox("settings-error", err.message || t("error_generic"));
  });
}

function initSettingsDaysOff() {
  var pickerBtn = $("day-off-picker");
  if (pickerBtn) pickerBtn.onclick = openDatePicker;
  loadDaysOff();
}

function loadDaysOff() {
  var list = $("days-off-list");
  var error = $("days-off-error");
  if (!list) return;
  list.innerHTML = "";
  hideBox("days-off-error");
  window.API.mechanic.getDaysOff().then(function (days) {
    if (days.length === 0) {
      var p = document.createElement("li");
      p.className = "text-slate-500 text-sm";
      p.textContent = t("settings_days_off_empty");
      list.appendChild(p);
      return;
    }
    days.forEach(function (d) {
      var item = document.createElement("li");
      item.className = "rounded-xl border border-slate-200 p-4 bg-white flex items-center justify-between gap-3";
      var txt = document.createElement("div");
      var tagItems = [{ label: t("field_date"), value: formatLongDate(d.day_off) }];
      if (d.reason) tagItems.push({ label: t("settings_days_off_reason"), value: d.reason });
      txt.appendChild(tagsRow(tagItems));
      item.appendChild(txt);
      var rm = smallBtn(t("settings_days_off_remove"), "btn-danger", function () {
        window.API.mechanic.removeDayOff(d.day_off).then(function () {
          loadDaysOff();
          flash("Día libre eliminado.");
        }).catch(function (err) { flash(err.message, true); });
      });
      item.appendChild(rm);
      list.appendChild(item);
    });
  }).catch(function (err) {
    showErrorBox("days-off-error", err.message || t("error_generic"));
  });
}

function openDatePicker() {
  var m = openModal(t("settings_days_off_pick"), "");
  var year = new Date().getFullYear();
  var month = new Date().getMonth();
  var monthNames = monthNamesES();
  var dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var selected = {};

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function isWorkingDow(dow) {
    for (var i = 0; i < settingsDays.length; i++) {
      if (settingsDays[i].day === dow) return true;
    }
    return false;
  }

  function render() {
    var head = document.createElement("div");
    head.className = "flex items-center justify-between mb-2";
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "btn-secondary !px-3 !py-1";
    prev.textContent = "←";
    var label = document.createElement("span");
    label.className = "font-semibold";
    label.textContent = monthNames[month] + " " + year;
    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn-secondary !px-3 !py-1";
    next.textContent = "→";
    head.appendChild(prev);
    head.appendChild(label);
    head.appendChild(next);
    m.body.innerHTML = "";
    m.body.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "grid grid-cols-7 gap-1 text-center";
    dayNames.forEach(function (d) {
      var c = document.createElement("div");
      c.className = "text-xs font-semibold text-slate-400 py-1";
      c.textContent = d;
      grid.appendChild(c);
    });

    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < firstDow; i++) grid.appendChild(document.createElement("div"));
    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(year, month, d);
      var ds = year + "-" + pad(month + 1) + "-" + pad(d);
      var working = isWorkingDow(date.getDay());
      var isSel = !!selected[ds];
      var cell = document.createElement("button");
      cell.type = "button";
      cell.setAttribute("aria-pressed", isSel ? "true" : "false");
      cell.textContent = d;
      if (!working) {
        cell.className = "p-2 rounded-lg text-sm text-slate-300 cursor-not-allowed border border-slate-200 bg-slate-50";
        cell.disabled = true;
      } else if (isSel) {
        cell.className = "p-2 rounded-lg text-sm font-semibold transition border bg-brand-600 text-white border-brand-600";
      } else {
        cell.className = "p-2 rounded-lg text-sm transition border bg-green-50 hover:bg-green-100 text-slate-800 border-green-200 cursor-pointer";
        cell.addEventListener("click", (function (ds) {
          return function () {
            if (selected[ds]) delete selected[ds];
            else selected[ds] = true;
            render();
          };
        })(ds));
      }
      grid.appendChild(cell);
    }
    m.body.appendChild(grid);

    var legend = document.createElement("div");
    legend.className = "mt-3 flex items-center gap-4 text-xs text-slate-500";
    var lg1 = document.createElement("span");
    lg1.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-green-200 align-middle'></span> " + escapeHTML(t("settings_days_off_legend_work"));
    var lg2 = document.createElement("span");
    lg2.innerHTML = "<span class='inline-block w-3 h-3 rounded bg-brand-600 align-middle'></span> " + escapeHTML(t("settings_days_off_legend_selected"));
    legend.appendChild(lg1);
    legend.appendChild(lg2);
    m.body.appendChild(legend);

    var footer = document.createElement("div");
    footer.className = "mt-4 flex items-center justify-between gap-2";
    var count = document.createElement("span");
    count.className = "text-sm text-slate-600 font-medium";
    var n = Object.keys(selected).length;
    count.textContent = n + " " + t("settings_days_off_selected");
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-primary";
    addBtn.textContent = t("settings_days_off_add_selected");
    addBtn.disabled = n === 0;
    addBtn.addEventListener("click", function () {
      var dates = Object.keys(selected).sort();
      var reason = $("day-off-reason") ? $("day-off-reason").value.trim() : "";
      addBtn.disabled = true;
      var i = 0;
      function next() {
        if (i >= dates.length) {
          loadDaysOff();
          closeModal();
          flash(t("settings_days_off_added"));
          return;
        }
        var date = dates[i++];
        window.API.mechanic.addDayOff({ day_off: date, reason: reason }).then(next).catch(next);
      }
      next();
    });
    footer.appendChild(count);
    footer.appendChild(addBtn);
    m.body.appendChild(footer);

    prev.addEventListener("click", function () {
      month--;
      if (month < 0) { month = 11; year--; }
      render();
    });
    next.addEventListener("click", function () {
      month++;
      if (month > 11) { month = 0; year++; }
      render();
    });
  }
  render();
}

function initApptTime() {
  var unitBox = $("appttime-unit");
  var valueBox = $("appttime-value");
  var saveBtn = $("appttime-save");
  if (saveBtn) saveBtn.onclick = saveApptTime;
  if (unitBox) {
    unitBox.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        apptTimeState.unit = b.dataset.unit;
        apptTimeState.value = b.dataset.unit === "hours" ? 2 : 1;
        renderApptTime();
      };
    });
  }
  if (valueBox) {
    valueBox.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        apptTimeState.value = parseInt(b.dataset.value, 10);
        renderApptTime();
      };
    });
  }
  window.API.mechanic.getAppointmentTime().then(function (s) {
    apptTimeState = { unit: s.unit || "hours", value: s.value || 2 };
    renderApptTime();
  }).catch(function (err) {
    showErrorBox("appttime-error", err.message || t("error_generic"));
  });
}

function renderApptTime() {
  var unitBox = $("appttime-unit");
  var valueBox = $("appttime-value");
  if (unitBox) {
    unitBox.querySelectorAll("button").forEach(function (b) {
      var on = b.dataset.unit === apptTimeState.unit;
      b.className = on
        ? "px-5 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white"
        : "px-5 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50";
    });
  }
  var values = apptTimeState.unit === "days" ? [1, 2, 3, 5, 7, 14] : [1, 2, 3, 4, 5, 6, 8, 12];
  if (valueBox) {
    valueBox.innerHTML = "";
    values.forEach(function (v) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.value = String(v);
      b.textContent = String(v) + (apptTimeState.unit === "days" ? " d" : " h");
      var on = v === apptTimeState.value;
      b.className = on
        ? "px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white"
        : "px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50";
      b.addEventListener("click", function () {
        apptTimeState.value = parseInt(b.dataset.value, 10);
        renderApptTime();
      });
      valueBox.appendChild(b);
    });
  }
  var hint = $("appttime-hint");
  if (hint) hint.textContent = t(apptTimeState.unit === "days" ? "appttime_hint_days" : "appttime_hint_hours");
}

function saveApptTime() {
  hideBox("appttime-error");
  hideBox("appttime-success");
  var btn = $("appttime-save");
  if (btn) btn.disabled = true;
  window.API.mechanic.updateAppointmentTime({
    unit: apptTimeState.unit,
    value: apptTimeState.value,
  }).then(function () {
    if (btn) btn.disabled = false;
    showSuccessBox("appttime-success", t("appttime_saved"));
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    showErrorBox("appttime-error", err.message || t("error_generic"));
  });
}

function initGmail() {
  if (gmailLoaded) return;
  gmailLoaded = true;
  var redirect = $("gmail-redirect-uri");
  if (redirect) redirect.textContent = "https://yourdomain/api/mechanic/gmail/callback";

  var saveBtn = $("gmail-save-creds");
  if (saveBtn) saveBtn.onclick = saveGmailCreds;
  var authBtn = $("gmail-authorize");
  if (authBtn) authBtn.onclick = authorizeGmail;

  window.API.mechanic.getGmailSettings().then(renderGmail).catch(function (err) {
    showErrorBox("gmail-msg", err.message || t("error_generic"));
  });
}

function renderGmail(s) {
  var status = $("gmail-status");
  var form = $("gmail-form");
  var from = $("gmail-from");
  if (from) from.value = s.from_email || "";
  if (!status) return;
  status.innerHTML = "";

  if (s.activated) {
    var badge = document.createElement("span");
    badge.className = "inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("gmail_active");
    status.appendChild(badge);
  } else if (s.configured) {
    var badge = document.createElement("span");
    badge.className = "inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("gmail_saved_msg");
    status.appendChild(badge);
  }

  var actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2 mt-3";

  if (s.activated) {
    var testBtn = smallBtn(t("gmail_test"), "btn-secondary", function () {
      window.API.mechanic.testGmail().then(function () {
        flash(t("gmail_test_ok"));
      }).catch(function (err) {
        flash(err.message || t("gmail_test_fail"), true);
      });
    });
    var deactBtn = smallBtn(t("gmail_deactivate"), "btn-danger", function () {
      showConfirm(t("gmail_deactivate_confirm")).then(function (ok) {
        if (!ok) return;
        window.API.mechanic.deactivateGmail().then(function () {
          gmailLoaded = false;
          initGmail();
          flash(t("gmail_deactivated_msg"));
        }).catch(function (err) { flash(err.message, true); });
      });
    });
    actions.appendChild(testBtn);
    actions.appendChild(deactBtn);
  } else {
    var reconfBtn = smallBtn(s.configured ? t("gmail_reconfigure") : t("gmail_activate"), "btn-secondary", function () {
      if (form) form.classList.remove("hidden");
    });
    actions.appendChild(reconfBtn);
    if (s.configured) {
      var authBtn = smallBtn(t("gmail_authorize"), "btn-primary", function () {
        authorizeGmail();
      });
      actions.appendChild(authBtn);
    }
  }
  status.appendChild(actions);
}

function saveGmailCreds() {
  var msg = $("gmail-msg");
  if (msg) msg.classList.add("hidden");
  var clientId = $("gmail-client-id").value.trim();
  var clientSecret = $("gmail-client-secret").value.trim();
  var fromEmail = $("gmail-from").value.trim();
  if (!clientId || !clientSecret || !fromEmail) {
    showErrorBox("gmail-msg", t("gmail_required"));
    return;
  }
  var btn = $("gmail-save-creds");
  if (btn) btn.disabled = true;
  window.API.mechanic.updateGmailSettings({
    client_id: clientId,
    client_secret: clientSecret,
    from_email: fromEmail,
  }).then(function () {
    if (btn) btn.disabled = false;
    var authBtn = $("gmail-authorize");
    if (authBtn) authBtn.classList.remove("hidden");
    showSuccessBox("gmail-msg", t("gmail_saved_msg"));
    authorizeGmail();
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    showErrorBox("gmail-msg", err.message || t("error_generic"));
  });
}

function authorizeGmail() {
  window.API.mechanic.getGmailAuthUrl().then(function (res) {
    if (res && res.url) {
      window.open(res.url, "_blank");
    }
  }).catch(function (err) {
    showErrorBox("gmail-msg", err.message || t("error_generic"));
  });
}

function initWhatsapp() {
  if (whatsappLoaded) return;
  whatsappLoaded = true;
  var saveBtn = $("whatsapp-save");
  if (saveBtn) saveBtn.onclick = saveWhatsapp;
  window.API.mechanic.getWhatsappSettings().then(renderWhatsapp).catch(function (err) {
    showErrorBox("whatsapp-msg", err.message || t("error_generic"));
  });
}

function renderWhatsapp(s) {
  var status = $("whatsapp-status");
  var form = $("whatsapp-form");
  var apiKey = $("whatsapp-api-key");
  var phoneId = $("whatsapp-phone-number-id");
  var testPhone = $("whatsapp-test-phone");
  if (phoneId) phoneId.value = s.phone_number_id || "";
  if (testPhone) testPhone.value = s.test_phone || "";
  if (apiKey) apiKey.value = "";
  if (!status) return;
  status.innerHTML = "";

  if (s.activated) {
    var badge = document.createElement("span");
    badge.className = "inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("whatsapp_active");
    status.appendChild(badge);
  } else if (s.configured) {
    var badge = document.createElement("span");
    badge.className = "inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("whatsapp_configured");
    status.appendChild(badge);
  }

  var actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2 mt-3";

  if (s.activated) {
    var testBtn = smallBtn(t("whatsapp_test"), "btn-secondary", function () {
      window.API.mechanic.testWhatsapp().then(function () {
        flash(t("whatsapp_test_ok"));
      }).catch(function (err) {
        flash(err.message || t("whatsapp_test_fail"), true);
      });
    });
    var deactBtn = smallBtn(t("whatsapp_deactivate"), "btn-danger", function () {
      showConfirm(t("whatsapp_deactivate_confirm")).then(function (ok) {
        if (!ok) return;
        window.API.mechanic.deactivateWhatsapp().then(function () {
          whatsappLoaded = false;
          initWhatsapp();
          flash(t("whatsapp_deactivated_msg"));
        }).catch(function (err) { flash(err.message, true); });
      });
    });
    actions.appendChild(testBtn);
    actions.appendChild(deactBtn);
  } else {
    var reconfBtn = smallBtn(s.configured ? t("whatsapp_reconfigure") : t("whatsapp_activate"), "btn-secondary", function () {
      if (form) form.classList.remove("hidden");
    });
    actions.appendChild(reconfBtn);
  }
  status.appendChild(actions);
}

function saveWhatsapp() {
  var msg = $("whatsapp-msg");
  if (msg) msg.classList.add("hidden");
  var apiKey = $("whatsapp-api-key").value.trim();
  var phoneId = $("whatsapp-phone-number-id").value.trim();
  var testPhone = $("whatsapp-test-phone").value.trim();
  if (!apiKey || !phoneId) {
    showErrorBox("whatsapp-msg", t("whatsapp_required"));
    return;
  }
  var btn = $("whatsapp-save");
  if (btn) btn.disabled = true;
  window.API.mechanic.updateWhatsappSettings({
    api_key: apiKey,
    phone_number_id: phoneId,
    test_phone: testPhone,
  }).then(function (res) {
    if (btn) btn.disabled = false;
    var form = $("whatsapp-form");
    if (form) form.classList.add("hidden");
    showSuccessBox("whatsapp-msg", t("whatsapp_saved_msg"));
    renderWhatsapp(res);
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    showErrorBox("whatsapp-msg", err.message || t("error_generic"));
  });
}

/* ================================================================
   LANDING + BACK BUTTONS
   ================================================================ */

function attachLandingButtonListeners() {
  var homeBtn = $("sidebar-home");
  if (homeBtn) {
    homeBtn.addEventListener("click", function () {
      showView("landing");
      initHomeDashboard();
      var sidebar = $("app-sidebar");
      if (sidebar) sidebar.classList.add("-translate-x-full");
    });
  }

  function mirrorClick(sourceId, targetId) {
    var source = $(sourceId);
    var target = $(targetId);
    if (!source || !target) return;
    source.addEventListener("click", function () {
      target.click();
    });
  }
  mirrorClick("sidebar-calendar", "landing-calendar");
  mirrorClick("sidebar-vehicles", "landing-vehicles");
  mirrorClick("sidebar-clients", "landing-clients");
  mirrorClick("sidebar-announce", "landing-announce");
  mirrorClick("sidebar-settings", "landing-settings");
  mirrorClick("sidebar-users", "landing-users");
  var sidebarToggle = $("sidebar-toggle");
  var sidebar = $("app-sidebar");
  if (sidebarToggle && sidebar) sidebarToggle.addEventListener("click", function () { sidebar.classList.toggle("-translate-x-full"); });

  var calendarBtn = $("landing-calendar");
  if (calendarBtn) {
    calendarBtn.addEventListener("click", function () {
      showView("calendar");
      renderCal();
    });
  }

  var announceBtn = $("landing-announce");
  if (announceBtn) {
    announceBtn.addEventListener("click", function () {
      showView("announce");
      initAnnouncementForm();
      loadAnnouncements();
    });
  }

  var clientsBtn = $("landing-clients");
  if (clientsBtn) {
    clientsBtn.addEventListener("click", function () {
      showView("clients");
      loadClients();
    });
  }

  var clientsSearch = $("clients-search");
  if (clientsSearch) {
    clientsSearch.addEventListener("input", function () {
      clearTimeout(clientsSearchTimer);
      clientsSearchTimer = setTimeout(renderClients, 250);
    });
  }

  var usersBtn = $("landing-users");
  if (usersBtn) {
    usersBtn.addEventListener("click", function () {
      showView("users");
      loadUsers();
    });
  }

  var vehiclesBtn = $("landing-vehicles");
  if (vehiclesBtn) {
    vehiclesBtn.addEventListener("click", function () {
      currentVehicleId = null;
      showView("vehicles");
      renderVehiclesList();
    });
  }

  var settingsBtn = $("landing-settings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", function () {
      showView("settings");
      initSettingsView();
    });
  }

  var vehiclesAdd = $("vehicles-add-btn");
  if (vehiclesAdd) {
    vehiclesAdd.addEventListener("click", function () {
      openVehicleModal(null);
    });
  }

  var vehiclesSearch = $("vehicles-search");
  if (vehiclesSearch) {
    vehiclesSearch.addEventListener("input", function () {
      clearTimeout(vehiclesSearchTimer);
      vehiclesSearchTimer = setTimeout(function () {
        renderVehiclesList(vehiclesSearch.value.trim());
      }, 300);
    });
  }

  var usersAdd = $("users-add-btn");
  if (usersAdd) {
    usersAdd.addEventListener("click", function () {
      openUserModal(null);
    });
  }

  var vehDetailEdit = $("vehicle-detail-edit");
  if (vehDetailEdit) {
    vehDetailEdit.addEventListener("click", function () {
      if (!currentVehicleId) return;
      window.API.mechanic.getVehicle(currentVehicleId).then(function (v) {
        openVehicleModal(v);
      }).catch(function (err) { flash(err.message, true); });
    });
  }

  var vehDetailDelete = $("vehicle-detail-delete");
  if (vehDetailDelete) {
    vehDetailDelete.addEventListener("click", function () {
      if (!currentVehicleId) return;
      showConfirm(t("vehicles_delete_confirm")).then(function (ok) {
        if (!ok) return;
        window.API.mechanic.deleteVehicle(currentVehicleId).then(function () {
          currentVehicleId = null;
          showView("vehicles");
          renderVehiclesList();
          flash(t("vehicles_deleted"));
        }).catch(function (err) { flash(err.message, true); });
      });
    });
  }
}

function initBackButtons() {
  var backButtons = [
    { id: "cal-back-btn", view: "landing" },
    { id: "announce-back-btn", view: "landing" },
    { id: "settings-back-btn", view: "landing" },
    { id: "clients-back-btn", view: "landing" },
    { id: "users-back-btn", view: "landing" },
    { id: "vehicles-back-btn", view: "landing" },
    { id: "vehicle-detail-back", view: "vehicles" },
  ];

  backButtons.forEach(function (btn) {
    var el = $(btn.id);
    if (el) {
      el.addEventListener("click", function () {
        var target = btn.id === "vehicle-detail-back" ? vehicleDetailBackView : btn.view;
        showView(target);
        if (target === "vehicles") renderVehiclesList();
        if (target === "calendar") renderCal();
      });
    }
  });
}

/* ================================================================
   INITIALIZATION
   ================================================================ */

function restoreView() {
  showView("landing");
  initHomeDashboard();
}

function initDashboard() {
  ensureMechanicAuth().then(function (u) {
    var userEl = $("account-menu-user");
    if (userEl) {
      var roleLabel = u.role === "admin" ? t("users_role_admin") : t("users_role_mechanic");
      userEl.textContent = u.name + " · " + roleLabel;
    }
    var usersBtn = $("landing-users");
    var sidebarUsersBtn = $("sidebar-users");
    if (usersBtn) {
      var isAdmin = u.role === "admin";
      usersBtn.classList.toggle("hidden", !isAdmin);
      if (sidebarUsersBtn) sidebarUsersBtn.classList.toggle("hidden", !isAdmin);
    }
    handleGmailQuery();
    initGearMenu();
    attachLandingButtonListeners();
    initBackButtons();
    wireCalendarNav();
    restoreView();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  if (window.PAGE === "login") {
    initLoginPage();
  } else if (window.PAGE === "dashboard") {
    initDashboard();
  } else if (window.PAGE === "create") {
    initCreatePage();
  }
});
