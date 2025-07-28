import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Database, 
  Trash2, 
  Eraser,
  Download,
  Search, 
  Eye, 
  EyeOff,
  RefreshCw,
  AlertCircle,
  FileText,
  Hash,
  Calendar,
  Settings,
  X,
  Filter
} from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { apiService } from '../services/api';
import { CollectionInfo, PointInfo, TextSearchRequest, InstanceConfig } from '../types';

// Safe highlighting component
interface HighlightedTextProps {
  text: string;
  searchText: string;
  caseSensitive?: boolean;
  className?: string;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ 
  text, 
  searchText, 
  caseSensitive = false,
  className = ""
}) => {
  if (!searchText.trim()) {
    return <span className={className}>{text}</span>;
  }

  const parts = text.split(new RegExp(
    `(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    caseSensitive ? 'g' : 'gi'
  ));

  return (
    <span className={className}>
      {parts.map((part, index) => 
        part.toLowerCase() === searchText.toLowerCase() || 
        (caseSensitive && part === searchText) ? (
          <mark key={index} className="bg-yellow-300 px-1 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

// Safe JSON highlighting component
interface HighlightedJsonProps {
  json: any;
  searchText: string;
  caseSensitive?: boolean;
  className?: string;
}

const HighlightedJson: React.FC<HighlightedJsonProps> = ({ 
  json, 
  searchText, 
  caseSensitive = false,
  className = ""
}) => {
  const jsonString = JSON.stringify(json, null, 2);
  
  if (!searchText.trim()) {
    return (
      <pre className={`whitespace-pre-wrap text-gray-700 ${className}`}>
        {jsonString}
      </pre>
    );
  }

  const parts = jsonString.split(new RegExp(
    `(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    caseSensitive ? 'g' : 'gi'
  ));

  return (
    <pre className={`whitespace-pre-wrap text-gray-700 ${className}`}>
      {parts.map((part, index) => 
        part.toLowerCase() === searchText.toLowerCase() || 
        (caseSensitive && part === searchText) ? (
          <mark key={index} className="bg-yellow-300 px-1 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </pre>
  );
};

const Browser: React.FC = () => {
  const { configName } = useParams<{ configName: string }>();
  const navigate = useNavigate();
  const { getConfig, instances } = useConfig();
  
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [points, setPoints] = useState<PointInfo[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVectors, setShowVectors] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pointsPerPage] = useState(50);
  
  // Search state
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PointInfo[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchedTotal, setSearchedTotal] = useState(0);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  
  // Search pagination state
  const [searchCurrentPage, setSearchCurrentPage] = useState(0);
  const [searchResultsPerPage, setSearchResultsPerPage] = useState(10);

  // Check both old config system and new instance system
  const config = configName ? getConfig(configName) : null;
  const instance = configName ? instances.find(inst => inst.name === configName) : null;
  const currentConfig = instance || config;
  
  useEffect(() => {
    if (!currentConfig) {
      navigate('/');
      return;
    }
    loadCollections();
  }, [currentConfig, navigate]);

  useEffect(() => {
    if (selectedCollection && !isSearchMode) {
      loadPoints();
    }
  }, [selectedCollection, currentPage, showVectors, isSearchMode]);

  const loadCollections = async () => {
    if (!configName) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getCollections(configName);
      setCollections(response.collections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPoints = async () => {
    if (!configName || !selectedCollection) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getPoints(
        configName,
        selectedCollection,
        pointsPerPage,
        currentPage * pointsPerPage,
        true,
        showVectors
      );
      setPoints(response.points);
      setTotalPoints(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load points');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!configName || !selectedCollection || !searchText.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchCurrentPage(0); // Reset to first page for new search
    
    try {
      const searchRequest: TextSearchRequest = {
        collection_name: selectedCollection,
        search_text: searchText.trim(),
        limit: 100,
        case_sensitive: caseSensitive
      };
      
      const response = await apiService.textSearchPoints(configName, searchRequest);
      
      setSearchResults(response.results);
      setSearchTotal(response.total);
      setSearchedTotal(response.searched_total);
      setIsSearchMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSearchResults([]);
    setSearchTotal(0);
    setSearchedTotal(0);
    setIsSearchMode(false);
    setCurrentPage(0);
    setSearchCurrentPage(0);
  };

  const handleDeleteCollection = async (collectionName: string) => {
    if (!configName || !confirm(`Are you sure you want to delete collection "${collectionName}"?`)) return;
    
    try {
      await apiService.deleteCollection(configName, collectionName);
      await loadCollections();
      if (selectedCollection === collectionName) {
        setSelectedCollection(null);
        setPoints([]);
        setTotalPoints(0);
        clearSearch();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection');
    }
  };

  const handleClearCollection = async (collectionName: string) => {
    if (!configName || !confirm(`Are you sure you want to clear all points from "${collectionName}"?`)) return;
    
    try {
      await apiService.clearCollection(configName, collectionName);
      if (isSearchMode) {
        clearSearch();
      } else {
        await loadPoints();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear collection');
    }
  };

  const handleDeletePoint = async (pointId: string) => {
    if (!configName || !selectedCollection || !confirm('Are you sure you want to delete this point?')) return;
    
    try {
      await apiService.deletePoint(configName, selectedCollection, pointId);
      if (isSearchMode) {
        // Refresh search results
        await handleSearch();
      } else {
        await loadPoints();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete point');
    }
  };

  const handleExportCollection = async (collectionName: string, withVectors: boolean = false) => {
    if (!configName) return;
    
    try {
      const blob = await apiService.exportCollection(configName, collectionName, withVectors);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collectionName}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export collection');
    }
  };

  const totalPages = Math.ceil(totalPoints / pointsPerPage);
  const displayPoints = isSearchMode ? searchResults : points;
  const displayTotal = isSearchMode ? searchTotal : totalPoints;
  
  // Search pagination logic
  const searchTotalPages = Math.ceil(searchTotal / searchResultsPerPage);
  const paginatedSearchResults = searchResults.slice(
    searchCurrentPage * searchResultsPerPage,
    (searchCurrentPage + 1) * searchResultsPerPage
  );
  const finalDisplayPoints = isSearchMode ? paginatedSearchResults : displayPoints;

  if (!currentConfig) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl font-semibold text-gray-900">{currentConfig.name}</h1>
                    {instance && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        instance.type === 'chromadb' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {instance.type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{currentConfig.url}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadCollections}
                disabled={isLoading}
                className="btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Collections Sidebar */}
          <div className="lg:col-span-1">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Collections</h2>
                <span className="text-sm text-gray-500">{collections.length}</span>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : collections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No collections found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <div
                      key={collection.name}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCollection === collection.name
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div
                        className="flex items-center justify-between"
                        onClick={() => {
                          setSelectedCollection(collection.name);
                          clearSearch();
                        }}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {isSearchMode && searchText.trim() ? (
                              <HighlightedText 
                                text={collection.name} 
                                searchText={searchText} 
                                caseSensitive={caseSensitive}
                              />
                            ) : (
                              collection.name
                            )}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                            <span>{collection.points_count} points</span>
                            <span>{collection.vector_size}d</span>
                            <span>{collection.distance}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCollection(collection.name, false);
                            }}
                            className="p-1 text-gray-400 hover:text-green-600"
                            title="Export collection data (without vectors)"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportCollection(collection.name, true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="Export collection data (with vectors)"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearCollection(collection.name);
                            }}
                            className="p-1 text-gray-400 hover:text-orange-600"
                            title="Clear all points from collection"
                          >
                            <Eraser className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.name);
                            }}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Delete entire collection"
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

          {/* Points Content */}
          <div className="lg:col-span-2">
            {selectedCollection ? (
              <div className="space-y-6">
                {/* Collection Header */}
                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {isSearchMode && searchText.trim() ? (
                          <HighlightedText 
                            text={selectedCollection} 
                            searchText={searchText} 
                            caseSensitive={caseSensitive}
                          />
                        ) : (
                          selectedCollection
                        )}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {isSearchMode ? (
                          <>
                            {searchTotal} results • Searched {searchedTotal} points
                          </>
                        ) : (
                          <>
                            {totalPoints} points • {collections.find(c => c.name === selectedCollection)?.vector_size}d vectors
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!isSearchMode && (
                        <button
                          onClick={() => setShowVectors(!showVectors)}
                          className="btn-secondary flex items-center space-x-2"
                        >
                          {showVectors ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span>{showVectors ? 'Hide' : 'Show'} Vectors</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="card">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search in payload fields..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={caseSensitive}
                          onChange={(e) => setCaseSensitive(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Case sensitive</span>
                      </label>
                      <button
                        onClick={handleSearch}
                        disabled={!searchText.trim() || isSearching}
                        className="btn-primary flex items-center space-x-2"
                      >
                        {isSearching ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        <span>{isSearching ? 'Searching...' : 'Search'}</span>
                      </button>
                      {isSearchMode && (
                        <button
                          onClick={clearSearch}
                          className="btn-secondary flex items-center space-x-2"
                        >
                          <X className="h-4 w-4" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Points List */}
                <div className="card">
                  {isLoading || isSearching ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : finalDisplayPoints.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>
                        {isSearchMode 
                          ? 'No search results found' 
                          : 'No points found in this collection'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {finalDisplayPoints.map((point) => (
                        <div key={point.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Hash className="h-4 w-4 text-gray-400" />
                                <span className="font-mono text-sm text-gray-600">
                                  {isSearchMode && searchText.trim() ? (
                                    <HighlightedText 
                                      text={point.id} 
                                      searchText={searchText} 
                                      caseSensitive={caseSensitive}
                                    />
                                  ) : (
                                    point.id
                                  )}
                                </span>
                                {point.score && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    Score: {point.score.toFixed(4)}
                                  </span>
                                )}
                              </div>
                              
                              {/* Payload */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-900">Payload:</h4>
                                <div className="bg-gray-50 rounded p-3 text-sm">
                                  {isSearchMode && searchText.trim() ? (
                                    <HighlightedJson 
                                      json={point.payload} 
                                      searchText={searchText} 
                                      caseSensitive={caseSensitive}
                                    />
                                  ) : (
                                    <pre className="whitespace-pre-wrap text-gray-700">
                                      {JSON.stringify(point.payload, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>

                              {/* Vector (if shown and not in search mode) */}
                              {!isSearchMode && showVectors && point.vector && (
                                <div className="mt-3 space-y-2">
                                  <h4 className="text-sm font-medium text-gray-900">Vector:</h4>
                                  <div className="bg-gray-50 rounded p-3 text-sm">
                                    <div className="text-gray-600">
                                      [{point.vector.slice(0, 10).map(v => v.toFixed(4)).join(', ')}
                                      {point.vector.length > 10 && `, ... (${point.vector.length} dimensions)`}]
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <button
                              onClick={() => handleDeletePoint(point.id)}
                              className="ml-4 p-1 text-gray-400 hover:text-red-600"
                              title="Delete point"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination (only show when not in search mode) */}
                  {!isSearchMode && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Showing {currentPage * pointsPerPage + 1} to {Math.min((currentPage + 1) * pointsPerPage, totalPoints)} of {totalPoints} points
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                          disabled={currentPage === 0}
                          className="btn-secondary px-3 py-1 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {currentPage + 1} of {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                          disabled={currentPage === totalPages - 1}
                          className="btn-secondary px-3 py-1 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search Results Pagination */}
                  {isSearchMode && searchTotal > 0 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-600">
                          Showing {searchCurrentPage * searchResultsPerPage + 1} to {Math.min((searchCurrentPage + 1) * searchResultsPerPage, searchTotal)} of {searchTotal} results
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Results per page:</span>
                          <select
                            value={searchResultsPerPage}
                            onChange={(e) => {
                              setSearchResultsPerPage(Number(e.target.value));
                              setSearchCurrentPage(0); // Reset to first page when changing page size
                            }}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSearchCurrentPage(Math.max(0, searchCurrentPage - 1))}
                          disabled={searchCurrentPage === 0}
                          className="btn-secondary px-3 py-1 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-600">
                          Page {searchCurrentPage + 1} of {searchTotalPages}
                        </span>
                        <button
                          onClick={() => setSearchCurrentPage(Math.min(searchTotalPages - 1, searchCurrentPage + 1))}
                          disabled={searchCurrentPage === searchTotalPages - 1}
                          className="btn-secondary px-3 py-1 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Collection</h3>
                <p className="text-gray-600">Choose a collection from the sidebar to view its points</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Browser; 