import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { QdrantConfig, InstanceConfig } from '../types';
import { apiService } from '../services/api';

interface ConfigContextType {
  configs: QdrantConfig[];
  instances: InstanceConfig[];
  addConfig: (config: QdrantConfig) => void;
  addInstance: (instance: InstanceConfig) => void;
  removeConfig: (name: string) => void;
  removeInstance: (name: string) => void;
  getConfig: (name: string) => QdrantConfig | undefined;
  refreshConfigs: () => Promise<void>;
  refreshInstances: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [configs, setConfigs] = useState<QdrantConfig[]>([]);
  const [instances, setInstances] = useState<InstanceConfig[]>([]);

  // Load instances from backend on mount
  const refreshInstances = async () => {
    try {
      const response = await apiService.getInstances();
      setInstances(response.instances);
    } catch (error) {
      console.error('Failed to load instances:', error);
    }
  };

  // Load configs from backend on mount (for backward compatibility)
  const refreshConfigs = async () => {
    try {
      const response = await apiService.listConfigs();
      const configsList: QdrantConfig[] = [];
      
      for (const configName of response.configs) {
        try {
          const config = await apiService.getConfig(configName);
          configsList.push(config);
        } catch (error) {
          console.error(`Failed to load config ${configName}:`, error);
        }
      }
      
      setConfigs(configsList);
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  useEffect(() => {
    refreshInstances();
    refreshConfigs();
  }, []);

  const addConfig = (config: QdrantConfig) => {
    setConfigs(prev => {
      const filtered = prev.filter(c => c.name !== config.name);
      return [...filtered, config];
    });
  };

  const addInstance = (instance: InstanceConfig) => {
    setInstances(prev => {
      const filtered = prev.filter(i => i.name !== instance.name);
      return [...filtered, instance];
    });
  };

  const removeConfig = (name: string) => {
    setConfigs(prev => prev.filter(config => config.name !== name));
  };

  const removeInstance = (name: string) => {
    setInstances(prev => prev.filter(instance => instance.name !== name));
  };

  const getConfig = (name: string) => {
    return configs.find(config => config.name === name);
  };

  const value: ConfigContextType = {
    configs,
    instances,
    addConfig,
    addInstance,
    removeConfig,
    removeInstance,
    getConfig,
    refreshConfigs,
    refreshInstances,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}; 