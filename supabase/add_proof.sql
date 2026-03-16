ALTER TABLE medication_schedules ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Create storage bucket for proofs if it doesn't exist (Supabase dashboard usually required for this,
-- but we provide the SQL just in case permissions allow)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for the proofs bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'proofs');
CREATE POLICY "Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'proofs' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update" ON storage.objects FOR UPDATE USING (bucket_id = 'proofs' AND auth.role() = 'authenticated');
