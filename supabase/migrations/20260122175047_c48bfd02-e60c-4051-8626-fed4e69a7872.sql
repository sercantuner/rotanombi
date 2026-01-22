-- Widget değerlendirme ve feedback tablosu
CREATE TABLE public.widget_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  suggestion TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Feedback mesajları (konuşma) tablosu
CREATE TABLE public.widget_feedback_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.widget_feedback(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS aktif et
ALTER TABLE public.widget_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_feedback_messages ENABLE ROW LEVEL SECURITY;

-- widget_feedback policies
CREATE POLICY "Users can create their own feedback"
ON public.widget_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
ON public.widget_feedback FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending feedback"
ON public.widget_feedback FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Super admins can view all feedback"
ON public.widget_feedback FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all feedback"
ON public.widget_feedback FOR UPDATE
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete feedback"
ON public.widget_feedback FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- widget_feedback_messages policies
CREATE POLICY "Users can send messages to their feedback"
ON public.widget_feedback_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.widget_feedback wf
    WHERE wf.id = feedback_id AND wf.user_id = auth.uid()
  ) OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can view messages of their feedback"
ON public.widget_feedback_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.widget_feedback wf
    WHERE wf.id = feedback_id AND wf.user_id = auth.uid()
  ) OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Users can mark messages as read"
ON public.widget_feedback_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.widget_feedback wf
    WHERE wf.id = feedback_id AND wf.user_id = auth.uid()
  ) OR public.is_super_admin(auth.uid())
);

-- Updated at trigger
CREATE TRIGGER update_widget_feedback_updated_at
BEFORE UPDATE ON public.widget_feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index'ler
CREATE INDEX idx_widget_feedback_widget_id ON public.widget_feedback(widget_id);
CREATE INDEX idx_widget_feedback_user_id ON public.widget_feedback(user_id);
CREATE INDEX idx_widget_feedback_status ON public.widget_feedback(status);
CREATE INDEX idx_widget_feedback_messages_feedback_id ON public.widget_feedback_messages(feedback_id);