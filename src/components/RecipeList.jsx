import { useState } from 'react';

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function RecipeList({ recipes, selectedId, onSelect, onRename, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');

  if (!recipes.length) {
    return <p className="empty-state">No recipes yet — paste a link above to get started.</p>;
  }

  const startEdit = (recipe) => {
    setEditingId(recipe.id);
    setDraftTitle(recipe.title);
  };

  const commitEdit = (id) => {
    setEditingId((current) => {
      if (current !== id) return current;
      const trimmed = draftTitle.trim();
      if (trimmed) onRename(id, trimmed);
      return null;
    });
  };

  return (
    <ul className="recipe-list">
      {recipes.map((recipe) => (
        <li key={recipe.id} className={recipe.id === selectedId ? 'active' : ''}>
          {editingId === recipe.id ? (
            <form
              className="recipe-list-item recipe-list-item-editing"
              onSubmit={(e) => {
                e.preventDefault();
                commitEdit(recipe.id);
              }}
            >
              {recipe.image ? (
                <img src={recipe.image} alt="" />
              ) : (
                <span className="recipe-list-thumb-placeholder" aria-hidden="true" />
              )}
              <input
                className="recipe-list-title-input"
                value={draftTitle}
                autoFocus
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={() => commitEdit(recipe.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingId(null);
                }}
                aria-label="Recipe title"
              />
            </form>
          ) : (
            <>
              <button type="button" className="recipe-list-item" onClick={() => onSelect(recipe.id)}>
                {recipe.image ? (
                  <img src={recipe.image} alt="" />
                ) : (
                  <span className="recipe-list-thumb-placeholder" aria-hidden="true" />
                )}
                <span className="recipe-list-text">
                  <span className="recipe-list-title">{recipe.title}</span>
                  <span className="recipe-list-url">{hostnameOf(recipe.sourceUrl)}</span>
                </span>
              </button>
              <button
                type="button"
                className="edit"
                aria-label={`Rename ${recipe.title}`}
                onClick={() => startEdit(recipe)}
              >
                ✎
              </button>
            </>
          )}
          <button
            type="button"
            className="delete"
            aria-label={`Remove ${recipe.title}`}
            onClick={() => onDelete(recipe.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export default RecipeList;
