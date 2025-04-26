import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Share,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../global.js';

export default function PrescriptionDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const fetchUserEmail = async () => {
      try {
        const storedEmail = await SecureStore.getItemAsync('userEmail');
        if (storedEmail) {
          setUserEmail(storedEmail);
          fetchPrescriptionDetails(storedEmail);
        } else {
          setLoading(false);
          Alert.alert("Error", "User not authenticated", [
            { text: "OK", onPress: () => router.push('/(auth)/login') }
          ]);
        }
      } catch (error) {
        console.error('Failed to get user email:', error);
        setLoading(false);
      }
    };

    fetchUserEmail();
  }, [id]);

  const fetchPrescriptionDetails = async (email) => {
    try {
      // Get patient ID (username) from email
      const patientId = email.split('@')[0];
      
      const response = await fetch(`${API_BASE_URL}/api/prescription/${patientId}/${id}`);
      const data = await response.json();
      
      if (response.ok && data && data.success) {
        console.log('Found prescription:', data.prescription);
        setPrescription(data.prescription);
      } else {
        Alert.alert("Not Found", "Prescription details could not be found");
        router.back();
      }
    } catch (error) {
      console.error('Error fetching prescription details:', error);
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!prescription) return;
    
    try {
      let medicationList = '';
      if (prescription.medications && prescription.medications.length > 0) {
        medicationList = prescription.medications
          .map(med => `- ${med.medicine} ${med.dosage}, ${med.frequency}, ${med.timing || 'Any time'}, for ${med.days}`)
          .join('\n');
      }
      
      const shareText = `
Prescription Details (ID: ${prescription.id})
Date: ${prescription.date || 'Not specified'}

Medications:
${medicationList}
      `;

      await Share.share({
        message: shareText,
        title: `Prescription ${prescription.id}`
      });
    } catch (error) {
      console.error('Error sharing prescription:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading prescription details...</Text>
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
        <Text style={styles.headerTitle}>Prescription Details</Text>
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={24} color="#4a6da7" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.prescriptionIdContainer}>
          <View style={styles.idBadge}>
            <Text style={styles.prescriptionId}>{prescription?.id || 'Unknown'}</Text>
          </View>
          <Text style={styles.prescriptionDate}>{prescription?.date || 'Unknown date'}</Text>
        </View>
        
        {prescription?.medications && prescription.medications.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="medication" size={18} color="#4a6da7" />
              <Text style={styles.sectionTitle}>Medications</Text>
            </View>
            
            {prescription.medications.map((medication, index) => (
              <View key={index} style={styles.medicationCard}>
                <Text style={styles.medicationName}>{medication.medicine}</Text>
                <View style={styles.medicationDetails}>
                  <Text style={styles.medicationInfo}>Dosage: {medication.dosage}</Text>
                  <Text style={styles.medicationInfo}>Frequency: {medication.frequency}</Text>
                  {medication.timing && (
                    <Text style={styles.medicationInfo}>Timing: {medication.timing}</Text>
                  )}
                  <Text style={styles.medicationInfo}>Duration: {medication.days}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Doctor's analysis section */}
        {prescription?.doctorAnalysis && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="description" size={18} color="#6a5acd" />
              <Text style={styles.sectionTitle}>Doctor's Analysis</Text>
            </View>
            
            <View style={styles.analysisCard}>
              <Text style={styles.analysisText}>{prescription.doctorAnalysis}</Text>
              
              {prescription.doctor && (
                <View style={styles.doctorInfo}>
                  <MaterialIcons name="person" size={16} color="#4a6da7" />
                  <Text style={styles.doctorName}>Dr. {prescription.doctor}</Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.blockchainInfo}>
          <Ionicons name="shield-checkmark" size={16} color="#4a6da7" />
          <Text style={styles.blockchainText}>
            Prescription secured on blockchain
          </Text>
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
  shareButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  prescriptionIdContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  idBadge: {
    backgroundColor: '#4a6da7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  prescriptionId: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  prescriptionDate: {
    fontSize: 16,
    color: '#666',
  },
  sectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  blockchainInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    marginBottom: 20,
  },
  blockchainText: {
    fontSize: 13,
    color: '#4a6da7',
    marginLeft: 6,
  },
  medicationCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  medicationDetails: {
    marginLeft: 8,
  },
  medicationInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  analysisCard: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6a5acd',
  },
  analysisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  doctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eaeaea',
  },
  doctorName: {
    marginLeft: 5,
    fontSize: 14,
    color: '#4a6da7',
    fontWeight: '500',
  },
});