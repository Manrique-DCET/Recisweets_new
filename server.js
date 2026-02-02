const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render)
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your_actual_secret_key_here';

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

//MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recipesdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB successfully');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    recipes: [{
        type: mongoose.Schema.Types.Mixed,
        isPublic: {
            type: Boolean,
            default: false
        },
        author: {
            type: String,
            required: true
        }
    }],
    createdAt: {
        type: Date,

    }
});

const User = mongoose.model('User', userSchema);

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No authentication token'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
};

// Routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000
        });

        return res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        await newUser.save();

        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true, message: 'Account created successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/recipes', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        res.json({ recipes: user.recipes || [] });
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/recipes', authenticateToken, async (req, res) => {
    try {
        const { recipe } = req.body;

        if (!recipe || !recipe.name) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recipe data'
            });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!Array.isArray(user.recipes)) {
            user.recipes = [];
        }

        const existingIndex = user.recipes.findIndex(r => r.id === recipe.id);
        if (existingIndex !== -1) {
            user.recipes[existingIndex] = recipe;
        } else {
            user.recipes.push(recipe);
        }

        await user.save();

        res.json({
            success: true,
            message: 'Recipe saved successfully',
            recipe: recipe
        });
    } catch (error) {
        console.error('Save recipe error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while saving recipe'
        });
    }
});

app.post('/api/recipes/batch', authenticateToken, async (req, res) => {
    try {
        const { recipes } = req.body;

        if (!Array.isArray(recipes)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recipes data'
            });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.recipes = recipes;
        await user.save();

        res.json({
            success: true,
            message: 'Recipes saved successfully'
        });
    } catch (error) {
        console.error('Save recipes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while saving recipes'
        });
    }
});

app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.recipes = user.recipes.filter(recipe => recipe.id !== req.params.id);
        await user.save();

        res.json({
            success: true,
            message: 'Recipe deleted successfully'
        });
    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting recipe'
        });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');
        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/public-recipes', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({}, 'username recipes');
        const publicRecipes = [];

        users.forEach(user => {
            if (user.recipes && Array.isArray(user.recipes)) {
                const userPublicRecipes = user.recipes
                    .filter(recipe => recipe.isPublic === true)
                    .map(recipe => ({
                        ...recipe.toObject ? recipe.toObject() : recipe,
                        author: user.username,
                        authorId: user._id
                    }));
                publicRecipes.push(...userPublicRecipes);
            }
        });

        publicRecipes.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            recipes: publicRecipes,
            count: publicRecipes.length
        });
    } catch (error) {
        console.error('Error fetching public recipes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching public recipes'
        });
    }
});

app.get('/api/user/current', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const userRecipeCount = user.recipes ? user.recipes.length : 0;
        const userPublicRecipeCount = user.recipes ? user.recipes.filter(r => r.isPublic).length : 0;

        const users = await User.find({}, 'recipes');
        let totalPublicRecipes = 0;
        users.forEach(u => {
            if (u.recipes) {
                totalPublicRecipes += u.recipes.filter(r => r.isPublic).length;
            }
        });

        res.json({
            success: true,
            stats: {
                userRecipes: userRecipeCount,
                userPublicRecipes: userPublicRecipeCount,
                totalPublicRecipes: totalPublicRecipes
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics'
        });
    }
});

app.post('/api/recipes/save-public', authenticateToken, async (req, res) => {
    try {
        const { recipeId, authorId } = req.body;

        const originalUser = await User.findById(authorId);
        if (!originalUser) {
            return res.status(404).json({
                success: false,
                message: 'Original recipe author not found'
            });
        }

        const originalRecipe = originalUser.recipes.find(r => r.id === recipeId);
        if (!originalRecipe || !originalRecipe.isPublic) {
            return res.status(404).json({
                success: false,
                message: 'Public recipe not found'
            });
        }

        const currentUser = await User.findById(req.user.userId);

        const existingRecipe = currentUser.recipes.find(r => r.id === recipeId);
        if (existingRecipe) {
            return res.status(400).json({
                success: false,
                message: 'Recipe already in your collection'
            });
        }

        const savedRecipe = {
            ...originalRecipe.toObject ? originalRecipe.toObject() : originalRecipe,
            id: Date.now().toString(),
            originalId: recipeId,
            originalAuthor: originalUser.username,
            savedDate: new Date().toLocaleDateString(),
            isPublic: false
        };

        currentUser.recipes.push(savedRecipe);
        await currentUser.save();

        res.json({
            success: true,
            message: 'Recipe saved to your collection!',
            recipe: savedRecipe
        });
    } catch (error) {
        console.error('Error saving public recipe:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving recipe'
        });
    }
});

app.get('/api/public-recipe/:id', async (req, res) => {
    try {
        const users = await User.find({}, 'username recipes');
        let foundRecipe = null;
        for (const user of users) {
            const recipe = user.recipes.find(r => r.id === req.params.id && r.isPublic);
            if (recipe) {
                foundRecipe = { ...recipe, author: user.username };
                break;
            }
        }
        if (!foundRecipe) return res.status(404).json({ error: 'Not found' });
        res.json(foundRecipe);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/recipe/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'public-recipe.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Not Found'
    });
});

app.use((req, res, next) => {
    const publicPaths = ['/login', '/signup', '/api/auth/login', '/api/auth/signup'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    const token = req.cookies.token;
    if (!token && !req.path.startsWith('/api/auth')) {
        return res.redirect('/login');
    }
    next();
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});