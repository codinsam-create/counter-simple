// Öffentliche Supabase-Konfiguration.
//
// Der Publishable Key ist kein Geheimnis: Er identifiziert nur das Projekt und
// landet absichtlich im Browser. Der Schutz kommt aus Row Level Security in der
// Datenbank. Den Secret-/service_role-Key niemals hier eintragen.
window.COUNTER_CONFIG = {
  backend: "supabase",
  supabaseUrl: "https://vjhtjrwqujkywtxaqrdl.supabase.co",
  supabaseKey: "sb_publishable_ACDMgRgjUBCdhM843Q6xTQ_xJEZMsmA",
};
