import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../global.js';

export default function PrescriptionsList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const email = await SecureStore.getItemAsync('userEmail');
      if (!email) {
        Alert.alert('Error', 'Not logged in');
        router.replace('/(auth)/login');
        return;
      }
      
      setUserEmail(email);
      
      // Get username from email (part before @)
      const username = email.split('@')[0];
      
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
    const email = await SecureStore.getItemAsync('userEmail');
    if (email) {
      const username = email.split('@')[0];
      await fetchPrescriptions(username);
    }
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

  const renderPrescription = ({ item }) => (
    <TouchableOpacity
      style={styles.prescriptionCard}
      onPress={() => handleViewPrescription(item.id)}
    >
      <View style={styles.prescriptionHeader}>
        <Text style={styles.prescriptionId}>{item.id}</Text>
        <Text style={styles.prescriptionDate}>
          {formatDate(item.date)}
        </Text>
      </View>
      
      <View style={styles.prescriptionDetails}>
        {/* Show medications summary */}
        {item.medications && item.medications.map((med, index) => (
          <View key={index} style={styles.detailRow}>
            <MaterialIcons name="medication" size={16} color="#4a6da7" />
            <Text style={styles.detailText}>
              {med.medicine} - {med.dosage} ({med.frequency})
            </Text>
          </View>
        ))}
      </View>
      
      <View style={styles.viewMoreContainer}>
        <Text style={styles.viewMore}>View Full Details</Text>
        <Ionicons name="chevron-forward" size={16} color="#4a6da7" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading prescriptions...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Prescriptions</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/add-prescription')}
        >
          <Ionicons name="add" size={24} color="#4a6da7" />
        </TouchableOpacity>
      </View>
      
      {prescriptions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="description" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No prescriptions found</Text>
          <TouchableOpacity 
            style={styles.addPrescriptionButton}
            onPress={() => router.push('/add-prescription')}
          >
            <Text style={styles.addPrescriptionText}>Add Prescription</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={prescriptions}
          renderItem={renderPrescription}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
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
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 12,
    marginBottom: 24,
  },
  addPrescriptionButton: {
    backgroundColor: '#4a6da7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addPrescriptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  prescriptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    padding: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#444',
    marginLeft: 8,
    flexShrink: 1,
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
});