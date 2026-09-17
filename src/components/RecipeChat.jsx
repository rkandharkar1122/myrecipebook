import { useState } from 'react';
import { sendRecipeAdaptChat, saveAdaptedRecipe } from '../api.js';

const EXAMPLES = ['make it vegan', 'no nuts', 'dairy-free', 'lower sodium'];

function RecipeChat({ recipe, onSaved }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pendingAdaptation, setPendingAdaptation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedTitle, setSavedTitle] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const next = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    setSavedTitle(null);
    try {
      const { reply, adaptedRecipe } = await sendRecipeAdaptChat(recipe.id, next);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (adaptedRecipe) setPendingAdaptation(adaptedRecipe);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSave = async () => {
    if (!pendingAdaptation || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await saveAdaptedRecipe(recipe.id, pendingAdaptation);
      setSavedTitle(created.title);
      setPendingAdaptation(null);
      onSaved(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="recipe-chat">
      <p className="chat-intro">
        Describe a dietary restriction and we&apos;ll rewrite this recipe for you.
      </p>

      {messages.length > 0 && (
        <div className="chat-messages">
          {messages.map((m, i) => (
            <p key={i} className={`chat-message ${m.role}`}>
              {m.content}
            </p>
          ))}
          {sending && <p className="chat-message assistant chat-pending">Thinking…</p>}
        </div>
      )}

      <p className="chat-hint">Try: {EXAMPLES.join(' · ')}</p>

      <form className="chat-input" onSubmit={handleSubmit}>
        <textarea
          value={input}
          placeholder="Describe the dietary restriction…"
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          aria-label="Dietary restriction request"
        />
        <button type="submit" disabled={sending || !input.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error && <p className="chat-error">{error}</p>}
      {savedTitle && <p className="chat-saved">Saved “{savedTitle}” to your recipes.</p>}

      {pendingAdaptation && (
        <div className="adapted-preview">
          <h4>{pendingAdaptation.title}</h4>
          {(pendingAdaptation.servings ||
            pendingAdaptation.prepTime ||
            pendingAdaptation.cookTime) && (
            <p className="adapted-preview-meta">
              {[
                pendingAdaptation.servings && `Serves ${pendingAdaptation.servings}`,
                pendingAdaptation.prepTime && `Prep ${pendingAdaptation.prepTime}`,
                pendingAdaptation.cookTime && `Cook ${pendingAdaptation.cookTime}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {pendingAdaptation.notes && (
            <p className="adapted-preview-notes">{pendingAdaptation.notes}</p>
          )}
          <strong>Ingredients</strong>
          <ul>
            {pendingAdaptation.ingredients.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <strong>Steps</strong>
          <ol>
            {pendingAdaptation.steps.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save as new recipe'}
          </button>
        </div>
      )}
    </div>
  );
}

export default RecipeChat;
