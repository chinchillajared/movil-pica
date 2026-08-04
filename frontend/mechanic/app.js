function $(id) {
  return document.getElementById(id);
}

function escapeHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
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
    return;
  }
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

function buildTimePicker(container, value, onChange) {
  container.innerHTML = "";
  var v = to12(value);
  var hourSel = document.createElement("select");
  hourSel.className = "border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white";
  for (var h = 1; h <= 12; h++) {
    var o = document.createElement("option");
    o.value = String(h);
    o.textContent = String(h);
    if (h === v.hour) o.selected = true;
    hourSel.appendChild(o);
  }
  var minSel = document.createElement("select");
  minSel.className = "border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white";
  var minutes = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
  if (minutes.indexOf(v.minute) === -1) minutes.push(v.minute);
  minutes.forEach(function (m) {
    var o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    if (m === v.minute) o.selected = true;
    minSel.appendChild(o);
  });
  var ampmSel = document.createElement("select");
  ampmSel.className = "border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white";
  ["AM", "PM"].forEach(function (p) {
    var o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    if (p === v.ampm) o.selected = true;
    ampmSel.appendChild(o);
  });
  [hourSel, minSel, ampmSel].forEach(function (sel) {
    sel.addEventListener("change", function () {
      onChange(from12(hourSel.value, minSel.value, ampmSel.value));
    });
    container.appendChild(sel);
  });
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
  var p = String(dateStr).split("-");
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return weekdayNamesES()[d.getDay()] + " " + p[2] + " de " + monthNamesES()[parseInt(p[1], 10) - 1] + " de " + p[0];
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
  var m = openModal("Foto", "");
  var img = document.createElement("img");
  img.src = src;
  img.className = "max-w-full rounded-lg";
  m.body.appendChild(img);
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
      btn.className = selected
        ? "py-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-700 font-semibold text-lg"
        : "py-4 rounded-xl border-2 border-slate-300 font-semibold text-lg bg-white hover:bg-slate-50 transition text-slate-800";
      btn.textContent = h;
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
        var parts = selectedDate.split("-");
        dateDisplay.textContent = parts[2] + " de " + monthNames[parseInt(parts[1], 10) - 1] + " de " + parts[0];
      }
      renderTimeSlots();
    }
    if (step === 3) {
      var finalDate = $("final-date-display");
      var finalTime = $("final-time-display");
      if (finalDate && selectedDate) {
        var p = selectedDate.split("-");
        finalDate.textContent = p[2] + "/" + p[1] + "/" + p[0];
      }
      if (finalTime && selectedTime) finalTime.textContent = selectedTime;
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
        $("create-appt-number").textContent = num;
        $("create-appt-plate").textContent = plate;
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

  var accountBtn = $("account-menu-account");
  if (accountBtn) {
    accountBtn.addEventListener("click", function () {
      dropdown.classList.add("hidden");
      openAccountModal();
    });
  }

  var backHome = $("back-home-btn");
  if (backHome) {
    backHome.addEventListener("click", function () {
      window.location.href = "/user/";
    });
  }
}

function openAccountModal() {
  var m = openModal(t("client_my_account"), "");
  var u = currentUser || getMechanicUser() || {};
  var info = document.createElement("div");
  info.className = "space-y-1 text-sm mb-5";
  info.innerHTML =
    "<p><span class='text-slate-500'>Nombre:</span> " + escapeHTML(u.name || "") + "</p>" +
    "<p><span class='text-slate-500'>Email:</span> " + escapeHTML(u.email || "") + "</p>" +
    "<p><span class='text-slate-500'>Rol:</span> " + escapeHTML(u.role || "") + "</p>";
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

  window.API.mechanic.list().then(function (appts) {
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
      if (details) details.appendChild(buildApptRow(a));
    });
  }).catch(function () {
    if (noAppt) noAppt.classList.remove("hidden");
    if (card) card.classList.add("hidden");
  });
}

function buildApptRow(a) {
  var row = document.createElement("div");
  row.className = "py-3 border-b border-slate-100";

  var info = document.createElement("div");
  info.className = "flex flex-wrap items-center justify-between gap-2 text-sm mb-3";
  info.innerHTML =
    "<div><span class='font-medium text-slate-800'>" + escapeHTML(String(a.appointment_time).slice(0, 5)) + "</span> " +
    "<span class='text-slate-600'>" + escapeHTML(a.first_name + " " + a.last_name) + " (" + escapeHTML(a.plate) + ")</span>" +
    "<span class='text-xs text-slate-400 ml-1'>" + escapeHTML(a.appointment_number) + "</span></div>";
  var badge = document.createElement("span");
  badge.className = "text-xs px-2 py-1 rounded-full " + statusBadgeClass(a.status);
  badge.textContent = statusLabel(a.status);
  info.appendChild(badge);
  row.appendChild(info);

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
  return row;
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
      var durationLabel = a.is_permanent ? t("announce_permanent") : (a.duration_hours + "h");
      var status = (a.is_active ? t("announce_active") : t("announce_inactive"));
      var header = document.createElement("div");
      header.className = "flex items-center justify-between gap-2";
      var statusEl = document.createElement("span");
      statusEl.className = "text-xs px-2 py-1 rounded-full bg-white/70 text-slate-700 font-medium";
      statusEl.textContent = status + " · " + durationLabel;
      header.appendChild(statusEl);
      var actions = document.createElement("div");
      actions.className = "flex gap-2";
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
      var body = document.createElement("p");
      body.className = "text-sm text-slate-800 mt-2";
      body.textContent = a.text;
      row.appendChild(body);
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
    info.innerHTML =
      "<p class='font-medium text-slate-800'>" + escapeHTML(c.first_name + " " + c.last_name) + "</p>" +
      "<p class='text-sm text-slate-500'>" + escapeHTML(c.email || "—") + " &middot; " + escapeHTML((c.country_code || "") + " " + (c.phone || "")) + "</p>";
    row.appendChild(info);
    var btn = smallBtn(t("clients_email"), "btn-secondary", function () {
      openEmailModal(c.email);
    });
    row.appendChild(btn);
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
      info.innerHTML =
        "<p class='font-medium text-slate-800'>" + escapeHTML(u.name) + "</p>" +
        "<p class='text-sm text-slate-500'>" + escapeHTML(u.email) + " &middot; " + escapeHTML(roleLabel) + "</p>";
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

function renderVehiclesList(q) {
  var list = $("vehicles-list");
  var empty = $("vehicles-empty");
  var error = $("vehicles-error");
  if (!list) return;
  list.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  hideBox("vehicles-error");
  window.API.mechanic.listVehicles(q || "").then(function (vehicles) {
    if (vehicles.length === 0) {
      if (empty) empty.classList.remove("hidden");
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
      var visitsLabel = v.visits_count === 1 ? "1 " + t("vehicles_visits") : (v.visits_count + " " + t("vehicles_visits"));
      info.innerHTML =
        "<p class='font-medium text-slate-800'>" + escapeHTML(v.plate) + "</p>" +
        "<p class='text-sm text-slate-500 truncate'>" + escapeHTML(v.make + " " + v.model + (v.year ? " (" + v.year + ")" : "")) + " &middot; " + escapeHTML(visitsLabel) + "</p>";
      left.appendChild(info);
      row.appendChild(left);
      var arrow = document.createElement("span");
      arrow.className = "text-slate-400";
      arrow.textContent = "→";
      row.appendChild(arrow);
      row.addEventListener("click", function () {
        currentVehicleId = v.id;
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
    if (title) title.textContent = v.plate + " — " + v.make + " " + v.model;

    var top = document.createElement("div");
    top.className = "flex flex-col sm:flex-row gap-4";
    if (v.front_photo) {
      var img = document.createElement("img");
      img.src = v.front_photo;
      img.className = "w-40 h-40 rounded-xl object-cover border border-slate-200 cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(v.front_photo); });
      top.appendChild(img);
    }
    var info = document.createElement("div");
    info.className = "space-y-1 text-sm flex-1";
    info.innerHTML =
      "<p><span class='text-slate-500'>" + escapeHTML(t("vehicles_plate")) + ":</span> <span class='font-medium'>" + escapeHTML(v.plate) + "</span></p>" +
      "<p><span class='text-slate-500'>" + escapeHTML(t("vehicles_make")) + ":</span> " + escapeHTML(v.make || "—") + "</p>" +
      "<p><span class='text-slate-500'>" + escapeHTML(t("vehicles_model")) + ":</span> " + escapeHTML(v.model || "—") + "</p>" +
      "<p><span class='text-slate-500'>" + escapeHTML(t("vehicles_year")) + ":</span> " + escapeHTML(v.year || "—") + "</p>" +
      "<p><span class='text-slate-500'>" + escapeHTML(t("vehicles_color")) + ":</span> " + escapeHTML(v.color || "—") + "</p>";
    top.appendChild(info);
    body.appendChild(top);

    var visitsTitle = document.createElement("h3");
    visitsTitle.className = "text-lg font-semibold mt-6 mb-3";
    visitsTitle.textContent = t("visits_title");
    body.appendChild(visitsTitle);

    var visits = v.visits || [];
    if (visits.length === 0) {
      var p = document.createElement("p");
      p.className = "text-slate-500 text-sm";
      p.textContent = t("visits_empty");
      body.appendChild(p);
    } else {
      visits.forEach(function (vis) {
        var item = document.createElement("div");
        item.className = "rounded-xl border border-slate-200 p-4 bg-white cursor-pointer hover:shadow-sm flex items-center justify-between gap-3";
        var info2 = document.createElement("div");
        info2.innerHTML =
          "<p class='font-medium text-slate-800'>" + escapeHTML(vis.title) + "</p>" +
          "<p class='text-sm text-slate-500'>" + escapeHTML(String(vis.visit_date)) + " &middot; " + (vis.jobs ? vis.jobs.length : 0) + " " + escapeHTML(t("visits_job").toLowerCase()) + "</p>";
        item.appendChild(info2);
        var arrow = document.createElement("span");
        arrow.className = "text-slate-400";
        arrow.textContent = "→";
        item.appendChild(arrow);
        item.addEventListener("click", function () {
          openVisitView(vehicleId, vis);
        });
        body.appendChild(item);
      });
    }
  }).catch(function (err) {
    showErrorBox("vehicle-detail-error", err.message || t("error_generic"));
  });
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
   VISITS + JOBS
   ================================================================ */

function openVisitModal(vehicleId, visit, onSaved) {
  var editing = !!visit;
  var m = openModal(editing ? t("visits_edit_title") : t("visits_add_title"), "");
  var form = document.createElement("form");
  form.className = "space-y-4";

  var state = {
    mileage_photo: visit ? visit.mileage_photo : "",
    fuel_level_photo: visit ? visit.fuel_level_photo : "",
    condition_photos: visit ? Object.assign({}, visit.condition_photos || {}) : {},
    defect_photos: visit ? (visit.defect_photos || []).slice() : [],
    belongings_photos: visit ? (visit.belongings_photos || []).slice() : [],
  };
  var previewRefreshers = [];

  function fieldLabel(text) {
    var p = document.createElement("label");
    p.className = "field-label";
    p.textContent = text;
    return p;
  }

  function singlePhotoCell(key, label) {
    var wrap = document.createElement("div");
    wrap.appendChild(fieldLabel(label));
    var body = document.createElement("div");
    body.className = "flex flex-wrap items-center gap-2";
    function refresh() {
      var old = body.querySelector("img");
      if (old) old.remove();
      if (state[key]) {
        var img = document.createElement("img");
        img.className = "w-24 h-24 rounded-lg object-cover border border-slate-200 cursor-pointer";
        img.src = state[key];
        img.addEventListener("click", function () { viewPhoto(state[key]); });
        body.insertBefore(img, body.firstChild);
      }
    }
    previewRefreshers.push(refresh);
    refresh();
    body.appendChild(makeUploadButton(t("vehicles_choose_photo"), function (dataUrl) {
      state[key] = dataUrl;
      refresh();
    }));
    wrap.appendChild(body);
    return wrap;
  }

  function conditionCell(key) {
    var wrap = document.createElement("div");
    wrap.appendChild(fieldLabel({
      front: t("visits_cond_front"),
      left: t("visits_cond_left"),
      right: t("visits_cond_right"),
      rear: t("visits_cond_rear"),
    }[key]));
    var body = document.createElement("div");
    body.className = "flex flex-wrap items-center gap-2";
    function refresh() {
      var old = body.querySelector("img");
      if (old) old.remove();
      var src = state.condition_photos[key];
      if (src) {
        var img = document.createElement("img");
        img.className = "w-20 h-20 rounded-lg object-cover border border-slate-200 cursor-pointer";
        img.src = src;
        img.addEventListener("click", function () { viewPhoto(src); });
        body.insertBefore(img, body.firstChild);
      }
    }
    previewRefreshers.push(refresh);
    refresh();
    body.appendChild(makeUploadButton(t("vehicles_choose_photo"), function (dataUrl) {
      state.condition_photos[key] = dataUrl;
      refresh();
    }));
    wrap.appendChild(body);
    return wrap;
  }

  var copyHtml = "";
  if (!editing) copyHtml =
    '<div class="flex items-center gap-2">' +
    '<input id="visit-copy" type="checkbox" class="w-4 h-4">' +
    '<label for="visit-copy" class="text-sm text-slate-700">' + escapeHTML(t("visits_copy_label")) + "</label></div>";

  form.innerHTML =
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
    '<div><label class="field-label">' + escapeHTML(t("visits_title_label")) + '</label><input id="visit-title" type="text" class="field-input" value="' + escapeHTML(visit ? visit.title : "") + '" required></div>' +
    '<div><label class="field-label">' + escapeHTML(t("visits_date")) + '</label><input id="visit-date" type="date" class="field-input" value="' + (visit ? visit.visit_date : todayISO()) + '"></div>' +
    "</div>" +
    copyHtml;

  var sectionTitle = function (text) {
    var h = document.createElement("h4");
    h.className = "text-sm font-semibold text-slate-700 pt-1";
    h.textContent = text;
    return h;
  };

  form.appendChild(sectionTitle(t("visits_mileage_photo")));
  var topPhotos = document.createElement("div");
  topPhotos.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";
  topPhotos.appendChild(singlePhotoCell("mileage_photo", t("visits_mileage_photo")));
  topPhotos.appendChild(singlePhotoCell("fuel_level_photo", t("visits_fuel_photo")));
  form.appendChild(topPhotos);

  form.appendChild(sectionTitle(t("visits_condition_photos")));
  var condGrid = document.createElement("div");
  condGrid.className = "grid grid-cols-2 sm:grid-cols-4 gap-3";
  ["front", "left", "right", "rear"].forEach(function (k) {
    condGrid.appendChild(conditionCell(k));
  });
  form.appendChild(condGrid);

  form.appendChild(sectionTitle(t("visits_defect_photos")));
  var defectBox = document.createElement("div");
  var defectEl = document.createElement("div");
  defectEl.id = "defect-photos";
  defectEl.className = "flex flex-wrap gap-2";
  var defectAdd = makeUploadButton(t("visits_add_photo"), function (dataUrl) {
    state.defect_photos.push(dataUrl);
    renderDefects();
  });
  defectAdd.classList.add("mt-2");
  defectBox.appendChild(defectEl);
  defectBox.appendChild(defectAdd);
  form.appendChild(defectBox);

  var obsGrid = document.createElement("div");
  obsGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";
  var obsWrap = document.createElement("div");
  obsWrap.appendChild(fieldLabel(t("visits_observations")));
  var obsTa = document.createElement("textarea");
  obsTa.id = "visit-observations";
  obsTa.className = "field-input";
  obsTa.rows = 3;
  obsTa.value = visit ? visit.observations || "" : "";
  obsWrap.appendChild(obsTa);
  obsGrid.appendChild(obsWrap);
  var belongWrap = document.createElement("div");
  belongWrap.appendChild(fieldLabel(t("visits_belongings")));
  var belongTa = document.createElement("textarea");
  belongTa.id = "visit-belongings";
  belongTa.className = "field-input";
  belongTa.rows = 3;
  belongTa.value = visit ? visit.belongings || "" : "";
  belongWrap.appendChild(belongTa);
  obsGrid.appendChild(belongWrap);
  form.appendChild(obsGrid);

  form.appendChild(sectionTitle(t("visits_belongings_photos")));
  var belongBox = document.createElement("div");
  var belongingsEl = document.createElement("div");
  belongingsEl.id = "belongings-photos";
  belongingsEl.className = "flex flex-wrap gap-2";
  var belongAdd = makeUploadButton(t("visits_add_photo"), function (dataUrl) {
    state.belongings_photos.push(dataUrl);
    renderBelongings();
  });
  belongAdd.classList.add("mt-2");
  belongBox.appendChild(belongingsEl);
  belongBox.appendChild(belongAdd);
  form.appendChild(belongBox);

  var errBox = document.createElement("div");
  errBox.id = "visit-error";
  errBox.className = "hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3";
  form.appendChild(errBox);
  var submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn-primary w-full";
  submitBtn.textContent = t("vehicles_save");
  form.appendChild(submitBtn);

  m.body.appendChild(form);

  function renderMulti(listEl, arr, onChange) {
    listEl.innerHTML = "";
    arr.forEach(function (src, idx) {
      var wrap = document.createElement("div");
      wrap.className = "relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200";
      var img = document.createElement("img");
      img.src = src;
      img.className = "w-full h-full object-cover cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(src); });
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full leading-none";
      rm.textContent = "×";
      rm.addEventListener("click", function () {
        arr.splice(idx, 1);
        onChange();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      listEl.appendChild(wrap);
    });
  }

  function renderDefects() {
    renderMulti(defectEl, state.defect_photos, renderDefects);
  }
  function renderBelongings() {
    renderMulti(belongingsEl, state.belongings_photos, renderBelongings);
  }
  renderDefects();
  renderBelongings();

  var copyCheck = $("visit-copy");
  if (copyCheck) {
    copyCheck.addEventListener("change", function () {
      if (!copyCheck.checked) return;
      window.API.mechanic.getVehicle(vehicleId).then(function (v) {
        var prevs = (v.visits || []);
        if (!prevs.length) return;
        var last = prevs[0];
        state.mileage_photo = last.mileage_photo || "";
        state.fuel_level_photo = last.fuel_level_photo || "";
        state.condition_photos = Object.assign({}, last.condition_photos || {});
        state.defect_photos = (last.defect_photos || []).slice();
        state.belongings_photos = (last.belongings_photos || []).slice();
        renderDefects();
        renderBelongings();
        previewRefreshers.forEach(function (fn) { fn(); });
        flash(t("visits_copy_done"));
      }).catch(function () {});
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("visit-error");
    var title = $("visit-title").value.trim();
    if (!title) {
      showErrorBox("visit-error", t("visits_title_required"));
      return;
    }
    var payload = {
      title: title,
      visit_date: $("visit-date").value || todayISO(),
      mileage_photo: state.mileage_photo,
      fuel_level_photo: state.fuel_level_photo,
      condition_photos: state.condition_photos,
      defect_photos: state.defect_photos,
      observations: $("visit-observations").value,
      belongings: $("visit-belongings").value,
      belongings_photos: state.belongings_photos,
      jobs: visit ? (visit.jobs || []) : [],
    };
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    var promise = editing
      ? window.API.mechanic.updateVehicleVisit(visit.id, payload)
      : window.API.mechanic.addVehicleVisit(vehicleId, payload);
    promise.then(function () {
      btn.disabled = false;
      closeModal();
      if (onSaved) onSaved();
    }).catch(function (err) {
      btn.disabled = false;
      var msg = err.message || t("error_generic");
      if (/already exists/i.test(msg)) msg = t("visits_title_duplicate");
      showErrorBox("visit-error", msg);
    });
  });
}

function openVisitView(vehicleId, visit) {
  var m = openModal(visit.title, "");
  var tabs = document.createElement("div");
  tabs.className = "flex gap-2 mb-4 border-b border-slate-200";
  var tabVal = document.createElement("button");
  tabVal.type = "button";
  tabVal.className = "px-4 py-2 text-sm font-semibold border-b-2 border-brand-600 text-brand-700";
  tabVal.textContent = t("visits_tab_valoracion");
  var tabJobs = document.createElement("button");
  tabJobs.type = "button";
  tabJobs.className = "px-4 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700";
  tabJobs.textContent = t("visits_tab_jobs");
  tabs.appendChild(tabVal);
  tabs.appendChild(tabJobs);
  m.body.appendChild(tabs);

  var panelVal = document.createElement("div");
  var panelJobs = document.createElement("div");
  panelJobs.classList.add("hidden");
  m.body.appendChild(panelVal);
  m.body.appendChild(panelJobs);

  var actions = document.createElement("div");
  actions.className = "flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-200";
  var editVisit = smallBtn(t("visits_edit_valoracion"), "btn-secondary", function () {
    closeModal();
    openVisitModal(vehicleId, visit, function () {
      renderVehicleDetail(vehicleId);
      flash(t("visits_updated"));
    });
  });
  var delVisit = smallBtn(t("visits_delete"), "btn-danger", function () {
    showConfirm(t("visits_delete_confirm")).then(function (ok) {
      if (!ok) return;
      window.API.mechanic.deleteVehicleVisit(visit.id).then(function () {
        closeModal();
        renderVehicleDetail(vehicleId);
        flash(t("visits_deleted"));
      }).catch(function (err) { flash(err.message, true); });
    });
  });
  actions.appendChild(editVisit);
  actions.appendChild(delVisit);
  m.body.appendChild(actions);

  function renderValoracion() {
    panelVal.innerHTML = "";
    var grid = document.createElement("div");
    grid.className = "grid grid-cols-2 sm:grid-cols-3 gap-3";
    var items = [];
    if (visit.mileage_photo) items.push({ label: t("visits_mileage_photo"), src: visit.mileage_photo });
    if (visit.fuel_level_photo) items.push({ label: t("visits_fuel_photo"), src: visit.fuel_level_photo });
    var condLabels = { front: t("visits_cond_front"), left: t("visits_cond_left"), right: t("visits_cond_right"), rear: t("visits_cond_rear") };
    ["front", "left", "right", "rear"].forEach(function (k) {
      if (visit.condition_photos && visit.condition_photos[k]) {
        items.push({ label: condLabels[k], src: visit.condition_photos[k] });
      }
    });
    if (items.length === 0) {
      var p = document.createElement("p");
      p.className = "text-slate-500 text-sm";
      p.textContent = t("visits_no_photos");
      grid.appendChild(p);
    }
    items.forEach(function (it) {
      var cell = document.createElement("div");
      cell.innerHTML = "<p class='text-xs font-medium text-slate-500 mb-1'>" + escapeHTML(it.label) + "</p>";
      var img = document.createElement("img");
      img.src = it.src;
      img.className = "w-full h-24 object-cover rounded-lg border border-slate-200 cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(it.src); });
      cell.appendChild(img);
      grid.appendChild(cell);
    });
    panelVal.appendChild(grid);

    if (visit.defect_photos && visit.defect_photos.length) {
      var dh = document.createElement("h4");
      dh.className = "font-semibold text-slate-700 mt-4 mb-2";
      dh.textContent = t("visits_defect_photos");
      panelVal.appendChild(dh);
      var dgrid = document.createElement("div");
      dgrid.className = "flex flex-wrap gap-2";
      visit.defect_photos.forEach(function (src) {
        var thumb = photoThumb(src, function () { viewPhoto(src); });
        dgrid.appendChild(thumb);
      });
      panelVal.appendChild(dgrid);
    }

    if (visit.belongings_photos && visit.belongings_photos.length) {
      var bh = document.createElement("h4");
      bh.className = "font-semibold text-slate-700 mt-4 mb-2";
      bh.textContent = t("visits_belongings_photos");
      panelVal.appendChild(bh);
      var bgrid = document.createElement("div");
      bgrid.className = "flex flex-wrap gap-2";
      visit.belongings_photos.forEach(function (src) {
        bgrid.appendChild(photoThumb(src, function () { viewPhoto(src); }));
      });
      panelVal.appendChild(bgrid);
    }

    if (visit.observations) {
      panelVal.appendChild(sectionText(t("visits_observations"), visit.observations));
    }
    if (visit.belongings) {
      panelVal.appendChild(sectionText(t("visits_belongings"), visit.belongings));
    }
  }

  function renderJobs() {
    panelJobs.innerHTML = "";
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-secondary mb-3";
    addBtn.textContent = t("visits_add_job");
    addBtn.addEventListener("click", function () {
      openJobModal(visit, function (jobs) {
        visit.jobs = jobs;
        renderJobs();
      });
    });
    panelJobs.appendChild(addBtn);

    if (!visit.jobs || visit.jobs.length === 0) {
      var p = document.createElement("p");
      p.className = "text-slate-500 text-sm";
      p.textContent = t("visits_no_jobs");
      panelJobs.appendChild(p);
      return;
    }
    visit.jobs.forEach(function (job, idx) {
      var card = document.createElement("div");
      card.className = "rounded-lg border border-slate-200 p-4 mb-3";
      if (job.diagnostic) {
        card.appendChild(sectionText(t("visits_diagnostic"), job.diagnostic));
      }
      if (job.observations) {
        card.appendChild(sectionText(t("visits_observations"), job.observations));
      }
      if (job.photos && job.photos.length) {
        var grid = document.createElement("div");
        grid.className = "flex flex-wrap gap-2 mt-2";
        job.photos.forEach(function (src) {
          grid.appendChild(photoThumb(src, function () { viewPhoto(src); }));
        });
        card.appendChild(grid);
      }
      var row = document.createElement("div");
      row.className = "flex gap-2 mt-3";
      var editBtn = smallBtn(t("users_edit"), "btn-secondary", function () {
        openJobModal(visit, function (jobs) {
          visit.jobs = jobs;
          renderJobs();
        }, idx);
      });
      var delBtn = smallBtn(t("announce_delete"), "btn-danger", function () {
        showConfirm(t("jobs_delete_confirm")).then(function (ok) {
          if (!ok) return;
          visit.jobs.splice(idx, 1);
          saveJobs(visit, function () { renderJobs(); });
        });
      });
      row.appendChild(editBtn);
      row.appendChild(delBtn);
      card.appendChild(row);
      panelJobs.appendChild(card);
    });
  }

  function saveJobs(v, done) {
    window.API.mechanic.updateVehicleVisit(v.id, { jobs: v.jobs || [] }).then(function () {
      if (done) done();
    }).catch(function (err) {
      flash(err.message, true);
    });
  }

  tabVal.addEventListener("click", function () {
    tabVal.className = "px-4 py-2 text-sm font-semibold border-b-2 border-brand-600 text-brand-700";
    tabJobs.className = "px-4 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700";
    panelVal.classList.remove("hidden");
    panelJobs.classList.add("hidden");
  });
  tabJobs.addEventListener("click", function () {
    tabJobs.className = "px-4 py-2 text-sm font-semibold border-b-2 border-brand-600 text-brand-700";
    tabVal.className = "px-4 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700";
    panelJobs.classList.remove("hidden");
    panelVal.classList.add("hidden");
  });

  renderValoracion();
  renderJobs();
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

function openJobModal(visit, onSave, editIndex) {
  var editing = editIndex !== undefined;
  var job = editing ? visit.jobs[editIndex] : { diagnostic: "", observations: "", photos: [] };
  var m = openModal(editing ? t("jobs_edit_title") : t("jobs_add_title"), "");
  var form = document.createElement("form");
  form.className = "space-y-4";
  form.innerHTML =
    '<div><label class="field-label">' + escapeHTML(t("visits_diagnostic")) + '</label><textarea id="job-diag" class="field-input" rows="3">' + escapeHTML(job.diagnostic || "") + "</textarea></div>" +
    '<div><label class="field-label">' + escapeHTML(t("visits_observations")) + '</label><textarea id="job-obs" class="field-input" rows="2">' + escapeHTML(job.observations || "") + "</textarea></div>" +
    '<div><label class="field-label">' + escapeHTML(t("visits_job_photos")) + "</label>" +
    '<div id="job-photos" class="flex flex-wrap gap-2"></div>' +
    '<button type="button" class="btn-secondary mt-2" id="job-add-photo">' + escapeHTML(t("visits_add_photo")) + "</button></div>" +
    '<div id="job-error" class="hidden rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3"></div>' +
    '<button type="submit" class="btn-primary w-full">' + escapeHTML(t("vehicles_save")) + "</button>";
  m.body.appendChild(form);

  var photos = (job.photos || []).slice();
  var photosEl = $("job-photos");

  function renderJobPhotos() {
    photosEl.innerHTML = "";
    photos.forEach(function (src, idx) {
      var wrap = document.createElement("div");
      wrap.className = "relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200";
      var img = document.createElement("img");
      img.src = src;
      img.className = "w-full h-full object-cover cursor-pointer";
      img.addEventListener("click", function () { viewPhoto(src); });
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 rounded-full leading-none";
      rm.textContent = "×";
      rm.addEventListener("click", function () {
        photos.splice(idx, 1);
        renderJobPhotos();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      photosEl.appendChild(wrap);
    });
  }
  renderJobPhotos();

  $("job-add-photo").addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      fileToDataURL(input, 3 * 1024 * 1024, function (dataUrl) {
        photos.push(dataUrl);
        renderJobPhotos();
      });
      input.remove();
    });
    input.click();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideBox("job-error");
    var newJob = {
      diagnostic: $("job-diag").value,
      observations: $("job-obs").value,
      photos: photos,
    };
    var jobs = (visit.jobs || []).slice();
    if (editing) jobs[editIndex] = newJob;
    else jobs.push(newJob);
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    window.API.mechanic.updateVehicleVisit(visit.id, { jobs: jobs }).then(function () {
      btn.disabled = false;
      closeModal();
      onSave(jobs);
    }).catch(function (err) {
      btn.disabled = false;
      showErrorBox("job-error", err.message || t("error_generic"));
    });
  });
}

/* ================================================================
   SETTINGS
   ================================================================ */

var settingsDays = [];
var applySelections = {};
var apptTimeState = { unit: "hours", value: 2 };
var gmailLoaded = false;
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
        if (name === "integrations") initGmail();
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
  }).catch(function (err) {
    showErrorBox("settings-error", err.message || t("error_generic"));
  });
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
  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = active ? "btn-primary !px-4 !py-1.5 text-sm" : "btn-secondary !px-4 !py-1.5 text-sm";
  toggle.textContent = active ? t("announce_active") : t("users_inactive");
  toggle.addEventListener("click", function () {
    if (active) {
      settingsDays = settingsDays.filter(function (d) { return d.day !== day; });
    } else {
      settingsDays.push({ day: day, start_time: "08:00", end_time: "17:00", lunch_start: null, lunch_end: null });
    }
    renderSettingsDays();
  });
  head.appendChild(toggle);
  row.appendChild(head);

  if (active) {
    var timeRow = document.createElement("div");
    timeRow.className = "mt-3 flex flex-wrap items-center gap-3";
    var startWrap = document.createElement("div");
    startWrap.innerHTML = "<p class='text-xs font-medium text-slate-500 mb-1'>" + escapeHTML(t("settings_start_time")) + "</p>";
    var startSel = document.createElement("div");
    startWrap.appendChild(startSel);
    timeRow.appendChild(startWrap);
    var endWrap = document.createElement("div");
    endWrap.innerHTML = "<p class='text-xs font-medium text-slate-500 mb-1'>" + escapeHTML(t("settings_end_time")) + "</p>";
    var endSel = document.createElement("div");
    endWrap.appendChild(endSel);
    timeRow.appendChild(endWrap);
    row.appendChild(timeRow);
    buildTimePicker(startSel, entry.start_time, function (v) {
      entry.start_time = v;
      renderSettingsDays();
    });
    buildTimePicker(endSel, entry.end_time, function (v) {
      entry.end_time = v;
      renderSettingsDays();
    });

    var lunchBtn = document.createElement("button");
    lunchBtn.type = "button";
    lunchBtn.className = active ? "mt-3 btn-secondary text-sm" : "mt-3 btn-secondary text-sm";
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
      lunchRow.className = "mt-2 flex flex-wrap items-center gap-3";
      var lsWrap = document.createElement("div");
      lsWrap.innerHTML = "<p class='text-xs font-medium text-slate-500 mb-1'>" + escapeHTML(t("settings_lunch_start")) + "</p>";
      var lsSel = document.createElement("div");
      lsWrap.appendChild(lsSel);
      lunchRow.appendChild(lsWrap);
      var leWrap = document.createElement("div");
      leWrap.innerHTML = "<p class='text-xs font-medium text-slate-500 mb-1'>" + escapeHTML(t("settings_lunch_end")) + "</p>";
      var leSel = document.createElement("div");
      leWrap.appendChild(leSel);
      lunchRow.appendChild(leWrap);
      row.appendChild(lunchRow);
      buildTimePicker(lsSel, entry.lunch_start, function (v) {
        entry.lunch_start = v;
        renderSettingsDays();
      });
      buildTimePicker(leSel, entry.lunch_end, function (v) {
        entry.lunch_end = v;
        renderSettingsDays();
      });
    }

    var others = settingsDays.filter(function (d) { return d.day !== day; });
    if (others.length) {
      var applyBlock = document.createElement("div");
      applyBlock.className = "mt-4 pt-3 border-t border-slate-100";
      var q = document.createElement("p");
      q.className = "text-sm font-medium text-slate-700 mb-2";
      q.textContent = t("settings_apply_question");
      applyBlock.appendChild(q);
      var chips = document.createElement("div");
      chips.className = "flex flex-wrap gap-2 mb-3";
      others.forEach(function (d) {
        var key = day + "_" + d.day;
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "px-3 py-1.5 rounded-full border text-sm " +
          (applySelections[key] ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50");
        chip.textContent = dayLabel(d.day);
        chip.addEventListener("click", function () {
          applySelections[key] = !applySelections[key];
          renderSettingsDays();
        });
        chips.appendChild(chip);
      });
      applyBlock.appendChild(chips);
      var applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "btn-secondary text-sm";
      applyBtn.textContent = t("settings_apply");
      applyBtn.addEventListener("click", function () {
        var applied = false;
        others.forEach(function (d) {
          var key = day + "_" + d.day;
          if (applySelections[key]) {
            var targetEntry = null;
            for (var i = 0; i < settingsDays.length; i++) {
              if (settingsDays[i].day === d.day) { targetEntry = settingsDays[i]; break; }
            }
            if (targetEntry) {
              targetEntry.start_time = entry.start_time;
              targetEntry.end_time = entry.end_time;
              targetEntry.lunch_start = entry.lunch_start;
              targetEntry.lunch_end = entry.lunch_end;
            }
            applySelections[key] = false;
            applied = true;
          }
        });
        if (applied) flash(t("settings_apply_done"));
        renderSettingsDays();
      });
      applyBlock.appendChild(applyBtn);
      row.appendChild(applyBlock);
    }
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
  if (pickerBtn) {
    pickerBtn.onclick = function () {
      openDatePicker(function (dateStr) {
        var sel = $("day-off-selected");
        if (sel) {
          sel.textContent = formatLongDate(dateStr);
          sel.dataset.value = dateStr;
        }
      });
    };
  }
  var addBtn = $("day-off-add");
  if (addBtn) addBtn.onclick = addDayOff;
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
      var reason = d.reason ? " — " + d.reason : "";
      txt.innerHTML = "<span class='text-sm text-slate-700 font-medium'>" + escapeHTML(formatLongDate(d.day_off)) + "</span><span class='text-xs text-slate-500'>" + escapeHTML(reason) + "</span>";
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

function addDayOff() {
  var sel = $("day-off-selected");
  var dateStr = sel ? sel.dataset.value : "";
  if (!dateStr) {
    showErrorBox("days-off-error", t("settings_days_off_required"));
    return;
  }
  var reason = $("day-off-reason") ? $("day-off-reason").value.trim() : "";
  hideBox("days-off-error");
  var btn = $("day-off-add");
  if (btn) btn.disabled = true;
  window.API.mechanic.addDayOff({ day_off: dateStr, reason: reason }).then(function () {
    if (btn) btn.disabled = false;
    if (sel) { sel.textContent = ""; delete sel.dataset.value; }
    var reasonInput = $("day-off-reason");
    if (reasonInput) reasonInput.value = "";
    loadDaysOff();
    flash("Día libre agregado.");
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    showErrorBox("days-off-error", err.message || t("error_generic"));
  });
}

function openDatePicker(onSelect) {
  var m = openModal(t("settings_days_off_pick"), "");
  var year = new Date().getFullYear();
  var month = new Date().getMonth();
  var monthNames = monthNamesES();
  var dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  function render() {
    var head = document.createElement("div");
    head.className = "flex items-center justify-between mb-3";
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
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div"));
    for (var d = 1; d <= daysInMonth; d++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-sm";
      cell.textContent = d;
      let ds = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      cell.addEventListener("click", function () {
        closeModal();
        onSelect(ds);
      });
      grid.appendChild(cell);
    }
    m.body.appendChild(grid);

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

  var badge = document.createElement("span");
  if (s.activated) {
    badge.className = "inline-flex items-center rounded-full bg-green-100 text-green-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("gmail_active");
  } else if (s.configured) {
    badge.className = "inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1";
    badge.textContent = t("gmail_saved_msg");
  } else {
    badge.className = "inline-flex items-center rounded-full bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1";
    badge.textContent = t("integrations_soon");
  }
  status.appendChild(badge);

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

/* ================================================================
   LANDING + BACK BUTTONS
   ================================================================ */

function attachLandingButtonListeners() {
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

  var vehDetailAddVisit = $("vehicle-detail-add-visit");
  if (vehDetailAddVisit) {
    vehDetailAddVisit.addEventListener("click", function () {
      if (!currentVehicleId) return;
      openVisitModal(currentVehicleId, null, function () {
        renderVehicleDetail(currentVehicleId);
        flash(t("visits_created"));
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
        showView(btn.view);
        if (btn.view === "vehicles") renderVehiclesList();
        if (btn.view === "calendar") renderCal();
      });
    }
  });
}

/* ================================================================
   INITIALIZATION
   ================================================================ */

function restoreView() {
  var v = localStorage.getItem("mechanic_current_view");
  if (!v || v === "landing") return;
  if (v === "calendar") { showView("calendar"); renderCal(); }
  else if (v === "announce") { showView("announce"); initAnnouncementForm(); loadAnnouncements(); }
  else if (v === "settings") { showView("settings"); initSettingsView(); }
  else if (v === "clients") { showView("clients"); loadClients(); }
  else if (v === "users") { showView("users"); loadUsers(); }
  else if (v === "vehicles") { showView("vehicles"); renderVehiclesList(); }
  else if (v === "vehicle-detail") {
    var id = localStorage.getItem("mechanic_current_vehicle");
    if (id) {
      currentVehicleId = Number(id);
      showView("vehicle-detail");
      renderVehicleDetail(currentVehicleId);
    }
  }
}

function initDashboard() {
  ensureMechanicAuth().then(function (u) {
    var userEl = $("account-menu-user");
    if (userEl) {
      var roleLabel = u.role === "admin" ? t("users_role_admin") : t("users_role_mechanic");
      userEl.textContent = u.name + " · " + roleLabel;
    }
    var usersBtn = $("landing-users");
    if (usersBtn) {
      if (u.role === "admin") usersBtn.classList.remove("hidden");
      else usersBtn.classList.add("hidden");
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
