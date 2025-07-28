import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from './contexts/ConfigContext'
import Welcome from './pages/Welcome'
import Browser from './pages/Browser'
import './App.css'

function App() {
  return (
    <ConfigProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/browser/:configName" element={<Browser />} />
          </Routes>
        </div>
      </Router>
    </ConfigProvider>
  )
}

export default App 