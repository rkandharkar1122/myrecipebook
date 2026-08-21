import { useState } from 'react';

function Inbox({ onAdd }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      await onAdd(trimmed);
      setUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="inbox" onSubmit={handleSubmit}>
      <input
        type="url"
        placeholder="Paste a recipe blog link…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="Recipe blog URL"
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add recipe'}
      </button>
      {error && <p className="inbox-error">{error}</p>}
    </form>
  );
}

export default Inbox;
