import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Settings,
  Zap,
  Shield,
  Globe
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { apiService } from '../services/api';
import { QdrantConfig, InstanceConfig } from '../types';

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { instances, addInstance, removeInstance, refreshInstances } = useConfig();
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    api_key: '',
    type: 'qdrant' as 'qdrant' | 'chromadb'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const instance: InstanceConfig = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        api_key: formData.api_key.trim() || undefined,
        type: formData.type
      };

      await apiService.addInstance(instance);
      await refreshInstances();
      setIsAdding(false);
      setFormData({ name: '', url: '', api_key: '', type: 'qdrant' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add instance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await apiService.deleteInstance(name);
      await refreshInstances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instance');
    }
  };

  const openBrowser = (instanceName: string) => {
    navigate(`/browser/${instanceName}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Database className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Vector Database Browser</h1>
                <p className="text-sm text-gray-600">Manage your vector databases</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsAdding(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Instance</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Vector Database Browser
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A beautiful and intuitive interface for managing your vector databases. 
            Browse collections, inspect chunks, and manage your vector data with ease.
            Supports both Qdrant and ChromaDB.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card text-center">
            <div className="p-3 bg-blue-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Instance</h3>
            <p className="text-gray-600">Manage multiple Qdrant instances from a single interface</p>
          </div>
          <div className="card text-center">
            <div className="p-3 bg-green-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Fast & Intuitive</h3>
            <p className="text-gray-600">Built with modern React and Tailwind for the best experience</p>
          </div>
          <div className="card text-center">
            <div className="p-3 bg-purple-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure</h3>
            <p className="text-gray-600">Support for API keys and secure connections</p>
          </div>
        </div>

        {/* Instances */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-gray-900">Your Database Instances</h3>
            <span className="text-sm text-gray-500">{instances.length} instance{instances.length !== 1 ? 's' : ''}</span>
          </div>

          {instances.length === 0 ? (
            <div className="card text-center py-12">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No instances yet</h3>
              <p className="text-gray-600 mb-6">Add your first database instance to get started</p>
              <button
                onClick={() => setIsAdding(true)}
                className="btn-primary flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Instance</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {instances.map((instance) => (
                <div key={instance.name} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Database className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-gray-900">{instance.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            instance.type === 'chromadb' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            [{instance.type}]
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{instance.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openBrowser(instance.name)}
                        className="btn-primary flex items-center space-x-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Open</span>
                      </button>
                      <button
                        onClick={() => handleDelete(instance.name)}
                        className="btn-danger p-2"
                        title="Delete instance"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Instance Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Add Database Instance</h3>
              <button
                onClick={() => setIsAdding(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Database Type
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'qdrant' | 'chromadb' })}
                  className="input-field"
                  required
                >
                  <option value="qdrant">Qdrant</option>
                  <option value="chromadb">ChromaDB</option>
                </select>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Instance Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Production DB"
                  required
                />
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.type === 'chromadb' ? 'ChromaDB URL' : 'Qdrant URL'}
                </label>
                <input
                  type="url"
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input-field"
                  placeholder={formData.type === 'chromadb' ? 'http://localhost:6335' : 'http://localhost:6333'}
                  required
                />
              </div>

              <div>
                <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-1">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  id="api_key"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="input-field"
                  placeholder="Your API key"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>Add Instance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Welcome; 