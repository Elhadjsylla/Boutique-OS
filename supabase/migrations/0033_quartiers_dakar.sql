-- Create the quartiers_dakar table if it doesn't exist
CREATE TABLE IF NOT EXISTS quartiers_dakar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default values
INSERT INTO quartiers_dakar (nom)
VALUES 
  ('Dakar Plateau'),
  ('Médina'),
  ('Fann-Point E-Amitié'),
  ('Ouakam'),
  ('Yoff'),
  ('Ngor-Almadies'),
  ('Mermoz-Sacré Cœur'),
  ('Grand Dakar'),
  ('Parcelles Assainies'),
  ('Pikine'),
  ('Guédiawaye'),
  ('Rufisque')
ON CONFLICT (nom) DO NOTHING;

-- Grant access
GRANT SELECT ON quartiers_dakar TO authenticated, anon;
