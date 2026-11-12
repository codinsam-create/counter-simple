// Supabase-Implementierung der Backend-Schnittstelle.
//
// Vertrag (siehe script.js):
//   init()                 -> Promise<user|null>
//   onChange(callback)     -> callback(user|null)
//   signUp(email, password)
//   signIn(email, password)
//   signOut()
//   pushEvents(events)     -> events: [{ id, delta }], idempotent
//   fetchTotal()           -> Promise<number>
//
// user ist immer { id: string, email: string } oder null.

(() => {
  function create(config) {
    const sb = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });

    let user = null;
    const listeners = new Set();

    function normalize(session) {
      const raw = session?.user;
      return raw ? { id: raw.id, email: raw.email } : null;
    }

    function notify(next) {
      const changed = (next?.id ?? null) !== (user?.id ?? null);
      user = next;
      if (!changed) return;
      listeners.forEach((callback) => callback(user));
    }

    sb.auth.onAuthStateChange((event, session) => {
      // Die initiale Session lädt script.js über init().
      if (event === "INITIAL_SESSION") return;
      notify(normalize(session));
    });

    return {
      async init() {
        const { data, error } = await sb.auth.getSession();
        if (error) throw error;
        user = normalize(data.session);
        return user;
      },

      onChange(callback) {
        listeners.add(callback);
      },

      async signUp(email, password) {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;

        const { data } = await sb.auth.getSession();
        if (!data.session) {
          throw new Error(
            "Konto erstellt. Bitte bestätige zuerst die E-Mail und melde dich dann an.",
          );
        }
      },

      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },

      async signOut() {
        // "local" entfernt die Session nur auf diesem Gerät und funktioniert
        // auch ohne Netzwerkverbindung.
        const { error } = await sb.auth.signOut({ scope: "local" });
        if (error) throw error;
      },

      async pushEvents(events) {
        // ignoreDuplicates macht den Upload idempotent: Ein bereits bekanntes
        // client_event_id wird stillschweigend übersprungen.
        const { error } = await sb.from("counter_events").upsert(
          events.map((event) => ({
            delta: event.delta,
            client_event_id: event.id,
          })),
          { onConflict: "user_id,client_event_id", ignoreDuplicates: true },
        );
        if (error) throw error;
      },

      async fetchTotal() {
        const { data, error } = await sb.rpc("counter_total");
        if (error) throw error;
        return Number(data) || 0;
      },
    };
  }

  window.CounterBackends = window.CounterBackends || {};
  window.CounterBackends.supabase = { create };
})();
