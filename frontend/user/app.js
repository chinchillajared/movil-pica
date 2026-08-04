function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function dayScheduleFor(schedule, dayOfWeek) {
  var found = null;
  (schedule.days || []).forEach(function (d) {
    if (d.day === dayOfWeek) found = d;
  });
  return found;
}

function toMinutes(hhmm) {
  return parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10);
}

function buildTimeSlotsFor(daySch) {
  if (!daySch) return [];
  var start = toMinutes(daySch.start_time);
  var end = toMinutes(daySch.end_time);
  var ls = daySch.lunch_start ? toMinutes(daySch.lunch_start) : null;
  var le = daySch.lunch_end ? toMinutes(daySch.lunch_end) : null;
  var out = [];
  for (var m = 0; m < 1440; m += 60) {
    if (m < start || m >= end) continue;
    if (ls !== null && le !== null && m >= ls && m < le) continue;
    var h = m / 60;
    var h12 = h % 12 || 12;
    var ampm = h < 12 ? "am" : "pm";
    out.push({ label: h12 + ":00" + ampm, value: ("0" + h).slice(-2) + ":00" });
  }
  return out;
}

function showError(formEl, message) {
  const box = formEl.querySelector("#form-error");
  if (!box) {
    showMessage(message);
    return;
  }
  box.textContent = message;
  box.classList.remove("hidden");
}

function hideError(formEl) {
  const box = formEl.querySelector("#form-error");
  if (box) box.classList.add("hidden");
}

function clearFieldErrors(formEl) {
  formEl.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = "";
    el.classList.add("hidden");
  });
}

function setFieldError(formEl, name, message) {
  const el = formEl.querySelector(`[data-error-for="${name}"]`);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
}

function statusBadgeClass(status) {
  return {
    pending: "badge-pending",
    confirmed: "badge-confirmed",
    completed: "badge-completed",
    cancelled: "badge-cancelled",
  }[status] || "badge-pending";
}

function statusKey(status) {
  return "status_" + status;
}

function initSchedule() {
  setupPhoneCodeDropdown();
  var state = { dateStr: "", hour: "" };
  var calMonth = new Date().getMonth();
  var calYear = new Date().getFullYear();
  var editExcludeDate = null;
  var editExcludeTime = null;
  var editExcludeNumber = null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayMs = today.getTime();

  var schedule = { days: [
    { day: 1, start_time: "08:00", end_time: "17:00" },
    { day: 2, start_time: "08:00", end_time: "17:00" },
    { day: 3, start_time: "08:00", end_time: "17:00" },
    { day: 4, start_time: "08:00", end_time: "17:00" },
    { day: 5, start_time: "08:00", end_time: "17:00" },
    { day: 6, start_time: "08:00", end_time: "17:00" }
  ] };

  function loadSchedule(cb) {
    window.API.public.getSchedule().then(function (s) {
      if (s && s.days && s.days.length) schedule = s;
      cb();
    }).catch(function () {
      cb();
    });
  }

  function showStep(n) {
    for (var i = 1; i <= 3; i++) {
      document.getElementById("step-" + i).classList.toggle("hidden", i !== n);
    }
    var dots = document.querySelectorAll("#step-indicator > .w-9");
    var lines = document.querySelectorAll("#step-indicator > .h-1");
    dots.forEach(function (dot, i) {
      var num = i + 1;
      dot.textContent = num;
      dot.className = "w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm " +
        (num <= n ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600");
    });
    lines.forEach(function (line, i) {
      line.className = "h-1 w-8 rounded-full " + (i + 1 < n ? "bg-brand-600" : "bg-slate-200");
    });
  }

  /* ---------- CALENDAR ---------- */

  function renderCalendar(month, year) {
    window.API.public.getTakenDates(year, month + 1, editExcludeNumber).then(function (takenDates) {
      if (editExcludeDate) {
        takenDates = takenDates.filter(function (d) { return d !== editExcludeDate; });
      }
      drawCalendar(month, year, takenDates);
    }).catch(function () {
      drawCalendar(month, year, []);
    });
  }

  function drawCalendar(month, year, takenDates) {
    var lang = window.I18N.lang;
    var takenSet = {};
    takenDates.forEach(function (d) { takenSet[d] = true; });

    var monthName = new Date(year, month).toLocaleDateString(lang, { month: "long" });
    document.getElementById("cal-month-year").textContent = monthName + " " + year;

    var headerRow = document.getElementById("cal-day-headers");
    headerRow.innerHTML = "";
    var ref = new Date(2017, 0, 1);
    for (var i = 0; i < 7; i++) {
      var d = new Date(ref);
      d.setDate(ref.getDate() + i);
      var el = document.createElement("div");
      el.className = "text-xs font-semibold text-slate-500 uppercase py-1 tracking-wide";
      el.textContent = d.toLocaleDateString(lang, { weekday: "short" });
      headerRow.appendChild(el);
    }

    var grid = document.getElementById("cal-days");
    grid.innerHTML = "";
    var firstDow = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    for (var i = 0; i < firstDow; i++) {
      grid.appendChild(document.createElement("div"));
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.textContent = day.toString();

      var date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      var isToday = date.getTime() === todayMs;
      var isPast = date.getTime() < todayMs;
      var daySch = dayScheduleFor(schedule, date.getDay());
      var isWorking = !!daySch;
      var ds = year + "-" + zero(month + 1) + "-" + zero(day);
      var isSelected = state.dateStr === ds;
      var isTaken = takenSet[ds];
      var isEditDate = editExcludeDate === ds;
      var timeNow = new Date();
      var dayTimes = buildTimeSlotsFor(daySch);
      var lastSlot = dayTimes.length
        ? parseInt(dayTimes[dayTimes.length - 1].value.split(":")[0]) * 60 + parseInt(dayTimes[dayTimes.length - 1].value.split(":")[1])
        : 0;
      var allPassed = isWorking && isToday && (timeNow.getHours() * 60 + timeNow.getMinutes() + 60) > lastSlot;

      var disabled = isPast || !isWorking || isTaken || allPassed;
      if (isEditDate) disabled = false;

      cell.className = "w-full py-2 rounded-lg text-sm font-medium transition";
      if (disabled) {
        cell.className += " text-slate-300 cursor-not-allowed";
        cell.disabled = true;
      } else if (isSelected) {
        cell.className += " bg-brand-600 text-white";
      } else if (isToday) {
        cell.className += " bg-brand-50 text-brand-700 font-bold border border-brand-300";
      } else {
        cell.className += " bg-green-50 hover:bg-green-100 text-slate-800 cursor-pointer border border-green-200";
      }

      cell.addEventListener("click", (function (ds) {
        return function () {
          state.dateStr = ds;
          renderCalendar(calMonth, calYear);
        };
      })(ds));

      grid.appendChild(cell);
    }

    var now = new Date();
    document.getElementById("cal-prev").disabled = (year === now.getFullYear() && month === now.getMonth());
    var p = document.getElementById("cal-prev");
    if (p.disabled) {
      p.className = "w-10 h-10 rounded-full flex items-center justify-center text-2xl font-bold text-slate-300 cursor-not-allowed";
    } else {
      p.className = "w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 text-2xl font-bold text-slate-600 transition";
    }
  }

  function zero(n) { return n < 10 ? "0" + n : "" + n; }

  function navigateCal(delta) {
    calMonth += delta;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar(calMonth, calYear);
  }

  document.getElementById("cal-prev").addEventListener("click", function () { navigateCal(-1); });
  document.getElementById("cal-next").addEventListener("click", function () { navigateCal(1); });

  loadSchedule(function () { renderCalendar(calMonth, calYear); });

  window.refreshScheduleCalendar = function () {
    loadSchedule(function () {
      var step1 = document.getElementById("step-1");
      if (step1 && !step1.classList.contains("hidden")) {
        renderCalendar(calMonth, calYear);
      }
      if (state.dateStr) {
        fetchTakenTimes(state.dateStr).then(function () {
          var step2 = document.getElementById("step-2");
          if (step2 && !step2.classList.contains("hidden")) {
            renderTimeButtons();
          }
        });
      }
    });
  };

  /* ---------- TAKEN TIMES ---------- */

  var takenTimes = [];

  function fetchTakenTimes(dateStr) {
    takenTimes = [];
    return window.API.public.getAppointmentTimes(dateStr).then(function (list) {
      takenTimes = list || [];
    }).catch(function () {
      takenTimes = [];
    });
  }

  /* Step 1 — Next */
  document.getElementById("step1-next").addEventListener("click", function () {
    var err = document.getElementById("step1-error");
    if (!state.dateStr) {
      err.textContent = window.I18N.t("error_required");
      err.classList.remove("hidden");
      return;
    }
    err.classList.add("hidden");
    document.getElementById("step2-date-display").textContent = formatAppDate(state.dateStr);
    fetchTakenTimes(state.dateStr).then(function () {
      if (editExcludeTime) {
        takenTimes = takenTimes.filter(function (t) { return t !== editExcludeTime; });
      }
      renderTimeButtons();
      showStep(2);
    });
  });

  /* ---------- TIME ---------- */

  function isToday(dateStr) {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return dateStr === y + "-" + m + "-" + day;
  }

  function isPastTime(timeStr) {
    var now = new Date();
    var parts = timeStr.split(":");
    var slotMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    var curMin = now.getHours() * 60 + now.getMinutes() + 60;
    return slotMin < curMin;
  }

  function renderTimeButtons() {
    var grid = document.getElementById("hour-grid");
    grid.innerHTML = "";
    var today = isToday(state.dateStr);
    var takenSet = {};
    takenTimes.forEach(function (t) { takenSet[t] = true; });
    var d = new Date(state.dateStr + "T12:00:00");
    var times = buildTimeSlotsFor(dayScheduleFor(schedule, d.getDay()));
    times.forEach(function (t) {
      var isTaken = takenSet[t.value] === true || (today && isPastTime(t.value));
      var btn = document.createElement("button");
      btn.type = "button";
      if (isTaken) {
        btn.className = "py-4 rounded-xl border-2 border-slate-200 font-semibold text-lg bg-slate-100 text-slate-300 cursor-not-allowed";
        btn.disabled = true;
      } else {
        btn.className = "py-4 rounded-xl border-2 border-slate-300 font-semibold text-lg bg-white hover:bg-slate-50 transition text-slate-800";
      }
      btn.textContent = t.label;
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        state.hour = t.value;
        grid.querySelectorAll("button").forEach(function (b) {
          if (!b.disabled) {
            b.className = "py-4 rounded-xl border-2 border-slate-300 font-semibold text-lg bg-white hover:bg-slate-50 transition text-slate-800";
          }
        });
        btn.className = "py-4 rounded-xl border-2 border-brand-600 bg-brand-50 text-brand-700 font-semibold text-lg";
      });
      grid.appendChild(btn);
    });
  }

  renderTimeButtons();

  document.getElementById("step2-back").addEventListener("click", function () { showStep(1); });
  document.getElementById("step2-next").addEventListener("click", function () {
    var err = document.getElementById("step2-error");
    if (!state.hour) {
      err.textContent = window.I18N.t("error_required");
      err.classList.remove("hidden");
      return;
    }
    err.classList.add("hidden");
    document.getElementById("final-date-display").textContent = formatAppDate(state.dateStr);
    var parts = state.hour.split(":");
    var h = parseInt(parts[0], 10);
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    document.getElementById("final-time-display").textContent = h + ":" + parts[1] + ampm;
    showStep(3);
  });

  /* ---------- LOCATION ---------- */

  var locBtn = document.getElementById("share-location");
  var locStatus = document.getElementById("location-status");
  var addressInput = document.getElementById("address");
  var mapsLink = document.getElementById("maps-link");

  function updateMapsLink() {
    if (addressInput.value.trim()) {
      mapsLink.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addressInput.value.trim());
      mapsLink.classList.remove("hidden");
    } else {
      mapsLink.classList.add("hidden");
    }
  }

  addressInput.addEventListener("input", updateMapsLink);

  locBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      locStatus.textContent = "Geolocation not available";
      locStatus.classList.remove("hidden");
      return;
    }
    locBtn.disabled = true;
    locBtn.innerHTML = '<span aria-hidden="true">&#8987;</span> Locating...';
    locStatus.classList.add("hidden");

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var coords = pos.coords.latitude.toFixed(6) + "," + pos.coords.longitude.toFixed(6);
        addressInput.value = coords;
        updateMapsLink();
        locBtn.innerHTML = '<span aria-hidden="true">&#9989;</span> Location shared';
        locBtn.className = "btn-secondary w-full flex items-center justify-center gap-2 !border-green-500 !text-green-700";
        locStatus.textContent = coords;
        locStatus.className = "text-xs text-slate-500 mt-1 text-center font-mono";
      },
      function () {
        locBtn.disabled = false;
        locBtn.innerHTML = '<span aria-hidden="true">&#128205;</span> Share current location';
        locStatus.textContent = "Could not get location. Try again.";
        locStatus.className = "text-xs text-red-600 mt-1 text-center";
      }
    );
  });

  /* STEP 3 — back */
  document.getElementById("step3-back").addEventListener("click", function () { showStep(2); });

  /* FORM SUBMIT */
  var form = document.getElementById("schedule-form");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearFieldErrors(form);
    hideError(form);

    var t = window.I18N.t.bind(window.I18N);
    var data = {
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
      phone: form.phone.value.trim(),
      country_code: document.getElementById("phone-code-btn").getAttribute("data-value"),
      email: (document.getElementById("email") ? document.getElementById("email").value.trim() : "") || undefined,
      plate: form.plate.value.trim().toUpperCase(),
      appointment_date: state.dateStr,
      appointment_time: state.hour,
      address: addressInput.value,
    };

    var ok = true;
    if (!data.first_name)  { setFieldError(form, "first_name", t("error_required")); ok = false; }
    if (!data.last_name)   { setFieldError(form, "last_name",  t("error_required")); ok = false; }
    if (!data.phone)       { setFieldError(form, "phone",      t("error_required")); ok = false; }
    else if (!/^[\d\s\-()]{4,20}$/.test(data.phone)) {
      setFieldError(form, "phone", t("error_phone")); ok = false;
    }
    if (!data.plate)       { setFieldError(form, "plate",      t("error_required")); ok = false; }
    if (!ok) return;

    showLoading();
    var editNumber = new URLSearchParams(location.search).get("edit");
    try {
      var res;
      if (editNumber) {
        res = await window.API.public.updateAppointment(editNumber, {
          phone: data.phone,
          plate: data.plate,
          first_name: data.first_name,
          last_name: data.last_name,
          new_phone: data.phone,
          new_country_code: data.country_code,
          appointment_date: data.appointment_date,
          appointment_time: data.appointment_time,
          address: data.address,
        });
      } else {
        res = await window.API.public.createAppointment(data);
      }
      [1, 2, 3].forEach(function (i) { document.getElementById("step-" + i).classList.add("hidden"); });
      document.getElementById("step-indicator").classList.add("hidden");
      document.getElementById("appt-number").textContent = res.appointment_number;
      document.getElementById("appt-plate").textContent = res.plate;
      document.getElementById("success-card").classList.remove("hidden");
      hideLoading();
    } catch (err) {
      hideLoading();
      showError(form, err.message || t("error_generic"));
    }
  });

  /* ---------- EDIT MODE ---------- */
  var params = new URLSearchParams(location.search);
  var editNumber = params.get("edit");
  if (editNumber) {
    var editPhone = params.get("phone");
    var editPlate = params.get("plate");
    if (editPhone && editPlate) {
      window.API.public.lookupAppointment(editPhone, editPlate).then(function (a) {
        form.first_name.value = a.first_name;
        form.last_name.value = a.last_name;
        var pcBtn = document.getElementById("phone-code-btn");
        pcBtn.setAttribute("data-value", a.country_code || "+506");
        var known = { "+506": "🇨🇷", "+1": "🇺🇸" };
        pcBtn.childNodes[0].textContent = (known[a.country_code] || "") + " " + (a.country_code || "+506");
        form.phone.value = a.phone;
        form.plate.value = a.plate;
        editExcludeDate = a.appointment_date;
        editExcludeTime = a.appointment_time.slice(0, 5);
        editExcludeNumber = editNumber;
        state.dateStr = a.appointment_date;
        state.hour = a.appointment_time.slice(0, 5);
        addressInput.value = a.address || "";
        if (a.address && /^-?\d+\.\d+,-?\d+\.\d+$/.test(a.address)) {
          locBtn.innerHTML = '<span aria-hidden="true">&#9989;</span> Location shared';
          locBtn.className = "btn-secondary w-full flex items-center justify-center gap-2 !border-green-500 !text-green-700";
          locStatus.textContent = a.address;
          locStatus.className = "text-xs text-slate-500 mt-1 text-center font-mono";
          updateMapsLink();
        }
        var d = new Date(a.appointment_date + "T12:00:00");
        calMonth = d.getMonth();
        calYear = d.getFullYear();
        renderCalendar(calMonth, calYear);
        showStep(1);
      }).catch(function () {
        location.href = "/user/status.html";
      });
    }
  }
}

function to12h(t) {
  var h = parseInt(t, 10);
  var m = t.slice(3);
  var ampm = h < 12 ? "am" : "pm";
  var h12 = h % 12 || 12;
  return h12 + ":" + m + ampm;
}

function setupPhoneCodeDropdown() {
  var btn = document.getElementById("phone-code-btn");
  var dd = document.getElementById("phone-code-dropdown");
  if (!btn || !dd) return;
  btn.addEventListener("click", function (e) { e.stopPropagation(); dd.classList.toggle("hidden"); });
  dd.querySelectorAll(".code-option").forEach(function (opt) {
    opt.addEventListener("click", function (e) { e.stopPropagation(); btn.childNodes[0].textContent = this.textContent.trim(); btn.setAttribute("data-value", this.getAttribute("data-value")); dd.classList.add("hidden"); });
  });
  document.addEventListener("click", function () { dd.classList.add("hidden"); });
}

function initStatus() {
  var form = document.getElementById("status-form");
  var card = document.getElementById("result-card");
  var actions = document.getElementById("status-actions");
  var btnCancel = document.getElementById("btn-cancel-appt");
  var btnEdit = document.getElementById("btn-edit-appt");
  var currentAppt = null;

  function refreshDisplay(a) {
    document.getElementById("r-number").textContent = a.appointment_number;
    document.getElementById("r-name").textContent = a.first_name + " " + a.last_name;
    document.getElementById("r-phone").textContent = (a.country_code || "+506") + " " + a.phone;
    document.getElementById("r-plate").textContent = a.plate;
    document.getElementById("r-date").textContent = formatAppDate(a.appointment_date);
    document.getElementById("r-time").textContent = to12h(a.appointment_time.slice(0, 5));
    document.getElementById("r-address").textContent = a.address;
    var statusEl = document.getElementById("r-status");
    var t = window.I18N.t.bind(window.I18N);
    statusEl.innerHTML = '<span class="badge ' + statusBadgeClass(a.status) + '">' + t(statusKey(a.status)) + '</span>';
    currentAppt = a;
    updateActions(a);
  }

  function updateActions(a) {
    if (a.status === "cancelled" || a.status === "completed") {
      actions.classList.add("hidden");
    } else {
      var t = window.I18N.t.bind(window.I18N);
      btnCancel.textContent = t("btn_cancel_appt");
      btnEdit.textContent = t("btn_edit_appt");
      actions.classList.remove("hidden");
    }
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideError(form);
    card.classList.add("hidden");
    actions.classList.add("hidden");
    var t = window.I18N.t.bind(window.I18N);
    var phone = form.phone.value.trim();
    var plate = form.plate.value.trim().toUpperCase();
    if (!phone || !plate) {
      showError(form, t("error_required"));
      return;
    }
    try {
      var res = await window.API.public.lookupAppointment(phone, plate);
      refreshDisplay(res);
      card.classList.remove("hidden");
    } catch (err) {
      if (err.status === 404) showMessage(t("not_found"));
      else showError(form, err.message || t("error_generic"));
    }
  });

  btnCancel.addEventListener("click", async function () {
    var t = window.I18N.t.bind(window.I18N);
    if (!await showConfirm(t("cancel_confirm"))) return;
    try {
      await window.API.public.cancelAppointment(currentAppt.appointment_number, {
        phone: currentAppt.phone,
        plate: currentAppt.plate,
      });
      currentAppt.status = "cancelled";
      refreshDisplay(currentAppt);
    } catch (err) {
      showError(form, err.message || t("error_generic"));
    }
  });

  btnEdit.addEventListener("click", function () {
    var params = new URLSearchParams({
      edit: currentAppt.appointment_number,
      phone: currentAppt.phone,
      plate: currentAppt.plate,
    });
    location.href = "/user/schedule.html?" + params.toString();
  });
}

document.addEventListener("i18n:ready", () => {
  if (window.__initDone) return;
  window.__initDone = true;
  if (window.PAGE === "schedule") initSchedule();
  if (window.PAGE === "status") initStatus();
  if (window.ClientAuth) {
    if (window.PAGE === "schedule") window.ClientAuth.prefillForm();
    if (window.PAGE === "schedule") {
      window.ClientAuth.tryRefresh().then(function () { window.ClientAuth.prefillForm(); });
    }
  }
  loadAnnouncement();
  var es = new EventSource("/api/events/stream");
  es.addEventListener("announcement", function () { loadAnnouncement(); });
  es.addEventListener("appointment", function () {
    loadAnnouncement();
    if (window.refreshScheduleCalendar) window.refreshScheduleCalendar();
  });
  es.addEventListener("settings", function () {
    if (window.refreshScheduleCalendar) window.refreshScheduleCalendar();
  });
});

async function loadAnnouncement() {
  var container = document.getElementById("announcement-banner");
  if (!container) return;
  container.innerHTML = "";
  try {
    var list = await window.API.public.getActiveAnnouncements();
    if (!list || !list.length) { container.classList.add("hidden"); return; }
    list.forEach(function (ann, i) {
      var el = document.createElement("div");
      el.className = "text-slate-800 text-center text-sm font-bold px-4 py-3";
      el.style.backgroundColor = ann.bg_color;
      if (i > 0) el.style.borderTop = "1px solid rgba(15,23,42,0.18)";
      el.textContent = ann.text;
      container.appendChild(el);
    });
    container.classList.remove("hidden");
  } catch (e) {
    container.classList.add("hidden");
  }
}
