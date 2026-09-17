import { useEffect, useState } from 'react';
import Inbox from './components/Inbox.jsx';
import RecipeList from './components/RecipeList.jsx';
import RecipeDetail from './components/RecipeDetail.jsx';
import RecipeIndex from './components/RecipeIndex.jsx';
import { fetchRecipes, addRecipe, renameRecipe, deleteRecipe } from './api.js';
import './App.css';

function App() {
  const [recipes, setRecipes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('library');

  useEffect(() => {
    fetchRecipes()
      .then((data) => {
        setRecipes(data);
        if (data.length) setSelectedId(data[0].id);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (url) => {
    const recipe = await addRecipe(url);
    setRecipes((prev) => [...prev, recipe]);
    setSelectedId(recipe.id);
  };

  const handleRename = async (id, title) => {
    const updated = await renameRecipe(id, title);
    setRecipes((prev) => prev.map((r) => (r.id === id ? updated : r)));
  };

  const handleDelete = async (id) => {
    await deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const handleSelectFromIndex = (id) => {
    setSelectedId(id);
    setView('library');
  };

  const handleAdaptationSaved = (recipe) => {
    setRecipes((prev) => [...prev, recipe]);
    setSelectedId(recipe.id);
  };

  const selectedRecipe = recipes.find((r) => r.id === selectedId) || null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>My Recipe Book</h1>
        <p>Paste a link to a recipe blog and we&apos;ll pull out the ingredients, steps, and nutrition info.</p>
        <Inbox onAdd={handleAdd} />
      </header>

      <nav className="view-nav">
        <button type="button" className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>
          My Recipes
        </button>
        <button type="button" className={view === 'index' ? 'active' : ''} onClick={() => setView('index')}>
          Index
        </button>
      </nav>

      {view === 'index' ? (
        <RecipeIndex recipes={recipes} onSelect={handleSelectFromIndex} />
      ) : (
        <main className="app-main">
          <aside className="app-sidebar">
            {loading ? (
              <p className="empty-state">Loading recipes…</p>
            ) : loadError ? (
              <p className="inbox-error">{loadError}</p>
            ) : (
              <RecipeList
                recipes={recipes}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            )}
          </aside>

          <section className="app-content">
            {selectedRecipe ? (
              <RecipeDetail
                key={selectedRecipe.id}
                recipe={selectedRecipe}
                onAdaptationSaved={handleAdaptationSaved}
              />
            ) : (
              <p className="empty-state">Select a recipe to see the details.</p>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
