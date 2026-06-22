import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeGetLocalStorage, safeSetLocalStorage } from './utils';

export type LanguageCode = 'en' | 'fr' | 'es' | 'tw';

export interface Language {
  code: LanguageCode;
  name: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'tw', name: 'Twi', flag: '🇬🇭' },
];

export const translations: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Nav links
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.services': 'Services',
    'nav.portfolio': 'Portfolio',
    'nav.gallery': 'Gallery',
    'nav.team': 'Team',
    'nav.booking': 'Booking',
    'nav.contact': 'Contact',
    'nav.applications': 'My Applications',
    'nav.admin': 'Admin',
    'nav.bookNow': 'Book Now',
    'nav.signOut': 'Sign Out',
    'nav.bookSessionNow': 'Book Your Session Now',
    'nav.chooseLanguage': 'Language',
    // Hero
    'hero.badge': 'Excellence in Every Detail',
    'hero.title': 'Grefas Consult & Entertainment',
    'hero.subtitle': 'Elevate Your Vision with Grefas in Nyinahin-Ashanti, Ashanti Region',
    'hero.description': 'Our Nyinahin-Ashanti, Ashanti Region based agency is your premier partner for professional consulting and world-class entertainment services. We turn your ideas into unforgettable experiences.',
    'hero.getStarted': 'Get Started',
    'hero.viewGallery': 'View Gallery',
    'hero.dailyInspiration': 'Daily Inspiration',
    // General
    'footer.description': 'Grefas Consult & Entertainment is your premier consulting and full-service entertainment provider in Nyinahin-Ashanti, Ashanti Region, Ghana.',
    'footer.quickLinks': 'Quick Links',
    'footer.contactUs': 'Contact Us',
    'footer.social': 'Social Media',
    'footer.copyright': 'All rights reserved.',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.about': 'À Propos',
    'nav.services': 'Services',
    'nav.portfolio': 'Portfolio',
    'nav.gallery': 'Galerie',
    'nav.team': 'Équipe',
    'nav.booking': 'Réservation',
    'nav.contact': 'Contact',
    'nav.applications': 'Mes Candidatures',
    'nav.admin': 'Admin',
    'nav.bookNow': 'Réserver',
    'nav.signOut': 'Déconnexion',
    'nav.bookSessionNow': 'Réservez votre séance maintenant',
    'nav.chooseLanguage': 'Langue',
    'hero.badge': "L'excellence dans les moindres détails",
    'hero.title': 'Grefas Consult & Entertainment',
    'hero.subtitle': "Élevez votre vision avec Grefas à Nyinahin-Ashanti, région d'Ashanti",
    'hero.description': "Notre agence basée à Nyinahin-Ashanti, dans la région d'Ashanti, est votre partenaire de choix pour des conseils professionnels et des services de divertissement de classe mondiale. Nous transformons vos idées en expériences inoubliables.",
    'hero.getStarted': 'Commencer',
    'hero.viewGallery': 'Voir la Galerie',
    'hero.dailyInspiration': 'Inspiration Quotidienne',
    'footer.description': "Grefas Consult & Entertainment est votre premier cabinet de conseil et prestataire de services de divertissement complets à Nyinahin-Ashanti, région d'Ashanti, Ghana.",
    'footer.quickLinks': 'Liens Rapides',
    'footer.contactUs': 'Contactez-nous',
    'footer.social': 'Réseaux Sociaux',
    'footer.copyright': 'Tous droits réservés.',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.about': 'Sobre Nosotros',
    'nav.services': 'Servicios',
    'nav.portfolio': 'Portafolio',
    'nav.gallery': 'Galería',
    'nav.team': 'Equipo',
    'nav.booking': 'Reserva',
    'nav.contact': 'Contacto',
    'nav.applications': 'Mis Solicitudes',
    'nav.admin': 'Admin',
    'nav.bookNow': 'Reservar',
    'nav.signOut': 'Cerrar Sesión',
    'nav.bookSessionNow': 'Reserve su sesión ahora',
    'nav.chooseLanguage': 'Idioma',
    'hero.badge': 'Excelencia en cada detalle',
    'hero.title': 'Grefas Consult & Entertainment',
    'hero.subtitle': 'Eleve su visión con Grefas en Nyinahin-Ashanti, Región de Ashanti',
    'hero.description': 'Nuestra agencia con sede en Nyinahin-Ashanti, región de Ashanti, es su socio principal para consultorías profesionales y servicios de entretenimiento de clase mundial. Convertimos sus ideas en experiencias inolvidables.',
    'hero.getStarted': 'Primeros Pasos',
    'hero.viewGallery': 'Ver Galería',
    'hero.dailyInspiration': 'Inspiración Diaria',
    'footer.description': 'Grefas Consult & Entertainment es su principal proveedor de consultoría y entretenimiento de servicio completo en Nyinahin-Ashanti, Región de Ashanti, Ghana.',
    'footer.quickLinks': 'Enlaces Rápidos',
    'footer.contactUs': 'Contáctenos',
    'footer.social': 'Redes Sociales',
    'footer.copyright': 'Todos los derechos reservados.',
  },
  tw: {
    'nav.home': 'Fie',
    'nav.about': 'Yɛn Ho Asɛm',
    'nav.services': 'Nnwuma',
    'nav.portfolio': 'Nnwuma a Yɛayɛ',
    'nav.gallery': 'Mfonini Mpɛm',
    'nav.team': 'Akuw',
    'nav.booking': 'Nkyerɛe',
    'nav.contact': 'Nkitahode',
    'nav.applications': 'Nnwuma a Masɔ Hwɛ',
    'nav.admin': 'Amandzela',
    'nav.bookNow': 'Kyerɛ seesei',
    'nav.signOut': 'Pue',
    'nav.bookSessionNow': 'Kyerɛ wo nhyiam seesei',
    'nav.chooseLanguage': 'Kasa',
    'hero.badge': 'Paapaemu fɛfɛɛfɛ wɔ biribiara mu',
    'hero.title': 'Grefas Consult & Entertainment',
    'hero.subtitle': 'Ma wo anisoadehunu kɔ anim ne Grefas wɔ Nyinahin-Ashanti, Ashanti Mantam',
    'hero.description': 'Yɛn adwumayɛbea a ɛwɔ Nyinahin-Ashanti, Ashanti Mantam yi ne wo hokafoɔ kɛseɛ ma afotu pa ne anigyedeɛ nwuma a ɛsen biara. Yɛma wo nsusuwpa dan anigyeɛ kɛseɛ.',
    'hero.getStarted': 'Fi Ase',
    'hero.viewGallery': 'Hwɛ Mfonini',
    'hero.dailyInspiration': 'Da Biara Da Nkuranhyɛ',
    'footer.description': 'Grefas Consult & Entertainment ne wo hokafo pa wɔ afotu ne anigyedeɛ nnwuma mu wɔ Nyinahin-Ashanti, Ashanti Mantam, Ghana.',
    'footer.quickLinks': 'Nkitahode a Ɛyɛ Ntɛm',
    'footer.contactUs': 'Yɛne yɛn nni nkitaho',
    'footer.social': 'Abɛfo nkitahode',
    'footer.copyright': 'Yɛatow dede nyinaa ato hɔ.',
  }
};

interface LanguageContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
  currentLanguage: Language;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<LanguageCode>(() => {
    return (safeGetLocalStorage('grefas_lang', 'en') as LanguageCode);
  });

  const setLanguage = (lang: LanguageCode) => {
    setLang(lang);
    safeSetLocalStorage('grefas_lang', lang);
  };

  const t = (key: string): string => {
    if (translations[language] && translations[language][key]) {
      return translations[language][key];
    }
    // fallback to English
    if (translations.en[key]) {
      return translations.en[key];
    }
    return key;
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, currentLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
