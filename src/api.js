const API_BASE = '/api';

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response had no JSON body
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function fetchRecipes() {
  return fetch(`${API_BASE}/recipes`).then(handleResponse);
}

export function addRecipe(url) {
  return fetch(`${API_BASE}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then(handleResponse);
}

export function deleteRecipe(id) {
  return fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' }).then(handleResponse);
}
