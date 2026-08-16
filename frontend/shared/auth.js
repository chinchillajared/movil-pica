/* Client (public site) authentication UI.
   Injects a compact login/account control into each [data-auth-ui] header slot:
   - Logged in:  "Hola, Nombre" + gear icon
   - Not logged: "Iniciar sesión/Registrarse" button + gear icon
   The gear icon opens a dropdown with Language, My account, Sign out. */

(function () {
  var t = function (k) { return (window.I18N && window.I18N.t) ? window.I18N.t(k) : k; };

  var GEAR_SVG = '<img src="/icons/gear.svg" alt="" class="w-5 h-5 block" />';

  function currentClient() { return getClientUser(); }

  function isLoggedIn() { return !!getClientTokens().access && !!currentClient(); }

  function gearButton(label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50";
    btn.setAttribute("aria-label", label);
    btn.innerHTML = GEAR_SVG;
    return btn;
  }

  function buildGearMenu(host, loggedIn) {
    var wrap = document.createElement("div");
    wrap.className = "relative";

    var gear = gearButton(t("language"));
    var menu = document.createElement("div");
    menu.className = "hidden absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[220px] z-50";

    var langBlock = document.createElement("div");
    langBlock.className = "px-4 py-2 border-b border-slate-100";
    var langLabel = document.createElement("p");
    langLabel.className = "text-xs uppercase tracking-wide text-slate-400 mb-1";
    langLabel.textContent = t("language");
    var langSwitcher = document.createElement("div");
    langSwitcher.setAttribute("data-lang-switcher", "");
    langSwitcher.className = "flex items-center gap-1";
    langBlock.appendChild(langLabel);
    langBlock.appendChild(langSwitcher);
    menu.appendChild(langBlock);

    if (loggedIn) {
      var logout = document.createElement("button");
      logout.type = "button";
      logout.className = "w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50";
      logout.textContent = t("client_logout");
      logout.addEventListener("click", function () {
        closeMenu();
        clearClientSession();
        window.location.reload();
      });
      menu.appendChild(logout);
    }

    function closeMenu() {
      menu.classList.add("hidden");
      document.removeEventListener("click", outside);
    }
    function outside(e) {
      if (!wrap.contains(e.target)) closeMenu();
    }
    gear.addEventListener("click", function (e) {
      e.stopPropagation();
      var isHidden = menu.classList.contains("hidden");
      menu.classList.toggle("hidden");
      if (!isHidden) { document.removeEventListener("click", outside); return; }
      if (window.I18N && window.I18N.buildSwitcher) window.I18N.buildSwitcher();
      setTimeout(function () { document.addEventListener("click", outside); }, 0);
    });

    wrap.appendChild(gear);
    wrap.appendChild(menu);
    host.appendChild(wrap);
  }

  function buildAccountMenu(host) {
    var wrap = document.createElement("div");
    wrap.className = "relative";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "client-header-action";
    var icon = document.createElement("img");
    icon.src = "/icons/person.svg";
    icon.alt = "";
    icon.className = "h-4 w-4 shrink-0";
    var label = document.createElement("span");
    label.textContent = t("account_nav");
    btn.appendChild(icon);
    btn.appendChild(label);

    var menu = document.createElement("div");
    menu.className = "hidden absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg py-1 min-w-[220px] z-50";

    var items = [
      { key: "nav_garage", href: "/user/vehicles.html" },
      { key: "appointments_title", href: "/user/appointments.html" },
      { key: "nav_schedule", href: "/user/schedule.html" },
      { key: "account_info", href: "/user/account.html" },
    ];
    items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = item.href;
      link.className = "block w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100";
      link.textContent = t(item.key);
      menu.appendChild(link);
    });

    function closeMenu() {
      menu.classList.add("hidden");
      document.removeEventListener("click", outside);
    }
    function outside(e) {
      if (!wrap.contains(e.target)) closeMenu();
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var isHidden = menu.classList.contains("hidden");
      menu.classList.toggle("hidden");
      if (!isHidden) { document.removeEventListener("click", outside); return; }
      setTimeout(function () { document.addEventListener("click", outside); }, 0);
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    host.appendChild(wrap);
  }

  function openAccountModal(startEditing) {
    var c = currentClient();
    var overlay = document.createElement("div");
    overlay.className = "auth-modal-overlay";
    overlay.innerHTML =
      '<div class="auth-modal-card">' +
        '<div class="auth-modal-header">' +
          '<h2 class="text-xl font-bold" id="account-modal-title"></h2>' +
          '<button type="button" id="account-modal-close" class="auth-modal-close">&times;</button>' +
        '</div>' +
        '<div id="account-modal-body" class="auth-modal-body"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("account-modal-title").textContent = startEditing ? t("client_edit") : t("client_my_account");

    var body = overlay.querySelector("#account-modal-body");
    if (startEditing) {
      buildAccountEditForm(body, c, overlay);
    } else {
      var tags = document.createElement("div");
      tags.className = "flex flex-wrap justify-center gap-2";
      var rows = [
        { k: "label_first_name", v: c.first_name },
        { k: "label_last_name", v: c.last_name },
        { k: "label_phone", v: (c.country_code || "+506") + " " + c.phone },
      ];
      if (c.email) rows.push({ k: "client_email", v: c.email });
      rows.forEach(function (r) {
        var tag = document.createElement("span");
        tag.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white text-sm";
        tag.innerHTML = '<span class="font-bold text-slate-800">' + escapeHtml(t(r.k)) + '</span> <span class="text-slate-600">' + escapeHtml(r.v) + '</span>';
        tags.appendChild(tag);
      });
      body.appendChild(tags);

      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-secondary w-full mt-4";
      editBtn.textContent = t("client_edit");
      editBtn.addEventListener("click", function () { buildAccountEditForm(body, c, overlay); });
      body.appendChild(editBtn);
    }

    overlay.querySelector("#account-modal-close").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
  }

  function buildAccountEditForm(body, c, overlay) {
    body.innerHTML = "";
    var order = [];
    order.push(field("edit-first", "text", "label_first_name", "placeholder_first_name", false));
    order.push(field("edit-last", "text", "label_last_name", "placeholder_last_name", false));
    order.push(field("edit-email", "email", "client_email", "client_email", false));
    var hint = document.createElement("p");
    hint.className = "text-xs text-slate-500 -mt-2 mb-3";
    hint.textContent = t("client_email_hint");
    order.push(hint);
    order.push(field("edit-phone", "tel", "label_phone", "placeholder_phone", false));
    order.forEach(function (el) { body.appendChild(el); });
    document.getElementById("edit-first").value = c.first_name || "";
    document.getElementById("edit-last").value = c.last_name || "";
    document.getElementById("edit-email").value = c.email || "";
    document.getElementById("edit-phone").value = c.phone || "";

    var err = document.createElement("div");
    err.id = "edit-error";
    err.className = "hidden mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3";
    body.appendChild(err);

    var saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-primary w-full";
    saveBtn.textContent = t("client_save");
    saveBtn.addEventListener("click", function () {
      saveBtn.disabled = true;
      err.classList.add("hidden");
      var payload = {
        first_name: document.getElementById("edit-first").value.trim(),
        last_name: document.getElementById("edit-last").value.trim(),
        email: document.getElementById("edit-email").value.trim(),
        phone: document.getElementById("edit-phone").value.trim(),
      };
      if (!payload.first_name || !payload.last_name || !payload.phone) {
        saveBtn.disabled = false;
        err.textContent = t("required_field");
        err.classList.remove("hidden");
        return;
      }
      window.API.auth.updateMe(payload).then(function (updated) {
        setClientUser(updated);
        overlay.remove();
        render();
        prefillForm();
      }).catch(function (e) {
        saveBtn.disabled = false;
        err.textContent = e.message || t("error_generic");
        err.classList.remove("hidden");
      });
    });
    body.appendChild(saveBtn);
  }

  function render() {
    document.querySelectorAll("[data-auth-ui]").forEach(function (host) {
      host.innerHTML = "";
      var loggedIn = isLoggedIn();
      if (loggedIn) {
        buildAccountMenu(host);
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700";
        var fullLabel = document.createElement("span");
        fullLabel.className = "client-login-label-full";
        fullLabel.textContent = t("client_login_register");
        var shortLabel = document.createElement("span");
        shortLabel.className = "client-login-label-short";
        shortLabel.textContent = t("client_login");
        btn.appendChild(fullLabel);
        btn.appendChild(shortLabel);
        btn.addEventListener("click", function () { openModal("login"); });
        host.appendChild(btn);
      }
      buildGearMenu(host, loggedIn);
    });
    if (window.I18N && window.I18N.buildSwitcher) window.I18N.buildSwitcher();
  }

  function buildHeaderAction(href, labelKey, iconName) {
    var link = document.createElement("a");
    link.href = href;
    link.className = "client-header-action";
    var icon = document.createElement("img");
    icon.src = "/icons/" + iconName;
    icon.alt = "";
    icon.className = "h-4 w-4 shrink-0";
    var label = document.createElement("span");
    label.textContent = t(labelKey);
    link.appendChild(icon);
    link.appendChild(label);
    return link;
  }

  function field(id, type, labelKey, placeholderKey, required) {
    var wrap = document.createElement("div");
    wrap.className = "mb-3 text-left";
    var label = document.createElement("label");
    label.className = "field-label";
    label.textContent = t(labelKey);
    var input = document.createElement("input");
    input.id = id;
    input.type = type;
    input.className = "field-input";
    input.placeholder = t(placeholderKey);
    input.required = required;
    wrap.appendChild(label);
    wrap.appendChild(input);
    return wrap;
  }

  function openModal(mode) {
    var overlay = document.createElement("div");
    overlay.className = "auth-modal-overlay";
    overlay.innerHTML =
      '<div class="auth-modal-card">' +
        '<div class="auth-modal-header">' +
          '<h2 class="text-xl font-bold" id="auth-modal-title"></h2>' +
          '<button type="button" id="auth-modal-close" class="auth-modal-close">&times;</button>' +
        '</div>' +
        '<div id="auth-modal-body" class="auth-modal-body"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var body = overlay.querySelector("#auth-modal-body");
    var title = overlay.querySelector("#auth-modal-title");

    function build(m) {
      title.textContent = m === "login" ? t("client_login") : t("client_register");
      body.innerHTML = "";
      if (m === "register") {
        body.appendChild(field("auth-first", "text", "label_first_name", "placeholder_first_name", true));
        body.appendChild(field("auth-last", "text", "label_last_name", "placeholder_last_name", true));
        body.appendChild(field("auth-phone", "tel", "label_phone", "placeholder_phone", true));
      } else {
        body.appendChild(field("auth-identifier", "tel", "client_identifier", "client_identifier_ph", true));
      }
      body.appendChild(field("auth-pass", "password", "client_password", "client_password", true));

      var err = document.createElement("div");
      err.id = "auth-error";
      err.className = "hidden mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3";
      body.appendChild(err);

      var submit = document.createElement("button");
      submit.type = "button";
      submit.className = "btn-primary w-full";
      submit.textContent = m === "login" ? t("client_submit_login") : t("client_submit_register");
      submit.addEventListener("click", function () { doSubmit(m, err); });
      body.appendChild(submit);

      var switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.className = "mt-3 w-full text-sm text-brand-700 hover:underline";
      switchBtn.textContent = m === "login" ? t("client_switch_register") : t("client_switch_login");
      switchBtn.addEventListener("click", function () { build(m === "login" ? "register" : "login"); });
      body.appendChild(switchBtn);
    }

    function showErr(el, msg) {
      el.textContent = msg;
      el.classList.remove("hidden");
    }

    function doSubmit(m, err) {
      err.classList.add("hidden");
      var pass = document.getElementById("auth-pass").value;
      if (m === "register") {
        var payload = {
          first_name: document.getElementById("auth-first").value.trim(),
          last_name: document.getElementById("auth-last").value.trim(),
          phone: document.getElementById("auth-phone").value.trim(),
          country_code: "+506",
          password: pass,
        };
        if (!payload.first_name || !payload.last_name || !payload.phone || !pass) { showErr(err, t("required_field")); return; }
        window.API.auth.register(payload).then(handleAuth).catch(function (e) {
          var detail = e.data && e.data.detail;
          if (detail === "phone already registered") showErr(err, t("client_phone_exists"));
          else showErr(err, e.message || t("error_generic"));
        });
      } else {
        var identifier = document.getElementById("auth-identifier").value.trim();
        if (!identifier || !pass) { showErr(err, t("required_field")); return; }
        window.API.auth.login({ identifier: identifier, password: pass }).then(handleAuth).catch(function (e) {
          if (e.status === 401) {
            var detail = e.data && e.data.detail;
            showErr(err, detail === "client_not_registered" ? t("client_not_registered") : t("client_invalid_credentials"));
          } else showErr(err, e.message || t("error_generic"));
        });
      }
    }

    function handleAuth(data) {
      setClientTokens(data);
      setClientUser(data.client);
      overlay.remove();
      render();
      prefillForm();
      document.dispatchEvent(new CustomEvent("client:login", { detail: data.client }));
      window.location.href = "/user/account.html";
    }

    overlay.querySelector("#auth-modal-close").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    build(mode);
  }

  function prefillForm() {
    var c = currentClient();
    if (!c) return;
    var map = { first_name: c.first_name, last_name: c.last_name, phone: c.phone };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.value) el.value = map[id];
    });
  }

  function tryRefresh() {
    return window.API.refreshClientToken();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function isValidEmail(v) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  }

  document.addEventListener("i18n:ready", render);
  window.ClientAuth = { render: render, prefillForm: prefillForm, tryRefresh: tryRefresh, isLoggedIn: isLoggedIn, currentClient: currentClient, openLogin: function () { openModal("login"); }, openAccount: function () { openAccountModal(false); }, openAccountEdit: function () { openAccountModal(true); } };
})();
