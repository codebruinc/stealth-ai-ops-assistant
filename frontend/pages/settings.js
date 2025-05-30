import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import apiService from '../utils/api';

export default function Settings() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientNotes, setClientNotes] = useState('');

  // Fetch clients on initial load
  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
    }
  }, [isAuthenticated]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await apiService.getClients();
      setClients(data);
      
      if (data.length > 0) {
        setSelectedClient(data[0]);
        setClientNotes(data[0].profile?.notes || '');
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load client data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSelect = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setClientNotes(client.profile?.notes || '');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const updatedProfile = {
        ...selectedClient.profile,
        notes: clientNotes
      };
      
      await apiService.updateClient(selectedClient.id, {
        profile: updatedProfile
      });
      
      // Update local state
      setClients(prev => prev.map(client => 
        client.id === selectedClient.id 
          ? { ...client, profile: updatedProfile } 
          : client
      ));
      
      setSuccess('Client notes saved successfully');
    } catch (err) {
      console.error('Error saving client notes:', err);
      setError('Failed to save client notes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <LoadingSpinner size="large" text="Loading settings..." />
      </div>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your preferences and client information
          </p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Client Information</h2>
            
            {/* Client selector */}
            <div className="mb-4">
              <label htmlFor="client-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Client
              </label>
              <select
                id="client-select"
                className="input"
                value={selectedClient?.id || ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                disabled={isLoading || clients.length === 0}
              >
                {clients.length === 0 ? (
                  <option value="">No clients available</option>
                ) : (
                  clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            {/* Client notes */}
            {selectedClient && (
              <div className="mb-4">
                <label htmlFor="client-notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Notes
                </label>
                <textarea
                  id="client-notes"
                  rows={4}
                  className="input"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  disabled={isLoading}
                  placeholder="Add notes about this client..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  These notes will be used to provide context for AI summaries and suggestions.
                </p>
              </div>
            )}
            
            {/* Error and success messages */}
            {error && (
              <div className="mb-4 text-sm text-red-600">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 text-sm text-green-600">
                {success}
              </div>
            )}
            
            {/* Save button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isLoading || !selectedClient}
                className="btn btn-primary"
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}