import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../global.js';

export default function Dashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const email = await SecureStore.getItemAsync('userEmail');
      if (!email) {
        Alert.alert('Error', 'Not logged in');
        router.replace('/(auth)/login');
        return;
      }
      
      setUserEmail(email);
      
      // Get username from email (part before @)
      const username = email.split('@')[0];
      
      // Fetch user profile data
      const userResponse = await fetch(`${API_BASE_URL}/api/user/${email}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserName(userData.name || 'User');
      }
      
      // Fetch prescriptions
      await fetchPrescriptions(username);
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load your data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescriptions = async (username) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/patient-prescriptions/${username}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.prescriptions) {
          setPrescriptions(data.prescriptions);
        }
      } else {
        console.error('Failed to fetch prescriptions');
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  const handleViewPrescription = (id) => {
    router.push(`/prescription/${id}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return dateString;
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading your health data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hello, {userName}</Text>
          <Text style={styles.emailText}>{userEmail}</Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push('/profile')}
          style={styles.profileButton}
        >
          <Ionicons name="person-circle" size={40} color="#4a6da7" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Health Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Summary</Text>
          <View style={styles.healthCard}>
            <View style={styles.healthMetrics}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>--</Text>
                <Text style={styles.metricLabel}>Upcoming Appointments</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{prescriptions.length}</Text>
                <Text style={styles.metricLabel}>Active Medications</Text>
              </View>
            </View>
            
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity 
                style={styles.secondaryActionButton}
                onPress={() => router.push('/diet-plan')}
              >
                <Text style={styles.secondaryActionButtonText}>Wellness Plan</Text>
                <MaterialIcons name="spa" size={18} color="#4a6da7" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push('/add-prescription')}
              >
                <Text style={styles.actionButtonText}>Add Prescription</Text>
                <MaterialIcons name="add-circle-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Prescriptions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Prescriptions</Text>
          
          {prescriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="medication" size={48} color="#ccc" />
              <Text style={styles.emptyStateText}>No prescriptions yet</Text>
              <Text style={styles.emptyStateSubText}>Your prescriptions will appear here</Text>
            </View>
          ) : (
            prescriptions.map((prescription) => (
              <TouchableOpacity
                key={prescription.id}
                style={styles.prescriptionCard}
                onPress={() => handleViewPrescription(prescription.id)}
              >
                <View style={styles.prescriptionHeader}>
                  <Text style={styles.prescriptionId}>{prescription.id}</Text>
                  <Text style={styles.prescriptionDate}>
                    {formatDate(prescription.date)}
                  </Text>
                </View>
                
                <View style={styles.prescriptionDetails}>
                  {/* Show medications summary */}
                  {prescription.medications && prescription.medications.slice(0, 2).map((med, index) => (
                    <View key={index} style={styles.detailRow}>
                      <MaterialIcons name="medication" size={16} color="#4a6da7" />
                      <Text style={styles.detailText}>
                        {med.medicine} - {med.dosage} ({med.frequency})
                      </Text>
                    </View>
                  ))}
                  
                  {/* Show "more medications" if there are more than 2 */}
                  {prescription.medications && prescription.medications.length > 2 && (
                    <Text style={styles.moreMeds}>
                      +{prescription.medications.length - 2} more medications
                    </Text>
                  )}
                  
                  {/* Show doctor's analysis snippet if available */}
                  {prescription.doctorAnalysis && (
                    <View style={styles.analysisRow}>
                      <MaterialIcons name="description" size={16} color="#6a5acd" />
                      <Text style={styles.analysisText} numberOfLines={1} ellipsizeMode="tail">
                        {prescription.doctorAnalysis}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.viewMoreContainer}>
                  <Text style={styles.viewMore}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#4a6da7" />
                </View>
              </TouchableOpacity>
            ))
          )}
          
          {prescriptions.length > 0 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/prescriptions')}
            >
              <Text style={styles.viewAllButtonText}>View All Prescriptions</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  emailText: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  profileButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  healthCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  healthMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a6da7',
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  actionButtonsContainer: {
    marginTop: 15,
    gap: 10,
  },
  secondaryActionButton: {
    backgroundColor: '#e8f0fe',
    borderRadius: 30,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a6da7',
  },
  secondaryActionButtonText: {
    color: '#4a6da7',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  actionButton: {
    backgroundColor: '#4a6da7',
    borderRadius: 30,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    color: '#666',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  prescriptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  prescriptionId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a6da7',
  },
  prescriptionDate: {
    fontSize: 14,
    color: '#666',
  },
  prescriptionDetails: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#444',
    marginLeft: 8,
  },
  moreMeds: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 3,
    marginLeft: 24,
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  analysisText: {
    fontSize: 14,
    color: '#6a5acd',
    marginLeft: 8,
    fontStyle: 'italic',
    flex: 1,
  },
  viewMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  viewMore: {
    fontSize: 14,
    color: '#4a6da7',
    fontWeight: '500',
    marginRight: 3,
  },
  viewAllButton: {
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  viewAllButtonText: {
    color: '#4a6da7',
    fontWeight: '600',
    fontSize: 15,
  },
});