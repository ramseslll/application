// backend/server.js - Point d'entrée du serveur
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const userRoutes = require('./routes/userRoutes');
const foodRoutes = require('./routes/foodRoutes');
const mealRoutes = require('./routes/mealRoutes');
const planRoutes = require('./routes/planRoutes');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/health', healthRoutes);

// Connexion à la base de données
mongoose.connect(config.mongoURI)
  .then(() => console.log('Connexion à MongoDB réussie'))
  .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Démarrage du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// backend/models/User.js - Modèle utilisateur
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  height: Number, // en cm
  weight: Number, // en kg
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
  },
  goal: {
    type: String,
    enum: ['lose', 'maintain', 'gain'],
    default: 'maintain'
  },
  dailyCalorieGoal: Number,
  macroGoals: {
    protein: Number, // en g
    carbs: Number,   // en g
    fat: Number      // en g
  },
  weightHistory: [{
    weight: Number,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Méthode pour hacher le mot de passe avant sauvegarde
UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Méthode pour comparer les mots de passe
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

// backend/models/Food.js - Modèle pour les aliments
const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  brand: String,
  barcode: String,
  servingSize: {
    amount: Number,
    unit: String
  },
  calories: Number, // kcal par portion
  macros: {
    protein: Number, // g par portion
    carbs: Number,   // g par portion
    fat: Number      // g par portion
  },
  micros: {
    fiber: Number,
    sugar: Number,
    sodium: Number,
    cholesterol: Number,
    // Vitamines
    vitaminA: Number,
    vitaminC: Number,
    vitaminD: Number,
    // etc.
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  source: {
    type: String,
    enum: ['usda', 'user', 'admin'],
    default: 'user'
  },
  usdaFoodId: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Food', FoodSchema);

// backend/models/Meal.js - Modèle pour les repas
const mongoose = require('mongoose');

const FoodItemSchema = new mongoose.Schema({
  food: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true
  }
});

const MealSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
    default: 'other'
  },
  items: [FoodItemSchema],
  date: {
    type: Date,
    default: Date.now
  },
  totalCalories: Number,
  totalMacros: {
    protein: Number,
    carbs: Number,
    fat: Number
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculer les totaux avant de sauvegarder
MealSchema.pre('save', async function(next) {
  // Supposons que nous avons déjà rempli les données des aliments
  // Dans un cas réel, vous devriez utiliser populate() pour obtenir ces informations
  let totalCals = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  // Dans un vrai scénario, ceci serait une opération plus complexe
  // impliquant des calculs basés sur les quantités et les unités
  this.items.forEach(item => {
    // Calculs fictifs, à ajuster avec la logique réelle
    const factor = item.quantity; // À adapter selon les unités
    totalCals += item.food.calories * factor;
    totalProtein += item.food.macros.protein * factor;
    totalCarbs += item.food.macros.carbs * factor;
    totalFat += item.food.macros.fat * factor;
  });
  
  this.totalCalories = totalCals;
  this.totalMacros = {
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFat
  };
  
  next();
});

module.exports = mongoose.model('Meal', MealSchema);

// backend/controllers/userController.js - Contrôleur pour les utilisateurs
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { calculateTDEE } = require('../utils/metabolismCalculator');

// Inscription d'un nouvel utilisateur
exports.registerUser = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      height,
      weight,
      activityLevel,
      goal
    } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Calculer les besoins caloriques et macros
    const tdee = calculateTDEE(gender, weight, height, dateOfBirth, activityLevel);
    
    // Ajuster selon l'objectif
    let calorieGoal = tdee;
    if (goal === 'lose') calorieGoal = tdee - 500; // Déficit de 500 kcal
    if (goal === 'gain') calorieGoal = tdee + 500; // Surplus de 500 kcal

    // Calculer les macros recommandées (exemple simplifié)
    const proteinPerKg = 2.0; // 2g de protéines par kg de poids corporel
    const protein = Math.round(weight * proteinPerKg);
    const fat = Math.round((calorieGoal * 0.25) / 9); // 25% des calories en lipides
    const remainingCalories = calorieGoal - (protein * 4) - (fat * 9);
    const carbs = Math.round(remainingCalories / 4); // Le reste en glucides

    // Créer le nouvel utilisateur
    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      height,
      weight,
      activityLevel,
      goal,
      dailyCalorieGoal: calorieGoal,
      macroGoals: {
        protein,
        carbs,
        fat
      },
      weightHistory: [{ weight, date: new Date() }]
    });

    await newUser.save();

    // Générer un token JWT
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        dailyCalorieGoal: newUser.dailyCalorieGoal,
        macroGoals: newUser.macroGoals
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
  }
};

// Connexion utilisateur
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trouver l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Générer un token JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dailyCalorieGoal: user.dailyCalorieGoal,
        macroGoals: user.macroGoals
      }
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

// backend/routes/foodRoutes.js - Routes pour les aliments
const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');
const authMiddleware = require('../middleware/authMiddleware');

// Routes publiques
router.get('/search', foodController.searchFood);
router.get('/barcode/:code', foodController.getFoodByBarcode);

// Routes protégées (nécessitent authentification)
router.post('/', authMiddleware, foodController.createFood);
router.get('/favorites', authMiddleware, foodController.getFavorites);
router.post('/favorites/:id', authMiddleware, foodController.addToFavorites);
router.delete('/favorites/:id', authMiddleware, foodController.removeFromFavorites);
router.get('/recent', authMiddleware, foodController.getRecentlyUsed);

module.exports = router;
