function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function RecipeList({ recipes, selectedId, onSelect, onDelete }) {
  if (!recipes.length) {
    return <p className="empty-state">No recipes yet — paste a link above to get started.</p>;
  }

  return (
    <ul className="recipe-list">
      {recipes.map((recipe) => (
        <li key={recipe.id} className={recipe.id === selectedId ? 'active' : ''}>
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
