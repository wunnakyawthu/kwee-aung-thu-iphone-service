export interface PhonePart {
  id: string;
  name: string;
  price: number;
  warrantyPeriod: string;
}

export interface PhoneModel {
  id: string;
  name: string;
  parts: PhonePart[];
}

export type Language = 'en' | 'mm';
export type Theme = 'light' | 'dark';

export interface StoreSettings {
  name: string;
  logoUrl: string;
}
