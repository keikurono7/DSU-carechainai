import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../global.js';

export default function DietScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [username, setUsername] = useState(null);
  const [dietPlan, setDietPlan] = useState(null);

  useEffect(() => {
    checkUserAndLoadData();
  }, []);

  const checkUserAndLoadData = async () => {
    try {
      const email = await SecureStore.getItemAsync('userEmail');
      if (email) {
        setUserEmail(email);
        const username = email.split('@')[0];
        setUsername(username);
        fetchDietPlan(email);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking user authentication:', error);
      setLoading(false);
    }
  };

  const fetchDietPlan = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wellness-plan/${id}`);
      const data = await response.json();
      
      if (data.success && data.plan) {
        setDietPlan(data.plan);
      } else {
        console.log('No wellness plan found:', data.message);
      }
    } catch (error) {
      console.error('Error fetching diet plan:', error);
      Alert.alert('Error', 'Failed to fetch diet plan. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateDietPlan = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'You must be logged in to generate a diet plan.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-wellness-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          patient_id: username,  // Keep this for web compatibility
          email: userEmail       // Add this for app compatibility
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDietPlan(data.plan);
        Alert.alert('Success', 'Wellness plan generated successfully!');
      } else {
        Alert.alert('Error', data.message || 'Failed to generate wellness plan.');
      }
    } catch (error) {
      console.error('Error generating diet plan:', error);
      Alert.alert('Error', 'Failed to generate wellness plan. Please try again later.');
    } finally {
      setGenerating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (username) {
      fetchDietPlan(username);
    } else {
      setRefreshing(false);
    }
  };

  const renderDietPlan = () => {
    if (!dietPlan) return null;

    return (
      <View style={styles.planContainer}>
        {dietPlan.generated_at && (
          <Text style={styles.generatedDate}>Generated on: {dietPlan.generated_at}</Text>
        )}
        
        {/* Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.text}>{dietPlan.overview}</Text>
        </View>

        {/* Diet Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Meal Plan</Text>
          {dietPlan.diet && Object.entries(dietPlan.diet).map(([mealType, items]) => (
            <View key={mealType} style={styles.mealCard}>
              <Text style={styles.mealTitle}>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</Text>
              {items.map((item, index) => (
                <View key={index} style={styles.mealItem}>
                  <View style={styles.bullet} />
                  <Text style={styles.mealItemText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Exercise Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercise Recommendations</Text>
          {dietPlan.exercise && dietPlan.exercise.map((exercise, index) => (
            <View key={index} style={styles.exerciseCard}>
              <Text style={styles.exerciseTitle}>{exercise.activity}</Text>
              <View style={styles.exerciseDetails}>
                <View style={styles.exerciseDetail}>
                  <MaterialIcons name="access-time" size={16} color="#4a6da7" />
                  <Text style={styles.exerciseDetailText}>{exercise.duration}</Text>
                </View>
                <View style={styles.exerciseDetail}>
                  <MaterialIcons name="repeat" size={16} color="#4a6da7" />
                  <Text style={styles.exerciseDetailText}>{exercise.frequency}</Text>
                </View>
                <View style={styles.intensityBadge(exercise.intensity.toLowerCase())}>
                  <Text style={styles.intensityText(exercise.intensity.toLowerCase())}>
                    {exercise.intensity}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Lifestyle Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle Tips</Text>
          {dietPlan.lifestyle && dietPlan.lifestyle.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipHeader}>
                <View style={styles.tipIcon}>
                  <Ionicons name={getTipIcon(tip.type)} size={16} color="#4a6da7" />
                </View>
                <Text style={styles.tipType}>{tip.type}</Text>
              </View>
              <Text style={styles.tipText}>{tip.tip}</Text>
            </View>
          ))}
        </View>

        {/* Precautions Section - Only show if there are precautions */}
        {dietPlan.precautions && dietPlan.precautions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Precautions</Text>
            <View style={styles.precautionsCard}>
              {dietPlan.precautions.map((precaution, index) => (
                <View key={index} style={styles.precautionItem}>
                  <MaterialIcons name="warning" size={16} color="#e67e22" style={styles.precautionIcon} />
                  <Text style={styles.precautionText}>{precaution}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            This wellness plan is personalized based on your health assessment. 
            Please follow these recommendations and report any difficulties during your next check-up.
          </Text>
        </View>
      </View>
    );
  };

  // Helper function to determine icon for lifestyle tips
  const getTipIcon = (type) => {
    const iconMap = {
      'Sleep': 'moon',
      'Hydration': 'water',
      'Stress Management': 'leaf',
      'Stress': 'leaf',
      'Social Connection': 'people',
      'Exercise': 'fitness',
      'Diet': 'nutrition',
      'Mental Health': 'happy',
      'Relaxation': 'partly-sunny',
      'Work-Life Balance': 'briefcase',
      // Add more mappings as needed
    };
    
    return iconMap[type] || 'finger-print';
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wellness Plan</Text>
        {!generating && (
          <TouchableOpacity style={styles.refreshButton} onPress={generateDietPlan}>
            <MaterialIcons name="refresh" size={24} color="#4a6da7" />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a6da7" />
            <Text style={styles.loadingText}>Loading wellness plan...</Text>
          </View>
        ) : generating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4a6da7" />
            <Text style={styles.loadingText}>Generating your personalized wellness plan...</Text>
          </View>
        ) : !userEmail ? (
          <Text style={styles.noDataText}>
            Please log in to view or generate your wellness plan.
          </Text>
        ) : dietPlan ? (
          renderDietPlan()
        ) : (
          <View style={styles.noPlanContainer}>
            <MaterialIcons name="no-food" size={64} color="#ccc" />
            <Text style={styles.noDataText}>
              No wellness plan found. Generate a personalized plan based on your health data.
            </Text>
            <TouchableOpacity 
              style={styles.generateButton} 
              onPress={generateDietPlan}
            >
              <Text style={styles.generateButtonText}>Generate Wellness Plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    padding: 20,
  },
  noPlanContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  generateButton: {
    marginTop: 20,
    backgroundColor: '#4a6da7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  generateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  planContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  generatedDate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  text: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  mealCard: {
    backgroundColor: '#fff5e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ffa726',
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f57c00',
    marginBottom: 8,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffa726',
    marginTop: 8,
    marginRight: 8,
  },
  mealItemText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  exerciseCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#66bb6a',
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#388e3c',
    marginBottom: 8,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  exerciseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  exerciseDetailText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 4,
  },
  intensityBadge: (intensity) => ({
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 
      intensity === 'low' 
        ? '#c8e6c9' 
        : intensity === 'medium' 
          ? '#fff3cd' 
          : '#f8d7da',
  }),
  intensityText: (intensity) => ({
    fontSize: 12,
    fontWeight: '500',
    color: 
      intensity === 'low' 
        ? '#2e7d32' 
        : intensity === 'medium' 
          ? '#856404' 
          : '#721c24',
  }),
  tipCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#42a5f5',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipIcon: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginRight: 8,
  },
  tipType: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1565c0',
  },
  tipText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  precautionsCard: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ffb300',
  },
  precautionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  precautionIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  precautionText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  footerNote: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4a6da7',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});