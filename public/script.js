let inventory = [];
let currentEditingId = null;
let allPublicRecipes = [];
let currentUser = null;

const addRecipeBtn = document.getElementById('addRecipeBtn');
const addRecipeModal = document.getElementById('addRecipeModal');
const addRecipeForm = document.getElementById('addRecipeForm');
const closeAddRecipeModal = document.getElementById('closeAddRecipeModal');
const cancelAddRecipeBtn = document.getElementById('cancelAddRecipeBtn');
const sortBtn = document.getElementById('sortBtn');
const sortItems = document.getElementById('sortItems');
const closeSortModal = document.getElementById('closeSortModal');
const resetSorting = document.getElementById('resetSorting');
const recipeBody = document.getElementById('recipeBody');
const recipeDetailsModal = document.getElementById("recipeDetailsModal");
const closeDetailsModal = document.getElementById("closeDetailsModal");

function addLogoutButton() {
    const nav = document.querySelector('nav ul');
    const logoutLi = document.createElement('li');
    logoutLi.innerHTML = '<button class="delete-bttn" id="logoutBtn">Logout</button>';
    nav.appendChild(logoutLi);
    
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            inventory = [];
            currentUser = null;
            window.location.href = '/login';
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

async function loadRecipes() {
    try {
        const data = await fetchWithAuth('/api/recipes');
        if (data) {
            inventory = data.recipes;
            displayRecipes();
        }
    } catch (error) {
        console.error('Error loading recipes:', error);
        alert('Failed to load recipes. Please try again.');
    }
}

async function loadPublicRecipes() {
    try {
        const response = await fetch('/api/public-recipes', {
            credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
            allPublicRecipes = data.recipes;
            displayPublicRecipes();
        } else {
            console.error('Failed to load public recipes:', data.message);
        }
    } catch (error) {
        console.error('Error loading public recipes:', error);
        alert('Failed to load public recipes. Please try again.');
    }
}

async function saveRecipesToServer() {
    try {
        const response = await fetch('/api/recipes/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ recipes: inventory })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to save recipes');
        }
    } catch (error) {
        console.error('Error saving recipes:', error);
        throw error;
    }
}

async function saveRecipe(recipe) {
    try {
        const response = await fetch('/api/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ recipe })
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                throw new Error(data.message || 'Failed to save recipe');
            } catch (e) {
                throw new Error(`Server error: ${text}`);
            }
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error saving recipe:', error);
        throw error;
    }
}

async function compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Invalid file type. Please select an image.'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;

                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedDataUrl);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function validateRecipeForm() {
    const name = document.getElementById('recipeName').value.trim();
    const ingredients = document.getElementById('ingredients').value.trim();
    const instructions = document.getElementById('recipeInst').value.trim();
    const imageInput = document.getElementById('recipeImage');
    const totalTime = document.getElementById('PCtime').value.trim();
    const servings = document.getElementById('servings').value;

    if (name.length < 3) {
        throw new Error('Recipe name must be at least 3 characters');
    }

    if (ingredients.length < 10) {
        throw new Error('Please provide more detailed ingredients');
    }

    if (instructions.length < 20) {
        throw new Error('Please provide more detailed instructions');
    }

    if (!totalTime) {
        throw new Error('Please specify total cooking time');
    }

    if (!servings || parseInt(servings) < 1) {
        throw new Error('Please specify number of servings');
    }

    if (!currentEditingId && (!imageInput.files || !imageInput.files[0])) {
        throw new Error('Please select an image');
    }

    return true;
}

function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

document.getElementById("itemSearch").addEventListener("keyup", searchRecipe);
function searchRecipe() {
    const query = document.getElementById("itemSearch").value.toLowerCase();
    const rows = document.querySelectorAll("#recipeBody tr");

    rows.forEach(row => {
        const nameCell = row.querySelector("td:nth-child(4)");
        const name = nameCell ? nameCell.textContent.toLowerCase() : '';
        row.style.display = name.includes(query) ? "" : "none";
    });
}

addRecipeBtn.onclick = () => {
    currentEditingId = null;
    addRecipeForm.reset();
    showModal(addRecipeModal);
};
closeAddRecipeModal.onclick = () => hideModal(addRecipeModal);
cancelAddRecipeBtn.onclick = () => {
    if (confirm("Cancel and discard changes?")) {
        addRecipeForm.reset();
        currentEditingId = null;
        hideModal(addRecipeModal);
    }
};
sortBtn.onclick = () => showModal(sortItems);
closeSortModal.onclick = () => hideModal(sortItems);
closeDetailsModal.onclick = () => hideModal(recipeDetailsModal);

const recipeInst = document.getElementById("recipeInst");
recipeInst.oninput = () => {
    recipeInst.style.height = "";
    recipeInst.style.height = Math.min(recipeInst.scrollHeight, 300) + "px";
};

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await getCurrentUser();
        addLogoutButton();
        await loadRecipes();
        console.log('After loadRecipes:', inventory);
    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '/login';
    }
});

function displayRecipes() {
    console.log('Displaying user recipes:', inventory);
    const recipeBody = document.getElementById('recipeBody');
    if (!recipeBody) return;

    recipeBody.innerHTML = '';
    
    const recipes = [...inventory].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    recipes.forEach(recipe => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${recipe.type || 'N/A'}</td>
            <td>
                <img src="${recipe.image || 'placeholder.jpg'}" 
                     alt="${recipe.name}" 
                     style="width: 100px; height: 100px; object-fit: cover;">
            </td>
            <td>${recipe.date || 'N/A'}</td>
            <td>
                <a href="#" class="recipe-link" data-id="${recipe.id}" data-public="false">
                    ${recipe.name}
                </a>
                ${recipe.isPublic ? '<br><small style="color: #28a745;">✓ Public</small>' : '<br><small style="color: #666;">Private</small>'}
            </td>
            <td>${recipe.difficulty || 'N/A'}</td>
        `;

        const recipeLink = row.querySelector('.recipe-link');
        recipeLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentEditingId = recipe.id;
            showRecipeDetails(recipe, true);
        });
        
        recipeBody.appendChild(row);
    });
}

function displayPublicRecipes() {
    console.log('Displaying public recipes:', allPublicRecipes);
    const recipeBody = document.getElementById('recipeBody');
    if (!recipeBody) return;

    recipeBody.innerHTML = '';

    const sortedRecipes = [...allPublicRecipes].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    sortedRecipes.forEach(recipe => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${recipe.type || 'N/A'}</td>
            <td>
                <img src="${recipe.image || 'placeholder.jpg'}" 
                     alt="${recipe.name}" 
                     style="width: 100px; height: 100px; object-fit: cover;">
            </td>
            <td>${recipe.date || 'N/A'}</td>
            <td>
                <a href="#" class="recipe-link" data-id="${recipe.id}" data-public="true">
                    ${recipe.name}
                </a>
                <br><small style="color: #666;">by ${recipe.author || 'Unknown'}</small>
            </td>
            <td>${recipe.difficulty || 'N/A'}</td>
        `;

        const recipeLink = row.querySelector('.recipe-link');
        recipeLink.addEventListener('click', (e) => {
            e.preventDefault();
            showPublicRecipeDetails(recipe);
        });
        
        recipeBody.appendChild(row);
    });
}

function appendRecipeToTable(recipe, isOwner) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${recipe.type}</td>
        <td><img src="${recipe.image || 'https://via.placeholder.com/50'}" alt="Recipe Image" width="150"/></td>
        <td>${recipe.date}</td>
        <td><a href="#" class="recipe-link" data-id="${recipe.id}">${recipe.name}</a></td>
        <td>${recipe.difficulty}</td>
    `;
    recipeBody.appendChild(row);
}

document.addEventListener("click", e => {
    if (e.target.classList.contains("recipe-link")) {
        e.preventDefault();
        const id = e.target.dataset.id;
        const recipe = inventory.find(r => r.id == id);
        if (recipe) {
            currentEditingId = recipe.id;
            showRecipeDetails(recipe);
        }
    }
});

function showRecipeDetails(recipe, isOwner = true) {
    document.getElementById("detailBackgroundImage").style.backgroundImage =
        `url(${recipe.image || 'https://via.placeholder.com/300'})`;

    document.getElementById("detailTitle").textContent = recipe.name;
    document.getElementById("detailType").textContent = recipe.type;
    document.getElementById("detailDifficulty").textContent = recipe.difficulty;
    document.getElementById("detailTime").textContent = recipe.totalTime;
    document.getElementById("detailServings").textContent = recipe.servings;    
    document.getElementById("detailIngredients").textContent = recipe.ingredients;
    document.getElementById("detailInstructions").textContent = recipe.instructions;
    document.getElementById("detailInfo").textContent = recipe.info || 'Not specified';
    document.getElementById("detailEquipment").textContent = recipe.equipment || 'Not specified';
    document.getElementById("detailTips").textContent = recipe.tips || 'None provided';
    document.getElementById("detailStorage").textContent = recipe.storage || 'Not specified';
    document.getElementById("detailDate").textContent = recipe.date;

    const editBtn = document.getElementById("editRecipeBtn");
    const deleteBtn = document.getElementById("deleteRecipeBtn");
    const shareBtn = document.getElementById("shareRecipeBtn");
    const downloadBtn = document.getElementById("downloadRecipePngBtn");
    
    if (isOwner) {
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
        shareBtn.style.display = 'inline-block';
        downloadBtn.style.display = 'inline-block';
    } else {
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
        shareBtn.style.display = 'inline-block';
        downloadBtn.style.display = 'inline-block';
    }

    window.currentRecipeDetails = recipe;
    
    showModal(recipeDetailsModal);
}

function showPublicRecipeDetails(recipe) {
    document.getElementById("detailBackgroundImage").style.backgroundImage =
        `url(${recipe.image || 'https://via.placeholder.com/300'})`;

    document.getElementById("detailTitle").textContent = recipe.name;
    document.getElementById("detailType").textContent = recipe.type;
    document.getElementById("detailDifficulty").textContent = recipe.difficulty;
    document.getElementById("detailTime").textContent = recipe.totalTime;
    document.getElementById("detailServings").textContent = recipe.servings;    
    document.getElementById("detailIngredients").textContent = recipe.ingredients;
    document.getElementById("detailInstructions").textContent = recipe.instructions;
    document.getElementById("detailInfo").textContent = recipe.info || 'Not specified';
    document.getElementById("detailEquipment").textContent = recipe.equipment || 'Not specified';
    document.getElementById("detailTips").textContent = recipe.tips || 'None provided';
    document.getElementById("detailStorage").textContent = recipe.storage || 'Not specified';
    document.getElementById("detailDate").textContent = recipe.date;

    const editBtn = document.getElementById("editRecipeBtn");
    const deleteBtn = document.getElementById("deleteRecipeBtn");
    const shareBtn = document.getElementById("shareRecipeBtn");
    const downloadBtn = document.getElementById("downloadRecipePngBtn");

    editBtn.style.display = 'none';
    deleteBtn.style.display = 'none';

    shareBtn.style.display = 'inline-block';
    downloadBtn.style.display = 'inline-block';

    window.currentRecipeDetails = recipe;
    
    showModal(recipeDetailsModal);
}

document.getElementById("editRecipeBtn").onclick = () => {
    const recipe = inventory.find(r => r.id === currentEditingId);
    if (!recipe) return;

    document.getElementById("recipeName").value = recipe.name;
    document.getElementById("type").value = recipe.type;
    document.getElementById("ingredients").value = recipe.ingredients;
    document.getElementById("recipeInst").value = recipe.instructions;
    document.getElementById("PCtime").value = recipe.totalTime;
    document.getElementById("servings").value = recipe.servings;
    document.getElementById("info").value = recipe.info || '';
    document.getElementById("equipment").value = recipe.equipment || '';
    document.getElementById("tips").value = recipe.tips || '';
    document.getElementById("storage").value = recipe.storage || '';
    document.getElementById("difficulty").value = recipe.difficulty;
    document.getElementById("isPublic").checked = recipe.isPublic || false;

    hideModal(recipeDetailsModal);
    showModal(addRecipeModal);
};

async function deleteRecipe(id) {
    if (!confirm('Are you sure you want to delete this recipe?')) {
        return;
    }

    try {
        const response = await fetch(`/api/recipes/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            inventory = inventory.filter(recipe => recipe.id !== id);
            displayRecipes();
            hideModal(recipeDetailsModal);
            currentEditingId = null;
        } else {
            throw new Error('Failed to delete recipe');
        }
    } catch (error) {
        alert('Error deleting recipe: ' + error.message);
    }
}

document.getElementById("deleteRecipeBtn").onclick = () => {
    if (currentEditingId) {
        deleteRecipe(currentEditingId);
    }
};

addRecipeForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const submitButton = document.getElementById('addRecipe');
    const originalText = submitButton.textContent;
    
    try {
        validateRecipeForm();

        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;
        
        const formData = new FormData(e.target);

        const recipeData = {
            id: currentEditingId || Date.now().toString(),
            name: formData.get('recipeName').trim(),
            type: formData.get('type'),
            difficulty: formData.get('difficulty'),
            totalTime: formData.get('PCtime').trim(),
            servings: parseInt(formData.get('servings'), 10),
            ingredients: formData.get('ingredients').trim(),
            instructions: formData.get('recipeInst').trim(),
            info: formData.get('info')?.trim() || '',
            equipment: formData.get('equipment')?.trim() || '',
            tips: formData.get('tips')?.trim() || '',
            storage: formData.get('storage')?.trim() || '',
            isPublic: formData.get('isPublic') === 'on',
            date: new Date().toLocaleDateString()
        };

        const imageFile = document.getElementById('recipeImage').files[0];
        if (imageFile) {
            try {
                console.log('Compressing image...');
                const compressedImage = await compressImage(imageFile);
                recipeData.image = compressedImage;
                console.log('Image compressed successfully');
            } catch (imageError) {
                throw new Error(`Image processing failed: ${imageError.message}`);
            }
        } else if (currentEditingId) {
            const existingRecipe = inventory.find(r => r.id === currentEditingId);
            if (existingRecipe && existingRecipe.image) {
                recipeData.image = existingRecipe.image;
            }
        }

        console.log('Saving recipe to server...');
        await saveRecipe(recipeData);

        if (currentEditingId) {
            const index = inventory.findIndex(r => r.id === currentEditingId);
            if (index !== -1) {
                inventory[index] = recipeData;
            }
        } else {
            inventory.push(recipeData);
        }

        displayRecipes();

        hideModal(addRecipeModal);
        e.target.reset();
        currentEditingId = null;
        
        alert('Recipe saved successfully!');
        
    } catch (error) {
        console.error('Form submission error:', error);
        alert(`Error saving recipe: ${error.message}`);
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
};

document.getElementById("applySortBtn").addEventListener("click", () => {
    let sortName = document.getElementById("sortByName").value;
    let sortDate = document.getElementById("sortByDate").value;

    let checkedTypes = Array.from(document.querySelectorAll('input[name="sortOrder"]:checked'))
        .map(cb => cb.value.toLowerCase());

    let filtered = inventory.filter(recipe => {
        return checkedTypes.length === 0 || checkedTypes.includes(recipe.type.toLowerCase().replace(/[\s&]+/g, '').replace(/desserts?/gi, ''));
    });

    if (sortName === "name") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortName === "name_desc") {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    if (sortDate === "date_asc") {
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortDate === "date_desc") {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    recipeBody.innerHTML = "";
    filtered.forEach(recipe => appendRecipeToTable(recipe));
    hideModal(sortItems);
});

resetSorting.onclick = () => {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('sortByName').selectedIndex = 0;
    document.getElementById('sortByDate').selectedIndex = 0;
    displayRecipes();
};

async function getCurrentUser() {
    try {
        const response = await fetch('/api/user/current', {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Not authenticated');
        }
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            return currentUser;
        }
    } catch (error) {
        window.location.href = '/login';
    }
}

async function handleTokenError(error) {
    if (error.message.includes('Token expired') || error.message.includes('Invalid token')) {
        inventory = [];
        currentUser = null;
        window.location.href = '/login';
        return;
    }
    throw error;
}

async function fetchWithAuth(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                ...options.headers,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                await handleTokenError(new Error(data.message));
                return null;
            }
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'downloadRecipePngBtn') {
        const detailInfo = document.querySelector('.detail-modal-content');
        if (detailInfo && typeof html2canvas !== 'undefined') {
            html2canvas(detailInfo).then(canvas => {
                const link = document.createElement('a');
                link.download = `${document.getElementById('detailTitle').textContent || 'recipe'}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(error => {
                console.error('Error generating PNG:', error);
                alert('Error generating PNG file');
            });
        }
    }
});

document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'shareRecipeBtn') {
        const recipe = window.currentRecipeDetails;
        if (recipe && recipe.isPublic) {
            const url = `${window.location.origin}/recipe/${recipe.id}`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Shareable link copied to clipboard!');
                }).catch(() => {
                    prompt('Copy this link:', url);
                });
            } else {
                prompt('Copy this link:', url);
            }
        } else {
            alert('This recipe must be public to share. Edit the recipe and check "Make Recipe Public".');
        }
    }
});