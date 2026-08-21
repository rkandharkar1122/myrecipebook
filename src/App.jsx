import { useEffect, useState } from 'react';
import Inbox from './components/Inbox.jsx';
import RecipeList from './components/RecipeList.jsx';
import RecipeDetail from './components/RecipeDetail.jsx';
import { fetchRecipes, addRecipe, deleteRecipe } from './api.js';
import './App.css';

function App() {
  const [recipes, setRecipes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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

  const handleDelete = async (id) => {
    await deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const selectedRecipe = recipes.find((r) => r.id === selectedId) || null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>My Recipe Book</h1>
        <p>Paste a link to a recipe blog and we&apos;ll pull out the ingredients, steps, and nutrition info.</p>
        <Inbox onAdd={handleAdd} />
      </header>

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
              onDelete={handleDelete}
            />
          )}
        </aside>

        <section className="app-content">
          {selectedRecipe ? (
            <RecipeDetail key={selectedRecipe.id} recipe={selectedRecipe} />
          ) : (
            <p className="empty-state">Select a recipe to see the details.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
