import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { API_BASE_URL } from '../global';

export default function BlockchainStatus() {
  const [status, setStatus] = useState('checking...');
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  
  const checkBlockchainStatus = async () => {
    try {
      setStatus('checking...');
      setError(null);
      
      console.log(`Trying to fetch: ${API_BASE_URL}/api/blockchain/status`);
      
      const response = await fetch(`${API_BASE_URL}/api/blockchain/status`);
      console.log('Response received:', response.status);
      
      const data = await response.json();
      console.log('Data:', data);
      
      if (data.status === 'connected') {
        setStatus('connected');
        setDetails(data);
      } else {
        setStatus('error');
        setError(data.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Error fetching blockchain status:', err);
      setStatus('error');
      setError(err.message);
    }
  };
  
  useEffect(() => {
    checkBlockchainStatus();
  }, []);
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Blockchain Status</Text>
      
      <View style={[
        styles.statusBadge, 
        status === 'connected' ? styles.connected : 
        status === 'checking...' ? styles.checking : 
        styles.error
      ]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
      
      {details && (
        <View style={styles.details}>
          <Text style={styles.detailText}>Chain: {details.chain}</Text>
          <Text style={styles.detailText}>Blocks: {details.blocks}</Text>
          <Text style={styles.detailText}>Connections: {details.connections}</Text>
          <Text style={styles.detailText}>Version: {details.version}</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.button}
        onPress={checkBlockchainStatus}
      >
        <Text style={styles.buttonText}>Refresh Status</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  connected: {
    backgroundColor: '#e6f7e6',
    borderColor: '#34c759',
    borderWidth: 1,
  },
  checking: {
    backgroundColor: '#f5f5f5',
    borderColor: '#9e9e9e',
    borderWidth: 1,
  },
  error: {
    backgroundColor: '#ffebee',
    borderColor: '#ef5350',
    borderWidth: 1,
  },
  statusText: {
    fontWeight: '600',
  },
  details: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#555',
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#4a6da7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
});