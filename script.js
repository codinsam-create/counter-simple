(() => {
  const STORAGE_KEY = "counter.value";
  const PENDING_KEY = "counter.pending.v1";
  const TOTAL_KEY_PREFIX = "counter.total.";

  const valueEl = document.getElementById("value");
  const incrementBtn = document.getElementById("increment");
  const decrementBtn = document.getElementById("decrement");
  const resetBtn = document.getElementById("reset");
  const installBtn = document.getElementById("install");
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("hint");
  const accountLabelEl = document.getElementById("account-label");
  const accountBtn = document.getElementById("account-btn");
  const syncEl = document.getElementById("sync");

  const authDialog = document.getElementById("auth-dialog");
  const authForm = document.getElementById("auth-form");
  const authTitle = document.getElementById("auth-title");
  const authIntro = document.getElementById("auth-intro");
  const authEmail = document.getElementById("auth-email");
  const authPassword = document.getElementById("auth-password");
  const authError = document.getElementById("auth-error");
  const authCancel = document.getElementById("auth-cancel");
  const authSubmit = document.getElementById("auth-submit");
  const authSwitch = document.getElementById("auth-switch");

  // --- Supabase -------------------------------------------------------------

  const config = window.COUNTER_CONFIG;
  const sb =
    window.supabase && config?.supabaseUrl && config?.supabaseKey
      ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      : null;

  // --- Zustand --------------------------------------------------------------

  let anonCount = readStoredValue();
  let pending = readPending();
  let session = null;
  let currentUserId = null;
  let serverTotal = 0;
  let flushing = false;
  let flushQueued = false;
  let syncError = null;
  let authMode = "signin";
  let installPrompt = null;

  function currentUser() {
    return session?.user ?? null;
  }

  function newId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0;
      const value = char === "x" ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  // --- Lokaler Speicher -----------------------------------------------------

  function readStoredValue() {
    try {
      const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(stored) ? stored : 0;
    } catch {
      return 0;
    }
  }

  function persistAnon() {
    try {
      localStorage.setItem(STORAGE_KEY, String(anonCount));
    } catch {
      // Speicher nicht verfügbar (z. B. Privatmodus) – Zähler funktioniert trotzdem.
    }
  }

  function readPending() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (event) =>
          event &&
          typeof event.id === "string" &&
          Number.isInteger(event.delta) &&
          event.delta !== 0 &&
          (event.userId === null || typeof event.userId === "string"),
      );
    } catch {
      return [];
    }
  }

  function persistPending() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      // Kein Speicher – Events gehen beim Neuladen verloren, die Anzeige stimmt trotzdem.
    }
  }

  function readCachedTotal(userId) {
    try {
      const stored = Number.parseInt(localStorage.getItem(TOTAL_KEY_PREFIX + userId), 10);
      return Number.isFinite(stored) ? stored : 0;
    } catch {
      return 0;
    }
  }

  function writeCachedTotal(userId, value) {
    try {
      localStorage.setItem(TOTAL_KEY_PREFIX + userId, String(value));
    } catch {
      // Optionaler Cache – die App funktioniert auch ohne.
    }
  }

  // --- Anzeige --------------------------------------------------------------

  function displayValue() {
    const user = currentUser();
    if (!user) return anonCount;

    const pendingSum = pending
      .filter((event) => event.userId === user.id)
      .reduce((sum, event) => sum + event.delta, 0);

    return serverTotal + pendingSum;
  }

  function render() {
    const value = displayValue();
    valueEl.value = value;
    valueEl.textContent = value;
    updateSyncUI();
  }

  function bump() {
    valueEl.classList.remove("bump");
    // Reflow erzwingen, damit die Animation erneut startet.
    void valueEl.offsetWidth;
    valueEl.classList.add("bump");
  }

  function update(delta) {
    const user = currentUser();

    if (user) {
      pending.push({ id: newId(), delta, userId: user.id });
      persistPending();
      flush();
    } else {
      anonCount += delta;
      persistAnon();
    }

    render();
    bump();
  }

  function reset() {
    const user = currentUser();
    const value = displayValue();

    if (user) {
      // Reset ist ebenfalls ein Delta: der aktuelle Stand wird abgezogen.
      if (value !== 0) {
        pending.push({ id: newId(), delta: -value, userId: user.id });
        persistPending();
        flush();
      }
    } else {
      anonCount = 0;
      persistAnon();
    }

    render();
    bump();
  }

  // --- Sync -----------------------------------------------------------------

  function updateSyncUI() {
    const user = currentUser();

    if (!user) {
      syncEl.hidden = true;
      return;
    }

    const count = pending.filter((event) => event.userId === user.id).length;
    let text = "";

    if (syncError) {
      text = syncError;
    } else if (flushing) {
      text = "Synchronisiere …";
    } else if (!navigator.onLine) {
      text = count
        ? `${count} ${count === 1 ? "Änderung wartet" : "Änderungen warten"} auf Verbindung`
        : "Offline – Zählungen bleiben lokal.";
    } else if (count) {
      text = `${count} ${count === 1 ? "Änderung wird" : "Änderungen werden"} übertragen …`;
    }

    syncEl.textContent = text;
    syncEl.hidden = !text;
    syncEl.classList.toggle("is-error", Boolean(syncError));
  }

  async function refreshTotal() {
    const user = currentUser();
    if (!sb || !user || !navigator.onLine) return;

    try {
      const { data, error } = await sb.rpc("counter_total");
      if (error) throw error;
      if (currentUser()?.id !== user.id) return;

      serverTotal = Number(data) || 0;
      writeCachedTotal(user.id, serverTotal);
      render();
    } catch (error) {
      console.warn("Zählerstand konnte nicht geladen werden:", error);
    }
  }

  async function flush() {
    const user = currentUser();
    if (!sb || !user) return;

    if (!navigator.onLine) {
      updateSyncUI();
      return;
    }

    if (flushing) {
      flushQueued = true;
      return;
    }

    const batch = pending.filter((event) => event.userId === user.id);
    if (!batch.length) {
      updateSyncUI();
      return;
    }

    flushing = true;
    syncError = null;
    updateSyncUI();

    try {
      // ignoreDuplicates macht den Upload idempotent: Ein bereits bekanntes
      // client_event_id wird stillschweigend übersprungen.
      const { error } = await sb.from("counter_events").upsert(
        batch.map((event) => ({
          delta: event.delta,
          client_event_id: event.id,
        })),
        { onConflict: "user_id,client_event_id", ignoreDuplicates: true },
      );
      if (error) throw error;

      const sentIds = new Set(batch.map((event) => event.id));
      pending = pending.filter((event) => !sentIds.has(event.id));
      persistPending();

      await refreshTotal();
    } catch (error) {
      console.warn("Sync fehlgeschlagen:", error);
      syncError = "Sync fehlgeschlagen – wird später erneut versucht.";
    } finally {
      flushing = false;
      render();

      if (flushQueued) {
        flushQueued = false;
        flush();
      }
    }
  }

  function migrateAnonymous(userId) {
    if (anonCount === 0) return;

    pending.push({ id: newId(), delta: anonCount, userId });
    anonCount = 0;
    persistAnon();
    persistPending();
  }

  async function startSession(user) {
    if (currentUser()?.id !== user.id) return;

    serverTotal = readCachedTotal(user.id);
    migrateAnonymous(user.id);
    render();

    // Erst hochladen (entfernt bestätigte Events), dann den Serverstand holen.
    await flush();
    await refreshTotal();
  }

  // --- Konto-UI -------------------------------------------------------------

  function updateAccountUI() {
    const user = currentUser();

    if (user) {
      accountLabelEl.textContent = user.email || "Angemeldet";
      accountLabelEl.title = user.email || "";
      accountBtn.textContent = "Abmelden";
      accountBtn.dataset.action = "signout";
    } else {
      accountLabelEl.textContent = "Nur auf diesem Gerät";
      accountLabelEl.title = "";
      accountBtn.textContent = "Anmelden";
      accountBtn.dataset.action = "signin";
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";

    authTitle.textContent = signup ? "Konto erstellen" : "Anmelden";
    authIntro.textContent = signup
      ? "Erstelle ein Konto, um deinen Zähler auf mehreren Geräten zu synchronisieren."
      : "Melde dich an, um deinen Zähler auf mehreren Geräten zu synchronisieren.";
    authSubmit.textContent = signup ? "Registrieren" : "Anmelden";
    authSwitch.textContent = signup
      ? "Schon ein Konto? Anmelden"
      : "Noch kein Konto? Registrieren";
    authPassword.autocomplete = signup ? "new-password" : "current-password";
    authError.hidden = true;
  }

  function openAuth(mode) {
    setAuthMode(mode);
    authForm.reset();
    authDialog.showModal();
    authEmail.focus();
  }

  function showAuthError(message) {
    authError.textContent = message;
    authError.hidden = false;
  }

  function setAuthBusy(busy) {
    authSubmit.disabled = busy;
    authForm.setAttribute("aria-busy", String(busy));
    authSubmit.textContent = busy
      ? "Bitte warten …"
      : authMode === "signup"
        ? "Registrieren"
        : "Anmelden";
  }

  function authErrorMessage(error) {
    const message = String(error?.message || error);

    if (/invalid login credentials/i.test(message)) {
      return "E-Mail oder Passwort ist falsch.";
    }
    if (/user already registered/i.test(message)) {
      return "Für diese E-Mail gibt es bereits ein Konto.";
    }
    if (/password should be at least/i.test(message)) {
      return "Das Passwort muss mindestens 6 Zeichen haben.";
    }
    if (/email not confirmed/i.test(message)) {
      return "Bitte bestätige zuerst die E-Mail-Adresse.";
    }
    if (/rate limit|after \d+ seconds/i.test(message)) {
      return "Zu viele Versuche. Bitte kurz warten.";
    }
    if (/failed to fetch|network/i.test(message)) {
      return "Keine Verbindung zum Server. Bitte später erneut versuchen.";
    }
    return message;
  }

  async function signOut() {
    if (!sb) return;

    try {
      // "local" entfernt die Session nur auf diesem Gerät und funktioniert
      // auch ohne Netzwerkverbindung.
      await sb.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("Abmelden fehlgeschlagen:", error);
    }
  }

  accountBtn.addEventListener("click", () => {
    if (accountBtn.dataset.action === "signout") {
      signOut();
    } else {
      openAuth("signin");
    }
  });

  authSwitch.addEventListener("click", () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
  });

  authCancel.addEventListener("click", () => authDialog.close());

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email || password.length < 6) {
      showAuthError("Bitte gib eine E-Mail und ein Passwort mit mindestens 6 Zeichen ein.");
      return;
    }
    if (!sb) {
      showAuthError("Supabase ist nicht konfiguriert.");
      return;
    }

    setAuthBusy(true);
    try {
      const { error } =
        authMode === "signup"
          ? await sb.auth.signUp({ email, password })
          : await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data } = await sb.auth.getSession();
      if (!data.session) {
        showAuthError(
          "Konto erstellt. Bitte bestätige zuerst die E-Mail und melde dich dann an.",
        );
        return;
      }

      authDialog.close();
    } catch (error) {
      showAuthError(authErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  });

  if (sb) {
    sb.auth.onAuthStateChange((event, newSession) => {
      // Die initiale Session laden wir in init() selbst.
      if (event === "INITIAL_SESSION") return;

      session = newSession;
      const user = newSession?.user ?? null;
      updateAccountUI();

      if (!user) {
        currentUserId = null;
        serverTotal = 0;
        syncError = null;
        render();
        return;
      }

      if (currentUserId === user.id) {
        render();
        return;
      }

      currentUserId = user.id;
      syncError = null;
      // Nicht direkt im Auth-Callback auf die Datenbank zugreifen.
      setTimeout(() => startSession(user), 0);
    });
  }

  // --- Zähler-Eingaben ------------------------------------------------------

  incrementBtn.addEventListener("click", () => update(1));
  decrementBtn.addEventListener("click", () => update(-1));
  resetBtn.addEventListener("click", reset);

  valueEl.addEventListener("animationend", () => valueEl.classList.remove("bump"));

  document.addEventListener("keydown", (event) => {
    if (authDialog.open) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;

    switch (event.key) {
      case "ArrowUp":
      case "+":
      case "=":
        event.preventDefault();
        update(1);
        break;
      case "ArrowDown":
      case "-":
        event.preventDefault();
        update(-1);
        break;
      case "r":
      case "R":
        event.preventDefault();
        reset();
        break;
    }
  });

  // --- PWA: Installation anbieten -------------------------------------------

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (!isStandalone) {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      installBtn.hidden = false;
    });
  }

  installBtn.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installBtn.hidden = true;
  });

  // iOS bietet kein beforeinstallprompt – dort hilft nur der manuelle Weg.
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !isStandalone) {
    hintEl.textContent =
      "Installieren: Teilen-Symbol antippen → „Zum Home-Bildschirm“.";
  }

  // --- PWA: Offline-Status --------------------------------------------------

  function updateOnlineStatus() {
    const offline = !navigator.onLine;
    statusEl.classList.toggle("is-visible", offline);
    statusEl.setAttribute("aria-hidden", String(!offline));
    updateSyncUI();
  }

  window.addEventListener("online", () => {
    updateOnlineStatus();
    if (currentUser()) {
      flush();
      refreshTotal();
    }
  });
  window.addEventListener("offline", updateOnlineStatus);

  // Beim Zurückkehren in den Tab den Stand anderer Geräte nachziehen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentUser()) {
      flush();
      refreshTotal();
    }
  });

  // --- PWA: Service Worker --------------------------------------------------

  if ("serviceWorker" in navigator && window.isSecureContext) {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Nur neu laden, wenn bereits eine alte Version aktiv war (Update,
      // nicht die allererste Installation).
      if (hadController) window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.error("Service Worker konnte nicht registriert werden:", error);
      });
    });
  }

  // --- Shortcut aus dem Manifest: ./?reset=1 --------------------------------

  function applyResetParam() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("reset")) return;

    reset();
    params.delete("reset");
    const query = params.toString();
    history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }

  // --- Start ----------------------------------------------------------------

  async function init() {
    updateAccountUI();
    updateOnlineStatus();
    render();

    if (sb) {
      try {
        const { data } = await sb.auth.getSession();
        session = data.session;

        if (session?.user) {
          currentUserId = session.user.id;
          updateAccountUI();
          await startSession(session.user);
        }
      } catch (error) {
        console.warn("Session konnte nicht geladen werden:", error);
      }
    }

    updateAccountUI();
    applyResetParam();
    render();
  }

  init();
})();
