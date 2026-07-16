-- 1. Create role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vendly_app') THEN
    CREATE ROLE vendly_app WITH LOGIN PASSWORD 'REPLACE_ME';
  END IF;
END
$$;

-- 2. Grant permissions
GRANT USAGE ON SCHEMA public TO vendly_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vendly_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vendly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vendly_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vendly_app;

-- 3. Enable RLS on tables
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_admins ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
DROP POLICY IF EXISTS vendor_isolation ON vendors;
DROP POLICY IF EXISTS vendor_isolation_select ON vendors;
DROP POLICY IF EXISTS vendor_isolation_insert ON vendors;
DROP POLICY IF EXISTS vendor_isolation_update ON vendors;
DROP POLICY IF EXISTS vendor_isolation_delete ON vendors;

CREATE POLICY vendor_isolation_select ON vendors FOR SELECT TO vendly_app USING (true);
CREATE POLICY vendor_isolation_insert ON vendors FOR INSERT TO vendly_app WITH CHECK (id = current_setting('app.current_vendor_id', true)::uuid);
CREATE POLICY vendor_isolation_update ON vendors FOR UPDATE TO vendly_app USING (id = current_setting('app.current_vendor_id', true)::uuid);
CREATE POLICY vendor_isolation_delete ON vendors FOR DELETE TO vendly_app USING (id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON customers;
CREATE POLICY vendor_isolation ON customers TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON orders;
CREATE POLICY vendor_isolation ON orders TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON menu_items;
CREATE POLICY vendor_isolation ON menu_items TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON conversations;
CREATE POLICY vendor_isolation ON conversations TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON pending_orders;
CREATE POLICY vendor_isolation ON pending_orders TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON promotions;
CREATE POLICY vendor_isolation ON promotions TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON broadcasts;
CREATE POLICY vendor_isolation ON broadcasts TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON payments;
CREATE POLICY vendor_isolation ON payments TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

DROP POLICY IF EXISTS vendor_isolation ON vendor_admins;
CREATE POLICY vendor_isolation ON vendor_admins TO vendly_app
  USING (vendor_id = current_setting('app.current_vendor_id', true)::uuid);

-- Tables that join through conversations
DROP POLICY IF EXISTS vendor_isolation ON messages;
CREATE POLICY vendor_isolation ON messages TO vendly_app
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE vendor_id = current_setting('app.current_vendor_id', true)::uuid
    )
  );