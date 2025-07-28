# Vector Database Browser

A beautiful and intuitive web-based interface for managing your vector databases. Browse collections, inspect chunks, search through your data, and manage your vector stores with ease.

## ✨ Features

### 🗄️ **Multi-Database Support**
- **Qdrant**: Full support for Qdrant vector database
- **ChromaDB**: Complete ChromaDB integration
- **Unified Interface**: Same beautiful UI for both database types

### 🔍 **Powerful Browsing & Search**
- **Collection Management**: View, delete, and export collections
- **Point Inspection**: Browse through individual vectors and metadata
- **Text Search**: Search through payload fields with highlighting
- **Vector Search**: Similarity search with configurable thresholds
- **Pagination**: Efficient handling of large datasets

### 💼 **Instance Management**
- **Multiple Instances**: Connect to multiple database instances
- **Easy Configuration**: Simple setup with connection testing
- **Visual Indicators**: Clear database type identification

### 📊 **Data Export**
- **CSV Export**: Export collection data with or without vectors
- **Filtered Exports**: Export search results
- **Metadata Preservation**: All payload data included

### 🎨 **Modern UI/UX**
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Live data refresh
- **Syntax Highlighting**: JSON payload formatting
- **Dark/Light Themes**: Comfortable viewing

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **Access to running vector database** (Qdrant or ChromaDB instance with known URL and port)

### Installation

Run the 'start.sh'. It will set up both backend or front end. If you wish to do it separately, follow the below steps.

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vector-database-browser.git
   cd vector-database-browser/vBrowser
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start the Backend** (Terminal 1)
   ```bash
   cd backend
   python main.py
   ```

2. **Start the Frontend** (Terminal 2)
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the Application**
   Open http://localhost:5173 in your browser

## 📖 Usage Guide

### Adding Database Instances

1. **Click "Add Instance"** on the welcome page
2. **Select Database Type**: Choose between Qdrant or ChromaDB
3. **Configure Connection**:
   - **Name**: Give your instance a descriptive name
   - **URL**: Database connection URL
     - Qdrant: `http://localhost:6333`
     - ChromaDB: `http://localhost:6335`
   - **API Key**: (Optional) For secured instances
4. **Test & Save**: Connection is automatically tested

### Browsing Collections

1. **Select Instance**: Click "Open" on any configured instance
2. **Choose Collection**: Collections appear in the left sidebar
3. **Browse Data**: 
   - View points with metadata
   - Toggle vector display
   - Navigate with pagination

### Searching Data

#### Text Search
- **Search Box**: Enter text to search in payload fields
- **Case Sensitivity**: Toggle case-sensitive matching
- **Highlighting**: Search terms are highlighted in results

#### Vector Search
- **Upload Vector**: Provide query vector for similarity search
- **Similarity Threshold**: Set minimum similarity score
- **Top-K Results**: Specify number of results

### Exporting Data

1. **Collection Export**: Click download icons in collection list
2. **Choose Format**: 
   - Data only (without vectors)
   - Full export (with vectors)
3. **CSV Download**: Automatically downloads formatted CSV

## ⚙️ Configuration

### Environment Variables

Create `.env` files for configuration:

**Backend (.env)**
```env
PORT=7500
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:7500
```

### Instance Configuration

Instances are stored in `backend/instance.config`:
```json
{
  "instances": [
    {
      "name": "Local Qdrant",
      "url": "http://localhost:6333/",
      "api_key": null,
      "type": "qdrant"
    },
    {
      "name": "Local ChromaDB", 
      "url": "http://localhost:6335/",
      "api_key": null,
      "type": "chromadb"
    }
  ]
}
```

## 🐳 Docker Deployment

### Using Docker Compose

```yaml
version: '3.8'
services:
  vector-browser-backend:
    build: ./backend
    ports:
      - "7500:7500"
    environment:
      - PORT=7500
    volumes:
      - ./backend/instance.config:/app/instance.config

  vector-browser-frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - vector-browser-backend
```

Run with:
```bash
docker-compose up -d
```

## 🔌 API Reference

The backend provides a REST API for programmatic access:

### Instances
- `GET /instances` - List all configured instances
- `POST /instances` - Add new instance
- `DELETE /instances/{name}` - Remove instance

### Collections
- `GET /collections/{instance_name}` - List collections
- `DELETE /collections/{instance_name}/{collection_name}` - Delete collection

### Points
- `GET /points/{instance_name}/{collection_name}` - Get points
- `POST /search/{instance_name}` - Vector search
- `POST /text-search/{instance_name}` - Text search
- `DELETE /points/{instance_name}/{collection_name}/{point_id}` - Delete point

### Export
- `GET /export/{instance_name}/{collection_name}` - Export collection

## 🛠️ Development

### Project Structure
```
vBrowser/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── instance.config      # Instance configurations
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   ├── package.json        # Node dependencies
│   └── vite.config.ts      # Vite configuration
└── start.sh                # Quick start script
```

### Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests  
cd frontend
npm test
```

## 📋 Requirements

### Backend Dependencies
- FastAPI 0.115.0+
- qdrant-client 1.15.0+
- chromadb 0.4.18+
- pydantic 2.10.0+
- uvicorn[standard] 0.30.0+

### Frontend Dependencies
- React 18+
- TypeScript 5+
- Tailwind CSS 3+
- Vite 5+
- React Router DOM 6+

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/vector-database-browser/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/vector-database-browser/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/vector-database-browser/wiki)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Qdrant** - For the excellent vector database
- **ChromaDB** - For the robust embedding database
- **FastAPI** - For the fast, modern web framework
- **React** - For the powerful UI library
- **Tailwind CSS** - For the utility-first CSS framework

---

**Made with ❤️ for the vector database community** 
