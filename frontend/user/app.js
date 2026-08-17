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
  var locationBaseClass = "btn-secondary w-full flex items-center justify-center gap-2 mt-2";

  function setLocationButton(icon, label, disabled, success) {
    locBtn.innerHTML = '<img class="w-5 h-5' + (disabled ? ' animate-spin' : '') + '" src="/icons/' + icon + '.svg" alt="" /> ' + label;
    locBtn.disabled = disabled;
    locBtn.className = locationBaseClass + (success ? " !border-green-500 !text-green-700" : "");
  }

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
      locStatus.textContent = window.I18N.t("location_unavailable");
      locStatus.classList.remove("hidden");
      return;
    }
    setLocationButton("spinner", window.I18N.t("location_locating"), true, false);
    locStatus.classList.add("hidden");

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var coords = pos.coords.latitude.toFixed(6) + "," + pos.coords.longitude.toFixed(6);
        addressInput.value = coords;
        updateMapsLink();
        setLocationButton("check", window.I18N.t("location_shared"), false, true);
        locStatus.textContent = coords;
        locStatus.className = "text-xs text-slate-500 mt-1 text-center font-mono";
      },
      function () {
        setLocationButton("location", window.I18N.t("btn_share_location"), false, false);
        locStatus.textContent = window.I18N.t("location_error");
        locStatus.className = "text-xs text-red-600 mt-1 text-center";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
        if (a.address && /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(a.address)) {
          setLocationButton("check", window.I18N.t("location_shared"), false, true);
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
      var field = document.createElement("div");
      field.className = "inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5";
     field.innerHTML = "<span class='text-xs font-bold uppercase tracking-wide text-slate-500'>" + htmlEscape(it.label) + "</span><span class='break-words text-sm font-semibold text-slate-900'>" + htmlEscape(it.value) + "</span>";
      if (it.label === t("field_address")) field.className += " sm:col-span-2";
      tagsBox.appendChild(field);
    });
    var statusTag = document.createElement("div");
     statusTag.className = "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5";
    statusTag.innerHTML = "<span class='text-xs font-semibold uppercase tracking-wide text-slate-500'>" + htmlEscape(t("field_status")) + "</span><span class='badge " + statusBadgeClass(a.status) + "'>" + htmlEscape(t(statusKey(a.status))) + "</span>";
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
     card.className = "vehicle-card relative flex min-h-[250px] flex-col";

    var menuWrap = document.createElement("div");
    menuWrap.className = "absolute top-2 right-2 z-10";
    var gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700";
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

    var photoBanner = document.createElement("div");
     photoBanner.className = "vehicle-card-photo mx-auto mb-1 mt-1 aspect-square w-full max-w-[220px] overflow-hidden";
    var photo = document.createElement("img");
    photo.src = v.front_photo || "/icons/car.svg";
    photo.alt = v.plate;
    photo.className = "h-full w-full object-cover";
    photoBanner.appendChild(photo);
    card.appendChild(photoBanner);

    var info = document.createElement("div");
    info.className = "mt-4 flex flex-1 flex-col";
    function vehicleTag(label, value) {
      var tag = document.createElement("span");
       tag.className = "vehicle-info-tag inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm";
      tag.innerHTML = "<span class='font-bold text-slate-800'>" + esc(label) + "</span><span class='text-slate-600'>" + esc(value == null || value === "" ? "—" : value) + "</span>";
      return tag;
    }
    var title = document.createElement("div");
     title.className = "vehicle-card-title pr-8 text-base font-bold";
    title.textContent = [v.make, v.model].filter(Boolean).join(" ") || t("vehicles_title");
    info.appendChild(title);
    var vehicleTags = document.createElement("div");
     vehicleTags.className = "vehicle-info-tags mt-3 flex flex-col items-start gap-2";
    vehicleTags.appendChild(vehicleTag(t("vehicles_plate"), v.plate || "—"));
    var items = [
      { label: t("vehicles_engine"), value: v.engine || "—" },
      { label: t("vehicles_year"), value: v.year != null ? v.year : "—" },
    ];
    items.forEach(function (it) {
      vehicleTags.appendChild(vehicleTag(it.label, it.value));
    });
    info.appendChild(vehicleTags);
    card.appendChild(info);

    var repairsBtn = document.createElement("a");
    repairsBtn.href = "/user/repairs.html?vehicle=" + v.id;
    repairsBtn.className = "btn-primary flex w-full items-center justify-center gap-2";
    repairsBtn.innerHTML = esc(t("vehicles_repairs_btn")) + ' <img class="w-5 h-5" src="/icons/wrench.svg" alt="" />';
    var spacer = document.createElement("div");
    spacer.className = "mt-auto pt-5";
    spacer.appendChild(repairsBtn);
    card.appendChild(spacer);

    return card;
  }

  function buildAddTile() {
    var tile = document.createElement("button");
    tile.type = "button";
     tile.className = "vehicle-add-tile flex min-h-[250px] flex-col items-center justify-center text-center";
    tile.innerHTML = "<span class='flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-2xl font-medium text-brand-700'>+</span><span class='text-sm font-semibold text-slate-700'>" + esc(t("vehicles_add")) + "</span>";
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
           '<div><label class="field-label" for="v-engine">' + esc(t("vehicles_engine")) + '</label>' +
             '<input id="v-engine" type="text" class="field-input" value="' + esc(vehicle ? vehicle.engine || "" : "") + '" placeholder="' + esc(t("vehicles_engine_ph")) + '" /></div>' +
          '<div><label class="field-label" for="v-year">' + esc(t("vehicles_year")) + '</label>' +
            '<input id="v-year" type="number" min="1900" max="2200" class="field-input" value="' + (vehicle && vehicle.year ? vehicle.year : "") + '" placeholder="' + esc(t("vehicles_year_ph")) + '" /></div>' +
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
        fileToDataURL(input, 10 * 1024 * 1024, function (dataUrl) {
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
      var engine = form.querySelector("#v-engine").value.trim();
      var yearVal = form.querySelector("#v-year").value.trim();
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
        engine: engine,
        year: yearVal ? parseInt(yearVal, 10) : null,
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
  var targetBytes = 500 * 1024;
  var file = input.files && input.files[0];
  if (!file) return;
  if (maxBytes && file.size > maxBytes) {
    showMessage(window.I18N.t("image_too_large"));
    input.value = "";
    return;
  }
  var reader = new FileReader();
  reader.onload = function () {
    var source = reader.result;
    if (file.size <= targetBytes) {
      onChange(source);
      return;
    }
    var image = new Image();
    image.onload = function () {
      var width = image.naturalWidth || image.width;
      var height = image.naturalHeight || image.height;
      var maxDimension = 1600;
      if (Math.max(width, height) > maxDimension) {
        var scale = maxDimension / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext("2d");
      var result = "";
      for (var attempt = 0; attempt < 8; attempt++) {
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        for (var quality = 0.82; quality >= 0.18; quality -= 0.08) {
          result = canvas.toDataURL("image/jpeg", quality);
          if (result.length * 0.75 <= targetBytes) {
            onChange(result);
            return;
          }
        }
        width = Math.max(320, Math.round(width * 0.75));
        height = Math.max(320, Math.round(height * 0.75));
      }
      if (result && result.length * 0.75 <= targetBytes) onChange(result);
      else showMessage(window.I18N.t("image_processing_error"));
    };
    image.onerror = function () { showMessage(window.I18N.t("image_processing_error")); };
    image.src = source;
  };
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
  card.className = "relative rounded-xl border border-slate-200 bg-white p-4";
  if (a.status !== "cancelled" && a.status !== "completed") {
    var menuWrap = document.createElement("div");
    menuWrap.className = "absolute right-3 top-3 z-10";
    var gearBtn = document.createElement("button");
    gearBtn.type = "button";
    gearBtn.className = "rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700";
    gearBtn.innerHTML = '<img class="h-4 w-4" src="/icons/gear.svg" alt="" />';
    var menu = document.createElement("div");
    menu.className = "absolute right-0 top-full mt-1 hidden min-w-[150px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg";
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50";
    editBtn.textContent = t("btn_edit_appt");
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50";
    cancelBtn.textContent = t("btn_cancel_appt");
    menu.appendChild(editBtn);
    menu.appendChild(cancelBtn);
    function closeMenu() { menu.classList.add("hidden"); document.removeEventListener("click", outside); }
    function outside(e) { if (!menuWrap.contains(e.target)) closeMenu(); }
    gearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("hidden");
      if (menu.classList.contains("hidden")) document.removeEventListener("click", outside);
      else setTimeout(function () { document.addEventListener("click", outside); }, 0);
    });
    editBtn.addEventListener("click", function () {
      var params = new URLSearchParams({ edit: a.appointment_number, phone: a.phone, plate: a.plate });
      location.href = "/user/schedule.html?" + params.toString();
    });
    cancelBtn.addEventListener("click", function () {
      showConfirm(t("cancel_confirm")).then(function (ok) {
        if (!ok) return;
        cancelBtn.disabled = true;
        window.API.public.cancelAppointment(a.appointment_number, { phone: a.phone, plate: a.plate }).then(function () {
          var listEl = card.parentElement;
          card.remove();
          if (listEl && !listEl.children.length) {
            var emptyEl = document.getElementById("appointments-empty");
            if (emptyEl) emptyEl.classList.remove("hidden");
          }
        }).catch(function (err) {
          cancelBtn.disabled = false;
          showMessage(err.message || t("error_generic"));
        });
      });
    });
    menuWrap.appendChild(gearBtn);
    menuWrap.appendChild(menu);
    card.appendChild(menuWrap);
  }
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
  tags.className = "mt-3 flex flex-wrap items-center gap-2";
  [
    [t("cal_plate"), a.plate],
    [t("field_date"), formatAppDate(a.appointment_date)],
    [t("field_time"), to12h(String(a.appointment_time).slice(0, 5))],
    a.address ? [t("field_address"), a.address] : null,
  ].filter(Boolean).forEach(function (item) {
    var tag = buildInfoTag(item[0], item[1]);
    tag.className = "appointment-info-tag";
    tags.appendChild(tag);
  });
  card.appendChild(tags);
  return card;
}

function buildRepairCard(r, t) {
  var card = document.createElement("div");
   card.className = "repair-card rounded-2xl p-5";

  var top = document.createElement("div");
  top.className = "flex flex-wrap items-start justify-between gap-3";
  var left = document.createElement("div");
  left.className = "min-w-0";
   left.innerHTML =
       "<div class='flex flex-wrap items-center gap-2'>" +
       "<span class='text-base font-bold text-slate-900'>" + htmlEscape(r.title || "—") + "</span>" +
       "</div>";
  var metaTags = document.createElement("div");
   metaTags.className = "mt-3 flex flex-wrap gap-2";
  [
    { label: t("field_date"), value: formatAppDate(String(r.created_at || "").slice(0, 10)) },
    { label: t("services_mileage"), value: r.mileage != null ? r.mileage + " " + (r.mileage_unit || "km") : "—" },
  ].forEach(function (it) {
    var field = document.createElement("div");
     field.className = "repair-meta-tag inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm";
     field.innerHTML = "<span class='font-bold text-slate-800'>" + htmlEscape(it.label) + "</span><span class='text-slate-600'>" + htmlEscape(String(it.value)) + "</span>";
    metaTags.appendChild(field);
  });
  left.appendChild(metaTags);
  top.appendChild(left);

  var detailsBtn = document.createElement("button");
  detailsBtn.type = "button";
  detailsBtn.className = "btn-secondary min-h-9 px-3 py-1.5 text-sm";
  detailsBtn.textContent = t("repairs_view_details");
  top.appendChild(detailsBtn);
  card.appendChild(top);

  detailsBtn.addEventListener("click", function () {
    openRepairDetailModal(r, t);
  });

  return card;
}

function openRepairDetailModal(r, t) {
  var overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4";
  var box = document.createElement("div");
  box.className = "service-detail-modal my-8 w-full max-w-xl rounded-2xl bg-white shadow-2xl";
  box.innerHTML =
    '<div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">' +
      '<h3 class="text-lg font-bold text-slate-800"></h3>' +
      '<button type="button" data-close class="text-2xl leading-none text-slate-400 hover:text-slate-700">&times;</button>' +
    '</div>' +
    '<div class="space-y-4 p-5" data-body></div>';
  var body = box.querySelector("[data-body]");
  var close = function () { overlay.remove(); };
  overlay.appendChild(box);
  box.querySelector("h3").textContent = r.title || "—";
  box.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });

  if (r.diagnosis) {
    var diagnosis = sectionTextBlock(t("services_diagnosis"), r.diagnosis);
    diagnosis.className = "rounded-lg border border-slate-200 bg-slate-50 p-4";
    body.appendChild(diagnosis);
  }
  if (r.price_rows && r.price_rows.length) body.appendChild(buildServicePriceTable(r.price_rows, t));
  if (r.other_photos && r.other_photos.length) body.appendChild(photoStrip(t("services_client_photos"), r.other_photos));
  document.body.appendChild(overlay);
}

function buildServicePriceTable(rows, t) {
  var wrap = document.createElement("div");
  wrap.className = "overflow-hidden rounded-xl border border-slate-200 bg-white";
  var heading = document.createElement("div");
  heading.className = "border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800";
  heading.textContent = t("services_prices_title");
  wrap.appendChild(heading);

  var table = document.createElement("table");
  table.className = "service-price-table w-full text-sm";
  table.innerHTML =
    "<thead class='bg-white text-slate-500'><tr>" +
      "<th class='service-price-type px-4 py-2 text-left font-semibold'>" + htmlEscape(t("services_price_type")) + "</th>" +
      "<th class='service-price-description px-4 py-2 text-left font-semibold'>" + htmlEscape(t("services_price_description")) + "</th>" +
      "<th class='service-price-amount px-4 py-2 text-right font-semibold'>" + htmlEscape(t("services_price_amount")) + "</th>" +
    "</tr></thead>";
  var tbody = document.createElement("tbody");
  var totals = {};
  rows.forEach(function (row) {
    var currency = row.currency || "CRC";
    var amount = row.amount != null && row.amount !== "" ? Number(row.amount) : 0;
    if (!totals[currency]) totals[currency] = { labor: 0, parts: 0 };
    if (row.kind === "parts") totals[currency].parts += amount;
    else totals[currency].labor += amount;
    var tr = document.createElement("tr");
    tr.className = "border-t border-slate-100";
    var kind = row.kind === "parts" ? t("services_price_parts") : t("services_price_labor");
    tr.innerHTML =
      "<td class='service-price-type px-4 py-3'><span class='service-price-kind rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700'>" + htmlEscape(kind) + "</span></td>" +
      "<td class='service-price-description px-4 py-3 text-slate-700'>" + htmlEscape(row.description || "—") + "</td>" +
      "<td class='service-price-amount px-4 py-3 text-right font-semibold text-slate-800'>" + htmlEscape(currencySymbol(currency) + " " + formatMoney(amount)) + "</td>";
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  var totalsBox = document.createElement("div");
  totalsBox.className = "flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3";
  Object.keys(totals).forEach(function (currency) {
    var symbol = currencySymbol(currency);
    var total = totals[currency];
    totalsBox.appendChild(buildInfoTag(t("services_total_labor"), symbol + " " + formatMoney(total.labor)));
    totalsBox.appendChild(buildInfoTag(t("services_total_parts"), symbol + " " + formatMoney(total.parts)));
    totalsBox.appendChild(buildInfoTag(t("services_total"), symbol + " " + formatMoney(total.labor + total.parts)));
  });
  wrap.appendChild(totalsBox);
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
  wrap.className = "rounded-lg border border-slate-200 bg-white p-4";
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

function initAccount() {
  var loginRequired = $("login-required");
  var content = $("account-content");
  var name = $("account-client-name");
  var openLoginBtn = $("btn-open-login");
  if (openLoginBtn && window.ClientAuth) {
    openLoginBtn.addEventListener("click", function () { window.ClientAuth.openLogin(); });
  }
  var editBtn = $("btn-edit-account");
  if (editBtn && window.ClientAuth && window.ClientAuth.openAccountEdit) {
    editBtn.addEventListener("click", function () { window.ClientAuth.openAccountEdit(); });
  }
  function showLoggedIn(state, client) {
    if (loginRequired) loginRequired.classList.toggle("hidden", state);
    if (content) content.classList.toggle("hidden", !state);
    if (name && client) name.textContent = client.first_name || "";
    if (client) {
      var first = $("account-info-first");
      var last = $("account-info-last");
      var phone = $("account-info-phone");
      var emailRow = $("account-info-email-row");
      var email = $("account-info-email");
      if (first) first.textContent = client.first_name || "";
      if (last) last.textContent = client.last_name || "";
      if (phone) phone.textContent = (client.country_code || "+506") + " " + (client.phone || "");
      if (emailRow && email) {
        if (client.email) {
          email.textContent = client.email;
          emailRow.classList.remove("hidden");
        } else {
          emailRow.classList.add("hidden");
        }
      }
    }
  }
  window.API.auth.me().then(function (client) {
    showLoggedIn(true, client);
  }).catch(function () {
    showLoggedIn(false);
  });
  document.addEventListener("client:login", function (event) {
    showLoggedIn(true, event.detail);
  });
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
      appts = (appts || []).filter(function (a) { return a.status !== "cancelled"; });
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
    var summary = document.createElement("div");
     summary.className = "vehicle-summary rounded-2xl p-4";
    var summaryInner = document.createElement("div");
    summaryInner.className = "flex flex-col gap-4 sm:flex-row sm:items-center";
    if (v.front_photo) {
      var vehiclePhoto = document.createElement("img");
      vehiclePhoto.src = v.front_photo;
      vehiclePhoto.alt = v.plate;
      vehiclePhoto.className = "h-24 w-24 shrink-0 rounded-lg border border-slate-200 object-cover";
      summaryInner.appendChild(vehiclePhoto);
    }
    var summaryInfo = document.createElement("div");
    summaryInfo.className = "grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2";
    var items = [
      { label: t("vehicles_plate"), value: v.plate },
      { label: t("vehicles_make"), value: v.make || "—" },
      { label: t("vehicles_model"), value: v.model || "—" },
      { label: t("vehicles_engine"), value: v.engine || "—" },
      { label: t("vehicles_year"), value: v.year != null ? v.year : "—" },
    ];
    items.forEach(function (it) {
      var field = document.createElement("div");
      field.className = "vehicle-summary-tag inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm";
     field.innerHTML = "<span class='font-bold text-slate-800'>" + htmlEscape(it.label) + "</span><span class='text-slate-600'>" + htmlEscape(it.value) + "</span>";
      summaryInfo.appendChild(field);
    });
    summaryInner.appendChild(summaryInfo);
    summary.appendChild(summaryInner);
    tagsBox.appendChild(summary);
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

function getHomepageValue(source, path) {
  return path.split(".").reduce(function (value, key) {
    return value == null ? undefined : value[key];
  }, source);
}

function applyHomeSettings(data) {
  if (window.PAGE !== "home" || !data) return;
  var lang = window.I18N && window.I18N.lang === "en" ? "en" : "es";
  var content = data.homepage_content || {};
  var localeContent = {};
  Object.keys(content).forEach(function (section) {
    if (section === "services" && content.services) {
      localeContent.services = Object.assign({}, content.services, content.services[lang], {
        cards: (content.services.cards || []).map(function (card) { return card[lang] || {}; }),
      });
    } else if (content[section] && content[section][lang]) {
      localeContent[section] = content[section][lang];
    }
  });
  document.querySelectorAll("[data-home-field]").forEach(function (el) {
    var value = getHomepageValue(localeContent, el.getAttribute("data-home-field"));
    if (value != null && typeof value !== "object") el.textContent = String(value);
  });

  var layout = data.homepage_layout || {};
  var main = document.querySelector(".public-main");
  var sections = {};
  document.querySelectorAll("[data-home-section]").forEach(function (section) {
    sections[section.getAttribute("data-home-section")] = section;
  });
  var visibility = layout.section_visibility || {};
  Object.keys(sections).forEach(function (name) {
    sections[name].classList.toggle("hidden", visibility[name] === false);
  });
  if (main && Array.isArray(layout.section_order)) {
    layout.section_order.forEach(function (name) {
      if (sections[name]) main.appendChild(sections[name]);
    });
  }
  var sizes = layout.sizes || {};
  if (sections.hero && sizes.hero_min_height) sections.hero.style.minHeight = sizes.hero_min_height + "px";
  document.querySelectorAll(".home-section").forEach(function (section) {
    if (sizes.section_padding) {
      section.style.paddingTop = sizes.section_padding + "px";
      section.style.paddingBottom = sizes.section_padding + "px";
    }
  });
  document.querySelectorAll(".service-card-image").forEach(function (image) {
    if (sizes.service_card_image_height) image.style.height = sizes.service_card_image_height + "px";
  });
  document.querySelectorAll(".home-cta").forEach(function (cta) {
    if (sizes.cta_padding) {
      cta.style.paddingTop = sizes.cta_padding + "px";
      cta.style.paddingBottom = sizes.cta_padding + "px";
    }
  });

  var images = data.background_images || [];
  var imageIndices = layout.image_indices || {};
  var heroIndex = Number.isInteger(imageIndices.hero) ? imageIndices.hero : 0;
  var hero = document.querySelector("[data-home-hero-image]");
  if (hero && images[heroIndex]) hero.style.backgroundImage = "url(\"" + images[heroIndex] + "\")";
  var serviceIndices = Array.isArray(imageIndices.services) ? imageIndices.services : [];
  document.querySelectorAll("[data-service-image]").forEach(function (el, position) {
    var index = Number.isInteger(serviceIndices[position]) ? serviceIndices[position] : position;
    var src = images[index];
    if (!src) return;
    el.classList.add("has-image");
    el.style.backgroundImage = "url(\"" + src + "\")";
  });
}

function wireHistoryBackButtons() {
  document.querySelectorAll("[data-history-back]").forEach(function (button) {
    if (button.dataset.historyWired) return;
    button.dataset.historyWired = "true";
    button.addEventListener("click", function (event) {
      event.preventDefault();
      if (document.referrer && document.referrer.indexOf(window.location.origin) === 0 && window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/user/";
      }
    });
  });
}

document.addEventListener("i18n:ready", () => {
  if (window.__initDone) return;
  window.__initDone = true;
  wireHistoryBackButtons();
  if (window.PAGE === "schedule") initSchedule();
  if (window.PAGE === "status") initStatus();
  if (window.PAGE === "vehicles") initVehicles();
  if (window.PAGE === "account") initAccount();
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
  applyHomeSettings(window.siteBrandingData);
  document.addEventListener("site:branding", function (event) { applyHomeSettings(event.detail); });
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

document.addEventListener("i18n:ready", function () {
  if (window.__initDone) applyHomeSettings(window.siteBrandingData);
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
