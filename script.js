(() => {
  const STORAGE_KEY = "counter.value";

  const valueEl = document.getElementById("value");
  const incrementBtn = document.getElementById("increment");
  const decrementBtn = document.getElementById("decrement");
  const resetBtn = document.getElementById("reset");
  const installBtn = document.getElementById("install");
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("hint");

  let count = readStoredValue();
  let installPrompt = null;

  function readStoredValue() {
    try {
      const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(stored) ? stored : 0;
    } catch {
      return 0;
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, String(count));
    } catch {
      // Speicher nicht verfügbar (z. B. Privatmodus) – Zähler funktioniert trotzdem.
    }
  }

  function render() {
    valueEl.value = count;
    valueEl.textContent = count;
    persist();
  }

  function bump() {
    valueEl.classList.remove("bump");
    // Reflow erzwingen, damit die Animation erneut startet.
    void valueEl.offsetWidth;
    valueEl.classList.add("bump");
  }

  function update(delta) {
    count += delta;
    render();
    bump();
  }

  function reset() {
    count = 0;
    render();
    bump();
  }

  incrementBtn.addEventListener("click", () => update(1));
  decrementBtn.addEventListener("click", () => update(-1));
  resetBtn.addEventListener("click", reset);

  valueEl.addEventListener("animationend", () => valueEl.classList.remove("bump"));

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

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
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // --- PWA: Service Worker ------------------------------------------------

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

  const params = new URLSearchParams(window.location.search);
  if (params.has("reset")) {
    reset();
    params.delete("reset");
    const query = params.toString();
    history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
  }

  render();
})();
