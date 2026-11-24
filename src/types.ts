export interface AppCatalogItem {
  id: string;
  name: string;
  label: string;
  description: string;
  logo_url: string | null;
  app_url: string | null;
  app_url_2: string | null;
  app_url_3: string | null;
  app_url_4: string | null;
  tone: string;
  sort_order: number;
  vip_text: string;
  open_text: string;
  is_active: boolean;
  open_mode?: 'auto' | 'frame' | 'direct';
  created_at: string;
}

export interface SliderPhoto {
  id: string;
  image_data: string;
  sort_order: number;
  created_at: string;
}

export interface SocialLinks {
  telegram: string;
  youtube: string;
  whatsapp: string;
  instagram: string;
}

export interface PublicBootstrapData {
  branding: {
    header_title: string;
    updated_at: string;
  };
  apps: AppCatalogItem[];
  sliderPhotos: SliderPhoto[];
  socialLinks: SocialLinks;
}

export interface AdminDashboardData {
  apps: AppCatalogItem[];
  linkCounters: Record<string, [number, number, number, number]>;
  branding: {
    header_title: string;
    updated_at: string;
  };
  sliderPhotos: SliderPhoto[];
  socialLinks: SocialLinks;
}
