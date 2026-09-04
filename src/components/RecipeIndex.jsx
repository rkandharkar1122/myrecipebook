import { useMemo, useRef } from 'react';

const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", '#'];

function groupByLetter(recipes) {
  const groups = new Map();
  for (const recipe of recipes) {
    const first = recipe.title?.trim()?.[0]?.toUpperCase() ?? '#';
    const letter = /[A-Z]/.test(first) ? first : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(recipe);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return groups;
}

function RecipeIndex({ recipes, onSelect }) {
  const groups = useMemo(() => groupByLetter(recipes), [recipes]);
  const sectionRefs = useRef({});

  const scrollToLetter = (letter) => {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!recipes.length) {
    return (
      <div className="index-page">
        <p className="empty-state">No recipes yet — add some links to build your index.</p>
      </div>
    );
  }

  return (
    <div className="index-page">
      <h2 className="index-title">Recipe Index</h2>

      <nav className="alphabet-nav" aria-label="Jump to letter">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            type="button"
            disabled={!groups.has(letter)}
            onClick={() => scrollToLetter(letter)}
          >
            {letter}
          </button>
        ))}
      </nav>

      <div className="index-sections">
        {ALPHABET.filter((letter) => groups.has(letter)).map((letter) => (
          <section
            key={letter}
            ref={(el) => {
              sectionRefs.current[letter] = el;
            }}
            className="index-section"
          >
            <h3>{letter}</h3>
            <ul>
              {groups.get(letter).map((recipe) => (
                <li key={recipe.id}>
                  <button type="button" onClick={() => onSelect(recipe.id)}>
                    {recipe.title}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default RecipeIndex;
