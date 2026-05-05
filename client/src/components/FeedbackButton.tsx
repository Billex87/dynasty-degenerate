import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Lightbulb, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_FEEDBACK_ENDPOINT = 'https://formspree.io/f/mzdogzgl';
const FEEDBACK_SUBMITTED_KEY = 'dynasty-degenerates-feedback-submitted';

function getStoredFeedbackSubmitted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FEEDBACK_SUBMITTED_KEY) === 'true';
  } catch {
    return false;
  }
}

type FeedbackButtonProps = {
  compact?: boolean;
  className?: string;
  leagueId?: string;
  leagueName?: string;
  leagueFormat?: string;
};

export function FeedbackButton({
  compact = false,
  className = '',
  leagueId,
  leagueName,
  leagueFormat,
}: FeedbackButtonProps) {
  const endpoint = String(import.meta.env.VITE_FEEDBACK_FORM_ENDPOINT || '').trim() || DEFAULT_FEEDBACK_ENDPOINT;
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [idea, setIdea] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(getStoredFeedbackSubmitted);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setIdea('');
    setCompany('');
    setError('');
    setIsSubmitting(false);
    setIsSubmitted(false);
  };

  const markFeedbackSubmitted = () => {
    setHasSubmittedFeedback(true);
    try {
      window.localStorage.setItem(FEEDBACK_SUBMITTED_KEY, 'true');
    } catch {
      // The modal confirmation still prevents repeat sends for this render.
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (!open) {
      resetTimerRef.current = window.setTimeout(resetForm, 180);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (company.trim()) {
      setIsSubmitted(true);
      markFeedbackSubmitted();
      return;
    }

    const trimmedIdea = idea.trim();
    if (trimmedIdea.length < 8) {
      setError('Give us a little more detail so we know what to build.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          idea: trimmedIdea,
          message: trimmedIdea,
          leagueId: leagueId?.trim() || undefined,
          leagueName: leagueName?.trim() || undefined,
          leagueFormat: leagueFormat?.trim() || undefined,
          page: typeof window !== 'undefined' ? window.location.href : undefined,
          _replyto: email.trim() || undefined,
          _subject: 'Dynasty Degenerates site idea',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = Array.isArray(data?.errors)
          ? data.errors.map((item: { message?: string }) => item.message).filter(Boolean).join(' ')
          : '';
        throw new Error(message || 'The idea box did not submit. Try again in a minute.');
      }

      setIsSubmitted(true);
      markFeedbackSubmitted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The idea box did not submit. Try again in a minute.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {!hasSubmittedFeedback ? (
        <button
          type="button"
          className={`support-button feedback-button ${compact ? 'support-button-compact feedback-button-compact' : ''} ${className}`.trim()}
          onClick={() => setIsOpen(true)}
        >
          <Lightbulb aria-hidden="true" className="support-button-icon" />
          <span>{compact ? 'Got Ideas?' : 'Got Ideas For Us?'}</span>
        </button>
      ) : null}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="feedback-dialog border-cyan-500/25 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-950/30 sm:max-w-lg">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="athletic-headline feedback-dialog-title">
              Got Ideas For Us?
            </DialogTitle>
            <DialogDescription className="feedback-dialog-description">
              Send the feature, fix, or league-report read you want next.
            </DialogDescription>
          </DialogHeader>

          {isSubmitted ? (
            <div className="feedback-success" role="status" aria-live="polite">
              <Sparkles aria-hidden="true" />
              <h3>Idea Sent</h3>
              <p>It landed in the suggestion inbox.</p>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={handleSubmit}>
              <input
                type="text"
                name="company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="feedback-honeypot"
                tabIndex={-1}
                aria-hidden="true"
                autoComplete="off"
              />

              <div className="feedback-field-grid">
                <label>
                  <span>Name</span>
                  <Input
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Optional"
                    className="feedback-input"
                  />
                </label>
                <label>
                  <span>Email</span>
                  <Input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Optional"
                    className="feedback-input"
                  />
                </label>
              </div>

              <label className="feedback-field">
                <span>Idea</span>
                <Textarea
                  name="idea"
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="Tell us what would make the report better."
                  className="feedback-textarea"
                  required
                />
              </label>

              {error && <p className="feedback-error">{error}</p>}

              <DialogFooter className="feedback-footer sm:justify-center">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 sm:w-auto"
                >
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {isSubmitting ? 'Sending...' : 'Send Idea'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
