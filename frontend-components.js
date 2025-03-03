// frontend/App.js - Point d'entrée de l'application
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import AppNavigator from './navigation/AppNavigator';
import { ThemeProvider } from './context/ThemeContext';
import SplashScreen from './screens/SplashScreen';

const App = () => {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={<SplashScreen />} persistor={persistor}>
        <ThemeProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <StatusBar />
              <AppNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
};

export default App;

// frontend/navigation/AppNavigator.js - Navigation principale
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Écrans d'authentification
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';

// Écrans principaux
import DashboardScreen from '../screens/main/DashboardScreen';
import FoodScreen from '../screens/main/FoodScreen';
import JournalScreen from '../screens/main/JournalScreen';
import PlansScreen from '../screens/main/PlansScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Écrans de détail
import MealDetailScreen from '../screens/details/MealDetailScreen';
import FoodDetailScreen from '../screens/details/FoodDetailScreen';
import AddFoodScreen from '../screens/details/AddFoodScreen';
import BarcodeScannerScreen from '../screens/details/BarcodeScannerScreen';
import RecipeScreen from '../screens/details/RecipeScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Journal') {
            iconName = focused ? 'journal' : 'journal-outline';
          } else if (route.name === 'Food') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Plans') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Food" component={FoodScreen} />
      <Tab.Screen name="Plans" component={PlansScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated } = useSelector(state => state.auth);
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {!isAuthenticated ? (
        // Routes d'authentification
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        // Routes principales
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
          <Stack.Screen name="MealDetail" component={MealDetailScreen} />
          <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
          <Stack.Screen name="AddFood" component={AddFoodScreen} />
          <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} />
          <Stack.Screen name="Recipe" component={RecipeScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;

// frontend/screens/main/DashboardScreen.js - Écran principal du tableau de bord
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { fetchDailyStats, fetchWeeklyStats } from '../../store/actions/statsActions';
import MacroProgressCircle from '../../components/MacroProgressCircle';
import DailyMealsList from '../../components/DailyMealsList';
import WeightTrend from '../../components/WeightTrend';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorMessage from '../../components/ui/ErrorMessage';

const screenWidth = Dimensions.get('window').width;

const DashboardScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [refreshing, setRefreshing] = useState(false);
  
  // Récupération des données depuis le store Redux
  const { user } = useSelector(state => state.auth);
  const { daily, weekly, loading, error } = useSelector(state => state.stats);
  const { meals } = useSelector(state => state.meals);
  
  // Chargement initial des données
  useEffect(() => {
    loadData();
  }, []);
  
  // Fonction pour charger/actualiser les données
  const loadData = () => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchDailyStats()),
      dispatch(fetchWeeklyStats())
    ]).finally(() => setRefreshing(false));
  };
  
  // Données pour les graphiques
  const calorieChartData = {
    labels: weekly ? weekly.map(day => day.date) : [],
    datasets: [
      {
        data: weekly ? weekly.map(day => day.calories) : [],
        color: (opacity = 1) => theme.colors.primary,
        strokeWidth: 2
      },
      {
        data: Array(weekly?.length).fill(user.dailyCalorieGoal),
        color: (opacity = 1) => `rgba(231, 76, 60, ${opacity})`,
        strokeWidth: 2,
        withDots: false
      }
    ],
    legend: ["Calories consommées", "Objectif"]
  };
  
  // Calcul des données pour aujourd'hui
  const today = daily || {
    calories: 0,
    macros: { protein: 0, carbs: 0, fat: 0 },
    remaining: user?.dailyCalorieGoal || 2000
  };
  
  // Calcul des pourcentages de macronutriments
  const proteinPercentage = Math.min(100, (today.macros.protein / (user?.macroGoals?.protein || 1)) * 100);
  const carbsPercentage = Math.min(100, (today.macros.carbs / (user?.macroGoals?.carbs || 1)) * 100);
  const fatPercentage = Math.min(100, (today.macros.fat / (user?.macroGoals?.fat || 1)) * 100);
  
  if (loading && !refreshing) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return <ErrorMessage message={error} onRetry={loadData} />;
  }
  
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Résumé journalier */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Aujourd'hui</Text>
        <View style={styles.calorieContainer}>
          <View style={styles.calorieInfo}>
            <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>Consommé</Text>
            <Text style={[styles.calorieValue, { color: theme.colors.text }]}>{today.calories}</Text>
            <Text style={[styles.calorieUnit, { color: theme.colors.textSecondary }]}>kcal</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calorieInfo}>
            <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>Objectif</Text>
            <Text style={[styles.calorieValue, { color: theme.colors.text }]}>{user?.dailyCalorieGoal}</Text>
            <Text style={[styles.calorieUnit, { color: theme.colors.textSecondary }]}>kcal</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.calorieInfo}>
            <Text style={[styles.calorieLabel, { color: theme.colors.textSecondary }]}>Restant</Text>
            <Text style={[styles.calorieValue, { color: theme.colors.text }]}>{today.remaining}</Text>
            <Text style={[styles.calorieUnit, { color: theme.colors.textSecondary }]}>kcal</Text>
          </View>
        </View>
      </View>
      
      {/* Progression des macros */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Macronutriments</Text>
        <View style={styles.macroContainer}>
          <MacroProgressCircle
            percentage={proteinPercentage}
            color="#3498db"
            title="Protéines"
            value={`${today.macros.protein}g`}
            target={`${user?.macroGoals?.protein}g`}
          />
          <MacroProgressCircle
            percentage={carbsPercentage}
            color="#2ecc71"
            title="Glucides"
            value={`${today.macros.carbs}g`}
            target={`${user?.macroGoals?.carbs}g`}
          />
          <MacroProgressCircle
            percentage={fatPercentage}
            color="#f39c12"
            title="Lipides"
            value={`${today.macros.fat}g`}
            target={`${user?.macroGoals?.fat}g`}
          />
        </View>
      </View>
      
      {/* Graphique des calories sur 7 jours */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Calories sur 7 jours</Text>
        {weekly && weekly.length > 0 ? (
          <LineChart
            data={calorieChartData}
            width={screenWidth - 40}
            height={220}
            chartConfig={{
              backgroundColor: theme.colors.card,
              backgroundGradientFrom: theme.colors.card,
              backgroundGradientTo: theme.colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => theme.colors.text,
              labelColor: (opacity = 1) => theme.colors.textSecondary,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: theme.colors.primary
              }
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16
            }}
          />
        ) : (
          <Text style={[styles.noDataText, { color: theme.colors.textSecondary }]}>
            Pas assez de données pour afficher le graphique
          </Text>
        )}
      </View>
      
      {/* Repas d'aujourd'hui */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Repas d'aujourd'hui</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Journal')}>
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        <DailyMealsList 
          meals={meals} 
          onMealPress={(meal) => navigation.navigate('MealDetail', { mealId: meal.id })}
        />
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('Food')}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Ajouter un repas</Text>
        </TouchableOpacity>
      </View>
      
      {/* Tendance de poids */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Évolution du poids</Text>
        <WeightTrend 
          weightHistory={user?.weightHistory || []}
          onAddPress={() => navigation.navigate('Profile', { screen: 'WeightLog' })}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  calorieContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calorieInfo: {
    flex: 1,
    alignItems: 'center',
  },
  calorieLabel: {