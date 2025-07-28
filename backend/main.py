from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict, Any, Union
from qdrant_client import QdrantClient
from qdrant_client.http import models
import chromadb
import json
import os
import csv
import io
from datetime import datetime

app = FastAPI(title="Vector Database Browser API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class QdrantConfig(BaseModel):
    name: str
    url: HttpUrl
    api_key: Optional[str] = None

class ChromaConfig(BaseModel):
    name: str
    url: HttpUrl
    api_key: Optional[str] = None

class CollectionInfo(BaseModel):
    name: str
    vector_size: int
    distance: str
    points_count: int
    segments_count: int
    status: str

class PointInfo(BaseModel):
    id: str
    payload: Dict[str, Any]
    vector: Optional[List[float]] = None
    score: Optional[float] = None

class SearchRequest(BaseModel):
    collection_name: str
    query_vector: List[float]
    limit: int = 10
    score_threshold: Optional[float] = None

class TextSearchRequest(BaseModel):
    collection_name: str
    search_text: str
    limit: int = 50
    case_sensitive: bool = False

# File-based storage for configurations
import json
import os
from pathlib import Path

INSTANCE_CONFIG_FILE = Path("instance.config")

class InstanceConfig(BaseModel):
    name: str
    url: HttpUrl
    api_key: Optional[str] = None
    type: str = "qdrant"  # "qdrant" or "chromadb"

class InstanceConfigFile(BaseModel):
    instances: List[InstanceConfig]

def load_instance_configurations() -> List[InstanceConfig]:
    """Load instance configurations from instance.config file"""
    if INSTANCE_CONFIG_FILE.exists():
        try:
            with open(INSTANCE_CONFIG_FILE, 'r') as f:
                data = json.load(f)
                config = InstanceConfigFile(**data)
                return config.instances
        except json.JSONDecodeError as e:
            print(f"Error parsing instance.config JSON: {e}")
            # Create a backup of the corrupted file
            backup_file = INSTANCE_CONFIG_FILE.with_suffix('.config.backup')
            try:
                import shutil
                shutil.copy2(INSTANCE_CONFIG_FILE, backup_file)
                print(f"Corrupted file backed up to {backup_file}")
            except Exception as backup_error:
                print(f"Failed to create backup: {backup_error}")
            return []
        except Exception as e:
            print(f"Error loading instance configurations: {e}")
            return []
    return []

def save_instance_configurations(instances: List[InstanceConfig]):
    """Save instance configurations to instance.config file"""
    try:
        config = InstanceConfigFile(instances=instances)
        # Convert HttpUrl objects to strings for JSON serialization
        config_dict = config.model_dump()
        # Convert HttpUrl objects to strings
        for instance in config_dict['instances']:
            if 'url' in instance and hasattr(instance['url'], '__str__'):
                instance['url'] = str(instance['url'])
        
        # Write to temporary file first to prevent corruption
        temp_file = INSTANCE_CONFIG_FILE.with_suffix('.tmp')
        with open(temp_file, 'w') as f:
            json.dump(config_dict, f, indent=2)
        
        # Move temporary file to actual file
        import shutil
        shutil.move(temp_file, INSTANCE_CONFIG_FILE)
        
    except Exception as e:
        print(f"Error saving instance configurations: {e}")
        # Clean up temp file if it exists
        temp_file = INSTANCE_CONFIG_FILE.with_suffix('.tmp')
        if temp_file.exists():
            try:
                temp_file.unlink()
            except:
                pass

# Load configurations on startup
instance_configurations: List[InstanceConfig] = load_instance_configurations()

# Convert instance configs to the old format for API compatibility
configurations: Dict[str, QdrantConfig] = {}
for instance in instance_configurations:
    if instance.type == "qdrant":
        configurations[instance.name] = QdrantConfig(
            name=instance.name,
            url=instance.url,
            api_key=instance.api_key
        )

def get_qdrant_client(config: QdrantConfig) -> QdrantClient:
    """Create Qdrant client from configuration"""
    try:
        if config.api_key:
            return QdrantClient(url=str(config.url), api_key=config.api_key)
        else:
            return QdrantClient(url=str(config.url))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to Qdrant: {str(e)}")

def get_chromadb_client(config: ChromaConfig) -> chromadb.HttpClient:
    """Create ChromaDB client from configuration"""
    try:
        # Parse URL to extract host and port
        from urllib.parse import urlparse
        parsed_url = urlparse(str(config.url))
        host = parsed_url.hostname or "localhost"
        port = parsed_url.port or 8000
        
        # ChromaDB HttpClient settings
        settings = chromadb.config.Settings()
        if config.api_key:
            settings.chroma_client_auth_credentials = config.api_key
        
        return chromadb.HttpClient(host=host, port=port, settings=settings)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to ChromaDB: {str(e)}")

def get_database_client(instance: InstanceConfig) -> Union[QdrantClient, chromadb.HttpClient]:
    """Get appropriate database client based on instance type"""
    if instance.type == "qdrant":
        config = QdrantConfig(name=instance.name, url=instance.url, api_key=instance.api_key)
        return get_qdrant_client(config)
    elif instance.type == "chromadb":
        config = ChromaConfig(name=instance.name, url=instance.url, api_key=instance.api_key)
        return get_chromadb_client(config)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported database type: {instance.type}")

def get_collections_for_instance(instance: InstanceConfig) -> List[CollectionInfo]:
    """Get collections for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        collections = client.get_collections()
        collection_infos = []
        for collection in collections.collections:
            info = client.get_collection(collection.name)
            collection_infos.append(CollectionInfo(
                name=collection.name,
                vector_size=info.config.params.vectors.size,
                distance=info.config.params.vectors.distance,
                points_count=info.points_count,
                segments_count=info.segments_count,
                status=info.status
            ))
        return collection_infos
    
    elif instance.type == "chromadb":
        collections = client.list_collections()
        collection_infos = []
        for collection in collections:
            # Get collection details
            coll = client.get_collection(collection.name)
            count = coll.count()
            
            collection_infos.append(CollectionInfo(
                name=collection.name,
                vector_size=0,  # ChromaDB doesn't expose vector size easily
                distance="cosine",  # ChromaDB default
                points_count=count,
                segments_count=1,  # ChromaDB doesn't have segments concept
                status="green"  # ChromaDB doesn't have status concept
            ))
        return collection_infos
    
    return []

def delete_collection_for_instance(instance: InstanceConfig, collection_name: str):
    """Delete collection for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        client.delete_collection(collection_name)
    elif instance.type == "chromadb":
        client.delete_collection(collection_name)

def get_points_for_instance(instance: InstanceConfig, collection_name: str, limit: int, offset: int, with_payload: bool, with_vector: bool):
    """Get points from any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        # Get collection info first
        collection_info = client.get_collection(collection_name)
        total_points = collection_info.points_count
        
        # Get points
        points = client.scroll(
            collection_name=collection_name,
            limit=limit,
            offset=offset,
            with_payload=with_payload,
            with_vectors=with_vector
        )
        
        point_infos = []
        for point in points[0]:
            point_infos.append(PointInfo(
                id=str(point.id),
                payload=point.payload or {},
                vector=point.vector if with_vector else None,
                score=None
            ))
        
        return {
            "points": point_infos,
            "total": total_points,
            "limit": limit,
            "offset": offset
        }
    
    elif instance.type == "chromadb":
        collection = client.get_collection(collection_name)
        total_points = collection.count()
        
        # ChromaDB doesn't have native pagination like Qdrant, so we'll get all and slice
        results = collection.get(
            include=["metadatas", "documents", "embeddings"] if with_vector else ["metadatas", "documents"],
            limit=None if total_points < 10000 else 10000  # Limit to prevent memory issues
        )
        
        # Handle pagination manually
        start_idx = offset
        end_idx = min(offset + limit, len(results['ids']))
        
        point_infos = []
        for i in range(start_idx, end_idx):
            if i < len(results['ids']):
                payload = results['metadatas'][i] if results['metadatas'] else {}
                if results.get('documents') and i < len(results['documents']):
                    payload['document'] = results['documents'][i]
                
                point_infos.append(PointInfo(
                    id=str(results['ids'][i]),
                    payload=payload,
                    vector=results['embeddings'][i] if with_vector and results.get('embeddings') else None,
                    score=None
                ))
        
        return {
            "points": point_infos,
            "total": total_points,
            "limit": limit,
            "offset": offset
        }

def search_points_for_instance(instance: InstanceConfig, collection_name: str, query_vector: List[float], limit: int, score_threshold: Optional[float] = None):
    """Search points in any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        search_params = {
            "collection_name": collection_name,
            "query_vector": query_vector,
            "limit": limit
        }
        
        if score_threshold:
            search_params["score_threshold"] = score_threshold
        
        results = client.search(**search_params)
        
        point_infos = []
        for result in results:
            point_infos.append(PointInfo(
                id=str(result.id),
                payload=result.payload or {},
                vector=None,
                score=result.score
            ))
        
        return {"results": point_infos}
    
    elif instance.type == "chromadb":
        collection = client.get_collection(collection_name)
        
        # ChromaDB query
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=limit,
            include=["metadatas", "documents", "distances"]
        )
        
        point_infos = []
        if results['ids'] and len(results['ids']) > 0:
            for i, doc_id in enumerate(results['ids'][0]):
                distance = results['distances'][0][i] if results['distances'] else 0
                # Convert distance to similarity score (ChromaDB returns distances, Qdrant returns similarity)
                score = 1.0 - distance
                
                payload = results['metadatas'][0][i] if results['metadatas'] and results['metadatas'][0] else {}
                if results.get('documents') and results['documents'][0] and i < len(results['documents'][0]):
                    payload['document'] = results['documents'][0][i]
                
                point_infos.append(PointInfo(
                    id=str(doc_id),
                    payload=payload,
                    vector=None,
                    score=score
                ))
        
        return {"results": point_infos}

def text_search_for_instance(instance: InstanceConfig, search_request: TextSearchRequest):
    """Text search for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        # Get all points from the collection
        points = client.scroll(
            collection_name=search_request.collection_name,
            limit=10000,  # Adjust based on your needs
            with_payload=True,
            with_vectors=False
        )
        
        if not points[0]:
            return {"results": [], "total": 0, "searched_total": 0}
        
        search_text = search_request.search_text
        if not search_request.case_sensitive:
            search_text = search_text.lower()
        
        matching_points = []
        
        for point in points[0]:
            if not point.payload:
                continue
                
            # Search through all payload fields
            found_match = False
            for field_name, field_value in point.payload.items():
                if field_value is None:
                    continue
                    
                # Convert field value to string for searching
                field_str = str(field_value)
                if not search_request.case_sensitive:
                    field_str = field_str.lower()
                
                if search_text in field_str:
                    found_match = True
                    break
            
            if found_match:
                matching_points.append(PointInfo(
                    id=str(point.id),
                    payload=point.payload or {},
                    vector=None,
                    score=None
                ))
                
                # Limit results
                if len(matching_points) >= search_request.limit:
                    break
        
        return {
            "results": matching_points,
            "total": len(matching_points),
            "searched_total": len(points[0])
        }
    
    elif instance.type == "chromadb":
        collection = client.get_collection(search_request.collection_name)
        
        # Get all documents with metadata
        results = collection.get(
            include=["metadatas", "documents"],
            limit=None  # Get all for text search
        )
        
        if not results['ids']:
            return {"results": [], "total": 0, "searched_total": 0}
        
        search_text = search_request.search_text
        if not search_request.case_sensitive:
            search_text = search_text.lower()
        
        matching_points = []
        searched_total = len(results['ids'])
        
        for i, doc_id in enumerate(results['ids']):
            if len(matching_points) >= search_request.limit:
                break
                
            found_match = False
            
            # Search in metadata
            if results['metadatas'] and i < len(results['metadatas']):
                metadata = results['metadatas'][i] or {}
                for field_name, field_value in metadata.items():
                    if field_value is None:
                        continue
                    field_str = str(field_value)
                    if not search_request.case_sensitive:
                        field_str = field_str.lower()
                    if search_text in field_str:
                        found_match = True
                        break
            
            # Search in documents
            if not found_match and results['documents'] and i < len(results['documents']):
                doc = results['documents'][i]
                if doc:
                    doc_str = str(doc)
                    if not search_request.case_sensitive:
                        doc_str = doc_str.lower()
                    if search_text in doc_str:
                        found_match = True
            
            if found_match:
                payload = results['metadatas'][i] if results['metadatas'] and i < len(results['metadatas']) else {}
                if results['documents'] and i < len(results['documents']):
                    payload['document'] = results['documents'][i]
                
                matching_points.append(PointInfo(
                    id=str(doc_id),
                    payload=payload,
                    vector=None,
                    score=None
                ))
        
        return {
            "results": matching_points,
            "total": len(matching_points),
            "searched_total": searched_total
        }

def clear_collection_for_instance(instance: InstanceConfig, collection_name: str) -> int:
    """Clear all points from a collection for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        # Get all point IDs
        points = client.scroll(
            collection_name=collection_name,
            limit=10000,  # Adjust based on your needs
            with_payload=False,
            with_vectors=False
        )
        
        if points[0]:
            point_ids = [point.id for point in points[0]]
            client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(
                    points=point_ids
                )
            )
            return len(points[0])
        return 0
    
    elif instance.type == "chromadb":
        collection = client.get_collection(collection_name)
        count = collection.count()
        
        # Get all IDs and delete them
        if count > 0:
            results = collection.get(include=[])  # Just get IDs
            if results['ids']:
                collection.delete(ids=results['ids'])
        
        return count

def delete_point_for_instance(instance: InstanceConfig, collection_name: str, point_id: str):
    """Delete a specific point for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        client.delete(
            collection_name=collection_name,
            points_selector=models.PointIdsList(
                points=[point_id]
            )
        )
    elif instance.type == "chromadb":
        collection = client.get_collection(collection_name)
        collection.delete(ids=[point_id])

def export_collection_for_instance(instance: InstanceConfig, collection_name: str, with_vectors: bool = False):
    """Export collection data to CSV for any database type"""
    client = get_database_client(instance)
    
    if instance.type == "qdrant":
        # Get all points from the collection
        points = client.scroll(
            collection_name=collection_name,
            limit=10000,  # Adjust based on your needs
            with_payload=True,
            with_vectors=with_vectors
        )
        
        if not points[0]:
            raise HTTPException(status_code=404, detail="No points found in collection")
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        if with_vectors:
            writer.writerow(['id', 'vector', 'payload'])
        else:
            writer.writerow(['id', 'payload'])
        
        # Write data
        for point in points[0]:
            try:
                if with_vectors:
                    vector_str = ','.join(map(str, point.vector)) if point.vector else ''
                    payload_str = json.dumps(point.payload or {}, ensure_ascii=False)
                    writer.writerow([str(point.id), vector_str, payload_str])
                else:
                    payload_str = json.dumps(point.payload or {}, ensure_ascii=False)
                    writer.writerow([str(point.id), payload_str])
            except Exception as point_error:
                print(f"Error processing point {point.id}: {point_error}")
                # Continue with other points
                continue
    
    elif instance.type == "chromadb":
        collection = client.get_collection(collection_name)
        
        # Get all documents with metadata and embeddings
        include_items = ["metadatas", "documents"]
        if with_vectors:
            include_items.append("embeddings")
            
        results = collection.get(include=include_items, limit=None)
        
        if not results['ids']:
            raise HTTPException(status_code=404, detail="No points found in collection")
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        if with_vectors:
            writer.writerow(['id', 'vector', 'payload'])
        else:
            writer.writerow(['id', 'payload'])
        
        # Write data
        for i, doc_id in enumerate(results['ids']):
            try:
                # Combine metadata and document into payload
                payload = {}
                if results['metadatas'] and i < len(results['metadatas']):
                    payload.update(results['metadatas'][i] or {})
                if results['documents'] and i < len(results['documents']):
                    payload['document'] = results['documents'][i]
                
                payload_str = json.dumps(payload, ensure_ascii=False)
                
                if with_vectors and results.get('embeddings') and i < len(results['embeddings']):
                    vector_str = ','.join(map(str, results['embeddings'][i]))
                    writer.writerow([str(doc_id), vector_str, payload_str])
                else:
                    writer.writerow([str(doc_id), payload_str])
            except Exception as point_error:
                print(f"Error processing point {doc_id}: {point_error}")
                # Continue with other points
                continue
    
    output.seek(0)
    csv_content = output.getvalue()
    
    # Create streaming response
    def generate():
        yield csv_content
    
    filename = f"{collection_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@app.get("/")
async def root():
    return {"message": "Qdrant Browser API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Configuration management
@app.post("/configs")
async def add_config(config: QdrantConfig):
    """Add a new Qdrant configuration (legacy endpoint - now uses instance system)"""
    try:
        # Test connection
        client = get_qdrant_client(config)
        client.get_collections()
        
        # Add to instance config
        new_instance = InstanceConfig(
            name=config.name,
            url=config.url,
            api_key=config.api_key,
            type="qdrant"
        )
        
        # Check if instance already exists
        existing_instances = load_instance_configurations()
        instance_exists = any(inst.name == config.name for inst in existing_instances)
        
        if not instance_exists:
            existing_instances.append(new_instance)
            save_instance_configurations(existing_instances)
        
        # Update in-memory configurations for API compatibility
        configurations[config.name] = config
        
        return {"message": "Configuration added successfully", "name": config.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid configuration: {str(e)}")

@app.get("/configs")
async def list_configs():
    """List all saved configurations (legacy endpoint)"""
    return {"configs": list(configurations.keys())}

@app.get("/configs/{name}")
async def get_config(name: str):
    """Get a specific configuration (legacy endpoint)"""
    if name not in configurations:
        raise HTTPException(status_code=404, detail="Configuration not found")
    config_dict = configurations[name].model_dump()
    # Convert HttpUrl to string for JSON serialization
    if 'url' in config_dict and hasattr(config_dict['url'], '__str__'):
        config_dict['url'] = str(config_dict['url'])
    return config_dict

@app.delete("/configs/{name}")
async def delete_config(name: str):
    """Delete a configuration (legacy endpoint - now uses instance system)"""
    if name not in configurations:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Remove from instance config
    existing_instances = load_instance_configurations()
    existing_instances = [inst for inst in existing_instances if inst.name != name]
    save_instance_configurations(existing_instances)
    
    # Remove from in-memory configurations
    del configurations[name]
    
    return {"message": "Configuration deleted successfully"}

@app.get("/instances")
async def get_instances():
    """Get all instance configurations"""
    instances = load_instance_configurations()
    # Convert HttpUrl objects to strings for JSON serialization
    instances_dict = []
    for instance in instances:
        instance_dict = instance.model_dump()
        if 'url' in instance_dict and hasattr(instance_dict['url'], '__str__'):
            instance_dict['url'] = str(instance_dict['url'])
        instances_dict.append(instance_dict)
    return {"instances": instances_dict}

@app.post("/instances")
async def add_instance(instance: InstanceConfig):
    """Add a new instance configuration"""
    try:
        # Test connection for both database types
        client = get_database_client(instance)
        
        # Test connection based on database type
        if instance.type == "qdrant":
            client.get_collections()
        elif instance.type == "chromadb":
            client.heartbeat()  # ChromaDB heartbeat to test connection
        
        # Add to instance config
        existing_instances = load_instance_configurations()
        instance_exists = any(inst.name == instance.name for inst in existing_instances)
        
        if instance_exists:
            raise HTTPException(status_code=400, detail="Instance with this name already exists")
        
        existing_instances.append(instance)
        save_instance_configurations(existing_instances)
        
        # Also add to configurations for backward compatibility (Qdrant only)
        if instance.type == "qdrant":
            configurations[instance.name] = QdrantConfig(
                name=instance.name,
                url=instance.url,
                api_key=instance.api_key
            )
        
        return {"message": "Instance added successfully", "name": instance.name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid instance: {str(e)}")

@app.delete("/instances/{name}")
async def delete_instance(name: str):
    """Delete an instance configuration"""
    existing_instances = load_instance_configurations()
    instance_exists = any(inst.name == name for inst in existing_instances)
    
    if not instance_exists:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Remove from instance config
    existing_instances = [inst for inst in existing_instances if inst.name != name]
    save_instance_configurations(existing_instances)
    
    # Remove from configurations for backward compatibility
    if name in configurations:
        del configurations[name]
        # save_configurations(configurations) # This line was removed as per the new_code
    
    return {"message": "Instance deleted successfully"}

# Collection management
@app.get("/collections/{instance_name}")
async def get_collections(instance_name: str):
    """Get all collections for an instance"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            collections = client.get_collections()
            
            collection_infos = []
            for collection in collections.collections:
                info = client.get_collection(collection.name)
                collection_infos.append(CollectionInfo(
                    name=collection.name,
                    vector_size=info.config.params.vectors.size,
                    distance=info.config.params.vectors.distance,
                    points_count=info.points_count,
                    segments_count=info.segments_count,
                    status=info.status
                ))
            
            return {"collections": collection_infos}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get collections: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        collection_infos = get_collections_for_instance(instance)
        return {"collections": collection_infos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get collections: {str(e)}")

@app.delete("/collections/{instance_name}/{collection_name}")
async def delete_collection(instance_name: str, collection_name: str):
    """Delete a collection"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            client.delete_collection(collection_name)
            return {"message": f"Collection '{collection_name}' deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete collection: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        delete_collection_for_instance(instance, collection_name)
        return {"message": f"Collection '{collection_name}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete collection: {str(e)}")

# Points/Chunks management
@app.get("/points/{instance_name}/{collection_name}")
async def get_points(
    instance_name: str, 
    collection_name: str, 
    limit: int = 100, 
    offset: int = 0,
    with_payload: bool = True,
    with_vector: bool = False
):
    """Get points from a collection"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            
            # Get collection info first
            collection_info = client.get_collection(collection_name)
            total_points = collection_info.points_count
            
            # Get points
            points = client.scroll(
                collection_name=collection_name,
                limit=limit,
                offset=offset,
                with_payload=with_payload,
                with_vectors=with_vector
            )
            
            point_infos = []
            for point in points[0]:
                point_infos.append(PointInfo(
                    id=str(point.id),
                    payload=point.payload or {},
                    vector=point.vector if with_vector else None,
                    score=None
                ))
            
            return {
                "points": point_infos,
                "total": total_points,
                "limit": limit,
                "offset": offset
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get points: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        return get_points_for_instance(instance, collection_name, limit, offset, with_payload, with_vector)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get points: {str(e)}")

@app.post("/search/{instance_name}")
async def search_points(instance_name: str, search_request: SearchRequest):
    """Search for similar vectors"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            
            search_params = {
                "collection_name": search_request.collection_name,
                "query_vector": search_request.query_vector,
                "limit": search_request.limit
            }
            
            if search_request.score_threshold:
                search_params["score_threshold"] = search_request.score_threshold
            
            results = client.search(**search_params)
            
            point_infos = []
            for result in results:
                point_infos.append(PointInfo(
                    id=str(result.id),
                    payload=result.payload or {},
                    vector=None,
                    score=result.score
                ))
            
            return {"results": point_infos}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        return search_points_for_instance(
            instance, 
            search_request.collection_name, 
            search_request.query_vector, 
            search_request.limit, 
            search_request.score_threshold
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/text-search/{instance_name}")
async def text_search_points(instance_name: str, search_request: TextSearchRequest):
    """Search for text in payload fields"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            
            # Get all points from the collection
            points = client.scroll(
                collection_name=search_request.collection_name,
                limit=10000,  # Adjust based on your needs
                with_payload=True,
                with_vectors=False
            )
            
            if not points[0]:
                return {"results": [], "total": 0, "searched_total": 0}
            
            search_text = search_request.search_text
            if not search_request.case_sensitive:
                search_text = search_text.lower()
            
            matching_points = []
            
            for point in points[0]:
                if not point.payload:
                    continue
                    
                # Search through all payload fields
                found_match = False
                for field_name, field_value in point.payload.items():
                    if field_value is None:
                        continue
                        
                    # Convert field value to string for searching
                    field_str = str(field_value)
                    if not search_request.case_sensitive:
                        field_str = field_str.lower()
                    
                    if search_text in field_str:
                        found_match = True
                        break
                
                if found_match:
                    matching_points.append(PointInfo(
                        id=str(point.id),
                        payload=point.payload or {},
                        vector=None,
                        score=None
                    ))
                    
                    # Limit results
                    if len(matching_points) >= search_request.limit:
                        break
            
            return {
                "results": matching_points,
                "total": len(matching_points),
                "searched_total": len(points[0])
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Text search failed: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        return text_search_for_instance(instance, search_request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text search failed: {str(e)}")

@app.delete("/points/{instance_name}/{collection_name}")
async def clear_collection(instance_name: str, collection_name: str, background_tasks: BackgroundTasks):
    """Clear all points from a collection"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            
            # Get all point IDs
            points = client.scroll(
                collection_name=collection_name,
                limit=10000,  # Adjust based on your needs
                with_payload=False,
                with_vectors=False
            )
            
            if points[0]:
                point_ids = [point.id for point in points[0]]
                client.delete(
                    collection_name=collection_name,
                    points_selector=models.PointIdsList(
                        points=point_ids
                    )
                )
            
            return {"message": f"Cleared {len(points[0]) if points[0] else 0} points from collection '{collection_name}'"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear collection: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        count = clear_collection_for_instance(instance, collection_name)
        return {"message": f"Cleared {count} points from collection '{collection_name}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear collection: {str(e)}")

@app.delete("/points/{instance_name}/{collection_name}/{point_id}")
async def delete_point(instance_name: str, collection_name: str, point_id: str):
    """Delete a specific point"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(
                    points=[point_id]
                )
            )
            return {"message": f"Point {point_id} deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete point: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        delete_point_for_instance(instance, collection_name, point_id)
        return {"message": f"Point {point_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete point: {str(e)}")

@app.get("/export/{instance_name}/{collection_name}")
async def export_collection_csv(instance_name: str, collection_name: str, with_vectors: bool = False):
    """Export collection data to CSV"""
    # First check if it's in the old configurations format
    if instance_name in configurations:
        try:
            client = get_qdrant_client(configurations[instance_name])
            
            # Get all points from the collection
            points = client.scroll(
                collection_name=collection_name,
                limit=10000,  # Adjust based on your needs
                with_payload=True,
                with_vectors=with_vectors
            )
            
            if not points[0]:
                raise HTTPException(status_code=404, detail="No points found in collection")
            
            # Create CSV content
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            if with_vectors:
                writer.writerow(['id', 'vector', 'payload'])
            else:
                writer.writerow(['id', 'payload'])
            
            # Write data
            for point in points[0]:
                try:
                    if with_vectors:
                        vector_str = ','.join(map(str, point.vector)) if point.vector else ''
                        payload_str = json.dumps(point.payload or {}, ensure_ascii=False)
                        writer.writerow([str(point.id), vector_str, payload_str])
                    else:
                        payload_str = json.dumps(point.payload or {}, ensure_ascii=False)
                        writer.writerow([str(point.id), payload_str])
                except Exception as point_error:
                    print(f"Error processing point {point.id}: {point_error}")
                    # Continue with other points
                    continue
            
            output.seek(0)
            csv_content = output.getvalue()
            
            # Create streaming response
            def generate():
                yield csv_content
            
            filename = f"{collection_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            return StreamingResponse(
                generate(),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )
            
        except Exception as e:
            print(f"Export error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to export collection: {str(e)}")
    
    # New instance-based approach
    instances = load_instance_configurations()
    instance = next((inst for inst in instances if inst.name == instance_name), None)
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    try:
        return export_collection_for_instance(instance, collection_name, with_vectors)
    except Exception as e:
        print(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to export collection: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7500) 