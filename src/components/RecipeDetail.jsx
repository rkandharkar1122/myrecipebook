import { useState } from 'react';
import RecipeChat from './RecipeChat.jsx';

function RecipeDetail({ recipe, onAdaptationSaved }) {
  const contentTabs = [
    { key: 'ingredients', label: 'Ingredients', available: recipe.ingredients?.length > 0 },
    { key: 'steps', label: 'Steps', available: recipe.steps?.length > 0 },
    {
      key: 'nutrition',
      label: 'Nutrition',
      available: !!recipe.nutrition && Object.keys(recipe.nutrition).length > 0,
    },
  ].filter((tab) => tab.available);

  const tabs = [...contentTabs, { key: 'adapt', label: 'Adapt' }];

  const [activeTab, setActiveTab] = useState(tabs[0]?.key);

  return (
    <article className="recipe-detail">
      <header className="recipe-detail-header">
        {recipe.image && <img className="recipe-hero" src={recipe.image} alt="" />}
        <div>
          <h2>{recipe.title}</h2>
          <div className="recipe-detail-links">
            {recipe.sourceUrl && (
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                View original ↗
              </a>
            )}
            {recipe.derivedFrom && <span className="recipe-tag">Adapted</span>}
            {recipe.videoUrl && (
              <a href={recipe.videoUrl} target="_blank" rel="noreferrer">
                Watch video ↗
              </a>
            )}
          </div>
        </div>
      </header>

      {contentTabs.length === 0 && (
        <p className="empty-state">
          Couldn&apos;t find ingredients, steps, or nutrition info for this link.
        </p>
      )}

      <nav className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeTab}
            className={tab.key === activeTab ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel" role="tabpanel">
        {activeTab === 'ingredients' && (
          <>
            {(recipe.prepTime || recipe.cookTime || recipe.servings) && (
              <dl className="recipe-meta">
                {recipe.prepTime && (
                  <div className="recipe-meta-item">
                    <dt>Prep time</dt>
                    <dd>{recipe.prepTime}</dd>
                  </div>
                )}
                {recipe.cookTime && (
                  <div className="recipe-meta-item">
                    <dt>Cook time</dt>
                    <dd>{recipe.cookTime}</dd>
                  </div>
                )}
                {recipe.servings && (
                  <div className="recipe-meta-item">
                    <dt>Servings</dt>
                    <dd>{recipe.servings}</dd>
                  </div>
                )}
              </dl>
            )}
            <ul className="ingredients">
              {recipe.ingredients.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </>
        )}
        {activeTab === 'steps' && (
          <ol className="steps">
            {recipe.steps.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        )}
        {activeTab === 'nutrition' && (
          <dl className="nutrition">
            {Object.entries(recipe.nutrition).map(([label, value]) => (
              <div key={label} className="nutrition-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {activeTab === 'adapt' && (
          <RecipeChat recipe={recipe} onSaved={onAdaptationSaved} />
        )}
      </div>
    </article>
  );
}

export default RecipeDetail;
