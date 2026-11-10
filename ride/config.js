// Member database connection. Leave both values empty until the Supabase project exists (see SETUP-MEMBERS.md).
// Both values are meant to be public: the "publishable" (anon) key only lets signed-in, approved members
// do what the security rules in supabase/schema.sql allow. Never put the "secret" / service_role key here.
window.PST_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
