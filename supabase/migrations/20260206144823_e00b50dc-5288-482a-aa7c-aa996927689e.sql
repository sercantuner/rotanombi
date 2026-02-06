-- Add new metadata columns to widgets table for AI-generated content
-- short_description: Brief description for Marketplace cards
-- long_description: Detailed documentation (Markdown supported)
-- technical_notes: JSONB with used fields, calculations, data flow
-- preview_image: Base64/URL for widget preview thumbnail
-- ai_suggested_tags: AI-suggested tags array

ALTER TABLE public.widgets 
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS long_description TEXT,
ADD COLUMN IF NOT EXISTS technical_notes JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preview_image TEXT,
ADD COLUMN IF NOT EXISTS ai_suggested_tags TEXT[] DEFAULT NULL;

-- Add comment for technical_notes structure
COMMENT ON COLUMN public.widgets.technical_notes IS 'JSON structure: {usedFields: [{name, type, usage}], calculations: [{name, formula, description}], dataFlow: string, chartType: string, generatedAt: string}';
COMMENT ON COLUMN public.widgets.short_description IS 'Brief description for Marketplace card (max 100 chars)';
COMMENT ON COLUMN public.widgets.long_description IS 'Detailed widget documentation (Markdown supported)';
COMMENT ON COLUMN public.widgets.preview_image IS 'Base64 encoded or URL of widget preview thumbnail';
COMMENT ON COLUMN public.widgets.ai_suggested_tags IS 'AI-suggested category tags for the widget';