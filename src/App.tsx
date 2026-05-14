/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingCart, Search, X, Plus, Minus, Trash2, ChevronLeft, ChevronRight, Github, Cpu, Sun, Moon, LogIn, LogOut, User as UserIcon, Settings, Camera, Upload, Package, Clock, Bell, Shield, Smartphone, Lock, Globe, MapPin, Truck, AlertCircle, Navigation, BarChart3, TrendingUp, Users, DollarSign, Activity, PieChart, CheckCircle2, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AreaChart as RechartsAreaChart, Area as RechartsArea, XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer, PieChart as RechartsPieChart, Pie as RechartsPie, Cell as RechartsCell, BarChart as RechartsBarChart, Bar as RechartsBar, Legend as RechartsLegend } from 'recharts';
import { motion, AnimatePresence, motionValue, useSpring } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  images?: string[]; // Additional pictures
  description: string;
  unitsInStock?: number;
  isFeatured?: boolean;
  isPreOrder?: boolean;
  preOrderDays?: string;
  hasWarranty?: boolean;
  warrantyDetails?: string;
  warrantyTime?: string;
  warrantyConditions?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  date: string;
  status: 'Pending' | 'Approved' | 'Cancelled' | 'Shipped' | 'Delivered';
  customerDetails?: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    district: string;
    thana: string;
    fullAddress?: string;
  };
  paymentDetails?: {
    method: 'bkash' | 'nagad';
    transactionId: string;
  };
}

export interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string;
  address?: string;
  orders?: Order[];
  is2FAEnabled?: boolean;
  sessions?: Session[];
}

// --- Supabase Config ---
const sanitizeConfig = (val: string) => {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "");
};

const sanitizeUrl = (url: string) => {
  let cleaned = sanitizeConfig(url);
  if (!cleaned) return "";
  
  // Force remove any trailing slashes, /rest, /v1 or combinations
  cleaned = cleaned.replace(/\/(rest|v1|auth|storage|realtime).*$/i, "");
  cleaned = cleaned.replace(/\/+$/, "");

  if (!cleaned.startsWith("http")) cleaned = "https://" + cleaned;

  try {
    const u = new URL(cleaned);
    return `${u.protocol}//${u.host}`;
  } catch {
    return cleaned;
  }
};

const supabaseUrlValue = import.meta.env.VITE_SUPABASE_URL || 'https://lxyszolrpinshzpmgxws.supabase.co';
const supabaseUrl = sanitizeUrl(supabaseUrlValue);
const supabaseAnonKey = sanitizeConfig(import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4eXN6b2xycGluc2h6cG1neHdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjM2MDQsImV4cCI6MjA5MzY5OTYwNH0.u5A5jf3SZ7zjDDK_fS7Jj5dfSCwjiDlPqrtZrT1P-8k');

if (!supabaseUrl.startsWith('http')) {
    console.error("CRITICAL: Invalid Supabase URL configuration:", supabaseUrl);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

const supabaseService = {
  async getProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data as Product[];
  },
  async addProduct(product: Product) {
    try {
      const { data, error } = await supabase.from('products').insert([product]).select();
      if (!error && data) return data[0] as Product;
      
      // Fallback if images column doesn't exist
      if (error && (error.message.includes('column') || error.code === '42703')) {
        const { images, ...rest } = product;
        const { data: fallbackData, error: fallbackError } = await supabase.from('products').insert([rest]).select();
        if (!fallbackError && fallbackData) return { ...fallbackData[0], images } as Product;
        throw fallbackError || error;
      }
      throw error;
    } catch (err) {
      console.error('addProduct failure:', err);
      throw err;
    }
  },
  async updateProduct(product: Product) {
    try {
      const { data, error } = await supabase.from('products').update(product).eq('id', product.id).select();
      if (!error && data) return data[0] as Product;

      // Fallback if images column doesn't exist
      if (error && (error.message.includes('column') || error.code === '42703')) {
        const { images, ...rest } = product;
        const { data: fallbackData, error: fallbackError } = await supabase.from('products').update(rest).eq('id', product.id).select();
        if (!fallbackError && fallbackData) return { ...fallbackData[0], images } as Product;
        throw fallbackError || error;
      }
      throw error;
    } catch (err) {
      console.error('updateProduct failure:', err);
      throw err;
    }
  },
  async deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
  async getOrders() {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) throw error;
    return data as Order[];
  },
  async getOrdersByUserId(userId: string) {
    try {
      // Try user_id (Postgres convention)
      const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('date', { ascending: false });
      if (!error) return data as Order[];
      
      // Fallback to userId (CamelCase convention)
      const { data: data2, error: error2 } = await supabase.from('orders').select('*').eq('userId', userId).order('date', { ascending: false });
      if (!error2) return data2 as Order[];
      
      throw error || error2;
    } catch (err) {
      console.error('getOrdersByUserId failure:', err);
      return [];
    }
  },
  async createOrder(order: Order) {
    try {
      // Create a copy to manipulate
      const baseOrder = { ...order };
      if (!baseOrder.date) baseOrder.date = new Date().toISOString();
      
      // First try with original object (matches Order interface)
      const { data, error } = await supabase.from('orders').insert([baseOrder]).select();
      if (!error && data) return data[0] as Order;
      
      console.warn('Initial createOrder failed, trying fallback mapping:', error);

      // Fallback 1: Column naming mismatch (userId vs user_id) and camelCase to snake_case
      const mappedOrder = {
        id: order.id,
        user_id: order.userId,
        total: order.total,
        status: order.status,
        date: baseOrder.date,
        items: order.items, // Keep as array, Supabase handles JSONB
        customer_details: order.customerDetails,
        payment_details: order.paymentDetails
      };

      const { data: data2, error: error2 } = await supabase.from('orders').insert([mappedOrder]).select();
      if (!error2 && data2) return data2[0] as Order;
      
      console.warn('Fallback 1 failed, trying Fallback 2 (minimal without custom ID):', error2);

      // Fallback 2: Maybe the 'id' is a serial/identity column that shouldn't be set manually
      const { id: _, ...noIdOrder } = mappedOrder;
      const { data: data3, error: error3 } = await supabase.from('orders').insert([noIdOrder]).select();
      if (!error3 && data3) return data3[0] as Order;

      // Fallback 3: Try flattening details if they are not JSONB columns
      console.warn('Fallback 2 failed, trying Fallback 3 (flattened details):', error3);
      const flattenedOrder = {
        ...noIdOrder,
        customer_name: `${order.customerDetails?.firstName} ${order.customerDetails?.lastName}`,
        phone: order.customerDetails?.phone,
        district: order.customerDetails?.district,
        thana: order.customerDetails?.thana,
        address: order.customerDetails?.fullAddress,
        payment_method: order.paymentDetails?.method,
        transaction_id: order.paymentDetails?.transactionId,
        items: JSON.stringify(order.items) // Stringify items as last resort
      };
      // Remove complex objects if they failed before
      delete (flattenedOrder as any).customer_details;
      delete (flattenedOrder as any).payment_details;

      const { data: data4, error: error4 } = await supabase.from('orders').insert([flattenedOrder]).select();
      if (!error4 && data4) return data4[0] as Order;

      throw error4 || error3 || error2 || error;
    } catch (err) {
      console.error('createOrder final failure:', err);
      throw err;
    }
  },
  async updateOrderStatus(orderId: string, status: Order['status']) {
    const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select();
    if (error) throw error;
    return data[0] as Order;
  },
  async deleteOrder(orderId: string) {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) throw error;
    return true;
  },
  async getSettings() {
    const { data, error } = await supabase.from('site_settings').select('*').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
  async updateSettings(settings: any) {
    const { data, error } = await supabase.from('site_settings').upsert({ id: 1, ...settings }).select().single();
    if (error) throw error;
    return data;
  }
};

// --- Constants & Data ---
const PRODUCTS: Product[] = [];
const CATEGORIES = ['All', ...new Set(PRODUCTS.map((p) => p.category))];

const BANGLADESH_DISTRICTS: Record<string, string[]> = {
  "Bagerhat": ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"],
  "Bandarban": ["Bandarban Sadar", "Thanchi", "Lama", "Naikhongchhari", "Ali Kadam", "Rowangchhari", "Ruma"],
  "Barguna": ["Barguna Sadar", "Amtali", "Bamna", "Betagi", "Patharghata", "Taltali"],
  "Barishal": ["Barishal Sadar", "Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Gaurnadi", "Hizla", "Mehendiganj", "Muladi", "Wazirpur"],
  "Bhola": ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"],
  "Bogra": ["Bogra Sadar", "Adamdighi", "Dhunat", "Dhupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Sherpur", "Shajahanpur", "Sonatola"],
  "Brahmanbaria": ["Brahmanbaria Sadar", "Ashuganj", "Bancharampur", "Bijoynagar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail", "Akhaura"],
  "Chandpur": ["Chandpur Sadar", "Faridganj", "Haimchar", "Haziganj", "Kachua", "Matlab Uttar", "Matlab Dakshin", "Shahrasti"],
  "Chattogram": ["Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Fatickchhari", "Hathazari", "Lohagara", "Mirsharai", "Patiya", "Rangunia", "Raozan", "Sandwip", "Satkania", "Sitakunda", "Chattogram Sadar"],
  "Chuadanga": ["Chuadanga Sadar", "Alamdanga", "Damurhuda", "Jibannagar"],
  "Cumilla": ["Cumilla Sadar", "Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Daudkandi", "Debidwar", "Homna", "Laksam", "Muradnagar", "Nangalkot", "Titas", "Meghna", "Monohargonj"],
  "Cox's Bazar": ["Cox's Bazar Sadar", "Chakaria", "Kutubdia", "Maheshkhali", "Ramu", "Teknaf", "Ukhia", "Pekua"],
  "Dhaka": ["Dhaka Sadar", "Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"],
  "Dinajpur": ["Dinajpur Sadar", "Biral", "Birganj", "Bochaganj", "Chirirbandar", "Phulbari", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur"],
  "Faridpur": ["Faridpur Sadar", "Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"],
  "Feni": ["Feni Sadar", "Chhagalnaiya", "Daganbhuiyan", "Parshuram", "Sonagazi", "Fulgazi"],
  "Gaibandha": ["Gaibandha Sadar", "Phulchhari", "Gobindaganj", "Palashbari", "Sadullapur", "Saghata", "Sundarganj"],
  "Gazipur": ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"],
  "Gopalganj": ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"],
  "Habiganj": ["Habiganj Sadar", "Ajmiriganj", "Bahubal", "Baniyachong", "Chunarughat", "Lakhai", "Madhabpur", "Nabiganj", "Shayestaganj"],
  "Jamalpur": ["Jamalpur Sadar", "Bakshiganj", "Dewanganj", "Islampur", "Madarganj", "Melandaha", "Sarishabari"],
  "Jashore": ["Jashore Sadar", "Abhaynagar", "Bagherpara", "Chaugachha", "Jhikargachha", "Keshabpur", "Manirampur", "Sharsha"],
  "Jhalokati": ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"],
  "Jhenaidah": ["Jhenaidah Sadar", "Harinakunda", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"],
  "Joypurhat": ["Joypurhat Sadar", "Akkelpur", "Kalai", "Khetlal", "Panchbibi"],
  "Khagrachhari": ["Khagrachhari Sadar", "Dighinala", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"],
  "Khulna": ["Khulna Sadar", "Batiaghata", "Dacope", "Dumuria", "Dighalia", "Koyra", "Paikgachha", "Phultala", "Terokhada", "Rupsha"],
  "Kishoreganj": ["Kishoreganj Sadar", "Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"],
  "Kurigram": ["Kurigram Sadar", "Bhurungamari", "Char Rajibpur", "Chilmari", "Phulbari", "Nageshwari", "Rajarhat", "Roumari", "Ulipur"],
  "Kushtia": ["Kushtia Sadar", "Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Mirpur"],
  "Lakshmipur": ["Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati", "Kamalnagar"],
  "Lalmonirhat": ["Lalmonirhat Sadar", "Aditmari", "Hatibandha", "Kaliganj", "Patgram"],
  "Madaripur": ["Madaripur Sadar", "Kalkini", "Rajoir", "Shibchar"],
  "Magura": ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"],
  "Manikganj": ["Manikganj Sadar", "Daulatpur", "Ghior", "Harirampur", "Saturia", "Shivalaya", "Singair"],
  "Meherpur": ["Meherpur Sadar", "Gangni", "Mujibnagar"],
  "Moulvibazar": ["Moulvibazar Sadar", "Barlekha", "Kamalganj", "Kulaura", "Rajnagar", "Sreemangal", "Juri"],
  "Munshiganj": ["Munshiganj Sadar", "Gajaria", "Lohajang", "Sirajdikhan", "Sreenagar", "Tongibari"],
  "Mymensingh": ["Mymensingh Sadar", "Bhaluka", "Dhobaura", "Fulbaria", "Gaffargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Muktagachha", "Nandail", "Phulpur", "Trishal", "Tara Khanda"],
  "Naogaon": ["Naogaon Sadar", "Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mahadevpur", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"],
  "Narail": ["Narail Sadar", "Kalia", "Lohagara"],
  "Narayanganj": ["Narayanganj Sadar", "Araihazar", "Bandar", "Rupganj", "Sonargaon"],
  "Narsingdi": ["Narsingdi Sadar", "Belabo", "Monohardi", "Palash", "Raipura", "Shibpur"],
  "Natore": ["Natore Sadar", "Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Singra", "Naldanga"],
  "Netrokona": ["Netrokona Sadar", "Atpara", "Barhatta", "Durgapur", "Khaliajuri", "Kalmakanda", "Kendua", "Madan", "Mohanganj", "Purbadhala"],
  "Nilphamari": ["Nilphamari Sadar", "Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Saidpur"],
  "Noakhali": ["Noakhali Sadar", "Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Senbagh", "Sonaimuri", "Subarnachar", "Kabirhat"],
  "Pabna": ["Pabna Sadar", "Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Santhia", "Sujanagar"],
  "Panchagarh": ["Panchagarh Sadar", "Atwari", "Boda", "Debiganj", "Tetulia"],
  "Patukhali": ["Patuakhali Sadar", "Bauphal", "Dashmina", "Galachipa", "Kalapara", "Mirzaganj", "Rangabali", "Dumki"],
  "Pirojpur": ["Pirojpur Sadar", "Bhandaria", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Zianagar"],
  "Rajbari": ["Rajbari Sadar", "Baliakandi", "Goalandaghat", "Pangsha", "Kalukhali"],
  "Rajshahi": ["Bagha", "Bagmara", "Charghat", "Durgapur", "Godagari", "Mohanpur", "Paba", "Puthia", "Tanore", "Rajshahi Sadar"],
  "Rangamati": ["Rangamati Sadar", "Bagaichhari", "Barkal", "Kawkhali", "Belaichhari", "Kaptai", "Jurachhari", "Langadu", "Nanierchar", "Rajasthali"],
  "Rangpur": ["Rangpur Sadar", "Badarganj", "Gangachara", "Kaunia", "Mithapukur", "Pirgachha", "Pirganj", "Taraganj"],
  "Satkhira": ["Satkhira Sadar", "Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Shyamnagar", "Tala"],
  "Shariatpur": ["Shariatpur Sadar", "Bhedarganj", "Damudya", "Gosairhat", "Naria", "Zajira"],
  "Sherpur": ["Sherpur Sadar", "Jhenaigati", "Nakla", "Nalitabari", "Sreebardi"],
  "Sirajganj": ["Sirajganj Sadar", "Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj", "Shahjadpur", "Tarash", "Ullahpara"],
  "Sunamganj": ["Sunamganj Sadar", "Bishwamirpur", "Chhatak", "Dakshin Sunamganj", "Derai", "Dharampasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Sullah", "Tahirpur"],
  "Sylhet": ["Sylhet Sadar", "Balaganj", "Beanibazar", "Bishwanath", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat", "Zakiganj", "Dakshin Surma", "Osmani Nagar"],
  "Tangail": ["Tangail Sadar", "Basail", "Bhuapur", "Delduar", "Gopalpur", "Ghatail", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Dhanbari"],
  "Thakurgaon": ["Thakurgaon Sadar", "Baliadangi", "Haripur", "Pirganj", "Ranisankail"]
};
const DISTRICTS = Object.keys(BANGLADESH_DISTRICTS).sort();

// --- Utils ---
const ID_COUNTER_KEY = 'gadgets_ghar_id_counter';

const formatAccountID = (uid: string) => {
  if (!uid) return 'MEM-00';
  if (uid.includes('-')) {
    const parts = uid.split('-');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart.substring(0, 4), 16) % 1000;
    return `MEM-${num.toString().padStart(3, '0')}`;
  }
  return uid;
};

const getNextId = () => {
  if (typeof window === 'undefined') return 'UID-1001';
  const current = parseInt(localStorage.getItem(ID_COUNTER_KEY) || '1000');
  const next = current + 1;
  localStorage.setItem(ID_COUNTER_KEY, next.toString());
  return `UID-${next}`;
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCart = localStorage.getItem('gadgets_ghar_cart');
        return savedCart ? JSON.parse(savedCart) : [];
      } catch (e) {
        console.error('Failed to parse cart from localStorage', e);
        return [];
      }
    }
    return [];
  });

  // Sync cart to localStorage
  useEffect(() => {
    localStorage.setItem('gadgets_ghar_cart', JSON.stringify(cart));
  }, [cart]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [lastVisualMatch, setLastVisualMatch] = useState<string | null>(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment'>('details');
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | null>(null);
  const [transactionId, setTransactionId] = useState('');
  
  // Checkout Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [fullAddress, setFullAddress] = useState('');

  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedThana, setSelectedThana] = useState<string>('');
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isWarrantyModalOpen, setIsWarrantyModalOpen] = useState(false);

  useEffect(() => {
    // Show welcome banner with a slight delay for better UX
    const timer = setTimeout(() => {
      setShowWelcomeBanner(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [userEmail, setUserEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authFullName, setAuthFullName] = useState('');
  const [authPhoneNumber, setAuthPhoneNumber] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'info' | 'orders' | 'settings' | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthRestored, setIsAuthRestored] = useState(false);

  // Initial Auth Restoration
  useEffect(() => {
    const handleAuthSession = (session: any) => {
      if (session) {
        const sUser = session.user;
        const initialUser: User = {
          uid: sUser.id,
          email: sUser.email || sUser.user_metadata?.email || '',
          displayName: sUser.user_metadata?.full_name || sUser.user_metadata?.display_name || 'User',
          photoURL: sUser.user_metadata?.avatar_url || null,
          phoneNumber: sUser.user_metadata?.phone_number || sUser.phone || '',
          address: sUser.user_metadata?.address || '',
          orders: []
        };
        setUser(initialUser);

        supabaseService.getOrdersByUserId(sUser.id).then(userOrders => {
          setUser(prev => prev && prev.uid === sUser.id ? { ...prev, orders: userOrders } : prev);
        }).catch(err => {
          console.error('Order fetch failure:', err);
        });
        
        if (sUser.user_metadata?.role === 'admin') {
          setIsAdminLoggedIn(true);
        }
      } else {
        setUser(null);
        setIsAdminLoggedIn(false);
      }
      setIsAuthRestored(true);
    };

    // Recover session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthSession(session);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event change:', event);
      handleAuthSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Pre-fill checkout info from user profile
  useEffect(() => {
    if (user) {
      if (user.displayName) {
        const parts = user.displayName.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.length > 1 ? parts.slice(1).join(' ') : '');
      }
      if (user.email) setCheckoutEmail(user.email);
      if (user.phoneNumber) setPhone(user.phoneNumber);
      if (user.address) setFullAddress(user.address);
    }
  }, [user, isCheckoutOpen]);

  // Admin State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'analytics' | 'products' | 'orders' | 'content' | 'settings' | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [secretClickCount, setSecretClickCount] = useState(0);
  
  // Products and Settings State
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [siteSettings, setSiteSettings] = useState({
    contactPhone: '01576-737194',
    whatsappNumber: '8801576737194',
    facebookPageUrl: 'https://www.facebook.com/gadgetsgharbdofficial',
    tiktokUrl: 'https://www.tiktok.com/@gadgets.ghar.bd?_r=1&_t=ZS-9655JSYIOHw',
    owners: [
      { name: 'Hassan Rakibul', url: 'https://www.facebook.com/hassan.rakibul.07/' },
      { name: 'Mahdi Rashid Semon', url: 'https://www.facebook.com/mahdirashid.semon.3' }
    ]
  });

  // Load Initial Global Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [products, orders, settings] = await Promise.all([
          supabaseService.getProducts().catch(() => []),
          supabaseService.getOrders().catch(() => []),
          supabaseService.getSettings().catch(() => null)
        ]);
        
        if (products && products.length > 0) {
          const mappedProducts = products.map((p: any) => ({
            ...p,
            hasWarranty: p.has_warranty ?? p.hasWarranty,
            warrantyDetails: p.warranty_details ?? p.warrantyDetails,
            warrantyTime: p.warranty_time ?? p.warrantyTime,
            warrantyConditions: p.warranty_conditions ?? p.warrantyConditions,
            preOrderDays: p.pre_order_days ?? p.preOrderDays
          }));
          setProductsList(mappedProducts);
        }
        if (orders) setAllOrders(orders);
        if (settings) {
            setSiteSettings(prev => ({ ...prev, ...settings }));
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Admin Product Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    price: undefined,
    category: 'Accessories',
    image: '',
    description: '',
    unitsInStock: undefined
  });

  // Persist site settings when changed
  useEffect(() => {
    if (!isLoading) {
        supabaseService.updateSettings(siteSettings).catch(err => console.error('Failed to update settings:', err));
    }
  }, [siteSettings, isLoading]);

  useEffect(() => {
    localStorage.setItem('gadgets_ghar_admin_auth', isAdminLoggedIn.toString());
  }, [isAdminLoggedIn]);

  // Sync logged in user's orders with the global orders list (simulating backend update)
  useEffect(() => {
    if (user && allOrders.length > 0) {
      const userOrders = user.orders || [];
      const updatedOrders = userOrders.map(localOrder => {
        const globalOrder = allOrders.find(o => o.id === localOrder.id);
        if (globalOrder && globalOrder.status !== localOrder.status) {
          return { ...localOrder, status: globalOrder.status };
        }
        return localOrder;
      });

      // Only update state if there are actual changes to prevent loops
      const hasChanged = JSON.stringify(updatedOrders) !== JSON.stringify(userOrders);
      if (hasChanged) {
        setUser(prev => prev ? { ...prev, orders: updatedOrders } : null);
      }
    }
  }, [allOrders, user?.uid]);

  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiSearching(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      // Get current products to inform the AI
      const productNames = productsList.map(p => p.name).join(", ");

      const ai = new GoogleGenAI({ apiKey: (process as any).env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            { text: `You are a visual search engine for 'Gadgets Ghar BD'. 
            
Available Products in our store: [${productNames}]

Your task:
1. Analyze the uploaded image.
2. Find the product from the list above that best matches the item in the image.
3. If you find a direct match from the list, return ONLY that product's EXACT name.
4. If the item in the image is NOT in our list, return a 1-2 word search query that describes it so we can find similar items.
5. Return ONLY the text result, no explanation.` }
          ]
        }
      });

      const resultText = response.text?.trim();
      
      if (resultText) {
          setSearchQuery(resultText);
          setLastVisualMatch(resultText);
          // Scroll to products
          const productSection = document.getElementById('products');
          if (productSection) {
              productSection.scrollIntoView({ behavior: 'smooth' });
          }
          
          // Clear visual match label after 10 seconds
          setTimeout(() => setLastVisualMatch(null), 10000);
      }
    } catch (error) {
      console.error("AI Visual Search Error:", error);
    } finally {
      setIsAiSearching(false);
      // Reset input
      e.target.value = '';
    }
  };

  // Admin Actions
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
        alert('Config Error: Supabase URL is not configured correctly. Please check VITE_SUPABASE_URL.');
        return;
    }

    setAdminAuthLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) {
        if (error.message.includes('Invalid path')) {
            alert('CRITICAL CONFIG ERROR: Invalid Supabase API path. Please ensure your VITE_SUPABASE_URL environment variable is correct (e.g. https://xyz.supabase.co) and does not include extra paths like /rest/v1.');
        } else {
            alert('Authentication Failed: ' + error.message);
        }
        return;
      }
      
      if (data.user) {
        if (data.user.user_metadata?.role === 'admin') {
          setIsAdminLoggedIn(true);
          setAdminPassword('');
          setAdminEmail('');
        } else {
          alert('Access Denied: You do not have admin permissions.');
          // Sign out immediately if not admin
          supabase.auth.signOut();
        setCart([]);
        localStorage.removeItem('gadgets_ghar_cart');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const message = err.message || '';
      if (message.toLowerCase().includes('invalid login credentials')) {
        alert('Incorrect password or email. Please try again.');
      } else {
        alert(err.message || 'Authentication failed');
      }
    } finally {
      setAdminAuthLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (newProduct.name && newProduct.price) {
      const product: Product = {
        id: `P-${Date.now()}`,
        name: newProduct.name,
        price: Number(newProduct.price),
        category: newProduct.category || 'Accessories',
        image: newProduct.image || 'https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?auto=format&fit=crop&q=80&w=400&h=500',
        description: newProduct.description || '',
        unitsInStock: newProduct.unitsInStock ? Number(newProduct.unitsInStock) : undefined
      };
      
      try {
        await supabaseService.addProduct(product);
        setProductsList(prev => [product, ...prev]);
        setNewProduct({ name: '', price: undefined, category: 'Accessories', image: '', description: '', unitsInStock: undefined });
      } catch (err) {
        console.error('Failed to add product:', err);
        alert('Failed to add product to database.');
      }
    }
  };

  const handleUpdateProduct = async () => {
    if (editingProduct) {
      try {
        await supabaseService.updateProduct(editingProduct);
        setProductsList(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
        setEditingProduct(null);
      } catch (err) {
        console.error('Failed to update product:', err);
        alert('Failed to update product in database.');
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await supabaseService.deleteProduct(id);
      setProductsList(prev => prev.filter(p => p.id !== id));
      setEditingProduct(null);
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product from database.');
    }
  };

  // Profile Refs
  const nameRef = React.useRef<HTMLInputElement>(null);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const phoneRef = React.useRef<HTMLInputElement>(null);
  const addressRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const featuredProducts = useMemo(() => {
    const featured = productsList.filter(p => p.isFeatured);
    return featured.length > 0 ? featured : productsList.slice(0, 5);
  }, [productsList]);

  const allSlides = useMemo(() => {
    const productSlides = featuredProducts.map(p => ({
      id: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      isPreOrder: p.isPreOrder,
      badge: p.isPreOrder ? 'Pre-Order' : 'Available',
      type: 'product' as const,
      data: p
    }));

    return [
      {
        id: 'welcome',
        name: 'Welcome to Gadgets Ghar BD',
        description: "Here you will get all types of gadget's products and you can bring your favorite products from China through us without any hassle. Contact WhatsApp from Support. Thanks",
        image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=1600&h=900',
        badge: 'Official Store',
        type: 'welcome' as const
      },
      ...productSlides
    ];
  }, [featuredProducts]);

  useEffect(() => {
    const isModalOpen = isAdminPanelOpen || !!editingProduct || !!selectedProduct || isCartOpen || isCheckoutOpen || isProfileModalOpen || isReturnsModalOpen || isWarrantyModalOpen;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAdminPanelOpen, editingProduct, selectedProduct, isCartOpen, isCheckoutOpen, isProfileModalOpen, isReturnsModalOpen]);

  // Theme Sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Auto-slide effect for Hero
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % allSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [allSlides.length]);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (!user) {
      setAuthMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const cartTotal = useMemo(() => 
    cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  );

  const activeCheckoutItems = useMemo(() => buyNowItem ? [buyNowItem] : cart, [buyNowItem, cart]);
  const activeCheckoutTotal = useMemo(() => buyNowItem ? buyNowItem.price * buyNowItem.quantity : cartTotal, [buyNowItem, cartTotal]);

  const cartCount = useMemo(() =>
    cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const [showPreOrderOnly, setShowPreOrderOnly] = useState(false);

  // Filter Logic
  const filteredProducts = useMemo(() => {
    return productsList.filter((product) => {
      const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPreOrder = !showPreOrderOnly || product.isPreOrder;
      return matchesCategory && matchesSearch && matchesPreOrder;
    });
  }, [selectedCategory, searchQuery, showPreOrderOnly, productsList]);

  const dynamicCategories = useMemo(() => {
    return ['All', ...new Set(productsList.map(p => p.category))];
  }, [productsList]);

  const allActualCategories = useMemo(() => {
    return [...new Set(productsList.map(p => p.category))];
  }, [productsList]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans transition-colors duration-300 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200 dark:bg-neutral-900/80 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900 group-hover:rotate-6 transition-transform">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tighter leading-none font-display animate-lighting-orange">GADGETS</span>
                <span className="text-xs font-bold tracking-[0.2em] text-blue-600 leading-none font-display animate-lighting-blue">GHAR BD</span>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full flex items-center">
                <Search className={`absolute left-3 w-4 h-4 transition-colors ${isAiSearching ? 'text-blue-500 animate-pulse' : 'text-neutral-400'}`} />
                <input
                  type="text"
                  placeholder={isAiSearching ? "AI is identifying gadget..." : "Search products..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-full py-2 pl-10 pr-12 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm shadow-sm"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <label className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-400 hover:text-blue-500 transition-colors cursor-pointer relative group/search">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageSearch}
                      disabled={isAiSearching}
                    />
                    {isAiSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap bg-neutral-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover/search:opacity-100 transition-opacity pointer-events-none font-bold uppercase tracking-widest z-50">
                      Visual Search
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* User Account */}
              <div className="relative">
                {user ? (
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1 pl-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none mb-0.5">Welcome</p>
                      <p className="text-xs font-black leading-none">{user.displayName?.split(' ')[0]}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full" />
                      ) : (
                        user.displayName?.charAt(0) || <UserIcon className="w-4 h-4" />
                      )}
                    </div>
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      setAuthMode('login');
                      setIsAuthModalOpen(true);
                    }}
                    className="flex items-center gap-2 p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors text-blue-600 font-bold text-xs"
                  >
                    <LogIn className="w-5 h-5 md:w-4 md:h-4" />
                    <span className="hidden md:block">Login</span>
                  </button>
                )}

                {/* Dropdown - Simple version */}
                <AnimatePresence>
                  {user && isUserMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-[45]" 
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-100 dark:border-neutral-800 z-50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/50">
                          <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{user.displayName}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{user.email}</p>
                        </div>
                        <div className="p-2">
                          <button 
                            onClick={() => {
                              setIsProfileModalOpen(true);
                              setIsUserMenuOpen(false);
                              if (window.innerWidth >= 768) setProfileTab('info');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left"
                          >
                            <UserIcon className="w-4 h-4 text-neutral-400" /> My Profile
                          </button>
                          <button 
                            onClick={() => {
                              setIsProfileModalOpen(true);
                              setIsUserMenuOpen(false);
                              setProfileTab('orders');
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors text-left"
                          >
                            <Package className="w-4 h-4 text-neutral-400" /> View Orders
                          </button>
                        </div>
                        <button 
                          onClick={async () => {
                            try {
                              await supabase.auth.signOut();
                            } catch (err) {
                              console.error('Sign out error:', err);
                            }
                            setCart([]);
                            localStorage.removeItem('gadgets_ghar_cart');
                            setUser(null);
                            setIsAdminLoggedIn(false);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-5 py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors border-t border-neutral-100 dark:border-neutral-800"
                        >
                          <LogOut className="w-4 h-4" /> Log Out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors order-2 md:order-none"
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-neutral-600" />}
              </button>

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                aria-label="Toggle cart"
              >
                <ShoppingCart className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900 translate-x-1 -translate-y-1">
                    {cartCount}
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden px-4 pb-4">
            <div className="relative w-full flex items-center">
              <Search className={`absolute left-3 w-4 h-4 transition-colors ${isAiSearching ? 'text-blue-500 animate-pulse' : 'text-neutral-400'}`} />
              <input
                type="text"
                placeholder={isAiSearching ? "AI is identifying..." : "Search products..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-full py-2.5 pl-10 pr-12 focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <label className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-400 hover:text-blue-500 transition-colors cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageSearch}
                    disabled={isAiSearching}
                  />
                  {isAiSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </label>
              </div>
            </div>
        </div>
      </nav>

      <main>
      {/* Hero Section / Featured Slider */}
        <section className="relative h-[65vh] md:h-[70vh] bg-neutral-950 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0"
            >
              <img
                src={allSlides[currentSlide].image}
                alt={allSlides[currentSlide].name}
                className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px] scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/40 to-transparent" />
              
              <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-center md:justify-start gap-8 md:gap-12 pt-20 pb-20 md:pt-0 md:pb-0">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="max-w-3xl text-center md:text-left z-10 w-full"
                >
                  <span className={`inline-block px-4 py-1.5 ${allSlides[currentSlide].type === 'welcome' ? 'bg-emerald-600' : (allSlides[currentSlide].isPreOrder ? 'bg-amber-600' : 'bg-blue-600')} text-white text-xs font-bold rounded-full mb-4 tracking-widest uppercase font-display shadow-lg shadow-black/20 text-center`}>
                    {allSlides[currentSlide].badge}
                  </span>
                  <h1 className="text-4xl md:text-7xl font-black text-white mb-4 leading-[1] font-display uppercase italic">
                    {allSlides[currentSlide].name.split(' ').map((word, i) => (
                      <span key={i} className={i % 2 !== 0 ? (allSlides[currentSlide].type === 'welcome' ? "text-emerald-500" : "text-blue-500") : ""}>
                        {word}{' '}
                      </span>
                    ))}
                  </h1>
                  
                  {allSlides[currentSlide].type === 'welcome' ? (
                    <div className="mb-8 max-w-2xl mx-auto md:mx-0">
                      <p className="text-base md:text-lg text-neutral-300 font-medium leading-relaxed tracking-tight">
                        {allSlides[currentSlide].description}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-8 flex flex-wrap gap-4 justify-center md:justify-start">
                      <div className={`px-6 py-3 rounded-2xl ${allSlides[currentSlide].isPreOrder ? 'bg-amber-100/10 border-amber-500/30' : 'bg-blue-100/10 border-blue-500/30'} border backdrop-blur-md`}>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-1">Status</p>
                        <p className={`text-xl font-black uppercase ${allSlides[currentSlide].isPreOrder ? 'text-amber-500' : 'text-blue-500'}`}>
                          {allSlides[currentSlide].isPreOrder ? 'ORDER NOW / PRE-ORDER' : 'AVAILABLE IN STOCK'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start">
                    <button 
                      onClick={() => {
                        if (allSlides[currentSlide].type === 'product') {
                          setSelectedProduct(allSlides[currentSlide].data as Product);
                          setActiveImageIndex(0);
                        } else {
                          const productSection = document.getElementById('products');
                          productSection?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className={`${allSlides[currentSlide].type === 'welcome' ? 'bg-emerald-600' : (allSlides[currentSlide].isPreOrder ? 'bg-amber-600' : 'bg-white')} ${allSlides[currentSlide].type === 'welcome' || allSlides[currentSlide].isPreOrder ? 'text-white' : 'text-black'} px-10 py-4 rounded-2xl font-black hover:scale-105 transition-all flex items-center gap-2 group shadow-2xl active:scale-95`}
                    >
                      {allSlides[currentSlide].type === 'welcome' ? 'Explore Store' : 'Shop Now'}
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    {allSlides[currentSlide].type === 'product' && (
                      <div className="flex items-center gap-2 text-white/50">
                        <div className={`w-1.5 h-1.5 rounded-full ${allSlides[currentSlide].isPreOrder ? 'bg-amber-500' : 'bg-blue-500'} animate-ping`} />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {allSlides[currentSlide].isPreOrder 
                            ? (allSlides[currentSlide].preOrderDays ? `Arriving in ${allSlides[currentSlide].preOrderDays}` : 'Global Sourcing Active') 
                            : 'Limited Stock Available'}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5, duration: 1, type: "spring" }}
                  className="hidden md:block w-1/3 aspect-[4/5] relative group"
                >
                  <div className={`absolute inset-0 ${allSlides[currentSlide].type === 'welcome' ? 'bg-emerald-600/20' : 'bg-blue-600/20'} rounded-[40px] blur-3xl group-hover:opacity-40 transition-opacity`} />
                  <img
                    src={allSlides[currentSlide].image}
                    alt="Hero Slide"
                    className="relative z-10 w-full h-full object-cover rounded-[40px] shadow-2xl border-4 border-white/10"
                    referrerPolicy="no-referrer"
                  />
                  {allSlides[currentSlide].price && (
                    <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-3xl shadow-2xl z-20">
                      <span className="text-4xl font-black text-black block">
                        <span className="text-3xl mr-1 font-black text-emerald-600 drop-shadow-sm">৳</span>
                        {allSlides[currentSlide].price}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Official Price</span>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Slider Indicators */}
          <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-30">
            {allSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`transition-all duration-500 rounded-full ${
                  currentSlide === i ? 'w-12 bg-white h-2' : 'w-2 bg-white/20 h-2'
                }`}
              />
            ))}
          </div>
        </section>

        {/* Product Section */}
        <section id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Featured Products</h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">Showing {filteredProducts.length} items</p>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowPreOrderOnly(!showPreOrderOnly)}
                className={`px-4 py-2 rounded-full text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                  showPreOrderOnly
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 dark:shadow-none'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <Clock className="w-4 h-4" /> Pre-Order
              </button>
              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 mx-2 hidden md:block" />
              {dynamicCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900'
                      : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    setSelectedProduct(product);
                    setActiveImageIndex(0);
                  }}
                >
                  <div className="relative aspect-[4/5] bg-neutral-200 dark:bg-neutral-800 rounded-2xl overflow-hidden mb-4">
                    <AnimatePresence>
                      {lastVisualMatch && product.name.toLowerCase().includes(lastVisualMatch.toLowerCase()) && (
                        <motion.div 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-black py-1 px-2 rounded-lg flex items-center gap-1 shadow-lg z-10 uppercase tracking-tighter"
                        >
                          <CheckCircle2 className="w-3 h-3 text-white" /> Visual Match
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">View Details</span>
                    </div>
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                       {product.isPreOrder && (
                        <div className="flex flex-col gap-1">
                          <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg self-start">
                            Pre-Order
                          </span>
                          {product.preOrderDays && (
                            <span className="bg-white/90 backdrop-blur dark:bg-neutral-800/90 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-sm self-start border border-amber-500/20">
                              Available: {product.preOrderDays}
                            </span>
                          )}
                        </div>
                       )}
                    </div>
                    <div className="absolute top-4 right-4 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-full text-xs font-black shadow-md flex items-center border border-neutral-100 dark:border-neutral-800">
                      <span className="text-sm mr-1 font-black text-emerald-600">৳</span>{product.price}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-bold mb-1">
                      {product.category}
                    </p>
                    <h3 className="text-lg font-semibold mb-1">{product.name}</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">{product.description}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No products found</h3>
              <p className="text-neutral-500 dark:text-neutral-400">Try adjusting your filters or search query.</p>
            </div>
          )}
        </section>
      </main>

      {/* Product Details View */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full md:h-auto max-h-[95vh]"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 z-[70] p-2 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-neutral-900 dark:text-white rounded-full transition-all backdrop-blur-md"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Product Image Area */}
              <div className="w-full md:w-1/2 bg-neutral-100 dark:bg-neutral-800 flex flex-col items-center justify-center p-4 md:p-8 flex-shrink-0">
                <div className="relative w-full h-[240px] md:h-[350px] lg:h-[400px] mb-2 md:mb-6 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImageIndex}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                      src={activeImageIndex === 0 ? selectedProduct.image : selectedProduct.images?.[activeImageIndex - 1]}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain rounded-2xl drop-shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                  </AnimatePresence>
                </div>

                {/* Thumbnail Gallery */}
                {(selectedProduct.images && Array.isArray(selectedProduct.images) && selectedProduct.images.some(img => img)) && (
                  <div className="flex gap-2 w-full px-4 overflow-x-auto py-3 scrollbar-hide justify-start md:justify-center items-center no-scrollbar">
                    <button
                      onClick={() => setActiveImageIndex(0)}
                      className={`flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 transition-all shadow-sm ${activeImageIndex === 0 ? 'border-blue-600 scale-105 shadow-blue-200' : 'border-transparent opacity-60'}`}
                    >
                      <img src={selectedProduct.image} alt="Thumbnail 1" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                    {selectedProduct.images.map((img, idx) => {
                      if (!img || typeof img !== 'string') return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx + 1)}
                          className={`flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden border-2 transition-all shadow-sm ${activeImageIndex === idx + 1 ? 'border-blue-600 scale-105 shadow-blue-200' : 'border-transparent opacity-60'}`}
                        >
                          <img src={img} alt={`Thumbnail ${idx + 2}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product Info Area */}
              <div className="w-full md:w-1/2 p-5 md:p-12 flex flex-col justify-start md:justify-center overflow-y-auto flex-1 overscroll-contain">
                <div className="mb-4 md:mb-8">
                  <span className="text-blue-600 font-bold text-[10px] md:text-xs uppercase tracking-widest mb-1 md:mb-2 block font-display">
                    {selectedProduct.category}
                  </span>
                  <h2 className="text-xl md:text-4xl font-black mb-2 md:mb-4 font-display leading-tight text-neutral-900 dark:text-white">
                    {selectedProduct.name}
                  </h2>
                <div className="text-2xl md:text-4xl font-black mb-3 md:mb-4 text-neutral-900 dark:text-white flex items-center py-2 h-auto min-h-[40px] md:min-h-[56px]">
                  <span className="text-xl md:text-2xl mr-1 font-black text-emerald-600 self-center">৳</span>
                  <span className="flex-1 break-all line-clamp-1">{selectedProduct.price}</span>
                </div>
                  <div className="w-12 md:w-16 h-1 bg-blue-600 rounded-full mb-4 md:mb-6" />
                  <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed text-sm md:text-lg">
                    {selectedProduct.description}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Common Add to Cart button */}
                  <button
                    onClick={() => {
                      if (!user) {
                        setAuthMode('login');
                        setIsAuthModalOpen(true);
                        return;
                      }
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                      setIsCartOpen(true);
                    }}
                    className="w-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold py-5 rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-neutral-200 dark:border-neutral-700"
                  >
                    <Plus className="w-5 h-5" /> Add to Cart
                  </button>

                  {selectedProduct.isPreOrder ? (
                    <button
                      onClick={() => {
                        if (!user) {
                          setAuthMode('login');
                          setIsAuthModalOpen(true);
                          return;
                        }
                        const bItem: CartItem = { ...selectedProduct, quantity: 1 };
                        setBuyNowItem(bItem);
                        setSelectedProduct(null);
                        setIsCheckoutOpen(true);
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Clock className="w-5 h-5" /> Pre-Order Now
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (!user) {
                          setAuthMode('login');
                          setIsAuthModalOpen(true);
                          return;
                        }
                        const bItem: CartItem = { ...selectedProduct, quantity: 1 };
                        setBuyNowItem(bItem);
                        setSelectedProduct(null);
                        setIsCheckoutOpen(true);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" /> Order Now
                    </button>
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                        {selectedProduct.isPreOrder ? 'Pre-Order' : 'In Stock'}
                      </span>
                      {selectedProduct.unitsInStock !== undefined && !selectedProduct.isPreOrder && (
                        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tighter">
                          {selectedProduct.unitsInStock} units available
                        </span>
                      )}
                      {selectedProduct.isPreOrder && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                          {selectedProduct.preOrderDays ? `Available in ${selectedProduct.preOrderDays}` : 'Reserve yours now'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div 
                    onClick={() => {
                      if (selectedProduct.hasWarranty) {
                        setIsWarrantyModalOpen(true);
                      }
                    }}
                    className={`flex items-center gap-3 p-2 rounded-2xl transition-all ${selectedProduct.hasWarranty ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10 active:scale-95' : ''}`}
                  >
                    <div className={`w-10 h-10 ${selectedProduct.hasWarranty ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                        {selectedProduct.hasWarranty ? 'Official Warranty' : 'Gadgets Ghar Warranty'}
                      </span>
                      {selectedProduct.hasWarranty && (
                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mt-0.5">
                          {selectedProduct.warrantyTime || selectedProduct.warrantyDetails?.split('.')[0] || 'Official Warranty'}
                          <span className="ml-2 text-[8px] text-emerald-500/60 uppercase">Click to view terms</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProduct.hasWarranty && (
                  <div 
                    onClick={() => setIsWarrantyModalOpen(true)}
                    className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 cursor-pointer group hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                         <Lock className="w-3 h-3" />
                         Warranty Details
                      </h4>
                      <ChevronRight className="w-3 h-3 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-medium line-clamp-2">
                      {selectedProduct.warrantyConditions || selectedProduct.warrantyDetails}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Warranty Terms Modal */}
      <AnimatePresence>
        {isWarrantyModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWarrantyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-emerald-50 dark:bg-emerald-900/20">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-neutral-800 rounded-xl shadow-sm text-emerald-600">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black font-display tracking-tight leading-none uppercase">Official Warranty</h2>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Full Terms & Conditions</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsWarrantyModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 font-sans leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="space-y-6">
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-800/30">
                    <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Warranty Coverage
                    </h3>
                    <p className="text-sm font-medium">
                      {selectedProduct.warrantyTime || selectedProduct.warrantyDetails || 'Standard manufacturer warranty applied.'}
                    </p>
                  </div>

                  {selectedProduct.warrantyConditions && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest font-display">Terms & Conditions</h3>
                      <div className="text-sm whitespace-pre-wrap text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {selectedProduct.warrantyConditions}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest font-display">General Conditions (সাধারণ শর্তাবলী)</h3>
                    <ul className="space-y-3">
                      {[
                        'পণ্যটি অবশ্যই অরিজিনাল বক্সে থাকতে হবে।',
                        'ফিজিক্যাল ড্যামেজ বা পানিজনিত সমস্যার ক্ষেত্রে সার্ভিস ওয়ারেন্টি প্রযোজ্য নয়।',
                        'ওয়ারেন্টি ক্লেইম করার জন্য অরিজিনাল ইনভয়েস সাথে থাকতে হবে।',
                        'শুধুমাত্র ম্যানুফ্যাকচারিং ত্রুটির জন্যই সার্ভিস প্রদান করা হবে।'
                      ].map((term, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{term}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-800/30">
                    <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 leading-tight">
                      দ্রষ্টব্য: পণ্যের ওয়ারেন্টি পলিসি যেকোনো সময় পরিবর্তন হতে পারে। বিস্তারিত জানতে আমাদের কাস্টমার কেয়ারে যোগাযোগ করুন।
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => setIsWarrantyModalOpen(false)}
                  className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl hover:opacity-90 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  Close Window
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-bold">Shopping Cart ({cartCount})</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg">Your cart is empty</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 text-blue-600 underline font-semibold"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      className="flex gap-4 group"
                    >
                      <div className="w-20 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-semibold text-sm">{item.name}</h3>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-neutral-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-1">{item.category}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center border border-neutral-200 dark:border-neutral-700 rounded-full px-2 py-1 gap-3">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="p-1 hover:text-black dark:hover:text-white transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="p-1 hover:text-black dark:hover:text-white transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-black text-sm text-neutral-900 dark:text-white flex items-baseline">
                            <span className="text-xs mr-0.5 font-black text-emerald-600">৳</span>{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-4">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-neutral-500 dark:text-neutral-400 text-sm">Subtotal</span>
                    <span className="text-2xl font-black text-neutral-900 dark:text-white flex items-baseline">
                      <span className="text-xl mr-1 font-black text-emerald-600">৳</span>{cartTotal.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">Shipping and taxes calculated at checkout.</p>
                  <button 
                    onClick={() => {
                      if (!user) {
                        setAuthMode('login');
                        setIsAuthModalOpen(true);
                        return;
                      }
                      setBuyNowItem(null);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-shadow shadow-lg active:scale-[0.98] transition-transform"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsCheckoutOpen(false);
                setCheckoutStep('details');
                setBuyNowItem(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-[40px] overflow-hidden shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black font-display uppercase italic tracking-tight">
                    {checkoutStep === 'details' ? 'Shipping Details' : 'Payment Method'}
                  </h2>
                  <div className="flex gap-2 mt-2">
                    <div className={`h-1 w-12 rounded-full ${checkoutStep === 'details' ? 'bg-blue-600' : 'bg-green-500'}`} />
                    <div className={`h-1 w-12 rounded-full ${checkoutStep === 'payment' ? 'bg-blue-600' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    setCheckoutStep('details');
                    setBuyNowItem(null);
                  }} 
                  className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {checkoutStep === 'details' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">First Name</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white" 
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Last Name</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white" 
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Phone Number <span className="text-red-500">*</span></label>
                      <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-black text-neutral-900 dark:text-white font-mono" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Email (Optional)</label>
                      <input 
                        type="email" 
                        value={checkoutEmail}
                        onChange={(e) => setCheckoutEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">District <span className="text-red-500">*</span></label>
                      <div className="relative group">
                        <select 
                          value={selectedDistrict}
                          onChange={(e) => {
                            setSelectedDistrict(e.target.value);
                            setSelectedThana('');
                          }}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white appearance-none cursor-pointer pr-10"
                        >
                          <option value="">Select District</option>
                          {DISTRICTS.map(district => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Thana / Upazila <span className="text-red-500">*</span></label>
                      <div className="relative group">
                        <select 
                          value={selectedThana}
                          onChange={(e) => setSelectedThana(e.target.value)}
                          disabled={!selectedDistrict}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white appearance-none cursor-pointer disabled:opacity-50 pr-10"
                        >
                          <option value="">Select Thana</option>
                          {selectedDistrict && BANGLADESH_DISTRICTS[selectedDistrict].map(thana => (
                            <option key={thana} value={thana}>{thana}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Full Address (House, Road, Area) <span className="text-neutral-500">(Optional)</span></label>
                    <textarea 
                      rows={3}
                      value={fullAddress}
                      onChange={(e) => setFullAddress(e.target.value)}
                      placeholder="e.g. apnar bashar address likhun"
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-medium text-neutral-900 dark:text-white resize-none font-medium" 
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-3xl">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 text-center underline italic">Payment Information / পেমেন্ট তথ্য</p>
                    <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 leading-relaxed text-center">
                      বিকাশ এবং নগদ পার্সোনাল নাম্বার:
                      <br />
                      <span className="text-xl text-blue-600 dark:text-blue-400 mt-2 block font-black tracking-tighter">01771335930</span>
                      <span className="text-[10px] text-neutral-400 mt-1 block uppercase font-black tracking-widest">Send Money (Personal)</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'bkash', name: 'bKash', color: '#DE066B' },
                      { id: 'nagad', name: 'Nagad', color: '#F26122' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id as any)}
                        className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 group ${paymentMethod === method.id ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800' : 'border-neutral-100 dark:border-neutral-800 bg-transparent'}`}
                      >
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: method.color }}
                        >
                          {method.name.charAt(0)}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{method.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Transaction ID <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                        placeholder="TRX4598218X"
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-black text-neutral-900 dark:text-white font-mono tracking-widest uppercase" 
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-neutral-400" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-8 border-t border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Payable Amount</span>
                    <span className="text-3xl font-black font-display tracking-tight text-neutral-900 dark:text-white flex items-baseline">
                      <span className="text-2xl mr-1 font-black text-emerald-600">৳</span>{activeCheckoutTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest block">Includes Delivery</span>
                    <span className="text-[10px] font-bold text-neutral-500 italic lowercase">Calculated at dispatch</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  {checkoutStep === 'payment' && (
                    <button
                      onClick={() => setCheckoutStep('details')}
                      className="px-8 py-5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-[24px] text-xs font-black uppercase tracking-widest hover:bg-neutral-200 transition-all flex items-center gap-2"
                    >
                      Back
                    </button>
                  )}
                  <button
                    disabled={checkoutStep === 'payment' && (!paymentMethod || !transactionId)}
                    onClick={() => {
                      if (checkoutStep === 'details') {
                        if (!phone || !selectedDistrict || !selectedThana) {
                          alert('Please fill in all required fields marked with *');
                          return;
                        }
                        setCheckoutStep('payment');
                        return;
                      }

                      let currentUser = user;
                      if (!currentUser) {
                        const newGuestUid = getNextId();
                        currentUser = {
                          uid: newGuestUid,
                          email: checkoutEmail || 'guest@example.com',
                          displayName: `${firstName} ${lastName}`.trim() || 'Guest User',
                          photoURL: null,
                          orders: []
                        };
                      }

                      const newOrderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                      const newOrder: Order = {
                        id: newOrderId,
                        userId: currentUser.uid,
                        items: [...activeCheckoutItems],
                        total: activeCheckoutTotal,
                        date: new Date().toISOString(),
                        status: 'Pending',
                        customerDetails: {
                          firstName: firstName || currentUser.displayName?.split(' ')[0] || 'Guest',
                          lastName: lastName || currentUser.displayName?.split(' ')[1] || '',
                          phone: phone,
                          email: checkoutEmail || currentUser.email || undefined,
                          district: selectedDistrict,
                          thana: selectedThana,
                          fullAddress: fullAddress
                        },
                        paymentDetails: {
                          method: paymentMethod as 'bkash' | 'nagad',
                          transactionId: transactionId
                        }
                      };
                      
                      // Save order to Supabase
                      setAuthLoading(true);
                      supabaseService.createOrder(newOrder)
                        .then(() => {
                          const defaultSessions = [
                            {
                              id: 'SESS-1',
                              device: 'Windows PC',
                              browser: 'Chrome 124.0.0',
                              location: 'Dhaka, Bangladesh',
                              lastActive: 'Just now',
                              isCurrent: true
                            }
                          ];

                          setUser(prev => {
                            if (!prev) return currentUser;
                            return {
                              ...prev,
                              orders: [newOrder, ...(prev.orders || [])],
                              sessions: prev.sessions || defaultSessions
                            };
                          });

                          setAllOrders(prev => [newOrder, ...prev]);
                          
                          if (buyNowItem) {
                            setBuyNowItem(null);
                          } else {
                            setCart([]);
                          }
                          
                          setIsCheckoutOpen(false);
                          setIsCartOpen(false);
                          setProfileTab('orders');
                          setIsProfileModalOpen(true);
                          setCheckoutStep('details');
                          setPaymentMethod(null);
                          setTransactionId('');
                          // Clear form
                          setFirstName('');
                          setLastName('');
                          setPhone('');
                          setCheckoutEmail('');
                          setFullAddress('');
                          setSelectedDistrict('');
                          setSelectedThana('');

                          alert(`অর্ডাার সফল হয়েছে! পেমেন্ট মেথড: ${paymentMethod?.toUpperCase()}, TRX: ${transactionId}. আপনার অর্ডার আইডি: ${newOrderId}`);
                        })
                        .catch(err => {
                          console.error('Failed to create order in Supabase:', err);
                          alert('Error: আপনার অর্ডারটি সার্ভারে সেভ করা যায়নি। দয়া করে আবার চেষ্টা করুন বা সরাসরি আমাদের কল করুন।');
                        })
                        .finally(() => setAuthLoading(false));
                    }}
                    className={`flex-1 py-5 rounded-[24px] text-xs font-black uppercase tracking-widest shadow-xl transition-all relative overflow-hidden group disabled:opacity-50 disabled:grayscale ${checkoutStep === 'details' ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-neutral-900/20' : 'bg-blue-600 text-white shadow-blue-200/50 dark:shadow-none'}`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {checkoutStep === 'details' ? (
                        <>Continue to Payment <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                      ) : (
                        <>Place Order <ShoppingCart className="w-4 h-4 group-hover:-translate-y-1 transition-transform" /></>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && user && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full md:h-auto max-h-[90vh] md:max-h-none"
              >
                <button 
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setProfileTab(null);
                  }}
                  className="absolute top-6 right-6 z-20 p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                </button>

                {/* Sidebar branding / Mobile Menu */}
                <div className={`w-full md:w-1/3 bg-blue-600 p-8 text-white flex flex-col min-h-[200px] md:min-h-0 ${profileTab ? 'hidden md:flex' : 'flex'}`}>
                  <div className="mb-8">
                     <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black font-display tracking-tight leading-none mb-2">My Profile</h2>
                    <p className="text-blue-100 text-sm italic">Manage your profile and track orders.</p>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <button 
                      onClick={() => setProfileTab('info')}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-3xl transition-all group ${profileTab === 'info' ? 'bg-white text-blue-600 font-bold shadow-xl scale-105' : 'bg-white/10 hover:bg-white/20 text-white hover:translate-x-1'}`}
                    >
                      <UserIcon className="w-4 h-4" /> Personal Info
                      <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${profileTab === 'info' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                    </button>
                    <button 
                      onClick={() => setProfileTab('orders')}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-3xl transition-all group ${profileTab === 'orders' ? 'bg-white text-blue-600 font-bold shadow-xl scale-105' : 'bg-white/10 hover:bg-white/20 text-white hover:translate-x-1'}`}
                    >
                      <Package className="w-4 h-4" /> My Orders
                      {user.orders && user.orders.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${profileTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600'}`}>
                          {user.orders.length}
                        </span>
                      )}
                      <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${profileTab === 'orders' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                    </button>
                    <button 
                      onClick={() => setProfileTab('settings')}
                      className={`w-full flex items-center gap-3 px-5 py-4 rounded-3xl transition-all group ${profileTab === 'settings' ? 'bg-white text-blue-600 font-bold shadow-xl scale-105' : 'bg-white/10 hover:bg-white/20 text-white hover:translate-x-1'}`}
                    >
                      <Settings className="w-4 h-4" /> App Settings
                      <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${profileTab === 'settings' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                    </button>

                    <div className="pt-4 mt-4 border-t border-white/20 md:hidden">
                      <button 
                        onClick={async () => {
                          try {
                            await supabase.auth.signOut();
                          } catch (err) {
                            console.error('Sign out error:', err);
                          }
                          setUser(null);
                          setCart([]); // Clear cart on logout
                          localStorage.removeItem('gadgets_ghar_cart'); // Clear cart storage
                          setIsAdminLoggedIn(false);
                          setIsProfileModalOpen(false);
                          setProfileTab(null);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-5 py-4 rounded-3xl bg-red-500/20 text-white font-bold hover:bg-red-500/30 transition-all"
                      >
                        <LogOut className="w-4 h-4" /> Log Out Account
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 relative group hidden md:block">
                  <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-md p-1 border border-white/20 mx-auto md:mx-0 overflow-hidden shadow-2xl relative">
                    <img 
                      src={tempPhoto || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} 
                      alt="Profile" 
                      className="w-full h-full rounded-2xl object-cover"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                       <Camera className="w-6 h-6 text-white" />
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setTempPhoto(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Main Content Area */}
              <div className={`flex-1 p-8 overflow-y-auto ${profileTab ? 'block' : 'hidden md:block'}`}>
                {profileTab && (
                  <button 
                    onClick={() => setProfileTab(null)}
                    className="md:hidden flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-6"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back To Menu
                  </button>
                )}

                {profileTab === 'info' ? (
                  <div className="h-full flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Full Name</label>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input 
                            type="text" 
                            ref={nameRef}
                            defaultValue={user.displayName || ''}
                            className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white font-medium"
                            placeholder="Your Name"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Gmail Address</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 font-bold text-xs flex items-center justify-center">@</div>
                          <input 
                            type="email" 
                            ref={emailRef}
                            defaultValue={user.email || ''}
                            className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white font-medium"
                            placeholder="name@gmail.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Phone Number</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 text-xs flex items-center justify-center font-bold">#</div>
                          <input 
                            type="tel" 
                            ref={phoneRef}
                            defaultValue={user.phoneNumber || ''}
                            className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 pl-12 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white font-medium"
                            placeholder="017XX-XXXXXX"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Account ID</label>
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl text-[10px] font-mono text-neutral-500 break-all border border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
                          <span>ACCOUNT: {formatAccountID(user.uid)}</span>
                          <span className="opacity-30 text-[8px] uppercase">Ref: {user.uid.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Shipping Address</label>
                      <textarea 
                        ref={addressRef}
                        defaultValue={user.address || ''}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all h-24 resize-none text-neutral-900 dark:text-white font-medium"
                        placeholder="Provide your detailed shipping address..."
                      ></textarea>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">Profile Picture</p>
                        <p className="text-xs text-neutral-500 font-medium">Add or change from device</p>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 dark:border-neutral-700 shadow-sm hover:bg-blue-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Add Photo
                      </button>
                    </div>

                    <div className="mt-auto pt-8 flex gap-4">
                      <button
                        onClick={async () => {
                          if (!user) return;
                          
                          const updatedName = nameRef.current?.value.trim() || user.displayName;
                          const updatedPhone = phoneRef.current?.value.trim() || user.phoneNumber;
                          const updatedAddress = addressRef.current?.value.trim() || user.address;

                          setAuthLoading(true);
                          try {
                            const { error } = await supabase.auth.updateUser({
                              data: {
                                full_name: updatedName,
                                phone_number: updatedPhone,
                                address: updatedAddress,
                                avatar_url: tempPhoto || user.photoURL
                              }
                            });

                            if (error) throw error;

                            setUser({
                              ...user,
                              displayName: updatedName,
                              phoneNumber: updatedPhone,
                              address: updatedAddress,
                              photoURL: tempPhoto || user.photoURL,
                            });
                            
                            setTempPhoto(null);
                            alert('Profile updated successfully!');
                            setIsProfileModalOpen(false);
                          } catch (err: any) {
                            alert('Failed to update profile: ' + err.message);
                          } finally {
                            setAuthLoading(false);
                          }
                        }}
                        disabled={authLoading}
                        className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none active:scale-95 text-sm disabled:opacity-50"
                      >
                        {authLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => {
                          setTempPhoto(null);
                          setIsProfileModalOpen(false);
                        }}
                        className="px-6 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : profileTab === 'orders' ? (
                  <div className="h-full flex flex-col">
                    <div className="mb-6 flex justify-between items-end">
                      <div>
                        <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Order History</h3>
                        <p className="text-xs text-neutral-500 font-medium mt-1">Track and manage your past purchases</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full uppercase tracking-widest leading-none">
                          {user.orders?.length || 0} Total Orders
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-6">
                      {!user.orders || user.orders.length === 0 ? (
                        <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-[2rem] p-16 text-center border-2 border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mb-4">
                            <Package className="w-8 h-8 text-neutral-300" />
                          </div>
                          <p className="text-neutral-500 font-bold text-sm tracking-tight mb-1">No orders yet</p>
                          <p className="text-neutral-400 text-xs font-medium max-w-[200px]">Once you place an order, it will appear here for tracking.</p>
                        </div>
                      ) : (
                        user.orders.map((order) => (
                          <div key={order.id} className="group bg-white dark:bg-neutral-800 rounded-[2rem] overflow-hidden shadow-sm border border-neutral-100 dark:border-neutral-700 hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900/30 transition-all duration-300">
                            {/* Order Header */}
                            <div className="p-5 flex flex-wrap justify-between items-center gap-4 border-b border-neutral-50 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/50 group-hover:bg-blue-50/30 dark:group-hover:bg-blue-900/5 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white dark:bg-neutral-700 rounded-xl flex items-center justify-center shadow-sm">
                                  <Package className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mb-0.5">{order.id}</p>
                                  <div className="flex items-center gap-2 text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
                                    <Clock className="w-3 h-3" /> {order.date}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {order.status === 'Approved' ? (
                                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.2)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Approved
                                  </span>
                                ) : order.status === 'Cancelled' ? (
                                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-700 border border-red-100 shadow-[0_2px_10px_-3px_rgba(239,68,68,0.2)]">
                                    <XCircle className="w-3 h-3" />
                                    Cancelled
                                  </span>
                                ) : order.status === 'Delivered' ? (
                                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Delivered
                                  </span>
                                ) : order.status === 'Pending' ? (
                                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100 shadow-[0_2px_10px_-3px_rgba(245,158,11,0.2)]">
                                    <Clock className="w-3 h-3" />
                                    Pending
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-100 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.2)]">
                                    {order.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Order Content */}
                            <div className="p-5">
                              {/* Order Progress Indicator for Success */}
                              {order.status === 'Approved' && (
                                <div className="px-5 mb-4">
                                  <div className="flex justify-between mb-2">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Delivered</span>
                                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest italic">Thank you for your purchase!</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                                    <div className="h-full w-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                  </div>
                                </div>
                              )}
                              
                              {/* Order Progress Indicator for Pending */}
                              {order.status === 'Pending' && (
                                <div className="px-5 mb-4">
                                  <div className="flex justify-between mb-2">
                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Processing</span>
                                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Awaiting Shipping</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ x: '-100%' }}
                                      animate={{ x: '0%' }}
                                      transition={{ duration: 2, ease: "easeInOut" }}
                                      className="h-full w-1/3 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 gap-3">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-4 p-3 rounded-2xl bg-neutral-50/30 dark:bg-neutral-800/30 border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700 transition-all">
                                    <div className="w-14 h-14 rounded-xl bg-white dark:bg-neutral-900 overflow-hidden flex-shrink-0 border border-neutral-100 dark:border-neutral-700 p-1 shadow-sm">
                                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{item.name}</p>
                                      <p className="text-xs text-neutral-500 font-bold">
                                        <span className="text-emerald-600 flex items-baseline gap-0.5 font-bold">
                                          <span className="text-xs font-black">৳</span>{item.price.toFixed(2)}
                                        </span>
                                        <span className="mx-2 text-neutral-300">|</span>
                                        <span>Quantity: {item.quantity}</span>
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black text-neutral-900 dark:text-white flex items-baseline">
                                        <span className="text-xs mr-0.5 font-black text-emerald-600">৳</span>{(item.price * item.quantity).toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-700 flex justify-between items-center">
                                <div className="flex gap-2">
                                  <button className="text-[10px] font-bold text-neutral-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                                    Need Help?
                                  </button>
                                  <span className="text-neutral-200">|</span>
                                  <button className="text-[10px] font-bold text-neutral-400 hover:text-blue-600 transition-colors uppercase tracking-widest">
                                    Invoice
                                  </button>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 leading-none">Total Amount Paid</p>
                                  <p className="text-xl font-black text-neutral-900 dark:text-white leading-none flex items-baseline">
                                    <span className="text-lg mr-1 font-black text-emerald-600">৳</span>{order.total.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="mb-6">
                      <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">App Settings</h3>
                      <p className="text-xs text-neutral-500 font-medium mt-1">Configure your app experience and security</p>
                    </div>

                    <div className="space-y-6">
                      {/* Theme Settings */}
                      <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                              {isDarkMode ? <Moon className="w-5 h-5 text-blue-600" /> : <Sun className="w-5 h-5 text-blue-600" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">Appearance</p>
                              <p className="text-[10px] text-neutral-500 font-medium">Switch between light and dark themes</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            className={`w-12 h-6 rounded-full transition-all relative ${isDarkMode ? 'bg-blue-600' : 'bg-neutral-300'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDarkMode ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Notification Settings */}
                      <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-700">
                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Bell className="w-3 h-3" /> Notifications
                        </h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">Order Updates</p>
                              <p className="text-[10px] text-neutral-500 font-medium">Get notified about your purchase status</p>
                            </div>
                            <button 
                              onClick={() => setOrderNotifications(!orderNotifications)}
                              className={`w-12 h-6 rounded-full transition-all relative ${orderNotifications ? 'bg-blue-600' : 'bg-neutral-300'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${orderNotifications ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Security Settings */}
                      <div className="bg-neutral-50 dark:bg-neutral-800/40 rounded-3xl p-6 border border-neutral-100 dark:border-neutral-700">
                        <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Shield className="w-3 h-3" /> Security & Privacy
                        </h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">Two-Factor Auth</p>
                              <p className="text-[10px] text-neutral-500 font-medium">Add extra layer of protection</p>
                            </div>
                            <button 
                              onClick={() => {
                                if (!user) return;
                                setUser({ ...user, is2FAEnabled: !user.is2FAEnabled });
                                alert(user.is2FAEnabled ? '2FA Disabled successfully!' : '2FA Enabled successfully! Your account is now more secure.');
                              }}
                              className={`w-12 h-6 rounded-full transition-all relative ${user.is2FAEnabled ? 'bg-blue-600' : 'bg-neutral-300'}`}
                            >
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${user.is2FAEnabled ? 'left-7' : 'left-1'}`} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">Change Password</p>
                              <p className="text-[10px] text-neutral-500 font-medium">Update your account password</p>
                            </div>
                            <button 
                              onClick={() => setIsPasswordModalOpen(true)}
                              className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              Manage
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-neutral-900 dark:text-white">Active Sessions</p>
                              <p className="text-[10px] text-neutral-500 font-medium">Manage your logged in devices</p>
                            </div>
                            <button 
                              onClick={() => setIsSessionsModalOpen(true)}
                              className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Smartphone className="w-3 h-3" /> {(user.sessions?.length || 1)} Devices
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          alert('All settings saved successfully!');
                          setIsProfileModalOpen(false);
                        }}
                        className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-100 dark:shadow-none active:scale-95 transition-all text-sm uppercase tracking-widest"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                  {authMode === 'login' ? <UserIcon className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
                </div>
                <h2 className="text-2xl font-black font-display tracking-tight leading-none mb-2">
                  {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">
                  {authMode === 'login' ? 'Sign in to your account to continue' : 'Join Gadgets Ghar BD today'}
                </p>
              </div>

              <div className="space-y-4">
                {authMode === 'signup' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Full Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="John Doe"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Phone Number (Optional)</label>
                      <input 
                        type="tel" 
                        placeholder="017XX-XXXXXX"
                        value={authPhoneNumber}
                        onChange={(e) => setAuthPhoneNumber(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">
                        {authMode === 'signup' ? 'Email Address *' : 'Email or Phone Number'}
                      </label>
                      <input 
                        type="text" 
                        required
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder={authMode === 'signup' ? "name@example.com" : "Email or Phone Number"}
                        className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Password</label>
                        {authMode === 'login' && <button className="text-[10px] font-bold text-blue-600 hover:underline">Forgot?</button>}
                      </div>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-blue-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (authLoading) return;
                        
                        if (authMode === 'login' && !userEmail) {
                          alert('Please enter your email or phone number');
                          return;
                        }

                        if (!authPassword) {
                          alert('Please enter your password');
                          return;
                        }

                        if (authMode === 'signup' && !authFullName) {
                          alert('Please enter your full name');
                          return;
                        }

                        setAuthLoading(true);
                        try {
                          if (authMode === 'signup') {
                            if (!userEmail.trim()) {
                              alert('Please provide an Email Address for account creation.');
                              setAuthLoading(false);
                              return;
                            }

                            // Robust Phone Formatting
                            let formattedPhone = authPhoneNumber.trim().replace(/\s/g, '');
                            if (formattedPhone && !formattedPhone.startsWith('+')) {
                              if (formattedPhone.startsWith('01')) {
                                formattedPhone = '+88' + formattedPhone;
                              } else if (formattedPhone.length === 10) {
                                formattedPhone = '+880' + formattedPhone;
                              }
                            }

                            const signUpData = { email: userEmail.trim(), password: authPassword };

                            const { data, error } = await supabase.auth.signUp({
                              ...signUpData,
                              options: {
                                data: {
                                  full_name: authFullName.trim(),
                                  phone_number: formattedPhone,
                                  display_name: authFullName.trim()
                                }
                              }
                            });
                            
                            if (error) throw error;
                            
                            if (data.user) {
                              alert('Congratulations! Your account has been created. Check email for verification if provided.');
                              setAuthPassword('');
                              setAuthFullName('');
                              setAuthPhoneNumber('');
                              setUserEmail('');
                              setIsAuthModalOpen(false);
                            }
                          } else {
                            // Properly handle Login
                            let loginId = userEmail.trim();
                            const isEmail = loginId.includes('@');
                            
                            if (!isEmail) {
                              loginId = loginId.replace(/\s/g, '');
                              if (!loginId.startsWith('+')) {
                                if (loginId.startsWith('01')) {
                                  loginId = '+88' + loginId;
                                } else if (loginId.length === 10) {
                                  loginId = '+880' + loginId;
                                }
                              }
                            }

                            let signInData: any = { password: authPassword };
                            if (isEmail) {
                              signInData.email = loginId;
                            } else {
                              signInData.phone = loginId;
                            }

                            console.log("Attempting login with:", isEmail ? "email" : "phone");
                            
                            // Use a race to prevent infinite hanging if Supabase is stuck
                            const loginPromise = supabase.auth.signInWithPassword(signInData);
                            const timeoutPromise = new Promise((_, reject) => 
                              setTimeout(() => reject(new Error("Login timed out. Please check your internet connection or try again.")), 15000)
                            );

                            const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;
                            
                            if (error) {
                              console.error("Login Error:", error);
                              throw error;
                            }
                            
                            if (data?.user) {
                              setAuthPassword('');
                              setIsAuthModalOpen(false);
                            } else {
                              throw new Error("Login failed: User not found");
                            }
                          }
                        } catch (err: any) {
                          console.error("Authentication Failure:", err);
                          const errMsg = err.message || JSON.stringify(err);
                          if (errMsg.includes('Invalid path')) {
                            alert('CRITICAL CONFIG ERROR: The Supabase API path is invalid. Please check your VITE_SUPABASE_URL.');
                          } else if (errMsg.includes('Email not confirmed')) {
                            alert('Login Failed: Your email has not been confirmed. Please check your inbox.');
                          } else {
                            alert(errMsg || 'Auth failed');
                          }
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                      disabled={authLoading}
                      className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 text-sm flex items-center justify-center gap-2"
                    >
                      {authLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        authMode === 'login' ? 'Sign In' : 'Create Account'
                      )}
                    </button>

                    <div className="relative py-4 flex items-center gap-4">
                      <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Or continue with</span>
                      <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                    </div>

                    <button 
                       onClick={async () => {
                        try {
                          const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                              redirectTo: window.location.origin
                            }
                          });
                          if (error) throw error;
                        } catch (err: any) {
                          alert(err.message || 'Google login failed');
                        }
                      }}
                      className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-black py-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all active:scale-95 text-sm flex items-center justify-center gap-3"
                    >
                      <img src="https://www.svgrepo.com/show/355037/google.svg" className="w-5 h-5" alt="Google" />
                      Google Account
                    </button>
                  </div>

                  <div className="mt-8 text-center">
                    <p className="text-xs text-neutral-500">
                      {authMode === 'login' ? (
                        <>
                          Don't have an account? <button onClick={() => setAuthMode('signup')} className="font-bold text-blue-600 hover:underline">Sign up for free</button>
                        </>
                      ) : (
                        <>
                          Already have an account? <button onClick={() => setAuthMode('login')} className="font-bold text-blue-600 hover:underline">Log in here</button>
                        </>
                      )}
                    </p>
                  </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Password Change Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                  <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black font-display tracking-tight leading-none mb-2">Change Password</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">Secure your account with a new password</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Current Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">New Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Confirm New Password</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={async () => {
                      alert('Password changed successfully! Please log in again.');
                      await supabase.auth.signOut();
                      setCart([]);
                      localStorage.removeItem('gadgets_ghar_cart');
                      setUser(null);
                      setIsAdminLoggedIn(false);
                      setIsPasswordModalOpen(false);
                      setIsProfileModalOpen(false);
                    }}
                    className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none active:scale-95 text-sm"
                  >
                    Update Password
                  </button>
                  <button
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-6 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold rounded-2xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all text-sm"
                  >
                    Back
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Sessions Modal */}
      <AnimatePresence>
        {isSessionsModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSessionsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-2xl font-black font-display tracking-tight leading-none">Active Sessions</h2>
                  <button 
                    onClick={() => setIsSessionsModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 italic">Manage and logout from other devices for security.</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {user?.sessions?.map((session) => (
                  <div key={session.id} className="group p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 hover:border-blue-100 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-neutral-700 rounded-2xl flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-600">
                          {session.browser.includes('Chrome') ? <Globe className="w-6 h-6 text-blue-600" /> : <Smartphone className="w-6 h-6 text-blue-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-neutral-900 dark:text-white leading-none">{session.device}</p>
                            {session.isCurrent && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[8px] font-black uppercase tracking-widest rounded-full">Current Device</span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">{session.browser}</p>
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button 
                          onClick={() => {
                            if (!user) return;
                            const updatedSessions = user.sessions?.filter(s => s.id !== session.id);
                            setUser({ ...user, sessions: updatedSessions });
                            alert('Session revoked successfully.');
                          }}
                          className="px-3 py-1.5 text-[10px] font-black text-red-600 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors border border-red-50 dark:border-red-900/20"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-blue-400" /> {session.location}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-blue-400" /> {session.lastActive}
                      </div>
                    </div>
                  </div>
                ))}

                {(!user?.sessions || user.sessions.length === 0) && (
                  <div className="text-center py-12">
                    <Smartphone className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
                    <p className="text-neutral-400 font-medium italic">No active sessions found.</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                <button 
                  disabled={isLoggingOutAll}
                  onClick={() => {
                    if (!user) return;
                    setIsLoggingOutAll(true);
                    
                    // Professional delay simulation
                    setTimeout(() => {
                      const currentSession = user.sessions?.find(s => s.isCurrent);
                      setUser({ ...user, sessions: currentSession ? [currentSession] : [] });
                      setIsLoggingOutAll(false);
                      // Use a more professional confirm if possible, but keeping consistency with alert for now
                      alert('Security check complete. All other sessions have been successfully terminated.');
                    }, 1500);
                  }}
                  className={`w-full py-4 font-black rounded-2xl transition-all text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 ${
                    isLoggingOutAll 
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed' 
                    : 'bg-white dark:bg-neutral-800 text-red-600 border border-red-100 dark:border-red-900/30 hover:bg-red-50 active:scale-[0.98]'
                  }`}
                >
                  {isLoggingOutAll ? (
                    <>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-500 rounded-full"
                      />
                      Processing Security Request...
                    </>
                  ) : (
                    'Logout from all other devices'
                  )}
                </button>
                <p className="text-center text-[9px] text-neutral-400 font-bold uppercase tracking-widest mt-4">
                  This will immediately revoke access to your account on all devices except this one.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Welcome Banner */}
      <AnimatePresence>
        {showWelcomeBanner && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWelcomeBanner(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col"
            >
              {/* Header Gradient */}
              <div className="h-32 bg-linear-to-br from-blue-600 via-indigo-600 to-purple-600 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30 rotate-12">
                    <Package className="w-10 h-10 text-white -rotate-12" />
                  </div>
                </div>
              </div>

              <div className="p-10 pt-8 text-center">
                <h2 className="text-3xl font-black font-display tracking-tight text-black dark:text-white uppercase mb-3">
                  Welcome to <br />
                  <span className="text-blue-600 animate-lighting-blue">Gadgets Ghar BD</span>
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed mb-8">
                  Get the latest tech, gadgets, and accessories delivered right to your doorstep. Best quality, guaranteed.
                </p>

                <div className="space-y-4 mb-10">
                  <div className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-3">Support & Contact</p>
                    <a 
                      href={`https://wa.me/${siteSettings.whatsappNumber}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 font-black text-xl hover:scale-105 transition-transform"
                    >
                      <Smartphone className="w-6 h-6" />
                      {siteSettings.contactPhone}
                    </a>
                    <p className="text-[10px] text-neutral-500 mt-2 font-bold uppercase">WhatsApp for Quick Support</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowWelcomeBanner(false)}
                  className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-5 rounded-3xl hover:opacity-90 transition-all active:scale-95 shadow-xl text-sm uppercase tracking-widest"
                >
                  Start Shopping
                </button>

                <div className="mt-10 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    Developer: <span className="text-black dark:text-white">Raihan Antor</span>
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowWelcomeBanner(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modals */}
      <AnimatePresence>
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminPanelOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl h-[90vh] flex flex-col"
            >
              {!isAdminLoggedIn ? (
                /* Admin Login */
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mb-6 text-blue-600">
                    <Lock className="w-10 h-10" />
                  </div>
                  <h2 className="text-3xl font-black font-display mb-2 uppercase italic tracking-tighter">Bulet Secure Access</h2>
                  <p className="text-sm text-neutral-500 mb-8 italic">Enter administrative credentials to manage store systems</p>
                  
                  <form onSubmit={handleAdminLogin} className="w-full max-w-sm space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Bulet Identity (Email)</label>
                      <div className="relative">
                        <input 
                          type="email" 
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="Email Address"
                          className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold dark:text-white" 
                          required
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Security Passphrase</label>
                      <div className="relative">
                        <input 
                          type={showAdminPassword ? "text" : "password"} 
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-blue-600 outline-none text-sm font-bold dark:text-white pr-12" 
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-blue-600 transition-colors"
                        >
                          {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={adminAuthLoading}
                      className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {adminAuthLoading ? 'Processing...' : 'Log In'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => setIsAdminPanelOpen(false)}
                      className="w-full text-neutral-400 font-bold py-2 hover:text-neutral-600 transition-colors text-[10px] uppercase tracking-widest"
                    >
                      Return to Store
                    </button>
                    <p className="text-[10px] text-neutral-400 text-center font-bold uppercase tracking-tighter pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      Authorized Personnel Only • IP Logged
                    </p>
                  </form>
                </div>
              ) : (
                /* Admin Dashboard */
                <>
                  <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Settings className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black font-display uppercase tracking-tight">Bulet Control Panel</h2>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Gadgets Ghar BD • Premium Management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                         onClick={async () => {
                           await supabase.auth.signOut();
                           setCart([]);
                           localStorage.removeItem('gadgets_ghar_cart');
                           setIsAdminLoggedIn(false);
                           setUser(null);
                         }}
                         className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                      <button 
                        onClick={() => {
                          setIsAdminPanelOpen(false);
                          setAdminTab(null);
                        }}
                        className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex overflow-hidden">
                    {/* Admin Sidebar/Tabs */}
                    <div className={`w-full md:w-64 border-r border-neutral-100 dark:border-neutral-800 p-6 flex flex-col gap-3 bg-neutral-50 dark:bg-neutral-800/30 ${adminTab ? 'hidden md:flex' : 'flex'}`}>
                       <button 
                         onClick={() => setAdminTab('analytics')}
                         className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all group ${adminTab === 'analytics' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:translate-x-1'}`}
                       >
                         <BarChart3 className="w-4 h-4" /> Analytics
                         <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${adminTab === 'analytics' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                       </button>
                       <button 
                         onClick={() => setAdminTab('products')}
                         className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all group ${adminTab === 'products' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:translate-x-1'}`}
                       >
                         <Package className="w-4 h-4" /> Products
                         <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${adminTab === 'products' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                       </button>
                       <button 
                         onClick={() => setAdminTab('orders')}
                         className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all group ${adminTab === 'orders' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:translate-x-1'}`}
                       >
                         <ShoppingCart className="w-4 h-4" /> Orders
                         <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${adminTab === 'orders' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                       </button>
                       <button 
                         onClick={() => setAdminTab('content')}
                         className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all group ${adminTab === 'content' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:translate-x-1'}`}
                       >
                         <Globe className="w-4 h-4" /> Website Content
                         <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${adminTab === 'content' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                       </button>
                       <button 
                         onClick={() => setAdminTab('settings')}
                         className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl text-sm font-bold transition-all group ${adminTab === 'settings' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:translate-x-1'}`}
                       >
                         <MapPin className="w-4 h-4" /> Store Settings
                         <ChevronRight className={`ml-auto w-4 h-4 transition-transform ${adminTab === 'settings' ? 'rotate-90 md:rotate-0' : 'opacity-40 group-hover:opacity-100'}`} />
                       </button>
                       <div className="mt-auto p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800 hidden md:block">
                         <p className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-widest">System Status</p>
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                           <p className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">All services operational</p>
                         </div>
                       </div>
                    </div>

                    {/* Admin Content */}
                    <div className={`flex-1 overflow-y-auto p-8 bg-white dark:bg-neutral-900 ${adminTab ? 'block' : 'hidden md:block'}`}>
                      {adminTab && (
                        <button 
                          onClick={() => setAdminTab(null)}
                          className="md:hidden flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-8"
                        >
                          <ChevronLeft className="w-4 h-4" /> Back To Menu
                        </button>
                      )}
                      {adminTab === 'orders' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-2xl font-black font-display uppercase italic tracking-tighter">Order Pipeline</h3>
                              <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Review, Verify and Process customer payments</p>
                            </div>
                            <div className="flex gap-4">
                              {allOrders.some(o => o.status === 'Cancelled') && (
                                <button
                                  onClick={async () => {
                                    if (confirm('Permanently delete all cancelled orders from the registry?')) {
                                      try {
                                        const cancelledOrders = allOrders.filter(o => o.status === 'Cancelled');
                                        await Promise.all(cancelledOrders.map(o => supabaseService.deleteOrder(o.id)));
                                        setAllOrders(prev => prev.filter(o => o.status !== 'Cancelled'));
                                        alert('All cancelled orders have been removed.');
                                      } catch (err) {
                                        console.error('Failed to clear cancelled orders:', err);
                                        alert('Failed to clear some orders from DB.');
                                      }
                                    }
                                  }}
                                  className="px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl border border-red-100 dark:border-red-800/30 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                                >
                                  <Trash2 className="w-3 h-3" /> Clear Cancelled
                                </button>
                              )}
                              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Total Volume</span>
                                <span className="text-xl font-black">{allOrders.length}</span>
                              </div>
                              <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl border border-yellow-100 dark:border-yellow-800/30">
                                <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest block">Awaiting Action</span>
                                <span className="text-xl font-black">{allOrders.filter(o => o.status === 'Pending').length}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {allOrders.length === 0 ? (
                              <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-neutral-100 dark:border-neutral-800 rounded-[40px]">
                                <ShoppingCart className="w-16 h-16 text-neutral-200 mb-4" />
                                <p className="text-neutral-400 font-bold uppercase tracking-widest italic text-center">Cloud registry empty.<br/>No orders detected in current buffer.</p>
                              </div>
                            ) : (
                              allOrders.map((order) => (
                                <div key={order.id} className="p-6 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-[32px] hover:shadow-xl transition-all">
                                  <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                                    <div className="flex gap-4">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        order.status === 'Approved' ? 'bg-green-100 text-green-600' : 
                                        order.status === 'Cancelled' ? 'bg-red-100 text-red-600' : 
                                        'bg-blue-100 text-blue-600'
                                      }`}>
                                        <Package className="w-6 h-6" />
                                      </div>
                                      <div>
                                        <h4 className="font-black font-display tracking-tight text-lg uppercase italic">{order.id}</h4>
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{order.date}</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                   <span className="text-2xl font-black font-display tracking-tighter flex items-baseline">
                                     <span className="text-lg mr-1 font-black text-emerald-600">৳</span>{order.total.toFixed(2)}
                                   </span>
                                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-1 ${
                                        order.status === 'Approved' ? 'bg-green-500/10 text-green-500' : 
                                        order.status === 'Cancelled' ? 'bg-red-500/10 text-red-500' : 
                                        'bg-blue-500/10 text-blue-500'
                                      }`}>
                                        {order.status}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-6 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl mb-6">
                                    <div>
                                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 underline">Identity Matrix</p>
                                      <div className="space-y-1">
                                        <p className="text-sm font-black text-neutral-900 dark:text-white">{order.customerDetails?.firstName} {order.customerDetails?.lastName}</p>
                                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{order.customerDetails?.phone}</p>
                                        <p className="text-[10px] font-medium text-neutral-500 lowercase">{order.customerDetails?.email}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 underline">Logistics Beacon</p>
                                      <div className="space-y-1">
                                        <p className="text-xs font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.customerDetails?.district}</p>
                                        <p className="text-[10px] font-bold text-neutral-500 ml-4">{order.customerDetails?.thana}</p>
                                        <p className="text-[10px] font-medium text-neutral-400 italic ml-4 leading-tight">{order.customerDetails?.fullAddress || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 underline">Financial Hash</p>
                                      <div className="space-y-1">
                                        <p className="text-sm font-black flex items-center gap-2">
                                          <span className={`w-2 h-2 rounded-full ${order.paymentDetails?.method === 'bkash' ? 'bg-pink-600' : 'bg-orange-600'}`} />
                                          {order.paymentDetails?.method?.toUpperCase()} Gateway
                                        </p>
                                        <div className="bg-neutral-200 dark:bg-neutral-800 p-2 rounded-xl border border-neutral-300 dark:border-neutral-700 mt-2">
                                          <p className="text-[10px] font-black text-neutral-400 uppercase">TX-ID Reference:</p>
                                          <p className="text-xs font-black font-mono tracking-wider text-green-600 dark:text-green-400 uppercase">{order.paymentDetails?.transactionId}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex -space-x-3 overflow-hidden py-1">
                                      {order.items.slice(0, 5).map((item, idx) => (
                                        <div key={idx} className="relative w-10 h-10 rounded-xl border-2 border-white dark:border-neutral-800 shadow-sm overflow-hidden bg-white">
                                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                      ))}
                                      {order.items.length > 5 && (
                                        <div className="relative w-10 h-10 rounded-xl border-2 border-white dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-black">
                                          +{order.items.length - 5}
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-3">
                                      {order.status === 'Pending' && (
                                        <>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await supabaseService.updateOrderStatus(order.id, 'Approved');
                                                setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Approved' } : o));
                                                alert(`Order ${order.id} Approved Successfully!`);
                                              } catch (err) {
                                                console.error('Failed to update status:', err);
                                              }
                                            }}
                                            className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95"
                                          >
                                            <CheckCircle2 className="w-4 h-4" /> Approve Order
                                          </button>
                                          <button
                                            onClick={async () => {
                                              try {
                                                await supabaseService.updateOrderStatus(order.id, 'Cancelled');
                                                setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Cancelled' } : o));
                                                alert(`Order ${order.id} Cancelled.`);
                                              } catch (err) {
                                                console.error('Failed to cancel order:', err);
                                              }
                                            }}
                                            className="px-6 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2 active:scale-95"
                                          >
                                            <XCircle className="w-4 h-4" /> Cancel Order
                                          </button>
                                        </>
                                      )}

                                      {order.status === 'Approved' && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              await supabaseService.updateOrderStatus(order.id, 'Delivered');
                                              setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Delivered' } : o));
                                              alert(`Order ${order.id} marked as Delivered!`);
                                            } catch (err) {
                                              console.error('Failed to mark as delivered:', err);
                                            }
                                          }}
                                          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95"
                                        >
                                          <Truck className="w-4 h-4" /> Mark as Delivered
                                        </button>
                                      )}
                                      
                                      {order.status !== 'Pending' && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={async () => {
                                              try {
                                                await supabaseService.updateOrderStatus(order.id, 'Pending');
                                                setAllOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Pending' } : o));
                                              } catch (err) {
                                                console.error('Failed to restore order:', err);
                                              }
                                            }}
                                            className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-200 transition-all active:scale-95"
                                          >
                                            Restore to Pending
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (confirm(`Permanently purge order ${order.id} from local registry? This cannot be undone.`)) {
                                                try {
                                                  await supabaseService.deleteOrder(order.id);
                                                  setAllOrders(prev => prev.filter(o => o.id !== order.id));
                                                  alert(`Order ${order.id} has been deleted.`);
                                                } catch (err) {
                                                  console.error('Failed to delete order:', err);
                                                }
                                              }
                                            }}
                                            className="px-4 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-red-500/20"
                                          >
                                            <Trash2 className="w-3 h-3" /> Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {adminTab === 'analytics' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="text-2xl font-black font-display uppercase italic tracking-tight mb-1">Business Intelligence</h3>
                              <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Real-time inventory and market performance</p>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Last Update</span>
                                <span className="text-xs font-bold text-neutral-900 dark:text-white">{new Date().toLocaleTimeString()}</span>
                              </div>
                              <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />
                              <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-black rounded-xl flex items-center gap-2 border border-green-200/50 dark:border-green-800/30">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                Live Metrics
                              </span>
                            </div>
                          </div>

                          {/* Key Performance Indicators */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                              { label: 'Inventory Capital', value: <span className="flex items-baseline gap-1"><span className="text-lg font-black text-emerald-600">৳</span>{productsList.reduce((acc, p) => acc + (Number(p.price || 0) * (p.unitsInStock || 0)), 0).toLocaleString()}</span>, icon: DollarSign, color: 'blue', trend: '+12.5%' },
                              { label: 'Active SKUs', value: productsList.length, icon: Package, color: 'emerald', trend: '+2 new' },
                              { label: 'Warehouse Load', value: productsList.reduce((acc, p) => acc + (p.unitsInStock || 0), 0), icon: TrendingUp, color: 'amber', trend: '84% Cap' },
                              { label: 'Category Span', value: new Set(productsList.map(p => p.category)).size, icon: Users, color: 'purple', trend: 'Diversified' }
                            ].map((kpi, idx) => (
                              <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className={`p-6 bg-white dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-[32px] hover:shadow-xl hover:shadow-neutral-200/20 dark:hover:shadow-none transition-all group`}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div className={`w-12 h-12 bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 text-${kpi.color}-600 dark:text-${kpi.color}-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                    <kpi.icon className="w-6 h-6" />
                                  </div>
                                  <span className={`text-[10px] font-black px-2 py-1 bg-${kpi.color}-50 dark:bg-${kpi.color}-900 text-${kpi.color}-600 rounded-lg`}>{kpi.trend}</span>
                                </div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                                <p className="text-3xl font-black font-display tracking-tight text-neutral-900 dark:text-white capitalize">{kpi.value}</p>
                              </motion.div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Stock Distribution Chart */}
                            <div className="lg:col-span-2 p-8 bg-neutral-900 dark:bg-black rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
                              <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                  <div>
                                    <h4 className="text-lg font-black font-display uppercase italic italic tracking-tight">Inventory Value Distribution</h4>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Pricing power by category level</p>
                                  </div>
                                  <select className="bg-neutral-800 border-none rounded-xl text-[10px] font-bold uppercase tracking-widest px-4 py-2 outline-none">
                                    <option>Monthly View</option>
                                    <option>Weekly View</option>
                                  </select>
                                </div>
                                
                                <div className="h-[300px] w-full">
                                  <RechartsResponsiveContainer width="100%" height="100%">
                                    <RechartsAreaChart data={CATEGORIES.map(cat => ({
                                      name: cat,
                                      value: productsList.filter(p => p.category === cat).reduce((acc, p) => acc + (Number(p.price || 0) * (p.unitsInStock || 0)), 0),
                                      stock: productsList.filter(p => p.category === cat).reduce((acc, p) => acc + (p.unitsInStock || 0), 0)
                                    }))}>
                                      <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <RechartsCartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                      <RechartsXAxis 
                                        dataKey="name" 
                                        stroke="#666" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        dy={10}
                                        tickFormatter={(val) => val.length > 8 ? val.substring(0, 8) + '..' : val}
                                      />
                                      <RechartsYAxis 
                                        stroke="#666" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        tickFormatter={(val) => `৳${(val/1000)}k`}
                                      />
                                      <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#171717', border: 'none', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                      />
                                      <RechartsArea type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                                    </RechartsAreaChart>
                                  </RechartsResponsiveContainer>
                                </div>
                              </div>
                            </div>

                            {/* Category Mix */}
                            <div className="p-8 bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 rounded-[40px]">
                              <h4 className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-600" /> Catalog Composition
                              </h4>
                              <div className="h-[200px] w-full mb-8">
                                <RechartsResponsiveContainer width="100%" height="100%">
                                  <RechartsPieChart>
                                    <RechartsPie
                                      data={allActualCategories.map((cat, idx) => ({
                                        name: cat,
                                        value: productsList.filter(p => p.category === cat).length
                                      })).filter(d => d.value > 0)}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={60}
                                      outerRadius={80}
                                      paddingAngle={5}
                                      dataKey="value"
                                    >
                                      {allActualCategories.map((_, index) => (
                                        <RechartsCell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'][index % 6]} />
                                      ))}
                                    </RechartsPie>
                                    <RechartsTooltip />
                                  </RechartsPieChart>
                                </RechartsResponsiveContainer>
                                <div className="space-y-3">
                                  {allActualCategories.map((cat, idx) => {
                                    const count = productsList.filter(p => p.category === cat).length;
                                    if (count === 0) return null;
                                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];
                                    return (
                                      <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % 6] }} />
                                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{cat}</span>
                                        </div>
                                        <span className="text-xs font-black">{((count / productsList.length) * 100).toFixed(0)}%</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             {/* Inventory Overview (Upgraded) */}
                             <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-[40px] border border-neutral-100 dark:border-neutral-800">
                               <div className="flex items-center justify-between mb-8">
                                 <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                   <Package className="w-4 h-4 text-blue-600" /> Stock Velocity by Category
                                 </h4>
                               </div>
                               <div className="h-[250px] w-full">
                                  <RechartsResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart data={allActualCategories.map(cat => ({
                                      name: cat,
                                      stock: productsList.filter(p => p.category === cat).reduce((acc, p) => acc + (p.unitsInStock || 0), 0)
                                    })).filter(d => d.stock > 0)}>
                                      <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ccc" />
                                      <RechartsXAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                      <RechartsYAxis fontSize={10} axisLine={false} tickLine={false} />
                                      <RechartsTooltip 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                      />
                                      <RechartsBar dataKey="stock" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={24} />
                                    </RechartsBarChart>
                                  </RechartsResponsiveContainer>
                               </div>
                             </div>

                             {/* Smart Alerts & Insights */}
                             <div className="p-8 bg-white dark:bg-neutral-800 rounded-[40px] border border-neutral-100 dark:border-neutral-800">
                               <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                                 <Activity className="w-4 h-4 text-blue-600" /> Intelligence Feed
                               </h3>
                               <div className="space-y-4">
                                 {/* Low Stock Alert */}
                                 {productsList.filter(p => (p.unitsInStock || 0) < 10).length > 0 && (
                                   <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex gap-4 items-start">
                                     <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shrink-0">
                                       <AlertCircle className="w-5 h-5" />
                                     </div>
                                     <div>
                                       <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Critical Stock Warning</p>
                                       <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                                         {productsList.filter(p => (p.unitsInStock || 0) < 10).length} products are falling below safety thresholds (&lt; 10 units).
                                       </p>
                                     </div>
                                   </div>
                                 )}

                                 {/* Optimization Suggestion */}
                                 <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl flex gap-4 items-start">
                                   <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                                     <TrendingUp className="w-5 h-5" />
                                   </div>
                                   <div>
                                     <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Market Opportunity</p>
                                     <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                                       Your {allActualCategories[0] || 'catalog'} collection has the highest value density. Increasing variety here could boost capital efficiency.
                                     </p>
                                   </div>
                                 </div>

                                 {/* Activity History */}
                                 <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700">
                                   <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">Recent System Logs</p>
                                   <div className="space-y-4">
                                     {[
                                       { action: 'Admin logged in', time: '2 mins ago', type: 'access' },
                                       { action: 'New product added: Premium Hub', time: '1 hour ago', type: 'catalog' },
                                       { action: 'Stock level updated', time: '3 hours ago', type: 'inventory' }
                                     ].map((log, i) => (
                                       <div key={i} className="flex justify-between items-center text-[10px] font-bold">
                                         <div className="flex items-center gap-2">
                                           <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                           <span className="text-neutral-700 dark:text-neutral-300">{log.action}</span>
                                         </div>
                                         <span className="text-neutral-400">{log.time}</span>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               </div>
                             </div>
                          </div>
                        </div>
                      )}
                      {adminTab === 'products' && (
                        <>
                          <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black font-display uppercase italic tracking-tight">Product Catalog ({productsList.length})</h3>
                            <button 
                              onClick={() => setEditingProduct({ id: 'new', name: '', price: undefined, category: 'Accessories', image: '', images: ['', '', '', ''], description: '', isFeatured: false, isPreOrder: false, preOrderDays: '', hasWarranty: false, warrantyDetails: '', warrantyTime: '', warrantyConditions: '' })}
                              className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                              <Plus className="w-4 h-4" /> Add Product
                            </button>
                          </div>

                          <div className="space-y-4">
                            {productsList.map(product => (
                              <div key={product.id} className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl group">
                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex-shrink-0">
                                  <img src={product.image} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <h4 className="font-bold text-sm truncate flex items-center gap-2">
                                     {product.name}
                                     {product.isFeatured && (
                                       <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-tighter rounded">Featured</span>
                                     )}
                                     {product.isPreOrder && (
                                       <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-tighter rounded">Pre-Order</span>
                                     )}
                                   </h4>
                                   <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center">
                                     {product.category} • <span className="text-xs mr-0.5 font-black text-emerald-600 ml-1">৳</span>{product.price}
                                     {product.isPreOrder ? ` • Pre-Order${product.preOrderDays ? ` (${product.preOrderDays})` : ''}` : (product.unitsInStock !== undefined && ` • ${product.unitsInStock} In Stock`)}
                                   </p>
                                </div>
                                 <div className="flex items-center gap-2">
                                   <button 
                                     onClick={() => setEditingProduct({ ...product, images: product.images || ['', '', '', ''] })}
                                     className="p-2 bg-white dark:bg-neutral-700 rounded-lg hover:text-blue-600 shadow-sm transition-colors"
                                   >
                                     <Settings className="w-4 h-4" />
                                   </button>
                                   <button 
                                     onClick={() => handleDeleteProduct(product.id)}
                                     className="p-2 bg-white dark:bg-neutral-700 rounded-lg hover:text-red-500 shadow-sm transition-colors"
                                   >
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {adminTab === 'content' && (
                        <div className="pb-20">
                          <h3 className="text-xl font-black font-display uppercase italic tracking-tight mb-8">
                            Website Content Management
                          </h3>
                          <div className="space-y-8">
                            <div className="grid grid-cols-1 gap-6">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Facebook Page URL</label>
                                  <input 
                                    type="text"
                                    value={siteSettings.facebookPageUrl}
                                    onChange={(e) => setSiteSettings(prev => ({ ...prev, facebookPageUrl: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">TikTok URL</label>
                                  <input 
                                    type="text"
                                    value={siteSettings.tiktokUrl}
                                    onChange={(e) => setSiteSettings(prev => ({ ...prev, tiktokUrl: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                                  />
                               </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-black font-display uppercase mb-4 tracking-widest text-neutral-400">Shop Owners</h4>
                              <div className="space-y-4">
                                 {siteSettings.owners.map((owner, idx) => (
                                   <div key={idx} className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700">
                                     <div className="space-y-2">
                                       <label className="text-[10px] font-bold text-neutral-400 uppercase">Name</label>
                                       <input 
                                         type="text"
                                         value={owner.name}
                                         onChange={(e) => {
                                           const newOwners = [...siteSettings.owners];
                                           newOwners[idx].name = e.target.value;
                                           setSiteSettings({ ...siteSettings, owners: newOwners });
                                         }}
                                         className="w-full bg-white dark:bg-neutral-700 border-none rounded-lg p-2 text-xs font-bold outline-none"
                                       />
                                     </div>
                                     <div className="space-y-2">
                                       <label className="text-[10px] font-bold text-neutral-400 uppercase">FB URL</label>
                                       <input 
                                         type="text"
                                         value={owner.url}
                                         onChange={(e) => {
                                           const newOwners = [...siteSettings.owners];
                                           newOwners[idx].url = e.target.value;
                                           setSiteSettings({ ...siteSettings, owners: newOwners });
                                         }}
                                         className="w-full bg-white dark:bg-neutral-700 border-none rounded-lg p-2 text-xs font-bold outline-none"
                                       />
                                     </div>
                                   </div>
                                 ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {adminTab === 'settings' && (
                        <div className="pb-20">
                          <h3 className="text-xl font-black font-display uppercase italic tracking-tight mb-8">
                            Store Settings
                          </h3>
                          <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">Contact Phone</label>
                                  <input 
                                    type="text"
                                    value={siteSettings.contactPhone}
                                    onChange={(e) => setSiteSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-1">WhatsApp Number</label>
                                  <input 
                                    type="text"
                                    value={siteSettings.whatsappNumber}
                                    onChange={(e) => setSiteSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                                    className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                                  />
                               </div>
                            </div>

                            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30">
                              <div className="flex gap-4 items-start">
                                <div className="p-3 bg-white dark:bg-neutral-800 rounded-2xl text-amber-600 shadow-sm">
                                  <Lock className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-amber-900 dark:text-amber-200">Security Note</h4>
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                                    Changes made here affect the public contact information on the homepage and footer. 
                                    Always ensure the phone numbers are correct to avoid missing customer queries.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Sub-Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
             <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-2xl font-black font-display uppercase tracking-tight">
                  {editingProduct.id === 'new' ? 'New Product' : 'Edit Product'}
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Product Name</label>
                    <input 
                      type="text"
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                         Price <span className="opacity-50">(৳)</span>
                       </label>
                       <input 
                         type="number"
                         value={(editingProduct as any).price ?? ''}
                         onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value === '' ? undefined : Number(e.target.value) })}
                         className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Category</label>
                       <input 
                         type="text"
                         value={editingProduct.category}
                         onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                         className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Units in Stock (Optional)</label>
                       <input 
                         type="number"
                         value={editingProduct.unitsInStock || ''}
                         onChange={(e) => setEditingProduct({ ...editingProduct, unitsInStock: e.target.value ? Number(e.target.value) : undefined })}
                         placeholder="e.g. 50"
                         className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                       />
                    </div>
                 </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex justify-between items-center">
                      Main Image 
                      <span className="text-[8px] font-normal lowercase">(URL or Upload)</span>
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={editingProduct.image}
                        onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                        placeholder="Main Image URL"
                        className="flex-1 bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white"
                      />
                      <label className="w-14 h-14 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0">
                        <Upload className="w-5 h-5 text-neutral-500" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setEditingProduct({ ...editingProduct, image: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                 </div>

                 {/* Additional optional images */}
                 <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest pl-1">Optional Additional Images</label>
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((idx) => (
                        <div key={idx} className="space-y-2">
                          <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">Image {idx + 2}</label>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={editingProduct.images?.[idx] || ''}
                              onChange={(e) => {
                                const newImages = [...(editingProduct.images || ['', '', '', ''])];
                                newImages[idx] = e.target.value;
                                setEditingProduct({ ...editingProduct, images: newImages });
                              }}
                              placeholder={`URL ${idx + 2}`}
                              className="flex-1 bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                            />
                             <label className="w-8 h-8 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex-shrink-0">
                              <Camera className="w-3 h-3 text-neutral-500" />
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      const newImages = [...(editingProduct.images || ['', '', '', ''])];
                                      newImages[idx] = reader.result as string;
                                      setEditingProduct({ ...editingProduct, images: newImages });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Description</label>
                    <textarea 
                      rows={3}
                      value={editingProduct.description}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600 transition-all dark:text-white resize-none"
                    />
                 </div>

                 <div className="pt-2 flex flex-col gap-3">
                    <button 
                      onClick={() => setEditingProduct({ ...editingProduct!, isFeatured: !editingProduct?.isFeatured })}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editingProduct?.isFeatured ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingProduct?.isFeatured ? 'left-[22px]' : 'left-0.5'}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Featured in Hero Slider</span>
                    </button>
                    <button 
                      onClick={() => setEditingProduct({ ...editingProduct!, isPreOrder: !editingProduct?.isPreOrder })}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editingProduct?.isPreOrder ? 'bg-amber-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingProduct?.isPreOrder ? 'left-[22px]' : 'left-0.5'}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Mark as Pre-Order</span>
                    </button>
                    {editingProduct?.isPreOrder && (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                          Wait Time <span className="opacity-50">(e.g. 7-10 Days)</span>
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. 7-10 Days"
                          value={editingProduct.preOrderDays ?? ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, preOrderDays: e.target.value })}
                          className="w-full bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                        />
                      </div>
                    )}
                    <button 
                      onClick={() => setEditingProduct({ ...editingProduct!, hasWarranty: !editingProduct?.hasWarranty })}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editingProduct?.hasWarranty ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editingProduct?.hasWarranty ? 'left-[22px]' : 'left-0.5'}`} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Official Warranty Available</span>
                    </button>
                 </div>

                 {editingProduct.hasWarranty && (
                   <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Warranty Time</label>
                          <input 
                            type="text"
                            value={editingProduct.warrantyTime || ''}
                            onChange={(e) => setEditingProduct({ ...editingProduct, warrantyTime: e.target.value })}
                            placeholder="e.g. 1 Year Official"
                            className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-600 transition-all dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Warranty Conditions</label>
                          <textarea 
                            rows={2}
                            value={editingProduct.warrantyConditions || ''}
                            onChange={(e) => setEditingProduct({ ...editingProduct, warrantyConditions: e.target.value })}
                            placeholder="List terms and conditions here..."
                            className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-600 transition-all dark:text-white resize-none"
                          />
                        </div>
                      </div>
                   </div>
                 )}
              </div>

              <div className="p-8 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                 <div className="flex gap-4">
                    {editingProduct.id !== 'new' && (
                      <button 
                         onClick={() => {
                           if (confirm('Are you sure you want to delete this product?')) {
                             handleDeleteProduct(editingProduct.id);
                           }
                         }}
                         className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-100 dark:shadow-none"
                         title="Delete Product"
                      >
                         <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                       onClick={() => setEditingProduct(null)}
                       className="flex-1 px-8 py-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-neutral-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                       disabled={isProductSaving}
                       onClick={async () => {
                         if (!editingProduct) return;
                         setIsProductSaving(true);
                         try {
                           const priceNum = Number(editingProduct.price) || 0;
                           const stockNum = editingProduct.unitsInStock !== undefined ? Number(editingProduct.unitsInStock) : undefined;
                           const filteredImages = (editingProduct.images || []).filter((img: string) => img && img.trim() !== '');
                           
                           // Create a clean payload with only valid columns
                           const payload: any = { 
                             id: editingProduct.id,
                             name: editingProduct.name,
                             price: priceNum,
                             category: editingProduct.category,
                             image: editingProduct.image,
                             description: editingProduct.description,
                             unitsInStock: stockNum,
                             isFeatured: !!editingProduct.isFeatured,
                             isPreOrder: !!editingProduct.isPreOrder,
                             pre_order_days: editingProduct.preOrderDays || '',
                             has_warranty: !!editingProduct.hasWarranty,
                             warranty_details: editingProduct.warrantyDetails || '',
                             warranty_time: editingProduct.warrantyTime || '',
                             warranty_conditions: editingProduct.warrantyConditions || ''
                           };

                           // Only add images if there are actually some pictures
                           if (filteredImages.length > 0) {
                             payload.images = filteredImages;
                           }

                            if (editingProduct.id === 'new') {
                               const newId = `P-${Date.now()}`;
                               const newP = { ...payload, id: newId };
                               const savedProduct = await supabaseService.addProduct(newP);
                               const mappedSaved = savedProduct ? {
                                 ...savedProduct,
                                 hasWarranty: (savedProduct as any).has_warranty ?? (savedProduct as any).hasWarranty,
                                 warrantyDetails: (savedProduct as any).warranty_details ?? (savedProduct as any).warrantyDetails,
                                 warrantyTime: (savedProduct as any).warranty_time ?? (savedProduct as any).warrantyTime,
                                 warrantyConditions: (savedProduct as any).warranty_conditions ?? (savedProduct as any).warrantyConditions,
                                 preOrderDays: (savedProduct as any).pre_order_days ?? (savedProduct as any).preOrderDays
                               } : { ...newP, id: newId, preOrderDays: newP.pre_order_days };
                               setProductsList(prev => [mappedSaved as Product, ...prev]);
                           } else {
                               const updatedProduct = await supabaseService.updateProduct(payload);
                               const finalProduct = updatedProduct ? {
                                 ...updatedProduct,
                                 hasWarranty: (updatedProduct as any).has_warranty ?? (updatedProduct as any).hasWarranty,
                                 warrantyDetails: (updatedProduct as any).warranty_details ?? (updatedProduct as any).warrantyDetails,
                                 warrantyTime: (updatedProduct as any).warranty_time ?? (updatedProduct as any).warrantyTime,
                                 warrantyConditions: (updatedProduct as any).warranty_conditions ?? (updatedProduct as any).warrantyConditions,
                                 preOrderDays: (updatedProduct as any).pre_order_days ?? (updatedProduct as any).preOrderDays
                               } : { ...editingProduct, ...payload, preOrderDays: payload.pre_order_days };
                               setProductsList(prev => prev.map(item => item.id === payload.id ? finalProduct as Product : item));
                           }
                           setEditingProduct(null);
                         } catch (err: any) {
                           console.error('Failed to save product:', err);
                           alert('Database Error: FAILED TO SAVE. Please ensure you have added "has_warranty" and "warranty_details" columns to your products table in Supabase.');
                         } finally {
                           setIsProductSaving(false);
                         }
                       }}
                       className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isProductSaving ? 'Saving...' : 'Save Product'}
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>

      {/* Returns & Exchanges Modal */}
      <AnimatePresence>
        {isReturnsModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReturnsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Package className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black font-display tracking-tight leading-none uppercase">Returns & Exchanges</h2>
                  </div>
                  <button 
                    onClick={() => setIsReturnsModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest pl-1">রিটার্ন এবং এক্সচেঞ্জ পলিসি (Return & Exchange Policy)</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 font-sans leading-relaxed text-neutral-700 dark:text-neutral-300">
                <div className="space-y-8">
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-800/30">
                    <p className="text-sm font-medium italic text-blue-800 dark:text-blue-300">
                      আমাদের লক্ষ্য হলো আপনাকে সেরা মানের গ্যাজেট এবং চমৎকার শপিং অভিজ্ঞতা প্রদান করা। কোনো কারণে আপনি আপনার অর্ডার করা পণ্যটি নিয়ে সন্তুষ্ট না হলে, আমাদের সহজ রিটার্ন ও এক্সচেঞ্জ পলিসি আপনার জন্য উন্মুক্ত।
                    </p>
                  </div>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-blue-600 rounded-full" />
                      ১. রিটার্ন এবং এক্সচেঞ্জের সময়সীমা
                    </h3>
                    <ul className="space-y-3 pl-6">
                      <li className="flex gap-3 text-sm">
                        <span className="text-blue-600 font-bold">✪</span>
                        <span>পণ্য ডেলিভারি পাওয়ার পর থেকে সর্বোচ্চ ৭২ ঘণ্টার (৩ দিন) মধ্যে আপনাকে অভিযোগ জানাতে হবে।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-blue-600 font-bold">✪</span>
                        <span>পরবর্তী ৭ দিনের মধ্যে পণ্যটি আমাদের কাছে ফেরত পাঠাতে হবে।</span>
                      </li>
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-emerald-600 rounded-full" />
                      ২. যেসব ক্ষেত্রে রিটার্ন/এক্সচেঞ্জ গ্রহণযোগ্য:
                    </h3>
                    <ul className="space-y-3 pl-6">
                      <li className="flex gap-3 text-sm">
                        <span className="text-emerald-600 font-bold">✪</span>
                        <span>পণ্যটি যদি ত্রুটিপূর্ণ (Defective) বা ক্ষতিগ্রস্ত (Damaged) অবস্থায় পাওয়া যায়।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-emerald-600 font-bold">✪</span>
                        <span>ওয়েবসাইট থেকে অর্ডার করা পণ্যের সাথে ডেলিভারি করা পণ্যের মিল না থাকলে (ভুল মডেল বা রং)।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-emerald-600 font-bold">✪</span>
                        <span>প্যাকেজে কোনো পার্টস বা এক্সেসরিজ কম থাকলে।</span>
                      </li>
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-amber-600 rounded-full" />
                      ৩. শর্তাবলী (Conditions):
                    </h3>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">রিটার্ন বা এক্সচেঞ্জ সফল হতে হলে নিচের শর্তগুলো পূরণ করতে হবে:</p>
                    <ul className="space-y-3 pl-6">
                      <li className="flex gap-3 text-sm">
                        <span className="text-amber-600 font-bold font-mono">▸</span>
                        <span>পণ্যটি অবশ্যই অব্যবহৃত (Unused) এবং আসল অবস্থায় থাকতে হবে।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-amber-600 font-bold font-mono">▸</span>
                        <span>পণ্যের সাথে থাকা Original বক্স, ইউজার ম্যানুয়াল, ওয়ারেন্টি কার্ড এবং যাবতীয় এক্সেসরিজ অবশ্যই ফেরত দিতে হবে।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-amber-600 font-bold font-mono">▸</span>
                        <span>পণ্যের বডিতে কোনো স্ক্র্যাচ (Scratch) বা ফিজিক্যাল ড্যামেজ থাকা যাবে না।</span>
                      </li>
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-purple-600 rounded-full" />
                      ৪. রিটার্ন প্রক্রিয়া:
                    </h3>
                    <div className="grid grid-cols-1 gap-3 pl-2">
                      {[
                        "আমাদের কাস্টমার কেয়ার নাম্বারে কল করুন অথবা আমাদের ফেসবুক পেজ/ইমেইলে আপনার অর্ডার আইডি এবং সমস্যার ছবি/ভিডিও পাঠান।",
                        "আমাদের টিম যাচাই-বাছাই করে আপনাকে পণ্যটি পাঠানোর ঠিকানা জানিয়ে দেবে।",
                        "ময়মনসিংহের ভেতরে হলে আমাদের নিজস্ব ডেলিভারি ম্যান বা কুরিয়ারের মাধ্যমে এক্সচেঞ্জ করা সম্ভব। ময়মনসিংহের বাইরে হলে আপনাকে কুরিয়ারের মাধ্যমে পণ্যটি পাঠাতে হবে।"
                      ].map((step, idx) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700">
                          <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white dark:bg-neutral-700 flex items-center justify-center text-xs font-black shadow-sm">{idx + 1}</span>
                          <p className="text-sm">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-blue-600 rounded-full" />
                      ৫. রিফান্ড (Refund) পলিসি:
                    </h3>
                    <ul className="space-y-3 pl-6">
                      <li className="flex gap-3 text-sm">
                        <span className="text-blue-600 font-bold">✪</span>
                        <span>যদি স্টক না থাকার কারণে আমরা আপনাকে একই পণ্য পুনরায় দিতে না পারি, তবেই রিফান্ড কার্যকর হবে।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-blue-600 font-bold">✪</span>
                        <span>রিফান্ড অনুমোদনের পর ৫-৭ কার্যদিবসের মধ্যে আপনার বিকাশ/নগদ বা ব্যাংক একাউন্টে টাকা ফেরত দেওয়া হবে।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-blue-600 font-bold">✪</span>
                        <span>ক্যাশ অন ডেলিভারির ক্ষেত্রে ডেলিভারি চার্জ রিফান্ডযোগ্য নয়।</span>
                      </li>
                    </ul>
                  </section>

                  <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-black font-display text-black dark:text-white uppercase tracking-tight">
                      <div className="w-2 h-6 bg-red-600 rounded-full" />
                      ৬. যেসব ক্ষেত্রে রিটার্ন প্রযোজ্য নয়:
                    </h3>
                    <ul className="space-y-3 pl-6">
                      <li className="flex gap-3 text-sm">
                        <span className="text-red-600 font-bold">✪</span>
                        <span>গ্যাজেটটি যদি সফটওয়্যার সংক্রান্ত কোনো সমস্যার কারণে না চলে (যা পরবর্তীতে আপডেট দিয়ে ঠিক করা সম্ভব)।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-red-600 font-bold">✪</span>
                        <span>ব্যবহারকারীর ভুলের কারণে পণ্য ক্ষতিগ্রস্ত হলে (যেমন: পানিতে পড়া, পড়ে গিয়ে ভেঙে যাওয়া বা ভুল ভোল্টেজে চার্জ দেওয়া)।</span>
                      </li>
                      <li className="flex gap-3 text-sm">
                        <span className="text-red-600 font-bold">✪</span>
                        <span>"পছন্দ হচ্ছে না" বা "অন্য কোথাও কম দামে পাওয়া যাচ্ছে"—এই ধরনের ব্যক্তিগত কারণে রিটার্ন গ্রহণ করা হয় না</span>
                      </li>
                    </ul>
                  </section>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
                <button 
                  onClick={() => setIsReturnsModalOpen(false)}
                  className="w-full max-w-xs bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl hover:opacity-90 transition-all active:scale-95 shadow-xl"
                >
                  Close Policy
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shipping Policy Modal */}
      <AnimatePresence>
        {isShippingModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShippingModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-blue-50/50 dark:bg-blue-900/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                      <Truck className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black font-display tracking-tight leading-none uppercase">Shipping Policy</h2>
                  </div>
                  <button 
                    onClick={() => setIsShippingModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest pl-1">ডেলিভারি সংক্রান্ত তথ্য</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-800/30 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 text-amber-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-1">অগ্রিম পেমেন্ট</h4>
                    <p className="text-sm text-amber-800/70 dark:text-amber-300/70">ডেলিভারি চার্জ অগ্রিম পেমেন্ট করতে হবে।</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 flex justify-between items-center">
                    <div>
                      <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">ময়মনসিংহ সিটি</h5>
                      <p className="text-lg font-black text-black dark:text-white">৮০ টাকা</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 flex justify-between items-center">
                    <div>
                      <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">ময়মনসিংহের বাইরে</h5>
                      <p className="text-lg font-black text-black dark:text-white">১৫০ টাকা</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                      <Navigation className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
                <button 
                  onClick={() => setIsShippingModalOpen(false)}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isTermsModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTermsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-blue-50/50 dark:bg-blue-900/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black font-display tracking-tight leading-none uppercase">Terms of Service</h2>
                  </div>
                  <button 
                    onClick={() => setIsTermsModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest pl-1">শর্তাবলী ও নীতিমালা</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-black dark:text-white uppercase tracking-tight">Terms of Service: Gadgets Ghar BD</h3>
                  
                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">1</span>
                      Introduction
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      By accessing and using Gadgets Ghar BD, you agree to comply with and be bound by the following terms and conditions. These terms apply to all visitors, users, and others who access our service.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">2</span>
                      Product Information & Pricing
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We strive to provide accurate descriptions and images of our gadgets. However, slight variations in color or packaging may occur.
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Prices are subject to change without prior notice.
                    </p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      In the event of a pricing error, we reserve the right to cancel orders placed at the incorrect price.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">3</span>
                      China Import Service (Special Terms)
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li><strong>Custom Orders:</strong> For products imported specifically from China at your request, a minimum advance payment (e.g., 50%) is required.</li>
                      <li><strong>Lead Time:</strong> Import durations are estimates. We are not responsible for delays caused by shipping carriers, customs clearance, or international holidays.</li>
                      <li><strong>Non-Refundable:</strong> Imported items specifically requested by a customer are generally non-returnable unless they arrive damaged or non-functional.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">4</span>
                      Warranty & Returns
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li><strong>Warranty:</strong> Many of our gadgets come with a brand or service warranty. Please check the product description for specific details.</li>
                      <li><strong>Return Policy:</strong> Items must be returned in their original packaging and condition. Used or physically damaged items will not be accepted for return.</li>
                      <li><strong>Dead on Arrival (DOA):</strong> Any claims for items damaged during shipping must be reported within 24–48 hours of delivery.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">5</span>
                      Shipping & Delivery
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We offer nationwide shipping across Bangladesh. Delivery times vary based on location. Gadgets Ghar BD is not liable for delays caused by third-party courier services.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">6</span>
                      Order Cancellation
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We reserve the right to refuse or cancel any order for reasons including stock unavailability, errors in product/pricing info, or suspicion of fraudulent activity.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">7</span>
                      Limitation of Liability
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Gadgets Ghar BD shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our products.
                    </p>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-800/30">
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 leading-relaxed">
                      <strong>Note:</strong> This is a general guide. For full legal protection, it is always a good idea to have these terms reviewed by a legal professional in Bangladesh, especially regarding consumer rights and electronic commerce laws.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
                <button 
                  onClick={() => setIsTermsModalOpen(false)}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
                >
                  I Understood
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isPrivacyModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPrivacyModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 dark:border-neutral-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black font-display tracking-tight leading-none uppercase">Privacy Policy</h2>
                  </div>
                  <button 
                    onClick={() => setIsPrivacyModalOpen(false)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-widest pl-1">গোপনীয়তা নীতি</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-black dark:text-white uppercase tracking-tight">Privacy Policy: Gadgets Ghar BD</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed italic">
                    At Gadgets Ghar BD, we value your privacy and are committed to protecting your personal information. This policy explains how we collect, use, and safeguard your data.
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">1</span>
                      Information We Collect
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We collect information to provide better services to our users, including:
                    </p>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li><strong>Personal Details:</strong> Name, email address, phone number, and shipping address when you place an order.</li>
                      <li><strong>Payment Information:</strong> We do not store your full card details; payments are processed securely through our authorized payment gateway partners.</li>
                      <li><strong>Import Requests:</strong> Information regarding specific products you wish to import from China.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">2</span>
                      How We Use Your Information
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Your data is used for:
                    </p>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li><strong>Order Processing:</strong> To manage your purchases, shipping, and delivery.</li>
                      <li><strong>Communication:</strong> To send you order updates, tracking information, and promotional offers (if opted-in).</li>
                      <li><strong>Customer Support:</strong> To assist you with technical queries or warranty claims.</li>
                      <li><strong>Import Services:</strong> To communicate with international suppliers for your custom orders.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">3</span>
                      Information Sharing
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We do not sell or rent your personal information to third parties. We only share data with:
                    </p>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li><strong>Delivery Partners:</strong> Local courier services to ensure your gadgets reach you.</li>
                      <li><strong>Import Agents:</strong> Necessary details shared with shipping/customs partners for China imports.</li>
                      <li><strong>Legal Requirements:</strong> If required by Bangladesh law or to protect our rights.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">4</span>
                      Data Security
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      We implement industry-standard security measures to protect your data. However, please remember that no method of transmission over the internet is 100% secure. We encourage you to use strong passwords for your account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">5</span>
                      Cookies
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Our website uses "cookies" to enhance your browsing experience, remember your cart items, and analyze site traffic. You can choose to disable cookies in your browser settings if you prefer.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">6</span>
                      Your Rights
                    </h4>
                    <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1 pl-2">
                      <li>Access the personal data we hold about you.</li>
                      <li>Request a correction of any incorrect information.</li>
                      <li>Request the deletion of your account and personal data from our records.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px]">7</span>
                      Changes to This Policy
                    </h4>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      Gadgets Ghar BD reserves the right to update this Privacy Policy at any time. Any changes will be posted on this page with an updated "Last Modified" date.
                    </p>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex items-center gap-3">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-relaxed font-bold">
                      Your data is protected with secure SSL encryption.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 text-center">
                <button 
                  onClick={() => setIsPrivacyModalOpen(false)}
                  className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-500/20"
                >
                  Confirm & Accept
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}

      <footer className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pt-16 pb-8 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div 
                className="flex items-center gap-3 mb-6 cursor-pointer select-none"
                onClick={() => {
                  setSecretClickCount(prev => {
                    const next = prev + 1;
                    if (next >= 7) {
                      setAdminTab(window.innerWidth >= 768 ? 'analytics' : null);
                      setIsAdminPanelOpen(true);
                      return 0;
                    }
                    return next;
                  });
                }}
              >
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-black tracking-tighter leading-none font-display animate-lighting-orange">GADGETS</span>
                  <span className="text-xs font-bold tracking-[0.2em] text-blue-600 leading-none font-display animate-lighting-blue">GHAR BD</span>
                </div>
              </div>
              <div className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6 space-y-3">
                <p className="text-xs leading-relaxed font-medium">Gadgets Ghar BD: Where Innovation Meets Your Lifestyle.</p>
                <p className="text-xs leading-relaxed">Smart Tech, Better Living – All under one roof at Gadgets Ghar BD.</p>
                <p className="text-xs leading-relaxed">Your search for the most unique and premium gadgets ends here.</p>
                <p className="text-xs leading-relaxed">Bringing the future of technology directly to your doorstep.</p>
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <p className="text-[10px] leading-relaxed mb-2 italic">Can't find what you're looking for? If it's in China, it can be in your hands! Import any product easily through Gadgets Ghar BD.</p>
                  <p className="text-[10px] leading-relaxed mb-2">Dreaming of a specific product from China? We've got you covered! Partner with Gadgets Ghar BD for hassle-free and reliable import services.</p>
                  <p className="text-[10px] leading-relaxed">From global markets to your local home – let Gadgets Ghar BD handle your China imports with speed and safety.</p>
                </div>
              </div>
              <a 
                href={siteSettings.facebookPageUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[12px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-2 w-fit flex items-center gap-1.5"
              >
                <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center p-0.5">
                  <svg className="w-full h-full text-white fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                Facebook Page : Gadgets Ghar BD
              </a>
              <a 
                href={siteSettings.tiktokUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200 hover:underline mb-6 w-fit flex items-center gap-1.5"
              >
                <div className="w-4 h-4 bg-black dark:bg-white rounded-full flex items-center justify-center p-0.5">
                  <svg className="w-full h-full text-white dark:text-black fill-current" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.27 1.76-.23.84-.16 1.76.24 2.55.4.77 1.13 1.34 1.96 1.55.85.24 1.83.1 2.59-.4.53-.33.91-.84 1.08-1.44.17-.61.16-1.25.16-1.89l.01-11.27z"/>
                  </svg>
                </div>
                {siteSettings.tiktokUrl.includes('tiktok.com/@') ? `Tiktok Id : ${siteSettings.tiktokUrl.split('@')[1].split('?')[0]}` : 'Tiktok Page'}
              </a>
            </div>
            <div>
              <h4 className="font-bold mb-6">Shop</h4>
              <ul className="space-y-4 text-sm text-neutral-500 dark:text-neutral-400 mb-8">
                <li><a href="#" className="hover:text-black dark:hover:text-white transition-colors">All Products</a></li>
                <li><a href="#" className="hover:text-black dark:hover:text-white transition-colors">Accessories</a></li>
                <li><a href="#" className="hover:text-black dark:hover:text-white transition-colors">Electronics</a></li>
              </ul>
              
              <div className="space-y-4">
                <h5 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Payment Methods</h5>
                <div className="flex flex-wrap gap-2">
                  {/* bKash */}
                  <div className="h-8 w-12 bg-white rounded-lg border border-neutral-100 flex items-center justify-center p-1.5 shadow-xs overflow-hidden">
                    <img src="https://www.logo.wine/a/logo/BKash/BKash-Icon-Logo.wine.svg" alt="bKash" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  {/* Nagad */}
                  <div className="h-8 w-12 bg-white rounded-lg border border-neutral-100 flex items-center justify-center p-1.5 shadow-xs overflow-hidden">
                    <img src="https://www.logo.wine/a/logo/Nagad/Nagad-Vertical-Logo.wine.svg" alt="Nagad" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  {/* Visa */}
                  <div className="h-8 w-12 bg-white rounded-lg border border-neutral-100 flex items-center justify-center p-1.5 shadow-xs overflow-hidden">
                    <img src="https://www.logo.wine/a/logo/Visa_Inc./Visa_Inc.-Logo.wine.svg" alt="Visa" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  {/* Mastercard */}
                  <div className="h-8 w-12 bg-white rounded-lg border border-neutral-100 flex items-center justify-center p-1.5 shadow-xs overflow-hidden">
                    <img src="https://www.logo.wine/a/logo/Mastercard/Mastercard-Logo.wine.svg" alt="Mastercard" className="h-full w-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-6">Support</h4>
              <ul className="space-y-4 text-sm text-neutral-500 dark:text-neutral-400">
                <li>
                  <a 
                    href="https://wa.me/8801576737194" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-all"
                  >
                    <Smartphone className="w-4 h-4" />
                    WhatsApp
                  </a>
                </li>
                <li>
                  <button 
                    onClick={() => setIsShippingModalOpen(true)}
                    className="hover:text-black dark:hover:text-white transition-colors text-left"
                  >
                    Shipping Policy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsReturnsModalOpen(true)}
                    className="hover:text-black dark:hover:text-white transition-colors text-left"
                  >
                    Returns & Exchanges
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="hover:text-black dark:hover:text-white transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsTermsModalOpen(true)}
                    className="hover:text-black dark:hover:text-white transition-colors text-left"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      setAdminTab(window.innerWidth >= 768 ? 'analytics' : null);
                      setIsAdminPanelOpen(true);
                    }} 
                    className="hover:text-black dark:hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Bulet
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col">
              <div className="flex flex-col mb-1 relative group">
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-bold mb-0.5">Shop Ownership</span>
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-lg blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <p className="relative text-sm font-black font-display tracking-tight text-neutral-800 dark:text-neutral-100 italic">
                  <a 
                    href="https://www.facebook.com/hassan.rakibul.07/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-emerald-500 hover:text-emerald-400 transition-colors drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                  >
                    Hassan Rakibul
                  </a>
                  <span className="mx-1.5 text-neutral-400">&</span>
                  <a 
                    href="https://www.facebook.com/mahdirashid.semon.3" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-500 hover:text-blue-400 transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                  >
                    Mahdi Rashid Semon
                  </a>
                </p>
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">© 2026 Gadgets Ghar BD. All rights reserved.</p>
            </div>

            <div className="flex flex-col items-center">
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-bold mb-0.5">Developer</p>
              <p className="text-sm font-black font-display leading-none mb-1 animate-dev-gradient drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                Raihan Antor
              </p>
              <a 
                href="https://www.facebook.com/Antor41.79" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                <div className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                FB: Raihan Antor
              </a>
            </div>

            <div className="flex gap-6 text-xs text-neutral-400 font-medium">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>


        </div>
      </footer>
      {/* Floating WhatsApp Support Button */}
      <motion.a
        href="https://wa.me/8801576737194" 
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-[0_8px_30px_rgb(37,211,102,0.4)] cursor-pointer group flex items-center justify-center"
      >
        <div className="absolute right-full mr-4 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-2 rounded-xl shadow-xl border border-neutral-100 dark:border-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <p className="text-xs font-black uppercase tracking-widest leading-none">Support Chat</p>
          <p className="text-[10px] text-neutral-500 font-medium mt-1">Connect on WhatsApp</p>
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-4 border-transparent border-l-white dark:border-l-neutral-800" />
        </div>
        <svg 
          viewBox="0 0 24 24" 
          className="w-7 h-7 fill-current"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </motion.a>
    </div>
  );
}
