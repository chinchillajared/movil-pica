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

function htmlEscape(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function buildInfoTag(label, value) {
  var tag = document.createElement("span");
  tag.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white text-sm";
  tag.innerHTML = "<span class='font-bold text-slate-800'>" + htmlEscape(label) + "</span> <span class='text-slate-600'>" + htmlEscape(value == null || value === "" ? "—" : value) + "</span>";
  return tag;
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
  var clientVehicles = {};
  var vehicleSelectWired = false;

  function setupVehicleSelector() {
    var wrap = $("vehicle-select-wrap");
    var select = $("vehicle-select");
    var plateInput = $("plate");
    if (!wrap || !select || !plateInput || vehicleSelectWired) return;
    if (new URLSearchParams(location.search).get("edit")) return;
    if (!window.ClientAuth || !window.ClientAuth.isLoggedIn()) return;
    vehicleSelectWired = true;
    window.API.auth.listVehicles().then(function (vehicles) {
      if (!vehicles || !vehicles.length) return;
      clientVehicles = {};
      var other = document.createElement("option");
      other.value = "__other__";
      other.textContent = window.I18N ? window.I18N.t("vehicle_other") : "Another vehicle";
      select.innerHTML = "";
      select.appendChild(other);
      vehicles.forEach(function (v) {
        clientVehicles[v.id] = v;
        var opt = document.createElement("option");
        opt.value = String(v.id);
        var label = v.plate;
        var desc = [v.make, v.model].filter(Boolean).join(" ");
        if (v.year) desc += " " + v.year;
        if (desc) label += " — " + desc;
        opt.textContent = label;
        select.appendChild(opt);
      });
      select.value = "__other__";
      wrap.classList.remove("hidden");
    }).catch(function () {
      vehicleSelectWired = false;
    });
    select.addEventListener("change", function () {
      var val = select.value;
      var chosen = clientVehicles[val];
      if (chosen) {
        plateInput.value = chosen.plate;
        plateInput.disabled = true;
      } else {
        plateInput.value = "";
        plateInput.disabled = false;
        plateInput.focus();
      }
    });
  }

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
    locBtn.innerHTML = '<img class="w-5 h-5 animate-spin" src="/icons/spinner.svg" alt="" /> Locating...';
    locStatus.classList.add("hidden");

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var coords = pos.coords.latitude.toFixed(6) + "," + pos.coords.longitude.toFixed(6);
        addressInput.value = coords;
        updateMapsLink();
        locBtn.innerHTML = '<img class="w-5 h-5" src="/icons/check.svg" alt="" /> Location shared';
        locBtn.className = "btn-secondary w-full flex items-center justify-center gap-2 !border-green-500 !text-green-700";
        locStatus.textContent = coords;
        locStatus.className = "text-xs text-slate-500 mt-1 text-center font-mono";
      },
      function () {
        locBtn.disabled = false;
        locBtn.innerHTML = '<img class="w-5 h-5" src="/icons/location.svg" alt="" /> Share current location';
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
      var successTags = document.getElementById("success-tags");
      successTags.innerHTML = "";
      successTags.appendChild(buildInfoTag(t("your_number"), res.appointment_number));
      successTags.appendChild(buildInfoTag(t("label_plate"), res.plate));
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
          locBtn.innerHTML = '<img class="w-5 h-5" src="/icons/check.svg" alt="" /> Location shared';
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

  window.setupScheduleVehicleSelector = setupVehicleSelector;
  setupVehicleSelector();
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
    var t = window.I18N.t.bind(window.I18N);
    var tagsBox = document.getElementById("r-tags");
    tagsBox.innerHTML = "";
    var items = [
      { label: t("label_appointment_number"), value: a.appointment_number },
      { label: t("field_name"), value: a.first_name + " " + a.last_name },
      { label: t("label_phone"), value: (a.country_code || "+506") + " " + a.phone },
      { label: t("label_plate"), value: a.plate },
      { label: t("field_date"), value: formatAppDate(a.appointment_date) },
      { label: t("field_time"), value: to12h(a.appointment_time.slice(0, 5)) },
      { label: t("field_address"), value: a.address || "—" },
    ];
    items.forEach(function (it) {
      tagsBox.appendChild(buildInfoTag(it.label, it.value));
    });
    var statusTag = document.createElement("span");
    statusTag.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white text-sm";
    statusTag.innerHTML = "<span class='font-bold text-slate-800'>" + htmlEscape(t("field_status")) + "</span> <span class='badge " + statusBadgeClass(a.status) + "'>" + htmlEscape(t(statusKey(a.status))) + "</span>";
    tagsBox.appendChild(statusTag);
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

function initVehicles() {
  var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
  var loginRequired = $("login-required");
  var content = $("vehicles-content");
  var grid = $("vehicles-grid");
  var openLoginBtn = $("btn-open-login");

  if (openLoginBtn && window.ClientAuth) {
    openLoginBtn.addEventListener("click", function () {
      window.ClientAuth.openLogin();
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showLoggedIn(state) {
    if (loginRequired) loginRequired.classList.toggle("hidden", state);
    if (content) content.classList.toggle("hidden", !state);
  }

  function loadVehicles() {
    if (!grid) return;
    grid.innerHTML = "";
    window.API.auth.listVehicles().then(function (vehicles) {
      (vehicles || []).forEach(function (v) { grid.appendChild(buildVehicleCard(v)); });
      grid.appendChild(buildAddTile());
    }).catch(function (err) {
      if (err.status === 401) { showLoggedIn(false); return; }
      showMessage(err.message || t("error_generic"));
    });
  }

  function buildVehicleCard(v) {
    var card = document.createElement("div");
    card.className = "relative rounded-xl border border-slate-200 bg-white p-3 flex flex-col";

    var menuWrap = document.createElement("div");
    menuWrap.className = "absolute top-2 right-2 z-10";
    var gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50";
    gearBtn.innerHTML = '<img class="w-4 h-4" src="/icons/gear.svg" alt="" />';
    var menu = document.createElement("div");
    menu.className = "hidden absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[150px] z-20";
    var editOpt = document.createElement("button");
    editOpt.type = "button";
    editOpt.className = "w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50";
    editOpt.textContent = t("vehicles_edit");
    var delOpt = document.createElement("button");
    delOpt.type = "button";
    delOpt.className = "w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50";
    delOpt.textContent = t("vehicles_delete");
    menu.appendChild(editOpt);
    menu.appendChild(delOpt);
    function closeMenu() { menu.classList.add("hidden"); document.removeEventListener("click", outside); }
    function outside(e) { if (!menuWrap.contains(e.target)) closeMenu(); }
    gearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("hidden");
      if (menu.classList.contains("hidden")) { document.removeEventListener("click", outside); return; }
      setTimeout(function () { document.addEventListener("click", outside); }, 0);
    });
    editOpt.addEventListener("click", function () { closeMenu(); openVehicleModal(v); });
    delOpt.addEventListener("click", function () {
      closeMenu();
      showConfirm(t("vehicles_delete_confirm")).then(function (ok) {
        if (!ok) return;
        window.API.auth.deleteVehicle(v.id).then(loadVehicles).catch(function (err) {
          showMessage(err.message || t("error_generic"));
        });
      });
    });
    menuWrap.appendChild(gearBtn);
    menuWrap.appendChild(menu);
    card.appendChild(menuWrap);

    var photo = document.createElement("img");
    photo.src = v.front_photo || "";
    photo.alt = v.plate;
    photo.className = "w-40 h-40 mx-auto object-cover rounded-2xl border border-slate-200 bg-slate-50" + (v.front_photo ? "" : " hidden");
    card.appendChild(photo);

    var info = document.createElement("div");
    info.className = "mt-3 flex flex-col gap-1.5 items-start";
    var items = [
      { label: t("vehicles_plate"), value: v.plate },
      { label: t("vehicles_make"), value: v.make || "—" },
      { label: t("vehicles_model"), value: v.model || "—" },
      { label: t("vehicles_year"), value: v.year != null ? v.year : "—" },
      { label: t("vehicles_color"), value: v.color || "—" },
    ];
    items.forEach(function (it) {
      var tag = document.createElement("span");
      tag.className = "inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white text-sm w-fit";
      tag.innerHTML = "<span class='font-bold text-slate-800'>" + esc(it.label) + "</span> <span class='text-slate-600'>" + esc(it.value) + "</span>";
      info.appendChild(tag);
    });
    card.appendChild(info);

    var repairsBtn = document.createElement("a");
    repairsBtn.href = "/user/repairs.html?vehicle=" + v.id;
    repairsBtn.className = "btn-secondary flex items-center justify-center gap-2";
    repairsBtn.innerHTML = esc(t("vehicles_repairs_btn")) + ' <img class="w-5 h-5" src="/icons/wheel.svg" alt="" />';
    var spacer = document.createElement("div");
    spacer.className = "mt-auto pt-5";
    spacer.appendChild(repairsBtn);
    card.appendChild(spacer);

    return card;
  }

  function buildAddTile() {
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-brand-400 hover:text-brand-700 text-slate-500 flex flex-col items-center justify-center gap-2 py-10 cursor-pointer";
    tile.innerHTML = "<span class='text-3xl leading-none'>+</span><span class='text-sm font-medium'>" + esc(t("vehicles_add")) + "</span>";
    tile.addEventListener("click", function () { openVehicleModal(null); });
    return tile;
  }

  function openVehicleModal(vehicle) {
    var editing = !!vehicle;
    var overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto";
    var box = document.createElement("div");
    box.className = "bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8";
    box.innerHTML =
      '<div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">' +
        '<h3 class="text-lg font-bold text-slate-800">' + esc(editing ? t("vehicles_edit_title") : t("vehicles_new_title")) + '</h3>' +
        '<button type="button" id="vehicle-modal-close" class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>' +
      '</div>' +
      '<form id="vehicle-form" novalidate class="p-5 space-y-4">' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
          '<div><label class="field-label" for="v-plate">' + esc(t("label_plate")) + '</label>' +
            '<input id="v-plate" type="text" required class="field-input uppercase" value="' + esc(vehicle ? vehicle.plate : "") + '" placeholder="' + esc(t("placeholder_plate")) + '" /></div>' +
          '<div><label class="field-label" for="v-make">' + esc(t("vehicles_make")) + '</label>' +
            '<input id="v-make" type="text" required class="field-input" value="' + esc(vehicle ? vehicle.make : "") + '" placeholder="' + esc(t("vehicles_make_ph")) + '" /></div>' +
          '<div><label class="field-label" for="v-model">' + esc(t("vehicles_model")) + '</label>' +
            '<input id="v-model" type="text" required class="field-input" value="' + esc(vehicle ? vehicle.model : "") + '" placeholder="' + esc(t("vehicles_model_ph")) + '" /></div>' +
          '<div><label class="field-label" for="v-year">' + esc(t("vehicles_year")) + '</label>' +
            '<input id="v-year" type="number" min="1900" max="2200" class="field-input" value="' + (vehicle && vehicle.year ? vehicle.year : "") + '" placeholder="' + esc(t("vehicles_year_ph")) + '" /></div>' +
          '<div class="sm:col-span-2"><label class="field-label" for="v-color">' + esc(t("vehicles_color")) + '</label>' +
            '<input id="v-color" type="text" class="field-input" value="' + esc(vehicle ? vehicle.color : "") + '" placeholder="' + esc(t("vehicles_color_ph")) + '" /></div>' +
          '<div class="sm:col-span-2"><label class="field-label">' + esc(t("vehicles_photo")) + '</label>' +
            '<div class="flex items-center gap-3">' +
              '<img id="v-photo-preview" alt="" class="hidden h-20 w-28 object-cover rounded-lg border border-slate-200 bg-white" />' +
              '<button id="v-photo-btn" type="button" class="btn-secondary">' + esc(t("vehicles_photo_upload")) + '</button>' +
            '</div></div>' +
        '</div>' +
        '<p id="vehicle-form-error" class="hidden text-sm text-red-600"></p>' +
        '<div class="flex justify-end gap-2 pt-2">' +
          '<button type="button" id="vehicle-modal-cancel" class="btn-secondary">' + esc(t("btn_back")) + '</button>' +
          '<button type="submit" class="btn-primary">' + esc(t("vehicles_save")) + '</button>' +
        '</div>' +
      '</form>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var photoDataUrl = "";
    var preview = box.querySelector("#v-photo-preview");
    var photoBtn = box.querySelector("#v-photo-btn");
    var err = box.querySelector("#vehicle-form-error");
    var form = box.querySelector("#vehicle-form");

    if (editing && vehicle.front_photo) {
      preview.src = vehicle.front_photo;
      preview.classList.remove("hidden");
    }

    function close() { overlay.remove(); }

    box.querySelector("#vehicle-modal-close").addEventListener("click", close);
    box.querySelector("#vehicle-modal-cancel").addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

    photoBtn.addEventListener("click", function () {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        fileToDataURL(input, 3 * 1024 * 1024, function (dataUrl) {
          photoDataUrl = dataUrl;
          preview.src = dataUrl;
          preview.classList.remove("hidden");
        });
        input.remove();
      });
      input.click();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var plate = form.querySelector("#v-plate").value.trim().toUpperCase();
      var make = form.querySelector("#v-make").value.trim();
      var model = form.querySelector("#v-model").value.trim();
      var yearVal = form.querySelector("#v-year").value.trim();
      var color = form.querySelector("#v-color").value.trim();
      if (!plate || !make || !model) {
        err.textContent = t("error_required");
        err.classList.remove("hidden");
        return;
      }
      err.classList.add("hidden");
      var payload = {
        plate: plate,
        make: make,
        model: model,
        year: yearVal ? parseInt(yearVal, 10) : null,
        color: color,
        front_photo: photoDataUrl || (vehicle ? vehicle.front_photo || "" : ""),
      };
      var promise = editing
        ? window.API.auth.updateVehicle(vehicle.id, payload)
        : window.API.auth.createVehicle(payload);
      promise.then(function () {
        close();
        loadVehicles();
        showMessage(editing ? t("vehicles_updated") : t("vehicles_saved"));
      }).catch(function (err2) {
        err.textContent = err2.message || t("error_generic");
        err.classList.remove("hidden");
      });
    });
  }

  document.addEventListener("client:login", function () {
    showLoggedIn(true);
    loadVehicles();
  });

  var loggedIn = window.ClientAuth ? window.ClientAuth.isLoggedIn() : false;
  if (loggedIn) { showLoggedIn(true); loadVehicles(); }
  else { showLoggedIn(false); }
}

function fileToDataURL(input, maxBytes, onChange) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (maxBytes && file.size > maxBytes) {
    showMessage("La imagen es demasiado grande (máx 3MB).");
    input.value = "";
    return;
  }
  var reader = new FileReader();
  reader.onload = function () { onChange(reader.result); };
  reader.onerror = function () { input.value = ""; };
  reader.readAsDataURL(file);
}

function $ (id) {
  return document.getElementById(id);
}

function setupAuthPage(contentId) {
  var loginRequired = $("login-required");
  var content = $(contentId);
  var openLoginBtn = $("btn-open-login");
  if (openLoginBtn && window.ClientAuth) {
    openLoginBtn.addEventListener("click", function () {
      window.ClientAuth.openLogin();
    });
  }
  return function (state) {
    if (loginRequired) loginRequired.classList.toggle("hidden", state);
    if (content) content.classList.toggle("hidden", !state);
  };
}

function buildAppointmentCard(a, t) {
  var card = document.createElement("div");
  card.className = "rounded-xl border border-slate-200 bg-white p-4";
  var head = document.createElement("div");
  head.className = "flex flex-wrap items-center gap-2";
  var num = document.createElement("span");
  num.className = "font-mono font-bold text-slate-800";
  num.textContent = a.appointment_number;
  var badge = document.createElement("span");
  badge.className = "badge " + statusBadgeClass(a.status);
  badge.textContent = t(statusKey(a.status));
  head.appendChild(num);
  head.appendChild(badge);
  card.appendChild(head);
  var tags = document.createElement("div");
  tags.className = "flex flex-wrap justify-center gap-2 mt-2";
  tags.appendChild(buildInfoTag(t("cal_plate"), a.plate));
  tags.appendChild(buildInfoTag(t("field_date"), formatAppDate(a.appointment_date)));
  tags.appendChild(buildInfoTag(t("field_time"), to12h(String(a.appointment_time).slice(0, 5))));
  if (a.address) tags.appendChild(buildInfoTag(t("field_address"), a.address));
  card.appendChild(tags);
  return card;
}

function buildRepairCard(r, t) {
  var card = document.createElement("div");
  card.className = "rounded-xl border border-slate-200 bg-white p-4";

  var top = document.createElement("div");
  top.className = "flex flex-wrap items-center justify-between gap-2";
  var left = document.createElement("div");
  left.className = "min-w-0";
  var sym = (r.price_rows && r.price_rows.length) ? currencySymbol(r.price_rows[0].currency || "CRC") : "₡";
  left.innerHTML =
    "<div class='flex flex-wrap items-center gap-2'>" +
      "<span class='font-medium text-slate-800'>" + htmlEscape(r.title || "—") + "</span>" +
      "<span class='badge badge-completed'>" + htmlEscape(sym + " " + formatMoney(r.total)) + "</span>" +
    "</div>";
  var metaTags = document.createElement("div");
  metaTags.className = "flex flex-wrap justify-center gap-2 mt-2";
  metaTags.appendChild(buildInfoTag(t("field_date"), formatAppDate(String(r.created_at || "").slice(0, 10))));
  if (r.mileage != null) metaTags.appendChild(buildInfoTag(t("services_mileage"), r.mileage + " " + (r.mileage_unit || "km")));
  left.appendChild(metaTags);
  top.appendChild(left);

  var detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "text-blue-600 hover:text-blue-800 underline text-sm font-medium";
  detailsBtn.textContent = t("repairs_view_details");
  top.appendChild(detailsBtn);
  card.appendChild(top);

  var details = document.createElement("div");
  details.className = "hidden mt-4 pt-4 border-t border-slate-200 space-y-3";
  card.appendChild(details);

  detailsBtn.addEventListener("click", function () {
    var showing = !details.classList.contains("hidden");
    details.classList.toggle("hidden", showing);
    detailsBtn.textContent = showing ? t("repairs_view_details") : t("repairs_hide_details");
  });

  if (r.mileage_photo) {
    var mp = document.createElement("div");
    var mpLabel = document.createElement("p");
    mpLabel.className = "text-xs font-medium text-slate-500 mb-1";
    mpLabel.textContent = t("services_mileage_photo");
    mp.appendChild(mpLabel);
    var mpImg = document.createElement("img");
    mpImg.src = r.mileage_photo;
    mpImg.className = "w-24 h-24 object-cover rounded-lg border border-slate-200 cursor-pointer";
    mpImg.addEventListener("click", function () { viewPhoto(r.mileage_photo); });
    mp.appendChild(mpImg);
    details.appendChild(mp);
  }

  if (r.diagnosis) details.appendChild(sectionTextBlock(t("services_diagnosis"), r.diagnosis));

  if (r.price_rows && r.price_rows.length) {
    details.appendChild(buildServicePriceTable(r.price_rows, t));
  }

  if (r.other_photos && r.other_photos.length) {
    details.appendChild(photoStrip(t("services_other_photos"), r.other_photos));
  }

  return card;
}

function buildServicePriceTable(rows, t) {
  var wrap = document.createElement("div");
  var table = document.createElement("table");
  table.className = "w-full text-sm";
  var thead = document.createElement("thead");
  var hr = document.createElement("tr");
  hr.className = "bg-slate-50 text-slate-500";
  hr.innerHTML =
    "<th class='text-left px-3 py-2 font-semibold rounded-l-lg'>" + htmlEscape(t("services_price_type")) + "</th>" +
    "<th class='text-left px-3 py-2 font-semibold'>" + htmlEscape(t("services_price_description")) + "</th>" +
    "<th class='text-right px-3 py-2 font-semibold rounded-r-lg'>" + htmlEscape(t("services_price_amount")) + "</th>";
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = document.createElement("tbody");
  rows.forEach(function (row) {
    var amt = row.amount != null && row.amount !== "" ? Number(row.amount) : 0;
    var kindLabel = row.kind === "parts" ? t("services_price_parts") : t("services_price_labor");
    var kindCls = row.kind === "parts" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800";
    var tr = document.createElement("tr");
    tr.className = "border-t border-slate-100";
    tr.innerHTML =
      "<td class='px-3 py-2'><span class='text-xs font-semibold px-2 py-0.5 rounded-full " + kindCls + "'>" + htmlEscape(kindLabel) + "</span></td>" +
      "<td class='px-3 py-2 text-slate-700'>" + htmlEscape(row.description || "—") + "</td>" +
      "<td class='px-3 py-2 text-right font-medium text-slate-800'>" + htmlEscape(currencySymbol(row.currency || "CRC") + " " + formatMoney(amt)) + "</td>";
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
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

function sectionTextBlock(label, text) {
  var div = document.createElement("div");
  div.innerHTML =
    "<p class='text-xs font-medium text-slate-500 mb-1'>" + htmlEscape(label) + "</p>" +
    "<p class='text-sm text-slate-700 whitespace-pre-wrap'>" + htmlEscape(text) + "</p>";
  return div;
}

function photoStrip(label, sources) {
  var wrap = document.createElement("div");
  var h = document.createElement("p");
  h.className = "text-xs font-medium text-slate-500 mb-1";
  h.textContent = label;
  wrap.appendChild(h);
  var grid = document.createElement("div");
  grid.className = "flex flex-wrap gap-2";
  sources.forEach(function (src) {
    var img = document.createElement("img");
    img.src = src;
    img.className = "w-20 h-16 object-cover rounded border border-slate-200 cursor-pointer";
    img.addEventListener("click", function () { viewPhoto(src); });
    grid.appendChild(img);
  });
  wrap.appendChild(grid);
  return wrap;
}

function viewPhoto(src) {
  if (!src) return;
  var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
  var overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4";
  overlay.innerHTML =
    '<div class="bg-white rounded-2xl p-2 max-w-full max-h-full overflow-auto">' +
      '<img class="max-w-full max-h-[85vh] rounded-lg" src="' + htmlEscape(src) + '" />' +
      '<button type="button" id="photo-close" class="block mx-auto mt-2 px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium">' + htmlEscape(t("dialog_close")) + '</button>' +
    '</div>';
  function close() { overlay.remove(); }
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  overlay.querySelector("#photo-close").addEventListener("click", close);
  document.body.appendChild(overlay);
}

function initGarage() {
  var showLoggedIn = setupAuthPage("garage-content");
  window.API.auth.me().then(function () {
    showLoggedIn(true);
  }).catch(function () {
    showLoggedIn(false);
  });
  document.addEventListener("client:login", function () { showLoggedIn(true); });
}

function initAppointments() {
  var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
  var showLoggedIn = setupAuthPage("appointments-content");
  var list = $("appointments-list");
  var empty = $("appointments-empty");
  function load() {
    if (!list) return;
    list.innerHTML = "";
    if (empty) empty.classList.add("hidden");
    window.API.auth.listAppointments().then(function (appts) {
      showLoggedIn(true);
      if (!appts || !appts.length) {
        if (empty) empty.classList.remove("hidden");
        return;
      }
      appts.forEach(function (a) { list.appendChild(buildAppointmentCard(a, t)); });
    }).catch(function (err) {
      if (err.status === 401) { showLoggedIn(false); return; }
      showMessage(err.message || t("error_generic"));
    });
  }
  load();
  window.refreshAppointments = load;
  document.addEventListener("client:login", load);
}

function initRepairs() {
  var t = window.I18N ? window.I18N.t.bind(window.I18N) : function (s) { return s; };
  var showLoggedIn = setupAuthPage("repairs-content");
  var list = $("repairs-list");
  var empty = $("repairs-empty");
  var tagsBox = $("vehicle-tags");
  var params = new URLSearchParams(location.search);
  var vehicleFilter = params.get("vehicle") ? parseInt(params.get("vehicle"), 10) : null;

  if (vehicleFilter) {
    var backBtn = document.querySelector("a[data-i18n='btn_back']");
    if (backBtn) backBtn.href = "/user/vehicles.html";
    var heading = $("repairs-title");
    if (heading) heading.textContent = t("repairs_vehicle_title");
  }

  function renderVehicleTags(vehicles) {
    if (!tagsBox || !vehicleFilter) return;
    var v = null;
    (vehicles || []).forEach(function (x) { if (x.id === vehicleFilter) v = x; });
    if (!v) { tagsBox.classList.add("hidden"); tagsBox.innerHTML = ""; return; }
    tagsBox.classList.remove("hidden");
    tagsBox.innerHTML = "";
    var items = [
      { label: t("vehicles_plate"), value: v.plate },
      { label: t("vehicles_make"), value: v.make || "—" },
      { label: t("vehicles_model"), value: v.model || "—" },
      { label: t("vehicles_year"), value: v.year != null ? v.year : "—" },
      { label: t("vehicles_color"), value: v.color || "—" },
    ];
    items.forEach(function (it) {
      var tag = document.createElement("span");
      tag.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm";
      tag.innerHTML = "<span class='font-bold text-slate-800'>" + htmlEscape(it.label) + "</span> <span class='text-slate-600'>" + htmlEscape(it.value) + "</span>";
      tagsBox.appendChild(tag);
    });
  }

  function load() {
    if (!list) return;
    list.innerHTML = "";
    if (empty) empty.classList.add("hidden");
    window.API.auth.listRepairs().then(function (repairs) {
      showLoggedIn(true);
      if (vehicleFilter) {
        repairs = (repairs || []).filter(function (r) { return r.vehicle_id === vehicleFilter; });
      }
      if (!repairs || !repairs.length) {
        if (empty) empty.classList.remove("hidden");
        return;
      }
      repairs.forEach(function (r) { list.appendChild(buildRepairCard(r, t)); });
    }).catch(function (err) {
      if (err.status === 401) { showLoggedIn(false); return; }
      showMessage(err.message || t("error_generic"));
    });
  }
  if (vehicleFilter) {
    window.API.auth.listVehicles().then(renderVehicleTags).catch(function () {});
  }
  load();
  window.refreshRepairs = load;
  document.addEventListener("client:login", load);
}

document.addEventListener("i18n:ready", () => {
  if (window.__initDone) return;
  window.__initDone = true;
  if (window.PAGE === "schedule") initSchedule();
  if (window.PAGE === "status") initStatus();
  if (window.PAGE === "vehicles") initVehicles();
  if (window.PAGE === "garage") initGarage();
  if (window.PAGE === "appointments") initAppointments();
  if (window.PAGE === "repairs") initRepairs();
  if (window.ClientAuth) {
    if (window.PAGE === "schedule") window.ClientAuth.prefillForm();
    if (window.PAGE === "schedule") {
      window.ClientAuth.tryRefresh().then(function () {
        window.ClientAuth.prefillForm();
        if (window.setupScheduleVehicleSelector) window.setupScheduleVehicleSelector();
      });
    }
  }
  document.addEventListener("client:login", function () {
    if (window.setupScheduleVehicleSelector) window.setupScheduleVehicleSelector();
  });
  loadAnnouncement();
  var es = new EventSource("/api/events/stream");
  es.addEventListener("announcement", function () { loadAnnouncement(); });
  es.addEventListener("appointment", function () {
    loadAnnouncement();
    if (window.refreshScheduleCalendar) window.refreshScheduleCalendar();
    if (window.refreshAppointments) window.refreshAppointments();
  });
  es.addEventListener("vehicle", function () {
    if (window.refreshRepairs) window.refreshRepairs();
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
