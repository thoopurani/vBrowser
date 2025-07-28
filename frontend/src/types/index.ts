export interface QdrantConfig {
  name: string;
  url: string;
  api_key?: string;
}

export interface InstanceConfig {
  name: string;
  url: string;
  api_key?: string;
  type: 'qdrant' | 'chromadb';
}

export interface CollectionInfo {
  name: string;
  vector_size: number;
  distance: string;
  points_count: number;
  segments_count: number;
  status: string;
}

export interface PointInfo {
  id: string;
  payload: Record<string, any>;
  vector?: number[];
  score?: number;
}

export interface SearchRequest {
  collection_name: string;
  query_vector: number[];
  limit: number;
  score_threshold?: number;
}

export interface TextSearchRequest {
  collection_name: string;
  search_text: string;
  limit: number;
  case_sensitive: boolean;
}

export interface TextSearchResponse {
  results: PointInfo[];
  total: number;
  searched_total: number;
}

export interface PointsResponse {
  points: PointInfo[];
  total: number;
  limit: number;
  offset: number;
}

export interface CollectionsResponse {
  collections: CollectionInfo[];
}

export interface ConfigsResponse {
  configs: string[];
}

export interface InstancesResponse {
  instances: InstanceConfig[];
} 