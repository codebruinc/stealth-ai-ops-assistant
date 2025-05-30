-- ======================================
-- 👤 Update clients table to add updated_at column
-- ======================================

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'clients'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE clients
        ADD COLUMN updated_at timestamp with time zone default timezone('utc', now());
    END IF;
END $$;