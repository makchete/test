import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

interface BrandingContextType {
  appName: string;
  appLogoUrl: string;
  setAppLogoUrl: (url: string) => void;
  uploadLogo: (file: File) => Promise<string>;
  resetLogo: () => Promise<void>;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appName, setAppName] = useState<string>('KOMECHAT');
  const [appLogoUrl, setAppLogoUrl] = useState<string>('/komechat_logo.jpg');

  const refreshBranding = useCallback(async () => {
    try {
      const data = await api.getBranding();
      if (data.appName) setAppName(data.appName);
      if (data.appLogoUrl) setAppLogoUrl(data.appLogoUrl);
    } catch (err) {
      console.warn('Failed to load branding info:', err);
    }
  }, []);

  useEffect(() => {
    refreshBranding();

    const handleBrandingEvent = (e: any) => {
      if (e.detail) {
        if (e.detail.appName) setAppName(e.detail.appName);
        if (e.detail.appLogoUrl) setAppLogoUrl(e.detail.appLogoUrl);
      }
    };

    window.addEventListener('komechat:branding_updated', handleBrandingEvent);
    return () => {
      window.removeEventListener('komechat:branding_updated', handleBrandingEvent);
    };
  }, [refreshBranding]);

  const uploadLogo = async (file: File): Promise<string> => {
    const res = await api.uploadAppLogo(file);
    if (res.appLogoUrl) {
      setAppLogoUrl(res.appLogoUrl);
      if (res.settings?.appName) setAppName(res.settings.appName);
    }
    return res.appLogoUrl;
  };

  const resetLogo = async (): Promise<void> => {
    const res = await api.resetAppLogo();
    if (res.appLogoUrl) {
      setAppLogoUrl(res.appLogoUrl);
    }
  };

  return (
    <BrandingContext.Provider
      value={{
        appName,
        appLogoUrl,
        setAppLogoUrl,
        uploadLogo,
        resetLogo,
        refreshBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
