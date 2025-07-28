import { 
  QdrantConfig, 
  InstanceConfig,
  CollectionInfo, 
  PointInfo, 
  SearchRequest, 
  TextSearchRequest,
  TextSearchResponse,
  PointsResponse, 
  CollectionsResponse, 
  ConfigsResponse,
  InstancesResponse
} from '../types';

const API_BASE_URL = 'http://localhost:7500';

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Configuration management
  async addConfig(config: QdrantConfig): Promise<{ message: string; name: string }> {
    return this.request('/configs', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async listConfigs(): Promise<ConfigsResponse> {
    return this.request('/configs');
  }

  async getConfig(name: string): Promise<QdrantConfig> {
    return this.request(`/configs/${name}`);
  }

  async deleteConfig(name: string): Promise<{ message: string }> {
    return this.request(`/configs/${name}`, {
      method: 'DELETE',
    });
  }

  // Instance management
  async getInstances(): Promise<InstancesResponse> {
    return this.request('/instances');
  }

  async addInstance(instance: InstanceConfig): Promise<{ message: string; name: string }> {
    return this.request('/instances', {
      method: 'POST',
      body: JSON.stringify(instance),
    });
  }

  async deleteInstance(name: string): Promise<{ message: string }> {
    return this.request(`/instances/${name}`, {
      method: 'DELETE',
    });
  }

  // Collection management
  async getCollections(configName: string): Promise<CollectionsResponse> {
    return this.request(`/collections/${configName}`);
  }

  async deleteCollection(configName: string, collectionName: string): Promise<{ message: string }> {
    return this.request(`/collections/${configName}/${collectionName}`, {
      method: 'DELETE',
    });
  }

  // Points management
  async getPoints(
    configName: string,
    collectionName: string,
    limit: number = 100,
    offset: number = 0,
    withPayload: boolean = true,
    withVector: boolean = false
  ): Promise<PointsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      with_payload: withPayload.toString(),
      with_vector: withVector.toString(),
    });

    return this.request(`/points/${configName}/${collectionName}?${params}`);
  }

  async searchPoints(configName: string, searchRequest: SearchRequest): Promise<{ results: PointInfo[] }> {
    return this.request(`/search/${configName}`, {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    });
  }

  async textSearchPoints(configName: string, searchRequest: TextSearchRequest): Promise<TextSearchResponse> {
    const response: TextSearchResponse = await this.request(`/text-search/${configName}`, {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    });
    
    return response;
  }

  async clearCollection(configName: string, collectionName: string): Promise<{ message: string }> {
    return this.request(`/points/${configName}/${collectionName}`, {
      method: 'DELETE',
    });
  }

  async deletePoint(configName: string, collectionName: string, pointId: string): Promise<{ message: string }> {
    return this.request(`/points/${configName}/${collectionName}/${pointId}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Export collection to CSV
  async exportCollection(configName: string, collectionName: string, withVectors: boolean = false): Promise<Blob> {
    const url = `${API_BASE_URL}/export/${configName}/${collectionName}?with_vectors=${withVectors}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // If we can't parse JSON, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Export failed: Empty file received');
    }
    
    return blob;
  }
}

export const apiService = new ApiService(); 