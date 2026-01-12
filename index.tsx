
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  LayoutDashboard, Package, ShoppingCart, ArrowRightLeft, 
  LogOut, TrendingUp, Truck, Plus, Trash2, Edit, Search, X, 
  DollarSign, Box, AlertTriangle, CreditCard, Banknote, QrCode,
  Tag, User as UserIcon, ReceiptText, Percent, Wallet, ArrowUpCircle, ArrowDownCircle,
  BarChart3, RefreshCw, ClipboardList, Copy, Filter, Layers, Settings, Users,
  ShieldCheck, Landmark, PercentCircle, Eye, Info, Lock, ShieldAlert, Calendar,
  History, Clock, UserCheck, RotateCcw, Award, Zap, Calculator, Trophy, Star, Medal,
  ChevronLeft, ChevronRight, ListOrdered, Download, Upload, Save, FileWarning,
  Megaphone, CalendarDays, CheckCircle2, TicketPercent, Gift, ShieldCheck as ShieldIcon,
  Printer, Check, Key, Shield, Monitor, UserPlus, HandCoins
} from 'lucide-react';

// --- CONFIGURAÇÃO DE SEGURANÇA (CHAVES DE ACESSO) ---
// Estas chaves liberam o acesso ao terminal. Se alteradas aqui e feito deploy, 
// o sistema exigirá a nova chave imediatamente no próximo carregamento.
const VALID_ACCESS_KEYS = [
  'A6OAQ-HH78Z-TMMWR-9P8V6-CG4WI', //-- RD STREET
  'Master',
];

// --- UTILITÁRIOS DE SEGURANÇA DE HARDWARE ---

const getDeviceFingerprint = () => {
  const { userAgent, language, hardwareConcurrency, platform } = navigator;
  const { width, height, colorDepth, availWidth, availHeight } = window.screen;
  // Cria uma assinatura única baseada nas características do hardware e navegador para evitar colisões
  return `${userAgent}|${language}|${hardwareConcurrency}|${platform}|${width}x${height}|${availWidth}x${availHeight}|${colorDepth}`;
};

const generateHWID = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).toUpperCase();
};

// --- UTILITÁRIOS DE FORMATAÇÃO ---

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseCurrency = (val: string) => {
  const clean = val.replace(/\D/g, '');
  return Number(clean) / 100;
};

// --- DEFINIÇÃO DE TIPOS ---

type UserRole = 'admin' | 'atendente';

interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: string;
}

interface AppSettings {
  maxGlobalDiscount: number;
  cardFees: {
    debit: number;
    credit1x: number;
    credit1xLabel?: string;
    creditInstallments: number;
  };
  sellerPermissions: string[]; 
  storeAddress?: string;
  storeCnpj?: string;
  storeName?: string; // Novo campo
  storeTagline?: string; // Novo campo
}

interface Product {
  id: number;
  name: string;
  category: string;
  sku: string;
  price: number;
  cost: number;
  markup: number; 
  stock: number;
  size: string;
  color: string;
  active: boolean;
  supplierId?: number;
}

interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  reason: string;
  date: string;
  user: string;
}

interface SaleItem {
  cartId: string;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  size?: string;
  color?: string;
  discountValue: number; 
  manualDiscountValue: number; // Campo de desconto manual por produto
  isExchanged?: boolean; 
  campaignName?: string; 
  campaignType?: 'percentage' | 'buy_x_get_y' | 'voucher';
}

interface PaymentRecord {
  method: string;
  amount: number;
  installments?: number;
  installmentValue?: number;
  netAmount: number;
  voucherCode?: string;
  f12ClientName?: string;
  f12Description?: string;
  f12DueDate?: string;
}

interface FiadoRecord {
  id: string;
  saleId: number;
  clientName: string;
  description: string;
  totalAmount: number;
  remainingAmount: number;
  createdAt: string;
  dueDate: string;
  vendedor: string;
  status: 'pending' | 'paid';
  items: SaleItem[];
}

interface CashLog {
  id: string;
  type: 'entrada' | 'retirada' | 'venda' | 'abertura';
  amount: number;
  description: string;
  time: string;
  user: string;
}

interface CashSession {
  isOpen: boolean;
  openingBalance: number;
  currentBalance: number;
  openedAt: string;
  openedBy: string;
  logs: CashLog[];
}

interface CashHistoryEntry {
  id: string;
  openedBy: string;
  openedAt: string;
  openingBalance: number;
  closedBy: string;
  closedAt: string;
  closingBalance: number;
  logs: CashLog[];
}

interface Sale {
  id: number;
  date: string;
  subtotal: number;
  discount: number;
  discountPercent: number;
  total: number;
  payments: PaymentRecord[];
  user: string; 
  adminUser: string; 
  items: SaleItem[];
  change: number; 
  exchangeCreditUsed?: number; 
}

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface Campaign {
  id: number;
  name: string;
  description: string;
  type: 'percentage' | 'buy_x_get_y' | 'voucher';
  discountPercent: number;
  pagueX?: number; // Qtd Paga (ex: 2)
  leveY?: number;  // Qtd Levada (ex: 3)
  voucherCode?: string;
  voucherValue?: number;
  voucherQuantity?: number;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  productIds: number[]; 
}

// --- DADOS INICIAIS ---

const DEFAULT_SETTINGS: AppSettings = {
  maxGlobalDiscount: 10,
  cardFees: {
    debit: 1.99,
    credit1x: 3.49,
    creditInstallments: 4.99
  },
  sellerPermissions: ['exchange_sale'],
  storeAddress: 'Rua da Moda, 123 - Centro',
  storeCnpj: '00.000.000/0001-00',
  storeName: 'SCARD SYS',
  storeTagline: 'ENTERPRISE SOLUTION'
};

const INITIAL_CATEGORIES = [
  'Sem Categoria', 'Camisetas', 'Calças', 'Vestidos', 'Bermudas', 'Casacos', 
  'Acessórios', 'Moda Íntima', 'Jeans', 'Blusas', 
  'Saias', 'Fitness', 'Bonés'
];

// --- COMPONENTE PRINCIPAL ---

const App = () => {
  // SEGURANÇA: isUnlocked agora verifica se há uma chave salva que ainda seja válida.
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const usePersistedState = <T,>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = useState<T>(() => {
      const stored = localStorage.getItem(key);
      try {
        if (!stored) return initial;
        const parsed = JSON.parse(stored);
        if (key === 'db_settings') {
          const initialAny = initial as any;
          return { ...initial, ...parsed, cardFees: { ...initialAny.cardFees, ...(parsed.cardFees || {}) } } as T;
        }
        return parsed;
      } catch (e) {
        return initial;
      }
    });
    useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
    return [state, setState];
  };

  const [dbUsers, setDbUsers] = usePersistedState<User[]>('db_users', []);
  const [products, setProducts] = usePersistedState<Product[]>('db_products', []);
  const [suppliers, setSuppliers] = usePersistedState<Supplier[]>('db_suppliers', []);
  const [categories, setCategories] = usePersistedState<string[]>('db_categories', INITIAL_CATEGORIES);
  const [movements, setMovements] = usePersistedState<StockMovement[]>('db_movements', []);
  const [sales, setSales] = usePersistedState<Sale[]>('db_sales', []);
  const [campaigns, setCampaigns] = usePersistedState<Campaign[]>('db_campaigns', []);
  const [cashSession, setCashSession] = usePersistedState<CashSession | null>('db_cash_session', null);
  const [cashHistory, setCashHistory] = usePersistedState<CashHistoryEntry[]>('db_cash_history', []);
  const [settings, setSettings] = usePersistedState<AppSettings>('db_settings', DEFAULT_SETTINGS);
  const [exchangeCredit, setExchangeCredit] = usePersistedState<number>('db_exchange_credit', 0);
  const [keyRegistrations, setKeyRegistrations] = usePersistedState<Record<string, string>>('db_key_registrations', {});
  const [fiados, setFiados] = usePersistedState<FiadoRecord[]>('db_fiados', []);
  const [currentView, setCurrentView] = useState('dashboard');
  
  const [openingBalanceInput, setOpeningBalanceInput] = useState(0);

  const deviceHwid = useMemo(() => generateHWID(getDeviceFingerprint()), []);

  // Efeito para verificar chave memorizada ao iniciar
  useEffect(() => {
    const savedKey = localStorage.getItem('scard_saved_access_key');
    if (savedKey && VALID_ACCESS_KEYS.includes(savedKey)) {
      // Verifica se a chave salva pertence a este HWID
      if (keyRegistrations[savedKey] && keyRegistrations[savedKey] !== deviceHwid) {
        localStorage.removeItem('scard_saved_access_key');
        return;
      }
      setIsUnlocked(true);
    }
  }, [keyRegistrations, deviceHwid]);

  const handleVerifyAccessKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rememberKey) return; 

    setIsValidating(true);
    const trimmedKey = accessKeyInput.trim();

    // Simulação de delay para validação e persistência do HWID
    setTimeout(() => {
      if (VALID_ACCESS_KEYS.includes(trimmedKey)) {
        // Lógica de Trava de Hardware (Cross-Machine Prevention)
        const registeredHwid = keyRegistrations[trimmedKey];
        
        if (registeredHwid && registeredHwid !== deviceHwid) {
          alert('ERRO DE SEGURANÇA: Esta licença/chave já está vinculada a outro dispositivo. Chaves de acesso SCARDPRO são de uso exclusivo por terminal único (HWID Lock).');
          setIsValidating(false);
          setAccessKeyInput('');
          return;
        }

        // Registrar chave para este HWID se for o primeiro uso
        if (!registeredHwid) {
          setKeyRegistrations(prev => ({ ...prev, [trimmedKey]: deviceHwid }));
        }

        if (rememberKey) {
          localStorage.setItem('scard_saved_access_key', trimmedKey);
        }
        setIsUnlocked(true);
      } else {
        alert('Chave de acesso inválida ou expirada. Entre em contato com o suporte SCARD.');
        setAccessKeyInput('');
      }
      setIsValidating(false);
    }, 1200);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    if (email === 'master' && password === '965088') {
      setUser({
        id: 0,
        name: 'MASTER SYSTEM',
        email: 'master@internal',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
      setCurrentView('dashboard');
      return;
    }

    const foundUser = dbUsers.find(u => u.email === email && u.password === password);
    if (foundUser) {
      setUser(foundUser);
      if (foundUser.role === 'atendente') {
        setCurrentView('sales');
      } else {
        setCurrentView('dashboard');
      }
    } else { 
      alert('E-mail ou senha incorretos!'); 
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem('regName') as HTMLInputElement).value;
    const email = (form.elements.namedItem('regEmail') as HTMLInputElement).value;
    const password = (form.elements.namedItem('regPassword') as HTMLInputElement).value;

    if (dbUsers.some(u => u.email === email)) {
      alert('E-mail já cadastrado!');
      return;
    }

    const newUser: User = {
      id: Date.now(),
      name,
      email,
      password,
      role: dbUsers.length === 0 ? 'admin' : 'atendente', 
      createdAt: new Date().toISOString()
    };

    setDbUsers([...dbUsers, newUser]);
    alert(`Usuário ${name} cadastrado com sucesso! Agora faça login.`);
    form.reset();
    setAuthMode('login');
  };

  const handleExportBackup = () => {
    const dataKeys = [
      'db_users', 'db_products', 'db_suppliers', 'db_categories', 
      'db_movements', 'db_sales', 'db_cash_session', 'db_cash_history', 
      'db_settings', 'db_exchange_credit', 'db_campaigns', 'db_key_registrations', 'db_fiados'
    ];
    
    const backupData: Record<string, any> = {};
    dataKeys.forEach(key => {
      const stored = localStorage.getItem(key);
      backupData[key] = stored ? JSON.parse(stored) : null;
    });

    const jsonString = JSON.stringify(backupData);
    const encodedData = btoa(unescape(encodeURIComponent(jsonString)));
    const secureContent = `SCARDSYS_SECURE_BKPV1:${encodedData}`;

    const blob = new Blob([secureContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const datePart = `${day}-${month}-${year}`;
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timePart = `${hours}-${minutes}-${seconds}`;
    
    const fileName = `backup_scardsys_${datePart}_${timePart}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("ATENÇÃO: Restaurar o backup irá sobrescrever TODOS os dados atuais (estoque, vendas, usuários e licenças). Deseja continuar?")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content.startsWith('SCARDSYS_SECURE_BKPV1:')) {
          throw new Error("Formato de arquivo inválido ou corrompido.");
        }
        const encodedData = content.replace('SCARDSYS_SECURE_BKPV1:', '');
        const decodedString = decodeURIComponent(escape(atob(encodedData)));
        const data = JSON.parse(decodedString);
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
        alert("Backup restaurado com sucesso! O sistema será reiniciado.");
        window.location.reload();
      } catch (err) {
        alert("Erro ao importar: O arquivo selecionado não é um backup válido ou está corrompido.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenCash = (amount: number) => {
    if (!user) return;
    const newSession: CashSession = {
      isOpen: true,
      openingBalance: amount,
      currentBalance: amount,
      openedAt: new Date().toISOString(),
      openedBy: user.name,
      logs: [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'abertura',
        amount: amount,
        description: 'Abertura de Caixa',
        time: new Date().toISOString(),
        user: user.name
      }]
    };
    setCashSession(newSession);
    setOpeningBalanceInput(0); 
  };

  const handleCloseCashAction = () => {
    if (!user || !cashSession) return;
    if (window.confirm('Deseja realmente encerrar o caixa atual?')) {
      const historyEntry: CashHistoryEntry = {
        id: Math.random().toString(36).substr(2, 9),
        openedBy: cashSession.openedBy,
        openedAt: cashSession.openedAt,
        openingBalance: cashSession.openingBalance,
        closedBy: user.name,
        closedAt: new Date().toISOString(),
        closingBalance: cashSession.currentBalance,
        logs: [...cashSession.logs]
      };
      setCashHistory(prev => [historyEntry, ...prev]);
      setCashSession(null);
      alert('Caixa encerrado e registrado com sucesso!');
    }
  };

  // TELA DE PROTEÇÃO POR CHAVE DE ACESSO
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] p-6 font-sans text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-800/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2 animate-pulse"></div>
        
        <div className="bg-slate-900/40 backdrop-blur-3xl p-10 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-sm border border-slate-800/50 relative z-10 animate-in fade-in zoom-in-95 duration-500 text-center">
          <div className="mb-10 inline-flex p-5 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            {isValidating ? <RefreshCw size={48} className="animate-spin text-indigo-500" /> : <Shield size={48} strokeWidth={1.5} />}
          </div>
          
          <div className="mb-10">
            <h1 className="text-4xl font-black text-white tracking-tighter italic mb-2">SCARD<span className="text-indigo-500">PRO</span></h1>
            <p className="text-slate-500 font-black uppercase text-[9px] tracking-[0.3em]">Hardware Access Protection</p>
          </div>

          <form onSubmit={handleVerifyAccessKey} className="space-y-6">
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1 text-center">Insira sua Chave de Acesso</label>
              <div className="relative group">
                <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500/50 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="password" 
                  autoFocus 
                  disabled={isValidating}
                  placeholder="••••••••••••" 
                  className="w-full rounded-2xl border-2 border-slate-800 bg-slate-950/50 px-12 py-5 text-indigo-400 focus:border-indigo-500 outline-none transition-all font-mono font-bold text-center tracking-widest placeholder:text-slate-800"
                  value={accessKeyInput}
                  onChange={(e) => setAccessKeyInput(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 cursor-pointer hover:bg-slate-950/60 transition-colors" onClick={() => setRememberKey(!rememberKey)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rememberKey ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700 bg-transparent'}`}>
                    {rememberKey && <Check size={14} className="text-white" />}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Concordo com os Termos de Uso e Licença de Terminal Único</span>
            </div>
            
            <button 
                type="submit" 
                disabled={!rememberKey || isValidating}
                className={`w-full rounded-2xl py-5 text-white font-black shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 uppercase text-xs tracking-[0.2em] ${(!rememberKey || isValidating) ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-50'}`}
            >
              {isValidating ? 'Validando HWID...' : 'Validar Acesso'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-slate-500 opacity-60">
              <Monitor size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">Identificador do Terminal</span>
            </div>
            <code className="bg-slate-950/80 px-3 py-1.5 rounded-lg text-[9px] font-mono font-black text-indigo-500/80 border border-slate-800/50">{deviceHwid}</code>
          </div>
        </div>
      </div>
    );
  }

  // TELA DE LOGIN/REGISTRO (Pós validação de chave)
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-6 font-sans text-slate-900 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-200 relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-slate-800 tracking-tighter italic mb-2">SCARD<span className="text-indigo-600">SYS</span></h1>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">Enterprise Solution</p>
          </div>
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail ou Master</label>
                <input name="email" type="text" placeholder="usuário" className="w-full rounded-2xl border-2 border-slate-100 px-5 py-4 text-slate-800 bg-slate-50 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Senha</label>
                <input name="password" type="password" placeholder="••••••••" className="w-full rounded-2xl border-2 border-slate-100 px-5 py-4 text-slate-800 bg-slate-50 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-indigo-600 py-5 text-white font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 uppercase text-xs tracking-widest mt-2">
                Acessar Terminal
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => setAuthMode('register')} className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                  Cadastrar Usuário
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
               <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome Completo</label>
                <input name="regName" type="text" placeholder="Nome" className="w-full rounded-2xl border-2 border-slate-100 px-5 py-4 text-slate-800 bg-slate-50 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">E-mail</label>
                <input name="regEmail" type="email" placeholder="admin@loja.com" className="w-full rounded-2xl border-2 border-slate-100 px-5 py-4 text-slate-800 bg-slate-50 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Senha</label>
                <input name="regPassword" type="password" placeholder="••••••••" className="w-full rounded-2xl border-2 border-slate-100 px-5 py-4 text-slate-800 bg-slate-50 focus:border-indigo-500 outline-none transition-all font-bold text-sm shadow-sm" required />
              </div>
              <button type="submit" className="w-full rounded-2xl bg-slate-800 py-5 text-white font-black hover:bg-slate-900 shadow-xl shadow-slate-200 transition-all active:scale-95 uppercase text-xs tracking-widest mt-2">
                Criar Conta
              </button>
              <div className="text-center mt-6">
                <button type="button" onClick={() => setAuthMode('login')} className="text-xs font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                  Voltar para Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  const isMasterUser = user.id === 0 || user.email === 'master@internal';
  const isAdmin = user.role === 'admin' || isMasterUser;
  const isCashOpen = cashSession && cashSession.isOpen;

  const hasPermission = (viewId: string) => {
    // Permission system: Admin has all access. Certain views are always allowed for everyone.
    // 'fiado' is removed from the "always true" list to satisfy the user request.
    if (isAdmin || viewId === 'sales' || viewId === 'reports' || viewId === 'product_search') return true; 
    return (settings.sellerPermissions || []).includes(viewId);
  };

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans text-slate-900 selection:bg-indigo-100 overflow-hidden">
      <aside className="w-64 bg-slate-950 text-white flex flex-col shrink-0 border-r border-slate-800 shadow-2xl relative z-20">
        <div className="p-8">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">SCARD<span className="text-indigo-500 font-normal">SYS</span></h2>
          <div className="flex items-center gap-3 mt-6 bg-slate-900 p-3 rounded-2xl border border-slate-800/50 group">
             <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-xs shadow-lg">
                {user.name.charAt(0).toUpperCase()}
             </div>
             <div className="flex flex-col min-w-0">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-none">{user.role === 'admin' ? 'Administrador' : 'Vendedor'}</span>
                <p className="text-xs font-black text-slate-100 uppercase tracking-tight truncate mt-1">{user.name}</p>
             </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scroll">
          <NavBtn active={currentView === 'sales'} onClick={() => setCurrentView('sales')} icon={<ShoppingCart size={18}/>} label="Caixa PDV" />
          <NavBtn active={currentView === 'product_search'} onClick={() => setCurrentView('product_search')} icon={<Search size={18}/>} label="Consultar" />
          {hasPermission('fiado') && <NavBtn active={currentView === 'fiado'} onClick={() => setCurrentView('fiado')} icon={<HandCoins size={18}/>} label="Pendentes (F12)" />}
          <NavBtn active={currentView === 'reports'} onClick={() => setCurrentView('reports')} icon={<TrendingUp size={18}/>} label="Relatórios" />
          {hasPermission('stock') && <NavBtn active={currentView === 'stock'} onClick={() => setCurrentView('stock')} icon={<Package size={18}/>} label="Estoque" />}
          
          {(isAdmin || hasPermission('dashboard') || hasPermission('campaigns')) && (
            <div className="pt-6 mt-6 border-t border-slate-900 space-y-1">
               <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4">Admin</p>
               {hasPermission('campaigns') && <NavBtn active={currentView === 'campaigns'} onClick={() => setCurrentView('campaigns')} icon={<Megaphone size={18}/>} label="Campanhas" />}
               {hasPermission('dashboard') && <NavBtn active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} icon={<LayoutDashboard size={18}/>} label="Dashboard" />}
               {isAdmin && <NavBtn active={currentView === 'team'} onClick={() => setCurrentView('team')} icon={<Users size={18}/>} label="Equipe" />}
               {isAdmin && <NavBtn active={currentView === 'settings'} onClick={() => setCurrentView('settings')} icon={<Settings size={18}/>} label="Ajustes" />}
            </div>
          )}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-slate-800/50">
          <button type="button" title="Gerar backup protegido dos dados" onClick={handleExportBackup} className="flex items-center space-x-3 text-emerald-400 hover:text-emerald-300 transition-all w-full px-4 py-2.5 rounded-xl hover:bg-emerald-400/5 group">
            <Download size={16} />
            <span className="font-black uppercase text-[9px] tracking-widest">Salvar Backup</span>
          </button>
          {isMasterUser && (
            <button type="button" title="Restaurar dados de um arquivo de backup" onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-3 text-sky-400 hover:text-sky-300 transition-all w-full px-4 py-2.5 rounded-xl hover:bg-sky-400/5 group">
              <Upload size={16} />
              <span className="font-black uppercase text-[9px] tracking-widest">Restaurar Backup</span>
              <input ref={fileInputRef} type="file" accept=".json,.scard" className="hidden" onChange={handleImportBackup} />
            </button>
          )}
          {isCashOpen && (
            <button type="button" onClick={handleCloseCashAction} className="flex items-center space-x-3 text-amber-500 hover:text-amber-400 transition-all w-full px-4 py-3 rounded-xl hover:bg-amber-500/5 group">
              <Wallet size={18} />
              <span className="font-black uppercase text-[9px] tracking-widest">Fechar Caixa</span>
            </button>
          )}
          <button type="button" onClick={() => { setIsUnlocked(false); setUser(null); }} className="flex items-center space-x-3 text-slate-500 hover:text-red-400 transition-all w-full px-4 py-3 rounded-xl hover:bg-red-500/5 group">
            <LogOut size={18} />
            <span className="font-black uppercase text-[9px] tracking-widest">Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto relative">
        <div className="max-w-[1550px] mx-auto px-10 py-12 h-full flex flex-col">
          {currentView === 'sales' && (
            !isCashOpen ? (
              <div className="flex-1 flex items-center justify-center animate-in fade-in">
                <div className="bg-white p-12 rounded-[3rem] shadow-xl w-full max-w-lg border border-slate-200">
                  <div className="flex flex-col items-center mb-10">
                    <div className="p-6 bg-indigo-50 text-indigo-600 rounded-[2rem] mb-6 shadow-inner border border-indigo-100">
                      <Wallet size={48} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Abertura de Caixa</h2>
                    <p className="text-slate-400 font-bold text-xs text-center mt-3 px-10 leading-relaxed uppercase tracking-widest opacity-70">Informe o saldo inicial disponível em espécie.</p>
                  </div>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleOpenCash(openingBalanceInput);
                  }} className="space-y-8">
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">R$</span>
                      <input 
                        name="amount" 
                        type="text" 
                        autoComplete="off" 
                        autoFocus 
                        className="w-full text-center text-5xl font-black bg-slate-50 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 outline-none py-8 transition-all text-indigo-700 shadow-inner pl-14" 
                        placeholder="0,00" 
                        required 
                        value={formatCurrency(openingBalanceInput)}
                        onChange={(e) => setOpeningBalanceInput(parseCurrency(e.target.value))}
                      />
                    </div>
                    <button type="submit" className="w-full rounded-2xl bg-indigo-600 py-6 text-white font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 uppercase text-sm tracking-[0.2em]">
                      Abrir Caixa
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <SalesViewComponent 
                user={user} 
                products={products} 
                setProducts={setProducts} 
                setSales={setSales} 
                setMovements={setMovements} 
                vendedores={dbUsers}
                cashSession={cashSession}
                setCashSession={setCashSession}
                settings={settings}
                exchangeCredit={exchangeCredit}
                setExchangeCredit={setExchangeCredit}
                campaigns={campaigns}
                setCampaigns={setCampaigns}
                fiados={fiados}
                setFiados={setFiados}
              />
            )
          )}
          {currentView === 'product_search' && (
            <ProductSearchViewComponent products={products} categories={categories} />
          )}
          {currentView === 'fiado' && (
             <FiadoManagementView 
               user={user}
               fiados={fiados} 
               setFiados={setFiados} 
               cashSession={cashSession} 
               setCashSession={setCashSession} 
               cashHistory={cashHistory}
             />
          )}
          {currentView === 'stock' && (
            <StockManagementView
              user={user}
              products={products}
              setProducts={setProducts}
              movements={movements}
              setMovements={setMovements}
              categories={categories}
            />
          )}
          {currentView === 'campaigns' && (
            <CampaignsViewComponent campaigns={campaigns} setCampaigns={setCampaigns} products={products} />
          )}
          {currentView === 'dashboard' && (
            <DashboardViewComponent products={products} sales={sales} cashSession={cashSession} fiados={fiados} cashHistory={cashHistory} />
          )}
          {currentView === 'reports' && (
            <ReportsViewComponent 
              user={user}
              sales={sales} 
              setSales={setSales} 
              products={products}
              setProducts={setProducts}
              setMovements={setMovements}
              cashHistory={cashHistory}
              cashSession={cashSession}
              setCashHistory={setCashHistory}
              settings={settings}
              setExchangeCredit={setExchangeCredit}
              setCurrentView={setCurrentView}
            />
          )}
          {currentView === 'team' && (
            <TeamViewComponent currentUser={user} users={dbUsers} setUsers={setDbUsers} />
          )}
          {currentView === 'settings' && (
            <SettingsViewComponent 
              settings={settings} 
              setSettings={setSettings} 
              categories={categories}
              setCategories={setCategories}
              products={products}
              setProducts={setProducts}
            />
          )}
        </div>
      </main>
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center space-x-4 w-full px-5 py-3 rounded-xl transition-all font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-100'}`}>
    <span>{icon}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);

// --- COMPONENTE GESTÃO DE PENDENTES (F12) ---

const FiadoManagementView = ({ user, fiados, setFiados, cashSession, setCashSession, cashHistory }: any) => {
  const [search, setSearch] = useState('');
  const [receivingModal, setReceivingModal] = useState<FiadoRecord | null>(null);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [receiveMethod, setReceiveMethod] = useState('Dinheiro');

  const pendingFiados = useMemo(() => {
    return fiados.filter((f: FiadoRecord) => f.status === 'pending' && 
      (f.clientName.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase())));
  }, [fiados, search]);

  const handleReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingModal) return;

    if (receiveAmount <= 0 || receiveAmount > receivingModal.remainingAmount + 0.01) {
      alert('Valor inválido para recebimento.');
      return;
    }

    const newRemaining = Math.max(0, receivingModal.remainingAmount - receiveAmount);
    const isFullyPaid = newRemaining <= 0.01;

    const updatedFiados = fiados.map((f: FiadoRecord) => {
       if (f.id === receivingModal.id) {
          return {
            ...f,
            remainingAmount: newRemaining,
            status: isFullyPaid ? 'paid' : 'pending'
          };
       }
       return f;
    });

    setFiados(updatedFiados);

    // Lógica de Entrada de Caixa se for Dinheiro/Pix
    if (cashSession && (receiveMethod === 'Dinheiro' || receiveMethod === 'Pix')) {
       const newLog: CashLog = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'entrada',
          amount: receiveAmount,
          description: `Rec. Pendente: ${receivingModal.clientName} (${receiveMethod})`,
          time: new Date().toISOString(),
          user: user.name
       };

       setCashSession((prev: CashSession) => ({
          ...prev,
          currentBalance: prev.currentBalance + (receiveMethod === 'Dinheiro' ? receiveAmount : 0),
          logs: [newLog, ...prev.logs]
       }));
    }

    alert(isFullyPaid ? 'Dívida quitada com sucesso!' : 'Pagamento parcial registrado!');
    setReceivingModal(null);
    setReceiveAmount(0);
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
       <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Gestão de Pendentes (F12)</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Controle de pagamentos pendentes de clientes</p>
       </div>

       <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 shrink-0">
          <div className="relative group flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por cliente ou descrição..." 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
       </div>

       <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1 custom-scroll">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Acordo / Descrição</th>
                  <th className="px-6 py-4">Vencimento</th>
                  <th className="px-6 py-4 text-right">Valor Inicial</th>
                  <th className="px-6 py-4 text-right">Pendente</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingFiados.map((f: FiadoRecord) => (
                  <tr key={f.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4">
                       <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-sm uppercase">{f.clientName}</span>
                          <span className="text-[9px] font-black text-indigo-500">VENDA #{f.saleId.toString().slice(-4)}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-xs font-bold text-slate-500 italic max-w-xs">{f.description}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded text-[10px] font-black border ${new Date(f.dueDate) < new Date() ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                          {new Date(f.dueDate).toLocaleDateString()}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-400 text-sm">R$ {formatCurrency(f.totalAmount)}</td>
                    <td className="px-6 py-4 text-right">
                       <span className="font-black text-red-600 font-mono text-sm">R$ {formatCurrency(f.remainingAmount)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                        onClick={() => { setReceivingModal(f); setReceiveAmount(f.remainingAmount); }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase shadow-md hover:bg-green-700 active:scale-95 transition-all"
                       >
                          Dar Baixa
                       </button>
                    </td>
                  </tr>
                ))}
                {pendingFiados.length === 0 && (
                   <tr>
                     <td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic uppercase tracking-widest">Nenhum registro pendente encontrado...</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>

       {receivingModal && (
          <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[200] backdrop-blur-md animate-in fade-in">
             <form onSubmit={handleReceive} className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                   <h3 className="text-xl font-black text-slate-900 uppercase italic">Baixa de Pagamento</h3>
                   <button type="button" onClick={() => setReceivingModal(null)} className="text-slate-300 hover:text-slate-500"><X size={24}/></button>
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Cliente</span>
                   <p className="text-lg font-black text-indigo-700 uppercase">{receivingModal.clientName}</p>
                   <div className="mt-2 flex justify-center gap-4">
                      <div>
                         <span className="text-[8px] font-black text-slate-400 uppercase block">Total Devido</span>
                         <span className="font-mono font-black text-red-600">R$ {formatCurrency(receivingModal.remainingAmount)}</span>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Valor do Pagamento</label>
                      <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">R$</span>
                         <input 
                           type="text" 
                           className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-2xl text-2xl font-black text-indigo-700 outline-none focus:border-indigo-500"
                           value={formatCurrency(receiveAmount)}
                           onChange={(e) => setReceiveAmount(parseCurrency(e.target.value))}
                           onFocus={(e) => e.target.select()}
                         />
                      </div>
                   </div>

                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Meio de Recebimento</label>
                      <select 
                        className="w-full border-2 rounded-2xl px-4 py-3 text-sm font-black uppercase bg-slate-50 outline-none"
                        value={receiveMethod}
                        onChange={(e) => setReceiveMethod(e.target.value)}
                      >
                         <option>Dinheiro</option>
                         <option>Pix</option>
                         <option>Cartão</option>
                      </select>
                   </div>
                </div>

                <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setReceivingModal(null)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                   <button type="submit" className="flex-[2] py-4 bg-green-600 text-white font-black rounded-2xl uppercase text-[10px] shadow-xl hover:bg-green-700">Confirmar Recebimento</button>
                </div>
             </form>
          </div>
       )}
    </div>
  );
};

// --- COMPONENTE BUSCA RÁPIDA DE PRODUTOS ---

const ProductSearchViewComponent = ({ products, categories }: { products: Product[], categories: string[] }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');

  const sortedCategories = useMemo(() => { 
    return [...categories].sort((a, b) => { 
      if (a === 'Sem Categoria') return -1; 
      if (b === 'Sem Categoria') return 1; 
      return a.localeCompare(b); 
    }); 
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const t = search.toLowerCase();
    return products.filter((p: Product) => {
      const matchSearch = p.active && (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t));
      const matchCategory = filterCategory === 'Todas' ? true : p.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, filterCategory]);

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
       <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Consulta de Produtos</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verificação rápida de preço e estoque</p>
       </div>
       
       <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 shrink-0">
          <div className="relative group flex-1">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por SKU ou nome..." className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>
          <select className="bg-slate-50 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
             <option value="Todas">Categorias</option>
             {sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
       </div>

       <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1 custom-scroll">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4 text-right">Preço de Venda</th>
                  <th className="px-6 py-4 text-center">Estoque Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                        <span className="text-[10px] font-black text-indigo-500 font-mono">{p.sku}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[8px] font-black uppercase border">{p.category || 'Sem Categoria'}</span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col text-[11px] font-bold text-slate-600">
                          {p.size && <span>TAM: {p.size}</span>}
                          {p.color && <span>COR: {p.color}</span>}
                          {!p.size && !p.color && <span className="text-slate-300">-</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900 font-mono text-sm text-right">R$ {formatCurrency(p.price)}</td>
                    <td className="px-6 py-4 text-center">
                       <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black ${p.stock <= 5 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                          {p.stock} un
                       </span>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">Nenhum produto encontrado...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>
    </div>
  );
};

// --- COMPONENTE CAMPANHAS ---

const CampaignsViewComponent = ({ campaigns, setCampaigns, products }: { campaigns: Campaign[], setCampaigns: any, products: Product[] }) => {
  const [modal, setModal] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [form, setForm] = useState<Partial<Campaign>>({
    name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, startDate: '', endDate: '', active: true, productIds: []
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const id = form.id || Date.now();
    const c: Campaign = { 
      ...form, 
      id, 
      createdAt: form.createdAt || new Date().toISOString() 
    } as Campaign;

    if (form.id) setCampaigns((prev: Campaign[]) => prev.map(x => x.id === id ? c : x));
    else setCampaigns((prev: Campaign[]) => [...prev, c]);
    
    setModal(false);
    setForm({ name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, startDate: '', endDate: '', active: true, productIds: [] });
  };

  const filteredProds = products.filter(p => p.active && (p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.sku.toLowerCase().includes(prodSearch.toLowerCase())));

  const toggleProduct = (pid: number) => {
    const current = form.productIds || [];
    if (current.includes(pid)) {
      setForm({ ...form, productIds: current.filter(id => id !== pid) });
    } else {
      setForm({ ...form, productIds: [...current, pid] });
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col min-h-0 animate-in fade-in">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Campanhas</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gestão de promoções e eventos</p>
        </div>
        <button onClick={() => { setForm({ name: '', description: '', type: 'percentage', discountPercent: 0, pagueX: 0, leveY: 0, voucherCode: '', voucherValue: 0, voucherQuantity: 1, startDate: '', endDate: '', active: true, productIds: [] }); setModal(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase">
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scroll">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-4">Campanha</th>
                <th className="px-6 py-4">Tipo/Regra</th>
                <th className="px-6 py-4">Itens/Validade</th>
                <th className="px-6 py-4">Período</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c: Campaign) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm uppercase italic">{c.name}</span>
                      <span className="text-[10px] text-slate-400 truncate max-w-xs">{c.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {c.type === 'percentage' ? (
                       <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-100 uppercase">
                          {c.discountPercent}% OFF
                       </span>
                     ) : c.type === 'buy_x_get_y' ? (
                       <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100 uppercase flex items-center gap-1.5 w-fit">
                          <TicketPercent size={12} /> PAGUE {c.pagueX} LEVE {c.leveY}
                       </span>
                     ) : (
                        <div className="flex flex-col gap-1">
                            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black border border-amber-100 uppercase flex items-center gap-1.5 w-fit">
                                <Gift size={12} /> VOUCHER: {c.voucherCode}
                            </span>
                            <span className="text-[10px] font-black text-slate-500 font-mono">VALOR: R$ {formatCurrency(c.voucherValue || 0)}</span>
                        </div>
                     )}
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-1">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-black w-fit uppercase">
                            {c.type === 'voucher' ? `${c.voucherQuantity} USOS` : `${c.productIds?.length || 0} PRODS`}
                        </span>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <CalendarDays size={12} className="text-indigo-400" />
                      {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const now = new Date();
                      const start = new Date(c.startDate);
                      const end = new Date(c.endDate);
                      end.setHours(23, 59, 59, 999);
                      
                      if (now > end) return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-red-50 text-red-600 border-red-100">Encerrada</span>;
                      if (now < start) return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-blue-50 text-blue-600 border-blue-100">Agendada</span>;
                      if (c.type === 'voucher' && (c.voucherQuantity || 0) <= 0) return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-slate-100 text-slate-400 border-slate-200">Esgotado</span>;
                      return <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border bg-green-50 text-green-600 border-green-100">Ativa</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setForm(c); setModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit size={14} /></button>
                      <button onClick={() => setCampaigns(campaigns.filter((x: any) => x.id !== c.id))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic">Nenhuma campanha cadastrada...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-[100] animate-in fade-in">
          <form onSubmit={save} className="bg-white p-8 rounded-[2.5rem] w-full max-w-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-hidden flex flex-col relative z-20">
            <div className="flex justify-between items-center border-b pb-4 shrink-0">
               <h3 className="text-xl font-black text-slate-900 uppercase italic">
                  {form.id ? 'Ajustar' : 'Nova'} Campanha / Voucher
               </h3>
               <button type="button" onClick={() => setModal(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll pr-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Nome da Campanha</label>
                      <input className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase focus:border-indigo-500 outline-none" placeholder="Ex: Black Friday" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Descrição</label>
                      <textarea className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold h-20 resize-none focus:border-indigo-500 outline-none" placeholder="Detalhes da promoção..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Tipo de Campanha</label>
                        <select className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase focus:border-indigo-500 outline-none" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                           <option value="percentage">Desconto Percentual (%)</option>
                           <option value="buy_x_get_y">Pague X, Leve Y (Item Grátis)</option>
                           <option value="voucher">Cupom de Desconto (Voucher)</option>
                        </select>
                    </div>

                    {form.type === 'percentage' && (
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Desconto (%)</label>
                          <div className="relative">
                            <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input 
                              type="number" 
                              step="0.5" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-red-600 focus:border-red-300 outline-none" 
                              value={form.discountPercent} 
                              onFocus={() => { if(form.discountPercent === 0) setForm(prev => ({...prev, discountPercent: '' as any})); }} 
                              onBlur={() => { if(form.discountPercent as any === '') setForm(prev => ({...prev, discountPercent: 0})); }}
                              onChange={e => setForm(prev => ({ ...prev, discountPercent: e.target.value === '' ? '' as any : Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                       </div>
                    )}

                    {form.type === 'buy_x_get_y' && (
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Pague (Qtd)</label>
                            <input 
                              type="number" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-indigo-600 focus:border-indigo-300 outline-none" 
                              value={form.pagueX} 
                              onChange={e => setForm(prev => ({ ...prev, pagueX: Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Leve (Qtd)</label>
                            <input 
                              type="number" 
                              className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-green-600 focus:border-green-300 outline-none" 
                              value={form.leveY} 
                              onChange={e => setForm(prev => ({ ...prev, laveY: Number(e.target.value) }))} 
                              required 
                            />
                          </div>
                          <p className="col-span-2 text-[8px] font-bold text-slate-400 italic uppercase">
                             O sistema dará desconto de 100% nas {(form.leveY || 0) - (form.pagueX || 0)} unidades mais baratas a cada {form.leveY} itens.
                          </p>
                       </div>
                    )}

                    {form.type === 'voucher' && (
                        <div className="space-y-4 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                           <div className="space-y-1">
                                <label className="text-[9px] font-black text-amber-600 uppercase block ml-1">Código do Voucher</label>
                                <input className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black uppercase text-amber-700 focus:border-amber-400 outline-none" placeholder="Ex: CUPOM10" value={form.voucherCode} onChange={e => setForm({ ...form, voucherCode: e.target.value.toUpperCase() })} required />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                    <label className="text-[9px] font-black text-amber-600 uppercase block ml-1">Valor Fixo (R$)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-amber-700 outline-none" 
                                        value={formatCurrency(form.voucherValue || 0)} 
                                        onChange={e => setForm({ ...form, voucherValue: parseCurrency(e.target.value) })} 
                                        required 
                                    />
                              </div>
                              <div className="space-y-1">
                                    <label className="text-[9px] font-black text-amber-600 uppercase block ml-1">Quantidade/Limite</label>
                                    <input 
                                        type="number" 
                                        className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-amber-700 outline-none" 
                                        value={form.voucherQuantity} 
                                        onChange={e => setForm({ ...form, voucherQuantity: Number(e.target.value) })} 
                                        required 
                                    />
                              </div>
                           </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Início</label>
                          <input type="date" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Término</label>
                          <input type="date" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-indigo-500 outline-none" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col min-h-0">
                    <label className="text-[9px] font-black text-slate-400 uppercase block ml-1">Selecionar Produtos Participantes</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Buscar produto por nome ou SKU..." className="w-full border-2 rounded-xl pl-9 pr-4 py-2 text-xs font-bold bg-slate-50 outline-none focus:border-indigo-500" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                    </div>
                    <div className="flex-1 border-2 rounded-2xl overflow-y-auto custom-scroll bg-slate-50 p-2 space-y-1 max-h-[300px]">
                        {filteredProds.map(p => (
                          <div key={p.id} onClick={() => toggleProduct(p.id)} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${form.productIds?.includes(p.id) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white hover:bg-indigo-50 text-slate-700'}`}>
                             <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                                <span className={`text-[8px] font-mono ${form.productIds?.includes(p.id) ? 'text-indigo-200' : 'text-slate-400'}`}>SKU: {p.sku}</span>
                             </div>
                             {form.productIds?.includes(p.id) ? <CheckCircle2 size={14} /> : <Plus size={14} className="text-slate-300" />}
                          </div>
                        ))}
                        {filteredProds.length === 0 && <p className="text-center py-4 text-[10px] text-slate-400 font-bold uppercase italic">Nenhum produto encontrado...</p>}
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center">
                       <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Selecionados</span>
                       <span className="text-xs font-black text-indigo-600">{form.productIds?.length || 0} Peças</span>
                    </div>
                  </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t mt-4 shrink-0">
              <button type="button" onClick={() => setModal(false)} className="px-5 py-2 text-slate-400 font-black uppercase text-[10px]">DESCARTAR</button>
              <button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95">SALVAR CAMPANHA</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PDV ---

const SalesViewComponent = ({ user, products, setProducts, setSales, setMovements, vendedores, cashSession, setCashSession, settings, exchangeCredit, setExchangeCredit, campaigns, setCampaigns, fiados, setFiados }: any) => {
  const isMasterUser = user.id === 0 || user.email === 'master@internal';
  const isAdmin = user.role === 'admin' || isMasterUser;
  
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [appliedPayments, setAppliedPayments] = useState<PaymentRecord[]>([]);
  const [currentPayMethod, setCurrentPayMethod] = useState('Dinheiro');
  const [currentPayAmount, setCurrentPayAmount] = useState(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [f12Client, setF12Client] = useState('');
  const [f12Desc, setF12Desc] = useState('');
  const [f12Date, setF12Date] = useState('');
  const [installments, setInstallments] = useState(1);
  const [assignedVendedor, setAssignedVendedor] = useState(user.name);
  const [modalFluxo, setModalFluxo] = useState<'entrada' | 'retirada' | null>(null);
  const [authRequest, setAuthRequest] = useState<'entrada' | 'retirada' | null>(null);
  const [fluxoDesc, setFluxoDesc] = useState('');
  const [fluxoVal, setFluxoVal] = useState(0);
  const [receiptData, setReceiptData] = useState<Sale | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('percent');
  const [discountInput, setDiscountInput] = useState<number>(0);

  const filtered = useMemo(() => {
    const active = products.filter((p: Product) => p.active && p.stock > 0);
    if (!search) return active;
    const t = search.toLowerCase();
    return active.filter((p: Product) => 
      p.name.toLowerCase().includes(t) || 
      p.sku.toLowerCase().includes(t)
    );
  }, [products, search]);

  const getQualifyingCampaign = useCallback((productId: number) => {
    const now = new Date();
    return (campaigns || []).find((c: Campaign) => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end && c.productIds?.includes(productId);
    });
  }, [campaigns]);

  const applyAutomaticCampaigns = useCallback((currentCart: SaleItem[]) => {
    let newCart = [...currentCart];
    
    newCart = newCart.map(item => ({ 
      ...item, 
      discountValue: 0, 
      campaignName: undefined, 
      campaignType: undefined 
    }));

    const activeXYCampaigns = (campaigns || []).filter((c: Campaign) => {
      const now = new Date();
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      end.setHours(23, 59, 59, 999);
      return c.type === 'buy_x_get_y' && now >= start && now <= end;
    });

    activeXYCampaigns.forEach((camp: Campaign) => {
      const qualifyingItems = newCart.filter(item => camp.productIds.includes(item.productId));
      const totalUnits = qualifyingItems.reduce((acc, item) => acc + item.quantity, 0);
      
      const leveY = camp.leveY || 1;
      const pagueX = camp.pagueX || 0;
      
      if (totalUnits >= leveY) {
        const freePerBundle = leveY - pagueX;
        const freeUnitsTotal = Math.floor(totalUnits / leveY) * freePerBundle;
        
        let allUnits: { cartId: string, price: number }[] = [];
        qualifyingItems.forEach(item => {
          for(let k = 0; k < item.quantity; k++) {
            allUnits.push({ cartId: item.cartId, price: item.price });
          }
        });

        allUnits.sort((a, b) => a.price - b.price);
        
        const unitsToDiscount = allUnits.slice(0, freeUnitsTotal);
        
        unitsToDiscount.forEach(unit => {
          const cartIdx = newCart.findIndex(it => it.cartId === unit.cartId);
          if (cartIdx !== -1) {
            newCart[cartIdx].discountValue += unit.price;
            newCart[cartIdx].campaignName = camp.name;
            newCart[cartIdx].campaignType = 'buy_x_get_y';
          }
        });
      }
    });

    newCart = newCart.map(item => {
      if (item.campaignType) return item; 
      const camp = getQualifyingCampaign(item.productId);
      if (camp && camp.type === 'percentage') {
        const disc = (item.price * item.quantity) * (camp.discountPercent / 100);
        return { ...item, discountValue: disc, campaignName: camp.name, campaignType: 'percentage' };
      }
      return item;
    });

    return newCart;
  }, [campaigns, getQualifyingCampaign]);

  const addDirectly = useCallback((p: Product) => {
    const totalInCart = cart.filter(item => item.productId === p.id).reduce((acc, item) => acc + item.quantity, 0);
    if (totalInCart + 1 > p.stock) {
        alert('Estoque insuficiente para este produto!');
        return;
    }

    const newItem: SaleItem = { 
      cartId: Math.random().toString(36).substr(2, 9),
      productId: p.id, 
      name: p.name, 
      sku: p.sku,
      quantity: 1,
      price: p.price,
      size: p.size,
      color: p.color,
      discountValue: 0,
      manualDiscountValue: 0
    };

    const updatedCart = applyAutomaticCampaigns([...cart, newItem]);
    setCart(updatedCart);
    setSelectedId(''); 
    setSearch(''); 
    setTimeout(() => searchInputRef.current?.focus(), 10);
  }, [cart, applyAutomaticCampaigns]);

  const updateQuantity = (cartId: string, delta: number) => {
    const item = cart.find(i => i.cartId === cartId);
    if (!item) return;
    
    const prod = products.find((p: Product) => p.id === item.productId);
    if (!prod) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      const updated = applyAutomaticCampaigns(cart.filter(i => i.cartId !== cartId));
      setCart(updated);
      return;
    }

    if (delta > 0) {
       const totalInCart = cart.filter(i => i.productId === item.productId).reduce((acc, it) => acc + it.quantity, 0);
       if (totalInCart + 1 > prod.stock) return alert('Limite de estoque!');
    }

    const updatedItems = cart.map(i => i.cartId === cartId ? { ...i, quantity: newQty } : i);
    setCart(applyAutomaticCampaigns(updatedItems));
  };

  const removeFromCart = (cartId: string) => {
    setCart(applyAutomaticCampaigns(cart.filter(i => i.cartId !== cartId)));
  };

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length >= 3) {
      const match = products.find((p: Product) => p.active && p.sku.toLowerCase() === trimmed.toLowerCase());
      if (match) { addDirectly(match); }
    }
  }, [search, products, addDirectly]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, i) => acc + (i.price * i.quantity) - i.discountValue - i.manualDiscountValue, 0);
  }, [cart]);
  
  const globalDiscountValue = useMemo(() => {
    const inputVal = Number(discountInput) || 0;
    const limit = isAdmin ? 100 : settings.maxGlobalDiscount;
    if (discountType === 'percent') {
      const clampedPercent = Math.min(inputVal, limit);
      return subtotal * (clampedPercent / 100);
    }
    const clampedValue = Math.min(inputVal, subtotal * (limit / 100));
    return clampedValue;
  }, [subtotal, discountInput, discountType, settings.maxGlobalDiscount, isAdmin]);

  const totalCartBeforeCredit = Math.max(0, subtotal - globalDiscountValue);
  const creditToUse = Math.min(totalCartBeforeCredit, exchangeCredit);
  const remainingExchangeCredit = Math.max(0, exchangeCredit - creditToUse);
  const totalFinalToPay = Math.max(0, totalCartBeforeCredit - exchangeCredit);
  
  const totalPaid = appliedPayments.reduce((acc, p) => acc + p.amount, 0);
  const remainingBalanceToSettle = Math.max(0, totalFinalToPay - totalPaid);
  const changeValue = Math.max(0, totalPaid - totalFinalToPay);

  useEffect(() => {
    setCurrentPayAmount(parseFloat(remainingBalanceToSettle.toFixed(2)));
  }, [totalFinalToPay, totalPaid, remainingBalanceToSettle]);

  const calculatedInstallment = useMemo(() => {
    if (currentPayMethod !== 'C. Parcelado' || installments < 1) return currentPayAmount;
    const totalWithInterest = currentPayAmount * (1 + (settings.cardFees.creditInstallments / 100));
    return totalWithInterest / installments;
  }, [currentPayAmount, currentPayMethod, installments, settings.cardFees.creditInstallments]);

  const handleFinish = () => {
    if (cart.length === 0) return;
    const isVip = appliedPayments.some(p => p.method === 'Voucher VIP');
    if (totalPaid < totalFinalToPay - 0.01 && totalFinalToPay > 0 && !isVip) {
      alert(`Pendente de recebimento: R$ ${remainingBalanceToSettle.toFixed(2)}`);
      return;
    }
    
    const totalDiscountRecorded = cart.reduce((acc, i) => acc + i.discountValue + i.manualDiscountValue, 0) + globalDiscountValue;
    const initialBruto = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const sale: Sale = { 
      id: Date.now(), 
      date: new Date().toISOString(), 
      subtotal: initialBruto, 
      discount: totalDiscountRecorded, 
      discountPercent: initialBruto > 0 ? (totalDiscountRecorded / initialBruto) * 100 : 0,
      total: isVip ? 0 : totalFinalToPay, 
      payments: [...appliedPayments], 
      user: assignedVendedor, 
      adminUser: user.name, 
      items: [...cart], 
      change: changeValue,
      exchangeCreditUsed: creditToUse
    };
    setSales((prev: any) => [sale, ...prev]);

    // Lógica para registrar o registro de pagamento (F12)
    const f12Payments = appliedPayments.filter(p => p.method === 'F12');
    if (f12Payments.length > 0) {
       const newFiados: FiadoRecord[] = f12Payments.map(p => ({
          id: Math.random().toString(36).substr(2, 9),
          saleId: sale.id,
          clientName: p.f12ClientName || 'Desconhecido',
          description: p.f12Description || 'Sem observação',
          totalAmount: p.amount,
          remainingAmount: p.amount,
          createdAt: new Date().toISOString(),
          dueDate: p.f12DueDate || new Date().toISOString(),
          vendedor: assignedVendedor,
          status: 'pending',
          items: [...cart]
       }));
       setFiados((prev: FiadoRecord[]) => [...newFiados, ...prev]);
    }

    // Atualizar Estoque
    setProducts(products.map((p: Product) => {
      const items = cart.filter(i => i.productId === p.id);
      const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);
      return totalQty > 0 ? { ...p, stock: p.stock - totalQty } : p;
    }));

    // Registrar Movimentações
    setMovements((prev: any) => [...cart.map(i => ({
      id: Math.random(), productId: i.productId, productName: i.name, type: 'saida', quantity: i.quantity, reason: 'Venda PDV', date: new Date().toISOString(), user: assignedVendedor
    })), ...prev]);

    // Atualizar Uso de Vouchers
    const voucherPayments = appliedPayments.filter(p => (p.method === 'Voucher' || p.method === 'Voucher VIP') && p.voucherCode);
    if (voucherPayments.length > 0) {
        setCampaigns((prev: Campaign[]) => prev.map(c => {
            const hasVoucherInSale = voucherPayments.some(vp => vp.voucherCode === c.voucherCode);
            if (hasVoucherInSale && c.type === 'voucher') {
                return { ...c, voucherQuantity: (c.voucherQuantity || 1) - 1 };
            }
            return c;
        }));
    }

    const cashPaid = appliedPayments.filter(p => p.method === 'Dinheiro').reduce((acc, p) => acc + p.amount, 0) - changeValue;
    if (cashPaid !== 0 && (cashSession || isMasterUser)) {
      const newLog: CashLog = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'venda',
        amount: Math.abs(cashPaid),
        description: `Venda #${sale.id.toString().slice(-4)}`,
        time: new Date().toISOString(),
        user: assignedVendedor
      };
      if (cashSession) {
          setCashSession((prev: CashSession) => ({
            ...prev,
            currentBalance: prev.currentBalance + cashPaid,
            logs: [newLog, ...prev.logs]
          }));
      }
    }
    
    // Abrir modal de ticket e limpar carrinho
    setReceiptData(sale);
    setCart([]); 
    setAppliedPayments([]); 
    setDiscountInput(0); 
    setExchangeCredit(remainingExchangeCredit);
  };

  const validateVoucher = () => {
    const code = voucherCodeInput.trim().toUpperCase();
    if (!code) return;

    const voucher = campaigns.find((c: Campaign) => c.type === 'voucher' && c.voucherCode === code && c.active);
    
    if (!voucher) {
        alert('Código de voucher inválido ou não encontrado.');
        return;
    }

    const now = new Date();
    const start = new Date(voucher.startDate);
    const end = new Date(voucher.endDate);
    end.setHours(23, 59, 59, 999);

    if (now < start || now > end) {
        alert('Este voucher está fora do período de validade.');
        return;
    }

    if ((voucher.voucherQuantity || 0) <= 0) {
        alert('Este voucher atingiu o limite máximo de utilizações.');
        return;
    }

    // Voucher Válido!
    const valueToApply = Math.min(remainingBalanceToSettle, voucher.voucherValue || 0);
    setCurrentPayAmount(valueToApply);
    alert(`Voucher "${voucher.name}" validado! R$ ${formatCurrency(valueToApply)} pronto para lançar.`);
  };

  const addPayment = () => {
    if (currentPayAmount <= 0 && currentPayMethod !== 'Voucher VIP') return;
    
    if (currentPayMethod === 'Voucher VIP') {
        const fullRemaining = remainingBalanceToSettle;
        setAppliedPayments([...appliedPayments, { 
          method: 'Voucher VIP', 
          amount: fullRemaining,
          netAmount: 0,
          voucherCode: 'VIP_INTERNAL'
        }]);
        setCurrentPayAmount(0);
        return;
    }

    if (currentPayMethod === 'F12') {
       if (!f12Client.trim()) {
          alert('Por favor, informe o nome do cliente para o registro F12.');
          return;
       }
    }

    let net = currentPayAmount;
    if (currentPayMethod === 'C. Débito') net = currentPayAmount * (1 - settings.cardFees.debit / 100);
    else if (currentPayMethod === 'C. Crédito') net = currentPayAmount * (1 - settings.cardFees.credit1x / 100);
    else if (currentPayMethod === 'C. Parcelado') net = currentPayAmount * (1 - settings.cardFees.creditInstallments / 100);
    else if (currentPayMethod === 'F12') net = 0; // Faturamento postergado
    
    setAppliedPayments([...appliedPayments, { 
      method: currentPayMethod, 
      amount: currentPayAmount,
      installments: currentPayMethod === 'C. Parcelado' ? installments : undefined,
      installmentValue: currentPayMethod === 'C. Parcelado' ? calculatedInstallment : undefined,
      netAmount: parseFloat(net.toFixed(2)),
      voucherCode: currentPayMethod === 'Voucher' ? voucherCodeInput.trim().toUpperCase() : undefined,
      f12ClientName: currentPayMethod === 'F12' ? f12Client.trim().toUpperCase() : undefined,
      f12Description: currentPayMethod === 'F12' ? f12Desc.trim() : undefined,
      f12DueDate: currentPayMethod === 'F12' ? f12Date : undefined
    }]);

    // Limpar campos F12
    setF12Client('');
    setF12Desc('');
    setF12Date('');
    setInstallments(1);
    setCurrentPayAmount(0);
    setVoucherCodeInput('');
  };

  const removePayment = (index: number) => {
    setAppliedPayments(prev => prev.filter((_, i) => i !== index));
  };

  const requestFluxo = (type: 'entrada' | 'retirada') => {
    if (type === 'entrada' || isAdmin) {
      setModalFluxo(type);
    } else {
      setAuthRequest(type);
    }
  };

  const handleAuthorization = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const userOrEmail = (form.elements.namedItem('authUser') as HTMLInputElement).value;
    const pass = (form.elements.namedItem('authPass') as HTMLInputElement).value;
    const isAuthMaster = userOrEmail === 'master' && pass === '965088';
    const authAdmin = vendedores.find((v: User) => (v.email === userOrEmail || v.name === userOrEmail) && v.password === pass && v.role === 'admin');
    if (isAuthMaster || authAdmin) {
      setModalFluxo(authRequest);
      setAuthRequest(null);
    } else {
      alert('Credenciais de Administrador inválidas!');
    }
  };

  const creditBalanceResult = exchangeCredit - totalCartBeforeCredit;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
         <h2 className="text-xl font-black text-slate-900 tracking-tighter italic uppercase">Caixa - Painel de Vendas</h2>
         <div className="flex items-center gap-3">
            {exchangeCredit > 0 && (
              <div className={`${creditBalanceResult >= 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'} px-4 py-1.5 rounded-lg border flex items-center gap-2 animate-pulse shadow-sm`}>
                <RotateCcw size={14} />
                <span className="text-xs font-black uppercase">
                  {creditBalanceResult >= 0 
                    ? `CRÉDITO RESTANTE: R$ ${creditBalanceResult.toFixed(2)}` 
                    : `PENDENTE: R$ ${Math.abs(creditBalanceResult).toFixed(2)}`}
                </span>
                <button onClick={() => setExchangeCredit(0)} className="ml-1 hover:opacity-70 transition-opacity"><X size={14}/></button>
              </div>
            )}
            <div className="bg-slate-950 text-white px-4 py-1.5 rounded-lg shadow-lg border border-slate-800 flex items-center gap-2">
               <Wallet size={14} className="text-indigo-400"/>
               <span className="text-base font-black font-mono">R$ {cashSession?.currentBalance?.toFixed(2) || '0.00'}</span>
            </div>
            {(cashSession || isMasterUser) && (
              <div className="flex gap-1">
                 <button type="button" onClick={() => requestFluxo('entrada')} className="bg-white border border-slate-200 p-2 rounded-lg text-green-600 hover:bg-green-50 transition-all shadow-sm" title="Entrada de Caixa"><ArrowUpCircle size={18}/></button>
                 <button type="button" onClick={() => requestFluxo('retirada')} className="bg-white border border-slate-200 p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all shadow-sm" title="Sangria de Caixa"><ArrowDownCircle size={18}/></button>
              </div>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
        <div className="lg:col-span-8 flex flex-col gap-3 min-h-0">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <div className="flex gap-3">
              <div className="flex-[5] space-y-0.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">BUSCAR</label>
                <div className="relative group">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input ref={searchInputRef} type="text" placeholder="Nome ou SKU..." className="w-full border rounded-lg pl-9 pr-3 py-2 bg-slate-50 text-slate-800 outline-none focus:border-indigo-500 transition-all font-bold text-[11px]" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                </div>
              </div>
              <div className="flex-[7] space-y-0.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">SELECIONAR</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-slate-50 text-slate-800 font-bold outline-none focus:border-indigo-500 transition-all text-[11px] cursor-pointer" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                  <option value="">Lista de itens...</option>
                  {filtered.map((p: Product) => (<option key={p.id} value={p.id}>[{p.sku}] {p.name} - R$ {formatCurrency(p.price)}</option>))}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => { const p = products.find((x: Product) => x.id === Number(selectedId)); if (p) addDirectly(p); }} className="px-8 py-2 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest shadow active:scale-95 h-[34px]">OK</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-1.5"><ShoppingCart size={12} className="text-indigo-600"/>CHECKOUT</h3>
               <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{cart.length} itens</span>
            </div>
            <div className="flex-1 overflow-auto custom-scroll">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-slate-50 sticky top-0 z-10 text-[8px] font-black text-slate-400 uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-4 py-2">ITEM</th>
                    <th className="px-4 py-2 text-center">UN</th>
                    <th className="px-4 py-2 text-right">PREÇO</th>
                    <th className="px-4 py-2 text-center">DESC. AUTO</th>
                    <th className="px-4 py-2 text-center">DESC. ITEM</th>
                    <th className="px-4 py-2 text-right">TOTAL</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <tr key={item.cartId} className="hover:bg-slate-50 transition-all group">
                      <td className="px-4 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[11px] leading-tight">{item.name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] font-black text-indigo-600 uppercase font-mono">{item.sku}</span>
                            {(item.size || item.color) && (
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                                • {item.size ? `TAM: ${item.size}` : ''} {item.color ? ` / COR: ${item.color}` : ''}
                              </span>
                            )}
                          </div>
                          {item.campaignName && (
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md w-fit mt-1 uppercase italic shadow-sm animate-in zoom-in ${item.campaignType === 'buy_x_get_y' ? 'bg-indigo-100 text-indigo-700' : item.campaignType === 'percentage' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                                {item.campaignType === 'buy_x_get_y' ? 'Promo Leve+' : item.campaignType === 'percentage' ? 'Promo' : 'Cupom'}: {item.campaignName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-100 rounded-md p-0.5 w-fit mx-auto">
                           <button onClick={() => updateQuantity(item.cartId, -1)} className="p-0.5 hover:text-red-500 transition-colors"><ChevronLeft size={14}/></button>
                           <span className="font-black text-slate-600 text-[11px] min-w-[12px] text-center">{item.quantity}</span>
                           <button onClick={() => updateQuantity(item.cartId, 1)} className="p-0.5 hover:text-indigo-600 transition-colors"><ChevronRight size={14}/></button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[10px] text-slate-400">R$ {formatCurrency(item.price)}</td>
                      <td className="px-4 py-2 text-center">
                         <span className={`text-[10px] font-black font-mono ${item.discountValue > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                           - R$ {formatCurrency(item.discountValue)}
                         </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="relative w-20 mx-auto">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300">R$</span>
                          <input 
                            type="text"
                            className="w-full border rounded px-5 py-1 text-[10px] font-black font-mono text-center outline-none focus:border-red-400 bg-slate-50/50"
                            value={formatCurrency(item.manualDiscountValue || 0)}
                            onChange={(e) => {
                              const val = parseCurrency(e.target.value);
                              // Regra de política de desconto por item
                              const maxPercent = isAdmin ? 100 : settings.maxGlobalDiscount;
                              const itemTotalBase = (item.price * item.quantity) - item.discountValue;
                              const maxDiscountVal = itemTotalBase * (maxPercent / 100);
                              const clampedVal = Math.min(val, maxDiscountVal);
                              
                              setCart(prev => prev.map(it => it.cartId === item.cartId ? { ...it, manualDiscountValue: clampedVal } : it));
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right"><span className="font-black text-slate-900 font-mono text-[11px]">R$ {formatCurrency((item.price * item.quantity) - item.discountValue - item.manualDiscountValue)}</span></td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => removeFromCart(item.cartId)} className="p-1 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-3 min-0">
          <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200 flex flex-col h-full overflow-hidden">
            <h3 className="text-[11px] font-black text-slate-800 mb-3 flex items-center gap-2 border-b pb-2 uppercase tracking-tighter italic"><ReceiptText size={14} className="text-indigo-600" /> RESUMO</h3>
            <div className="space-y-4 flex-1 overflow-auto custom-scroll pr-1">
              <div className="bg-slate-950 p-4 rounded-xl text-white relative overflow-hidden shadow-xl">
                 <div className="relative z-10 space-y-2">
                   <div className="flex justify-between items-center opacity-40">
                      <span className="text-[8px] font-black uppercase">SUBTOTAL (C/ DESC. ITENS)</span>
                      <span className="text-[9px] font-mono font-black">R$ {formatCurrency(subtotal)}</span>
                   </div>
                   {creditToUse > 0 && (
                     <div className="flex justify-between items-center border-t border-white/10 pt-1">
                       <span className="text-[8px] font-black uppercase text-amber-400">CRÉDITO UTILIZADO</span>
                       <span className="text-[9px] font-mono font-black text-amber-400">- R$ {formatCurrency(creditToUse)}</span>
                     </div>
                   )}
                   <div className="space-y-1 pt-1 border-t border-slate-800">
                      <label className="text-[8px] font-black text-indigo-400 uppercase">DESCONTO GERAL</label>
                      <div className="flex items-center gap-1.5">
                         <div className="flex bg-slate-900 rounded-md overflow-hidden border border-slate-800">
                            <button type="button" onClick={() => setDiscountType('percent')} className={`px-1.5 py-1 text-[9px] ${discountType === 'percent' ? 'bg-indigo-600' : 'text-slate-500'}`}><Percent size={10}/></button>
                            <button type="button" onClick={() => setDiscountType('value')} className={`px-1.5 py-1 text-[9px] ${discountType === 'value' ? 'bg-indigo-600' : 'text-slate-500'}`}><DollarSign size={10}/></button>
                         </div>
                         <div className="relative flex-1">
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-mono mr-1">{discountType === 'percent' ? '%' : 'R$'}</span>
                            <input 
                              type="text" 
                              onFocus={(e) => e.target.select()} 
                              className="w-full bg-transparent border-b border-slate-800 outline-none text-red-400 font-black text-sm pr-4 text-right font-mono" 
                              value={discountType === 'value' ? formatCurrency(discountInput) : discountInput} 
                              onChange={e => {
                                if (discountType === 'value') {
                                  setDiscountInput(parseCurrency(e.target.value));
                                } else {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setDiscountInput(Number(val));
                                }
                              }} 
                            />
                         </div>
                      </div>
                   </div>
                   <div className="flex justify-between items-end pt-1 border-b border-slate-800 pb-2">
                      <span className="text-[8px] font-black uppercase text-indigo-300">TOTAL FINAL</span>
                      <span className="text-2xl font-black text-white font-mono">R$ {formatCurrency(totalFinalToPay)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-2 mt-1 bg-white/5 p-2 rounded-lg">
                      <span className="text-[9px] font-black uppercase text-amber-400">TROCO</span>
                      <span className="text-xl font-black text-amber-500 font-mono italic">R$ {formatCurrency(changeValue)}</span>
                   </div>
                 </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">VENDEDOR RESPONSÁVEL</label>
                  <select className="w-full border rounded-lg px-2.5 py-2 bg-slate-50 text-slate-800 font-black text-[10px] uppercase cursor-pointer focus:border-indigo-500 outline-none transition-all" value={assignedVendedor} onChange={e => setAssignedVendedor(e.target.value)}>
                    {vendedores.map((v: User) => (<option key={v.id} value={v.name}>{v.name}</option>))}
                    {user.id === 0 && !vendedores.find((v: User) => v.name === user.name) && (<option value={user.name}>{user.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-400 uppercase ml-1">FORMA DE PAGAMENTO</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <select className="w-full border rounded-lg px-2.5 py-2 bg-slate-50 text-slate-800 font-black text-[10px] uppercase cursor-pointer focus:border-indigo-500 outline-none transition-all" value={currentPayMethod} onChange={e => {
                        const val = e.target.value;
                        setCurrentPayMethod(val);
                        if (val === 'Voucher VIP' || val === 'F12') setCurrentPayAmount(remainingBalanceToSettle);
                    }}>
                      <option>Dinheiro</option><option>Pix</option><option>C. Débito</option><option>C. Crédito</option><option>C. Parcelado</option><option>Voucher</option><option>Voucher VIP</option>
                      {isAdmin && <option value="F12">F12</option>}
                    </select>

                    {currentPayMethod === 'Voucher' && (
                        <div className="animate-in fade-in slide-in-from-top-1 bg-amber-50 p-3 rounded-lg border border-amber-200 space-y-2">
                            <label className="text-[8px] font-black uppercase text-amber-600">Código do Voucher</label>
                            <div className="flex gap-1.5">
                                <input 
                                    type="text" 
                                    placeholder="Ex: CUPOM10"
                                    className="flex-1 border rounded-md px-2 py-1.5 text-[10px] font-black uppercase bg-white outline-none focus:border-amber-400"
                                    value={voucherCodeInput}
                                    onChange={e => setVoucherCodeInput(e.target.value.toUpperCase())}
                                />
                                <button type="button" onClick={validateVoucher} className="bg-amber-600 text-white px-3 py-1.5 rounded-md font-black text-[9px] uppercase hover:bg-amber-700">Validar</button>
                            </div>
                        </div>
                    )}

                    {currentPayMethod === 'F12' && (
                        <div className="animate-in fade-in slide-in-from-top-1 bg-indigo-50 p-3 rounded-lg border border-indigo-200 space-y-2">
                           <div>
                              <label className="text-[8px] font-black uppercase text-indigo-600">Nome do Cliente</label>
                              <input 
                                type="text" 
                                placeholder="CLIENTE AMIGO"
                                className="w-full border rounded-md px-2 py-1.5 text-[10px] font-black uppercase bg-white outline-none focus:border-indigo-400 mt-0.5"
                                value={f12Client}
                                onChange={e => setF12Client(e.target.value.toUpperCase())}
                              />
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                              <div>
                                 <label className="text-[8px] font-black uppercase text-indigo-600">Vencimento</label>
                                 <input 
                                    type="date" 
                                    className="w-full border rounded-md px-2 py-1 text-[10px] font-black bg-white outline-none focus:border-indigo-400 mt-0.5"
                                    value={f12Date}
                                    onChange={e => setF12Date(e.target.value)}
                                 />
                              </div>
                              <div>
                                 <label className="text-[8px] font-black uppercase text-indigo-600">Condições/Desc.</label>
                                 <input 
                                    type="text" 
                                    placeholder="Ex: 2x no mês"
                                    className="w-full border rounded-md px-2 py-1 text-[10px] font-black bg-white outline-none focus:border-indigo-400 mt-0.5"
                                    value={f12Desc}
                                    onChange={e => setF12Desc(e.target.value)}
                                 />
                              </div>
                           </div>
                        </div>
                    )}

                    {currentPayMethod === 'C. Parcelado' && (
                      <div className="animate-in fade-in slide-in-from-top-1 space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between">
                              <label className="text-[8px] font-black uppercase text-slate-400">Parcelas</label>
                              <input type="number" min="1" max="12" onFocus={(e) => e.target.select()} className="w-14 border rounded px-1.5 py-0.5 text-[11px] text-center font-black" value={installments} onChange={e => setInstallments(Math.min(12, Math.max(1, Number(e.target.value))))} />
                          </div>
                          <div className="text-center pt-0.5 border-t border-slate-100">
                              <p className="text-[9px] font-black text-indigo-600 leading-none">{installments}x R$ {formatCurrency(calculatedInstallment)}</p>
                              <p className="text-[7px] text-slate-400 italic">Taxa: {settings.cardFees.creditInstallments}%</p>
                          </div>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">R$</span>
                        <input 
                          type="text" 
                          onFocus={(e) => e.target.select()} 
                          className="w-full border rounded-lg pl-7 pr-2.5 py-2 bg-slate-50 text-slate-800 font-black text-[11px] text-right font-mono focus:border-indigo-500 outline-none transition-all" 
                          value={formatCurrency(currentPayAmount)} 
                          onChange={e => setCurrentPayAmount(parseCurrency(e.target.value))} 
                        />
                      </div>
                      <button type="button" onClick={addPayment} className={`px-3 ${(currentPayMethod === 'Voucher VIP' || currentPayMethod === 'F12') ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg active:scale-90 flex items-center justify-center shadow transition-all`} title={currentPayMethod === 'Voucher VIP' ? 'Aplicar VIP' : 'Adicionar Pagamento'}><Plus size={16}/></button>
                    </div>
                    {appliedPayments.length > 0 && (
                      <div className="mt-3 bg-indigo-50/50 p-3 rounded-xl border border-dashed border-indigo-200 space-y-2 animate-in fade-in">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Wallet size={10} /> Pagamentos Lançados
                        </p>
                        <div className="space-y-1.5">
                          {appliedPayments.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-indigo-50 group">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-black text-slate-700 uppercase truncate">
                                    {p.method} {p.voucherCode && p.method !== 'Voucher VIP' ? `(${p.voucherCode})` : ''}
                                    {p.method === 'F12' ? ` (${p.f12ClientName})` : ''}
                                </span>
                                {p.installments && <span className="text-[7px] text-slate-400 font-bold">{p.installments}x de R$ {formatCurrency(p.installmentValue || 0)}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className={`text-[10px] font-black font-mono ${(p.method === 'Voucher VIP' || p.method === 'F12') ? 'text-purple-600' : p.method === 'Voucher' ? 'text-amber-600' : 'text-indigo-600'}`}>R$ {formatCurrency(p.amount)}</span>
                                <button type="button" onClick={() => removePayment(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5 hover:bg-red-50 rounded">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleFinish} 
              disabled={((totalFinalToPay > 0 && totalPaid < totalFinalToPay - 0.01 && !appliedPayments.some(p => p.method === 'Voucher VIP'))) || cart.length === 0} 
              className={`w-full py-3 rounded-lg font-black text-xs shadow-lg transition-all uppercase tracking-[0.2em] mt-3 active:scale-95 ${(((totalFinalToPay > 0 && totalPaid < totalFinalToPay - 0.01 && !appliedPayments.some(p => p.method === 'Voucher VIP'))) || cart.length === 0) ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE TICKET / CONFIRMAÇÃO */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-[150] backdrop-blur-sm animate-in fade-in no-print-overlay">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 overflow-hidden">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full mx-auto flex items-center justify-center border border-green-100">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase italic">Venda Concluída!</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Os dados foram lançados com sucesso no sistema.</p>
             </div>

             <div id="printable-receipt" className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-2xl font-mono text-[11px] text-slate-700 space-y-4 shadow-inner">
                <div className="text-center space-y-1">
                    <p className="font-black text-base italic leading-none">{settings.storeName || 'SCARD SYS'}</p>
                    <p className="text-[9px] uppercase tracking-[0.2em] opacity-60">{settings.storeTagline || 'ENTERPRISE SOLUTION'}</p>
                    <p className="text-[8px] opacity-40">{settings.storeAddress || 'Rua da Moda, 123 - Centro'}</p>
                    {settings.storeCnpj && <p className="text-[8px] opacity-40">CNPJ: {settings.storeCnpj}</p>}
                </div>
                
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold">
                    <span>CUPOM: #{receiptData.id.toString().slice(-6)}</span>
                    <span>{new Date(receiptData.date).toLocaleDateString()} {new Date(receiptData.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-1">
                        <span>DESCRIÇÃO</span>
                        <span>TOTAL</span>
                    </div>
                    {receiptData.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start leading-tight">
                            <span className="flex-1 pr-4 uppercase">
                                {it.quantity}x {it.name}
                                {it.size && <span className="text-[8px] block text-slate-400">TAM: {it.size} | COR: {it.color}</span>}
                            </span>
                            <span className="font-black">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                    <div className="flex justify-between text-slate-500">
                        <span>SUBTOTAL</span>
                        <span>R$ {formatCurrency(receiptData.subtotal)}</span>
                    </div>
                    {receiptData.discount > 0 && (
                        <div className="flex justify-between text-red-500 font-bold">
                            <span>DESCONTO GERAL</span>
                            <span>- R$ {formatCurrency(receiptData.discount)}</span>
                        </div>
                    )}
                    {receiptData.exchangeCreditUsed && receiptData.exchangeCreditUsed > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>CRÉDITO TROCA</span>
                            <span>- R$ {formatCurrency(receiptData.exchangeCreditUsed)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-300 pt-1 mt-1">
                        <span>TOTAL PAGO</span>
                        <span>R$ {formatCurrency(receiptData.total)}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase">FORMA(S) DE PAGAMENTO:</p>
                    {receiptData.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{p.method} {p.installments ? `(${p.installments}x)` : ''}{p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span>
                            <span className="font-bold">R$ {formatCurrency(p.amount)}</span>
                        </div>
                    ))}
                    {receiptData.change > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>TROCO</span>
                            <span>R$ {formatCurrency(receiptData.change)}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-slate-200 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">VENDEDOR:</p>
                    <p className="text-[10px] font-bold uppercase">{receiptData.user}</p>
                    <p className="text-[8px] mt-4 opacity-40">Obrigado pela preferência!</p>
                </div>
             </div>

             <div className="flex gap-3 pt-2">
                <button 
                    onClick={() => { setReceiptData(null); setTimeout(() => searchInputRef.current?.focus(), 100); }} 
                    className="flex-1 px-4 py-4 border-2 border-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                >
                    Fechar
                </button>
                <button 
                    onClick={() => { window.print(); setReceiptData(null); setTimeout(() => searchInputRef.current?.focus(), 100); }} 
                    className="flex-[2] px-4 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <Printer size={18} />
                    Confirmar & Imprimir
                </button>
             </div>
          </div>
        </div>
      )}

      {authRequest && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[120] backdrop-blur-md animate-in fade-in">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center border border-amber-100"><ShieldAlert size={32} /></div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic">Autorização Necessária</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Operação restrita a administradores.</p>
            </div>
            <form onSubmit={handleAuthorization} className="space-y-4">
              <input name="authUser" type="text" placeholder="Usuário ou 'master'" className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:border-indigo-500" required autoFocus />
              <input name="authPass" type="password" placeholder="Senha" className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold bg-slate-50 outline-none focus:border-indigo-500" required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setAuthRequest(null)} className="flex-1 px-4 py-3 border-2 border-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-xl">Validar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalFluxo && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[110] backdrop-blur-md animate-in fade-in">
          <form onSubmit={(e) => {
             e.preventDefault();
             if (fluxoVal <= 0) return alert('Valor inválido!');
             const amt = modalFluxo === 'retirada' ? -fluxoVal : fluxoVal;
             const log: CashLog = { id: Math.random().toString(36).substr(2, 9), type: modalFluxo, amount: fluxoVal, description: fluxoDesc || (modalFluxo === 'retirada' ? 'Sangria manual' : 'Entrada manual'), time: new Date().toISOString(), user: user.name };
             setCashSession((prev: CashSession) => ({ ...prev, currentBalance: prev.currentBalance + amt, logs: [log, ...prev.logs] }));
             setModalFluxo(null); setFluxoVal(0); setFluxoDesc('');
          }} className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-8 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center border-b border-slate-100 pb-4">
               <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
                {modalFluxo === 'retirada' ? 'Sangria de Caixa' : 'Entrada de Caixa'}
               </h3>
               <button type="button" onClick={() => setModalFluxo(null)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={24}/></button>
             </div>
             <div className="space-y-6">
                <div className="relative group">
                   <div className="absolute inset-0 bg-indigo-600/5 rounded-2xl border-2 border-indigo-600/20 group-focus-within:border-indigo-600 group-focus-within:bg-indigo-600/10 transition-all"></div>
                   <div className="relative px-6 py-8 flex items-center gap-4">
                      <span className="text-xl font-black text-slate-400">R$</span>
                      <input 
                        type="text" 
                        className="flex-1 bg-transparent text-5xl font-black text-indigo-700 outline-none font-mono" 
                        value={formatCurrency(fluxoVal)} 
                        onChange={e => setFluxoVal(parseCurrency(e.target.value))} 
                        required autoFocus onFocus={(e) => e.target.select()}
                      />
                   </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <textarea 
                    className="w-full bg-transparent text-sm font-bold text-slate-600 outline-none h-32 resize-none placeholder:text-slate-400" 
                    placeholder="Digite o motivo ou observação..." 
                    value={fluxoDesc} 
                    onChange={e => setFluxoDesc(e.target.value)} 
                  />
                </div>
             </div>
             <button 
              type="submit" 
              className={`w-full py-5 rounded-2xl text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${modalFluxo === 'retirada' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' : 'bg-green-600 hover:bg-green-700 shadow-green-600/30'}`}
             >
                Confirmar Lançamento
             </button>
          </form>
        </div>
      )}
    </div>
  );
};

// --- ESTOQUE ---

const StockManagementView = ({ products, setProducts, categories }: any) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ cost: 0, price: 0, markup: 2.0, category: 'Sem Categoria', stock: 0, size: '', color: '' });
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');

  const sortedCategories = useMemo(() => { 
    return [...categories].sort((a, b) => { 
      if (a === 'Sem Categoria') return -1; 
      if (b === 'Sem Categoria') return 1; 
      return a.localeCompare(b); 
    }); 
  }, [categories]);

  const updatePrice = useCallback((cost: number, markup: number) => {
    const newPrice = parseFloat((cost * markup).toFixed(2));
    setForm((prev: any) => ({ ...prev, cost, markup, price: newPrice }));
  }, []);
  const updateMarkup = useCallback((cost: number, price: number) => {
    const newMarkup = cost > 0 ? parseFloat((price / cost).toFixed(4)) : 0;
    setForm((prev: any) => ({ ...prev, cost, price, markup: newMarkup }));
  }, []);
  const generateRandomSku = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    setForm({ ...form, sku: `${code}${randomLetters}` });
  };
  const handleClone = (p: Product) => {
    setForm({ ...p, id: undefined, sku: '' });
    setModal(true);
  };
  const save = (e: any) => {
    e.preventDefault();
    if (products.some((p: Product) => p.sku === form.sku && p.id !== form.id)) return alert('SKU duplicado!');
    const id = form.id || Date.now();
    const p = { ...form, id, active: true, price: Number(form.price) || 0, cost: Number(form.cost) || 0, markup: Number(form.markup) || 1, stock: Number(form.stock) || 0 };
    if (form.id) setProducts((prev: any) => prev.map((x: any) => x.id === id ? p : x));
    else setProducts((prev: any) => [...prev, p]);
    setModal(false); setForm({ cost: 0, price: 0, markup: 2.0, category: 'Sem Categoria', stock: 0, size: '', color: '' });
  };
  const filteredProducts = useMemo(() => {
    const t = search.toLowerCase();
    return products.filter((p: Product) => {
      const matchSearch = p.active && (p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t));
      const matchCategory = filterCategory === 'Todas' ? true : p.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, filterCategory]);
  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      {!modal && (
        <div className="flex justify-between items-center shrink-0 animate-in fade-in">
            <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Estoque</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Controle de mercadorias</p>
            </div>
            <button type="button" onClick={() => { setForm({stock: 0, cost: 0, price: 0, markup: 2.0, size: '', color: '', sku: '', category: 'Sem Categoria'}); setModal(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg active:scale-95 text-[10px] uppercase"><Plus size={16}/> Novo Cadastro</button>
        </div>
      )}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 shrink-0">
        <div className="relative group flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="SKU ou nome..." className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="bg-slate-50 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
               <option value="Todas">Categorias</option>
               {sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scroll">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-6 py-3">Produto</th>
                <th className="px-6 py-3">Categoria</th>
                <th className="px-6 py-3">Info</th>
                <th className="px-6 py-3 text-right">Venda</th>
                <th className="px-6 py-3 text-center">Qtd</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p: Product) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-xs">{p.name}</span>
                      <span className="text-[8px] font-black text-indigo-400 font-mono">{p.sku}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 text-[8px] font-black uppercase border">{p.category || 'Sem Categoria'}</span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col leading-tight">
                        {p.size && <span className="text-[12px] font-black text-slate-900 uppercase">TAM: {p.size}</span>}
                        {p.color && <span className="text-[12px] font-bold text-slate-600 mt-0.5">{p.color}</span>}
                        {!p.size && !p.color && <span className="text-[10px] text-slate-300">-</span>}
                     </div>
                  </td>
                  <td className="px-6 py-4 font-black text-slate-900 font-mono text-xs text-right">R$ {formatCurrency(p.price)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-4 py-1 rounded-xl text-[10px] font-black ${p.stock <= 5 ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>{p.stock}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleClone(p)} className="p-2 text-slate-400 hover:text-green-600" title="Clonar"><Copy size={14}/></button>
                      <button onClick={() => { setForm(p); setModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit size={14}/></button>
                      <button onClick={() => setProducts(products.filter((x: any) => x.id !== p.id))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[100] backdrop-blur-md animate-in fade-in">
          <form onSubmit={save} className="bg-white p-8 rounded-[2rem] w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scroll">
            <h3 className="text-xl font-black text-slate-900 uppercase italic border-b pb-4">{form.id ? 'Ajustar' : 'Novo'} Registro de Peça</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="md:col-span-2"><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Descrição Comercial</label><input placeholder="Ex: Camiseta Slim Masculina" className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">SKU / Referência</label><div className="flex gap-2"><input className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm font-mono" value={form.sku || ''} onChange={e => setForm({...form, sku: e.target.value})} required /><button type="button" onClick={generateRandomSku} className="bg-slate-100 p-3 rounded-xl hover:bg-slate-200"><RefreshCw size={16}/></button></div></div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Categoria</label><select className="w-full border-2 rounded-xl px-4 py-3 text-sm font-bold" value={form.category || 'Sem Categoria'} onChange={e => setForm({...form, category: e.target.value})} required>{sortedCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2"><div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Tamanho</label><input placeholder="P, M, G, 42..." className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold" value={form.size || ''} onChange={e => setForm({...form, size: e.target.value})} /></div><div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Cor / Estampa</label><input placeholder="Preto, Floral..." className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-bold" value={form.color || ''} onChange={e => setForm({...form, color: e.target.value})} /></div></div>
              <div className="grid grid-cols-3 gap-4 md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Custo (R$)</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">R$</span><input type="text" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl pl-7 pr-3 py-2 text-sm font-black" value={formatCurrency(form.cost || 0)} onChange={e => updatePrice(parseCurrency(e.target.value), form.markup)} /></div></div>
                <div><label className="text-[9px] font-black text-indigo-400 uppercase block mb-1">Markup</label><input type="number" step="0.1" onFocus={(e) => e.target.select()} className="w-full border-2 border-indigo-100 rounded-xl px-3 py-2 text-sm font-black text-indigo-700" value={form.markup || 0} onChange={e => updatePrice(form.cost, Number(e.target.value))} /></div>
                <div><label className="text-[9px] font-black text-green-600 uppercase block mb-1">Venda (R$)</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">R$</span><input type="text" onFocus={(e) => e.target.select()} className="w-full border-2 border-green-100 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-green-700" value={formatCurrency(form.price || 0)} onChange={e => updateMarkup(form.cost, parseCurrency(e.target.value))} /></div></div>
              </div>
              <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Qtd em Estoque</label><input type="number" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl px-4 py-2.5 text-sm font-black text-center" value={form.stock || 0} onChange={e => setForm({...form, stock: Number(e.target.value)})} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t mt-4"><button type="button" onClick={() => setModal(false)} className="px-5 py-2 text-slate-400 font-black uppercase text-[10px] tracking-widest">DESCARTAR</button><button type="submit" className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95">SALVAR ALTERAÇÕES</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE DASHBOARD ---

const DashboardViewComponent = ({ products, sales, cashSession, fiados, cashHistory }: any) => {
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day');
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [commBase, setCommBase] = useState(() => Number(localStorage.getItem('dash_comm_base')) || 1);
  const [commPremium, setCommPremium] = useState(() => Number(localStorage.getItem('dash_comm_prem')) || 2);
  const [commThreshold, setCommThreshold] = useState(() => Number(localStorage.getItem('dash_comm_thresh')) || 20000);
  useEffect(() => {
    localStorage.setItem('dash_comm_base', commBase.toString());
    localStorage.setItem('dash_comm_prem', commPremium.toString());
    localStorage.setItem('dash_comm_thresh', commThreshold.toString());
  }, [commBase, commPremium, commThreshold]);

  const filteredSales = useMemo(() => {
    return sales.filter((s: Sale) => {
      const d = new Date(s.date);
      if (period === 'day') {
        const [y, m, day] = selectedDay.split('-').map(Number);
        return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
      }
      if (period === 'month') {
        const [y, m] = selectedMonth.split('-').map(Number);
        return d.getFullYear() === y && (d.getMonth() + 1) === m;
      }
      if (period === 'year') {
        return d.getFullYear() === Number(selectedYear);
      }
      return true;
    });
  }, [sales, period, selectedDay, selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    let totals = { total: 0, cash: 0, pix: 0, card: 0, voucher: 0, voucherVip: 0, f12: 0, count: 0 };
    let productsCount: Record<number, { name: string, qty: number, size?: string, color?: string }> = {};

    filteredSales.forEach((s: Sale) => {
      totals.count += 1;
      s.payments.forEach(p => {
        // Apenas soma ao faturamento bruto o que NÃO for F12
        if (p.method !== 'F12') {
           totals.total += p.amount;
           if (p.method === 'Dinheiro') totals.cash += p.amount; 
           else if (p.method === 'Pix') totals.pix += p.amount; 
           else if (p.method === 'Voucher') totals.voucher += p.amount;
           else if (p.method === 'Voucher VIP') totals.voucherVip += p.amount;
           else totals.card += p.amount;
        } else {
           totals.f12 += p.amount;
        }
      });
      s.items.forEach(item => {
        if (!productsCount[item.productId]) { productsCount[item.productId] = { name: item.name, qty: 0, size: item.size, color: item.color }; }
        productsCount[item.productId].qty += item.quantity;
      });
    });

    // Adicionar recebimentos de registros pendentes feitos no período
    const allLogs = [
      ...(cashSession?.logs || []),
      ...(cashHistory?.flatMap((h: any) => h.logs) || [])
    ];

    allLogs.forEach(log => {
       const logDate = new Date(log.time);
       let matchPeriod = false;
       if (period === 'day') {
          const [y, m, d] = selectedDay.split('-').map(Number);
          matchPeriod = logDate.getFullYear() === y && (logDate.getMonth() + 1) === m && logDate.getDate() === d;
       } else if (period === 'month') {
          const [y, m] = selectedMonth.split('-').map(Number);
          matchPeriod = logDate.getFullYear() === y && (logDate.getMonth() + 1) === m;
       } else {
          matchPeriod = logDate.getFullYear() === Number(selectedYear);
       }

       if (matchPeriod && log.description.startsWith('Rec. Pendente:')) {
          totals.total += log.amount;
          if (log.description.includes('(Dinheiro)')) totals.cash += log.amount;
          else if (log.description.includes('(Pix)')) totals.pix += log.amount;
          else totals.card += log.amount;
       }
    });

    const productsRank = Object.values(productsCount).sort((a, b) => b.qty - a.qty).slice(0, 5);
    return { totals, productsRank };
  }, [filteredSales, cashSession, cashHistory, period, selectedDay, selectedMonth, selectedYear]);

  const commissionContext = useMemo(() => {
    let sellersMap: Record<string, number> = {};
    let totalMonthly = 0;
    let y, m;
    if (period === 'day') { [y, m] = selectedDay.split('-').map(Number); } else if (period === 'month') { [y, m] = selectedMonth.split('-').map(Number); } else { y = Number(selectedYear); m = Number(selectedMonth.split('-')[1]); }
    sales.forEach((s: Sale) => {
      const sd = new Date(s.date);
      if (sd.getFullYear() === y && (sd.getMonth() + 1) === m) {
        if (!sellersMap[s.user]) sellersMap[s.user] = 0;
        sellersMap[s.user] += s.total;
        totalMonthly += s.total;
      }
    });
    return { sellers: Object.entries(sellersMap).sort((a, b) => b[1] - a[1]), total: totalMonthly };
  }, [sales, period, selectedDay, selectedMonth, selectedYear]);

  const totalReceivedForBadges = stats.totals.cash + stats.totals.pix + stats.totals.card + stats.totals.voucher + stats.totals.voucherVip;
  const totalStock = products.reduce((acc: number, p: any) => acc + p.stock, 0);
  const totalStockCost = products.reduce((acc: number, p: any) => acc + (p.cost * p.stock), 0);
  const totalFiadoPending = fiados.filter((f: FiadoRecord) => f.status === 'pending').reduce((acc: number, f: FiadoRecord) => acc + f.remainingAmount, 0);
  
  return (
    <div className="space-y-8 animate-in fade-in h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col"><h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Painel Indicadores</h2><p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Visão estratégica do negócio</p></div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {(['day', 'month', 'year'] as const).map((p) => (
                    <button key={p} onClick={() => setPeriod(p)} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>{p === 'day' ? 'DIA' : p === 'month' ? 'MÊS' : 'ANO'}</button>
                ))}
            </div>
            <div className="flex items-center gap-3">
              {period === 'day' && (<div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">ESCOLHA O DIA:</span><input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-transparent text-sm font-black text-indigo-700 outline-none cursor-pointer" /></div>)}
              {period === 'month' && (<div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">ESCOLHA O MÊS:</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-sm font-black text-indigo-700 outline-none cursor-pointer" /></div>)}
              {period === 'year' && (<div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 animate-in fade-in shadow-sm"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">ESCOLHA O ANO:</span><input type="number" min="2000" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-sm font-black text-indigo-700 outline-none cursor-pointer w-20" /></div>)}
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <CardStat icon={<TrendingUp size={24}/>} label="Faturamento Real" val={`R$ ${stats.totals.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} color="green" />
        <CardStat icon={<Wallet size={24}/>} label="Caixa Atual" val={`R$ ${cashSession?.currentBalance?.toFixed(2) || '0.00'}`} color="indigo" />
        <CardStat icon={<HandCoins size={24}/>} label="Pendente (F12)" val={`R$ ${formatCurrency(totalFiadoPending)}`} color="red" />
        <CardStat icon={<Box size={24}/>} label="Total Estoque" val={`${totalStock} peças`} subVal={`Custo Total R$ ${formatCurrency(totalStockCost)}`} color="blue" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-800 uppercase italic flex items-center gap-2"><CreditCard size={20} className="text-indigo-600" /> Meios de Recebimento</h3><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período Selecionado</span></div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 <PaymentBadge label="Dinheiro" val={stats.totals.cash} color="green" total={totalReceivedForBadges} icon={<Banknote size={16}/>} />
                 <PaymentBadge label="Pix" val={stats.totals.pix} color="blue" total={totalReceivedForBadges} icon={<QrCode size={16}/>} />
                 <PaymentBadge label="Cartão" val={stats.totals.card} color="indigo" total={totalReceivedForBadges} icon={<CreditCard size={16}/>} />
                 <PaymentBadge label="Voucher" val={stats.totals.voucher} color="amber" total={totalReceivedForBadges} icon={<Gift size={16}/>} />
                 <PaymentBadge label="Pendentes (F12)" val={stats.totals.f12} color="red" total={totalReceivedForBadges + stats.totals.f12} icon={<HandCoins size={16}/>} />
              </div>
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 uppercase italic mb-8 flex items-center gap-2"><Trophy size={20} className="text-amber-500" /> Ranking de Produtos</h3>
              <div className="space-y-4">
                 {stats.productsRank.length > 0 ? stats.productsRank.map((p, idx) => (
                    <div key={idx} className="bg-slate-50 p-5 rounded-3xl flex items-center justify-between border border-slate-100 hover:border-amber-200 transition-all group">
                       <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-white transition-all group-hover:scale-110 ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-500' : 'bg-orange-50 text-orange-600'}`}>
                             {idx === 0 ? <Medal size={24}/> : idx === 1 ? <Medal size={24}/> : <Award size={24}/>}
                          </div>
                          <div>
                             <div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{idx + 1}º mais vendido</span></div>
                             <h4 className="text-lg font-black text-slate-900 uppercase italic leading-tight">{p.name}</h4>
                             {(p.size || p.color) && (<p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic opacity-80 flex items-center gap-2">{p.size && <span>tam: <span className="text-indigo-500">{p.size}</span></span>}{p.color && <span>/ cor: <span className="text-indigo-500">{p.color}</span></span>}</p>)}
                          </div>
                       </div>
                       <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">Qtd Saída</p><p className="text-xl font-black text-indigo-600">{p.qty} <span className="text-[10px] text-slate-400 uppercase">un</span></p></div>
                    </div>
                 )) : (<div className="py-12 text-center text-slate-300 font-bold italic">Sem movimentação de produtos no período...</div>)}
              </div>
           </div>
        </div>
        <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden flex flex-col h-fit">
           <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/20 rounded-full blur-[80px] -mr-20 -mt-20"></div>
           <div className="relative z-10 flex flex-col">
              <div className="mb-8">
                 <h3 className="text-lg font-black uppercase italic flex items-center gap-2"><Calculator size={20} className="text-indigo-400" /> Equipe & Comissões</h3>
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 mb-4">Configuração de metas e bonificações</p>
                 <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-2xl border border-white/10"><span className="text-[8px] font-black text-slate-400 uppercase">Taxa Base %</span><div className="flex items-center gap-1"><input type="number" step="0.5" className="w-full bg-transparent text-sm font-black text-indigo-400 focus:outline-none" value={commBase} onChange={e => setCommBase(Number(e.target.value))} /><Percent size={10} className="text-slate-600"/></div></div>
                    <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-2xl border border-white/10"><span className="text-[8px] font-black text-slate-400 uppercase">Taxa Premium %</span><div className="flex items-center gap-1"><input type="number" step="0.5" className="w-full bg-transparent text-sm font-black text-amber-400 focus:outline-none" value={commPremium} onChange={e => setCommPremium(Number(e.target.value))} /><Percent size={10} className="text-slate-600"/></div></div>
                 </div>
                 <div className="flex flex-col gap-1 bg-white/5 p-3 rounded-2xl border border-white/10"><span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Gatilho Premium (R$)</span><div className="flex items-center gap-2"><span className="text-[10px] font-black text-slate-600">R$</span><input type="text" className="w-full bg-transparent text-base font-black text-white focus:outline-none font-mono" value={formatCurrency(commThreshold)} onChange={e => setCommThreshold(parseCurrency(e.target.value))} /></div></div>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-auto custom-scroll pr-2">
                 {commissionContext.sellers.map(([name, val], idx) => {
                    const isPremium = val >= commThreshold; const rate = isPremium ? commPremium : commBase; const commission = val * (rate / 100);
                    return (
                       <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                          <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${idx === 0 ? 'bg-amber-600/30 text-amber-400 border-amber-600/20' : 'bg-indigo-600/30 text-indigo-400 border-indigo-600/20'}`}>{idx + 1}º</div><span className="text-xs font-black uppercase tracking-tight group-hover:text-indigo-300 transition-colors">{name}</span></div>
                             <span className="text-xs font-black font-mono">R$ {val.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full mb-3 overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${isPremium ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (val / (commissionContext.total || 1)) * 100)}%` }}></div></div>
                          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter text-slate-500"><div className="flex items-center gap-1.5"><span className={`px-2 py-0.5 rounded-md ${isPremium ? 'bg-amber-500/10 text-amber-500 animate-pulse' : 'bg-white/10 text-slate-400'}`}>Taxa: {rate}%</span>{isPremium && <Zap size={8} className="text-amber-500" />}</div><div className="text-right"><span className={`${isPremium ? 'text-amber-400' : 'text-indigo-400'} text-[10px] font-mono italic`}>Comissão: R$ {formatCurrency(commission)}</span></div></div>
                       </div>
                    );
                 })}
                 {commissionContext.sellers.length === 0 && (<div className="h-full flex items-center justify-center py-20"><p className="text-slate-700 font-bold uppercase text-[10px] tracking-widest">Sem movimentação</p></div>)}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const CardStat = ({ icon, label, val, color, subVal }: any) => (
  <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-200 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all group">
    <div className={`p-4 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">{label}</p>
      <p className="text-2xl font-black text-slate-900 font-mono italic tracking-tighter leading-tight">{val}</p>
      {subVal && <p className="text-[9px] font-black text-red-500 uppercase mt-1 tracking-tight">{subVal}</p>}
    </div>
  </div>
);

const PaymentBadge = ({ label, val, color, total, icon }: any) => {
  const percent = total > 0 ? (val / total) * 100 : 0;
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className={`p-1.5 rounded-lg bg-${color}-50 text-${color}-500`}>{icon}</div><span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{label}</span></div><span className="text-[10px] font-black text-slate-400">{percent.toFixed(1)}%</span></div>
       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group hover:border-indigo-100 transition-colors"><p className="text-base font-black text-slate-800 font-mono">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
       <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full bg-${color}-500 rounded-full transition-all duration-700`} style={{ width: `${percent}%` }}></div></div>
    </div>
  );
};

// --- RELATÓRIOS ---

const ReportsViewComponent = ({ user, sales, setSales, products, setProducts, setMovements, cashHistory, cashSession, settings, setExchangeCredit, setCurrentView }: any) => {
  const [tab, setTab] = useState<'sales' | 'cash' | 'fluxo'>('sales'); const [search, setSearch] = useState(''); const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [reprintSale, setReprintSale] = useState<Sale | null>(null); // Novo estado para reimpressão
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('day'); const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10)); const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const isAdmin = user.role === 'admin' || user.id === 0; const canDelete = isAdmin || (settings.sellerPermissions || []).includes('delete_sale'); const canExchange = isAdmin || (settings.sellerPermissions || []).includes('exchange_sale');
  const hasSubPermission = (permId: string) => isAdmin || (settings.sellerPermissions || []).includes(permId);
  const showSalesTab = true; const showFluxoTab = hasSubPermission('reports_fluxo'); const showCashTab = hasSubPermission('reports_cash');
  useEffect(() => { if (!showSalesTab) { if (showFluxoTab) setTab('fluxo'); else if (showCashTab) setTab('cash'); } }, [showSalesTab, showFluxoTab, showCashTab]);
  const filteredSalesByPeriod = useMemo(() => {
    return sales.filter((s: Sale) => {
      const d = new Date(s.date);
      if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
      if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
      if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
      return true;
    });
  }, [sales, period, selectedDay, selectedMonth, selectedYear]);
  const filteredSales = useMemo(() => { if (!search) return filteredSalesByPeriod; const t = search.toLowerCase(); return filteredSalesByPeriod.filter((s: Sale) => s.id.toString().includes(t) || s.user.toLowerCase().includes(t) || s.items.some(i => i.name.toLowerCase().includes(t))); }, [filteredSalesByPeriod, search]);
  const cashLogs = useMemo(() => {
    let allLogs: CashLog[] = []; if (cashSession) allLogs = [...cashSession.logs]; cashHistory.forEach((h: CashHistoryEntry) => { allLogs = [...allLogs, ...h.logs]; });
    const movements = allLogs.filter(l => l.type === 'entrada' || l.type === 'retirada');
    return movements.filter(l => {
        const d = new Date(l.time); if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
        if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
        if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
        return true;
    }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [cashSession, cashHistory, period, selectedDay, selectedMonth, selectedYear]);
  const filteredCashHistory = useMemo(() => {
    return cashHistory.filter((h: CashHistoryEntry) => {
      const d = new Date(h.closedAt); if (period === 'day') { const [y, m, day] = selectedDay.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day; }
      if (period === 'month') { const [y, m] = selectedMonth.split('-').map(Number); return d.getFullYear() === y && (d.getMonth() + 1) === m; }
      if (period === 'year') { return d.getFullYear() === Number(selectedYear); }
      return true;
    }).sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }, [cashHistory, period, selectedDay, selectedMonth, selectedYear]);
  const handleDeleteSale = (sale: Sale) => {
    if (!canDelete) return alert('Sem permissão para excluir vendas!'); if (!window.confirm('Deseja realmente excluir esta venda? O estoque será devolvido.')) return;
    setProducts((prev: Product[]) => prev.map(p => { const items = sale.items.filter(i => i.productId === p.id); const totalQty = items.reduce((acc, i) => acc + i.quantity, 0); return totalQty > 0 ? { ...p, stock: p.stock + totalQty } : p; }));
    setMovements((prev: any) => [...sale.items.map(i => ({ id: Math.random(), productId: i.productId, productName: i.name, type: 'entrada', quantity: i.quantity, reason: `Exclusão Venda #${sale.id.toString().slice(-4)}`, date: new Date().toISOString(), user: user.name })), ...prev]);
    setSales((prev: Sale[]) => prev.filter(s => s.id !== sale.id)); alert('Venda excluída e estoque estornado!');
  };
  const handleItemExchange = (sale: Sale, item: SaleItem) => {
    if (!canExchange) return alert('Sem permissão para realizar trocas!'); if (item.isExchanged) return alert('Este item já foi trocado!');
    const itemSubtotal = (item.price * item.quantity) - item.discountValue - item.manualDiscountValue; const totalItemsSubtotal = sale.items.reduce((acc, it) => acc + (it.price * it.quantity - it.discountValue - it.manualDiscountValue), 0); const proportionalFactor = totalItemsSubtotal > 0 ? itemSubtotal / totalItemsSubtotal : 0; const netItemValue = sale.total * proportionalFactor;
    if (!window.confirm(`Deseja realizar a troca do item ${item.name}?\nCrédito a ser gerado: R$ ${formatCurrency(netItemValue)}`)) return;
    setProducts((prev: Product[]) => prev.map(p => p.id === item.productId ? { ...p, stock: p.stock + item.quantity } : p ));
    setMovements((prev: any) => [{ id: Math.random(), productId: item.productId, productName: item.name, type: 'entrada', quantity: item.quantity, reason: `Troca Item Venda #${sale.id.toString().slice(-4)}`, date: new Date().toISOString(), user: user.name }, ...prev]);
    setSales((prev: Sale[]) => prev.map(s => { if (s.id === sale.id) { return { ...s, items: s.items.map(it => it.cartId === item.cartId ? { ...it, isExchanged: true } : it) }; } return s; }));
    setExchangeCredit((prev: number) => prev + netItemValue); setSelectedSale(null); setCurrentView('sales'); alert(`Sucesso! R$ ${formatCurrency(netItemValue)} de crédito adicionado ao sistema.`);
  };
  return (
    <div className="space-y-6 h-full flex flex-col min-h-0">
      <div className="flex flex-col gap-6 md:flex-row md:items-end justify-between shrink-0">
        <div><h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Relatórios & Histórico</h2><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acompanhamento operacional detalhado</p></div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {(['day', 'month', 'year'] as const).map((p) => (<button key={p} onClick={() => setPeriod(p)} className={`px-8 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>{p === 'day' ? 'DIA' : p === 'month' ? 'MÊS' : 'ANO'}</button>))}
            </div>
            <div className="flex items-center gap-3">
              {period === 'day' && (<div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 animate-in fade-in"><span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">DIA:</span><input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-transparent text-[11px] font-black text-indigo-700 outline-none cursor-pointer" /></div>)}
              {period === 'month' && (<div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 animate-in fade-in"><span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">MÊS:</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-[11px] font-black text-indigo-700 outline-none cursor-pointer" /></div>)}
              {period === 'year' && (<div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 animate-in fade-in"><span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">ANO:</span><input type="number" min="2000" max="2100" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-transparent text-[11px] font-black text-indigo-700 outline-none cursor-pointer w-16" /></div>)}
            </div>
        </div>
      </div>
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start">
           {showSalesTab && <button onClick={() => setTab('sales')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'sales' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><ShoppingCart size={14}/> Vendas</button>}
           {showFluxoTab && <button onClick={() => setTab('fluxo')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'fluxo' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><RefreshCw size={14}/> Entradas/Sangrias</button>}
           {showCashTab && <button onClick={() => setTab('cash')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tab === 'cash' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}><History size={14}/> Histórico de Caixa</button>}
      </div>
      {tab === 'sales' && showSalesTab && (<><div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4 shrink-0"><div className="relative group flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Filtrar por ID, vendedor ou produto..." className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0"><div className="overflow-auto flex-1 custom-scroll"><table className="w-full text-left border-separate border-spacing-0"><thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">ID</th><th className="px-6 py-4">Vendedor</th><th className="px-6 py-4 text-right">Total</th><th className="px-6 py-4 text-center">Itens</th><th className="px-6 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSales.map((s: Sale) => (<tr key={s.id} className="hover:bg-slate-50 transition-all group"><td className="px-6 py-4"><div className="flex flex-col"><span className="text-xs font-bold text-slate-800">{new Date(s.date).toLocaleDateString()}</span><span className="text-[9px] text-slate-400 font-mono">{new Date(s.date).toLocaleTimeString()}</span></div></td><td className="px-6 py-4 text-[10px] font-mono font-black text-indigo-600">#{s.id.toString().slice(-6)}</td><td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase">{s.user}</td><td className="px-6 py-4 text-right font-black text-slate-900 font-mono text-xs">R$ {formatCurrency(s.total)}</td><td className="px-6 py-4 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black text-slate-500">{s.items.length}</span></td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => setSelectedSale(s)} className="p-2 text-slate-400 hover:text-indigo-600" title="Ver Detalhes"><Eye size={16}/></button>{canDelete && <button onClick={() => handleDeleteSale(s)} className="p-2 text-slate-400 hover:text-red-600" title="Excluir"><Trash2 size={16}/></button>}</div></td></tr>))}{filteredSales.length === 0 && (<tr><td colSpan={6} className="py-20 text-center text-slate-300 font-bold italic">Nenhuma venda encontrada para este período...</td></tr>)}</tbody></table></div></div></>)}
      {tab === 'fluxo' && showFluxoTab && (<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0 animate-in fade-in"><div className="overflow-auto flex-1 custom-scroll"><table className="w-full text-left border-separate border-spacing-0"><thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Data e Hora</th><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Descrição/Motivo</th><th className="px-6 py-4 text-right">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{cashLogs.map((log) => (<tr key={log.id} className="hover:bg-slate-50 transition-all group"><td className="px-6 py-4"><div className="flex flex-col"><span className="text-xs font-bold text-slate-800">{new Date(log.time).toLocaleDateString()}</span><span className="text-[9px] text-slate-400 font-mono">{new Date(log.time).toLocaleTimeString()}</span></div></td><td className="px-6 py-4 text-xs font-bold text-slate-600 uppercase italic tracking-tight">{log.user}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${log.type === 'entrada' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{log.type === 'entrada' ? 'Entrada' : 'Sangria'}</span></td><td className="px-6 py-4 text-xs font-bold text-slate-500 max-w-xs truncate">{log.description || '-'}</td><td className={`px-6 py-4 text-right font-black font-mono text-xs ${log.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{log.type === 'entrada' ? '+' : '-'} R$ {formatCurrency(log.amount)}</td></tr>))}{cashLogs.length === 0 && (<tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">Nenhuma movimentação de caixa encontrada...</td></tr>)}</tbody></table></div></div>)}
      {tab === 'cash' && showCashTab && (<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-0 animate-in fade-in"><div className="overflow-auto flex-1 custom-scroll"><table className="w-full text-left border-separate border-spacing-0"><thead className="bg-slate-50 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b"><tr><th className="px-6 py-4">Abertura / Fechamento</th><th className="px-6 py-4">Usuários</th><th className="px-6 py-4 text-right">Saldo Inicial</th><th className="px-6 py-4 text-right">Saldo Final</th><th className="px-6 py-4 text-center">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredCashHistory.map((h: CashHistoryEntry) => (<tr key={h.id} className="hover:bg-slate-50 transition-all group"><td className="px-6 py-4"><div className="flex flex-col gap-1"><div className="flex items-center gap-2 text-[10px] font-bold text-green-600"><Clock size={10} /> {new Date(h.openedAt).toLocaleString()}</div><div className="flex items-center gap-2 text-[10px] font-bold text-red-500"><Clock size={10} /> {new Date(h.closedAt).toLocaleString()}</div></div></td><td className="px-6 py-4"><div className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase text-slate-400">AB: {h.openedBy}</span><span className="text-[10px] font-black uppercase text-slate-400">FC: {h.closedBy}</span></div></td><td className="px-6 py-4 text-right text-xs font-mono font-bold text-slate-500">R$ {formatCurrency(h.openingBalance)}</td><td className="px-6 py-4 text-right text-xs font-mono font-black text-slate-900">R$ {formatCurrency(h.closingBalance)}</td><td className="px-6 py-4 text-center"><span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase">Encerrado</span></td></tr>))}{filteredCashHistory.length === 0 && (<tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">Nenhum histórico de caixa encontrado para este período...</td></tr>)}</tbody></table></div></div>)}
      {selectedSale && (<div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[100] backdrop-blur-md animate-in fade-in"><div className="bg-white p-8 rounded-[2rem] w-full max-w-2xl shadow-2xl space-y-6 max-h-[90vh] overflow-auto custom-scroll"><div className="flex justify-between items-center border-b pb-4"><h3 className="text-xl font-black text-slate-900 uppercase italic">Detalhes da Venda #{selectedSale.id.toString().slice(-6)}</h3><div className="flex items-center gap-2"><button onClick={() => setReprintSale(selectedSale)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Reimprimir Cupom"><Printer size={20}/></button><button onClick={() => setSelectedSale(null)} className="text-slate-300 hover:text-slate-500"><X size={24}/></button></div></div><div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border"><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Data / Hora</p><p className="text-xs font-bold text-slate-700">{new Date(selectedSale.date).toLocaleString()}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendedor</p><p className="text-xs font-black text-indigo-600 uppercase">{selectedSale.user}</p></div></div><div className="space-y-3"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos Vendidos</h4><div className="border rounded-2xl overflow-hidden"><table className="w-full text-left text-xs"><thead className="bg-slate-50 font-black text-slate-500 uppercase text-[9px]"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-center">Qtd</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Troca</th></tr></thead><tbody className="divide-y">{selectedSale.items.map((it, i) => (<tr key={i} className={`bg-white ${it.isExchanged ? 'opacity-50 grayscale' : ''}`}><td className="px-4 py-3"><div className="flex flex-col"><span className="font-bold">{it.name}</span><span className="text-[9px] text-slate-400 font-mono">{it.sku}</span><span className="text-[8px] text-slate-500 italic mt-0.5 uppercase tracking-tighter">tam: {it.size || '-'} / cor: {it.color || '-'}</span>{it.isExchanged && <span className="text-[7px] font-black text-red-500 uppercase mt-0.5 animate-pulse">Item Trocado</span>}</div></td><td className="px-4 py-3 text-center font-bold">{it.quantity}</td><td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</td><td className="px-4 py-3 text-center">{canExchange && !it.isExchanged && (<button onClick={() => handleItemExchange(selectedSale, it)} className="p-1.5 bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white rounded-lg transition-all shadow-sm" title="Trocar Item"><RotateCcw size={14}/></button>)}</td></tr>))}</tbody></table></div></div><div className="border-t pt-6 flex flex-col items-end gap-2"><div className="flex justify-between w-64 text-xs font-bold text-slate-400"><span>Subtotal</span><span className="font-mono">R$ {formatCurrency(selectedSale.subtotal)}</span></div><div className="flex justify-between w-64 text-xs font-bold text-red-400"><span>Desconto ({selectedSale.discountPercent.toFixed(1)}%)</span><span className="font-mono">- R$ {formatCurrency(selectedSale.discount)}</span></div>{selectedSale.exchangeCreditUsed && selectedSale.exchangeCreditUsed > 0 && (<div className="flex justify-between w-64 text-xs font-bold text-amber-500"><span>Crédito Utilizado</span><span className="font-mono">- R$ {formatCurrency(selectedSale.exchangeCreditUsed)}</span></div>)}<div className="flex justify-between w-64 text-xl font-black text-slate-900 border-t pt-2"><span className="italic uppercase tracking-tighter">Total Pago</span><span className="font-mono">R$ {formatCurrency(selectedSale.total)}</span></div></div><div className="space-y-3"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meios de Pagamento</h4><div className="flex flex-wrap gap-2">{selectedSale.payments.map((p, i) => (<div key={i} className={`bg-${(p.method === 'Voucher VIP' || p.method === 'F12') ? 'purple' : 'indigo'}-50 border border-${(p.method === 'Voucher VIP' || p.method === 'F12') ? 'purple' : 'indigo'}-100 px-3 py-2 rounded-xl flex flex-col`}><span className={`text-[8px] font-black text-${(p.method === 'Voucher VIP' || p.method === 'F12') ? 'purple' : 'indigo'}-400 uppercase`}>{p.method} {p.installments ? `${p.installments}x` : ''} {p.voucherCode && p.method !== 'Voucher VIP' ? `(${p.voucherCode})` : ''}{p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span><span className={`text-xs font-black text-${(p.method === 'Voucher VIP' || p.method === 'F12') ? 'purple' : 'indigo'}-600 font-mono`}>R$ {formatCurrency(p.amount)}</span></div>))}</div></div></div></div>)}

      {reprintSale && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-[150] backdrop-blur-sm animate-in fade-in no-print-overlay">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl space-y-6 animate-in zoom-in-95 overflow-hidden">
             <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full mx-auto flex items-center justify-center border border-indigo-100">
                    <Printer size={32} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase italic">Reimpressão</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Confirme a impressão do cupom de venda.</p>
             </div>

             <div id="printable-receipt" className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-2xl font-mono text-[11px] text-slate-700 space-y-4 shadow-inner">
                <div className="text-center space-y-1">
                    <p className="font-black text-base italic leading-none">{settings.storeName || 'SCARD SYS'}</p>
                    <p className="text-[9px] uppercase tracking-[0.2em] opacity-60">{settings.storeTagline || 'ENTERPRISE SOLUTION'}</p>
                    <p className="text-[8px] opacity-40">{settings.storeAddress || 'Rua da Moda, 123 - Centro'}</p>
                    {settings.storeCnpj && <p className="text-[8px] opacity-40">CNPJ: {settings.storeCnpj}</p>}
                </div>
                
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold">
                    <span>CUPOM: #{reprintSale.id.toString().slice(-6)}</span>
                    <span>{new Date(reprintSale.date).toLocaleDateString()} {new Date(reprintSale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>

                <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-1">
                        <span>DESCRIÇÃO</span>
                        <span>TOTAL</span>
                    </div>
                    {reprintSale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start leading-tight">
                            <span className="flex-1 pr-4 uppercase">
                                {it.quantity}x {it.name}
                                {it.size && <span className="text-[8px] block text-slate-400">TAM: {it.size} | COR: {it.color}</span>}
                            </span>
                            <span className="font-black">R$ {formatCurrency((it.price * it.quantity) - it.discountValue - it.manualDiscountValue)}</span>
                        </div>
                    ))}
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                    <div className="flex justify-between text-slate-500">
                        <span>SUBTOTAL</span>
                        <span>R$ {formatCurrency(reprintSale.subtotal)}</span>
                    </div>
                    {reprintSale.discount > 0 && (
                        <div className="flex justify-between text-red-500 font-bold">
                            <span>DESCONTO GERAL</span>
                            <span>- R$ {formatCurrency(reprintSale.discount)}</span>
                        </div>
                    )}
                    {reprintSale.exchangeCreditUsed && reprintSale.exchangeCreditUsed > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>CRÉDITO TROCA</span>
                            <span>- R$ {formatCurrency(reprintSale.exchangeCreditUsed)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-300 pt-1 mt-1">
                        <span>TOTAL PAGO</span>
                        <span>R$ {formatCurrency(reprintSale.total)}</span>
                    </div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase">FORMA(S) DE PAGAMENTO:</p>
                    {reprintSale.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{p.method} {p.installments ? `(${p.installments}x)` : ''}{p.method === 'F12' ? ` (${p.f12ClientName})` : ''}</span>
                            <span className="font-bold">R$ {formatCurrency(p.amount)}</span>
                        </div>
                    ))}
                    {reprintSale.change > 0 && (
                        <div className="flex justify-between text-amber-600 font-bold">
                            <span>TROCO</span>
                            <span>R$ {formatCurrency(reprintSale.change)}</span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-slate-200 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">VENDEDOR:</p>
                    <p className="text-[10px] font-bold uppercase">{reprintSale.user}</p>
                    <p className="text-[8px] mt-4 opacity-40">Obrigado pela preferência!</p>
                </div>
             </div>

             <div className="flex gap-3 pt-2">
                <button 
                    onClick={() => setReprintSale(null)} 
                    className="flex-1 px-4 py-4 border-2 border-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                >
                    Fechar
                </button>
                <button 
                    onClick={() => { window.print(); setReprintSale(null); }} 
                    className="flex-[2] px-4 py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <Printer size={18} />
                    Imprimir Agora
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- CONFIGURAÇÕES ---

const SettingsViewComponent = ({ settings, setSettings, categories, setCategories, products, setProducts }: any) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ 
    maxGlobalDiscount: settings?.maxGlobalDiscount ?? 10, 
    cardFees: { 
      debit: settings?.cardFees?.debit ?? 1.99, 
      credit1x: settings?.cardFees?.credit1x ?? 3.49, 
      creditInstallments: settings?.cardFees?.creditInstallments ?? 4.99 
    }, 
    sellerPermissions: settings?.sellerPermissions ?? DEFAULT_SETTINGS.sellerPermissions,
    storeAddress: settings?.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
    storeCnpj: settings?.storeCnpj ?? DEFAULT_SETTINGS.storeCnpj,
    storeName: settings?.storeName ?? DEFAULT_SETTINGS.storeName,
    storeTagline: settings?.storeTagline ?? DEFAULT_SETTINGS.storeTagline
  });
  const [newCategory, setNewCategory] = useState('');
  const sortedCategories = useMemo(() => { return [...categories].sort((a, b) => { if (a === 'Sem Categoria') return -1; if (b === 'Sem Categoria') return 1; return a.localeCompare(b); }); }, [categories]);
  const handleAddCategory = () => { const trimmed = newCategory.trim(); if (!trimmed) return; if (categories.includes(trimmed)) return alert('Já existe!'); setCategories([...categories, trimmed]); setNewCategory(''); };
  const handleDeleteCategory = (cat: string) => { if (window.confirm(`Remover "${cat}"? Todos os produtos desta categoria serão movidos para "Sem Categoria".`)) { setCategories(categories.filter((c: string) => c !== cat)); setProducts((prev: Product[]) => prev.map(p => p.category === cat ? { ...p, category: 'Sem Categoria' } : p )); } };
  const handleSave = () => { setSettings(localSettings); alert('Ajustes salvos!'); };
  const togglePermission = (viewId: string) => { const perms = (localSettings.sellerPermissions || []).includes(viewId) ? localSettings.sellerPermissions.filter(p => p !== viewId) : [...(localSettings.sellerPermissions || []), viewId]; setLocalSettings({ ...localSettings, sellerPermissions: perms }); };
  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex justify-between items-end"><div className="flex flex-col"><h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Configurações</h2><p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Ajustes de taxas e sistema</p></div><button onClick={handleSave} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px]">Salvar Alterações</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-800 uppercase italic border-b pb-4">Dados da Empresa (Recibo)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nome da Empresa</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-slate-800 font-bold text-sm" value={localSettings.storeName} onChange={e => setLocalSettings({...localSettings, storeName: e.target.value})} placeholder="SCARD SYS" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Subtítulo / Slogan</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-slate-800 font-bold text-sm" value={localSettings.storeTagline} onChange={e => setLocalSettings({...localSettings, storeTagline: e.target.value})} placeholder="ENTERPRISE SOLUTION" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Endereço Completo</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-slate-800 font-bold text-sm" value={localSettings.storeAddress} onChange={e => setLocalSettings({...localSettings, storeAddress: e.target.value})} placeholder="Rua ..., Nº ..., Bairro, Cidade-UF" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">CNPJ</label>
                    <input type="text" className="w-full border-2 rounded-xl px-4 py-3 text-slate-800 font-bold text-sm" value={localSettings.storeCnpj} onChange={e => setLocalSettings({...localSettings, storeCnpj: e.target.value})} placeholder="00.000.000/0001-00" />
                  </div>
                </div>
              </div>
              <div className="space-y-6 border-t pt-6"><h3 className="text-lg font-black text-slate-800 uppercase italic border-b pb-4">Taxas Bancárias (%)</h3><div className="grid grid-cols-3 gap-4">{['debit', 'credit1x', 'creditInstallments'].map(key => (<div key={key}><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">{key === 'debit' ? 'Débito' : key === 'credit1x' ? 'Crédito 1x' : 'C. Parcelado'}</label><input type="number" step="0.01" onFocus={(e) => e.target.select()} className="w-full border-2 rounded-xl px-4 py-3 text-indigo-600 font-black text-sm" value={(localSettings.cardFees as any)[key]} onChange={e => setLocalSettings({...localSettings, cardFees: {...localSettings.cardFees, [key]: Number(e.target.value)}})} /></div>))}</div></div><div className="space-y-6 border-t pt-6"><h3 className="text-lg font-black text-slate-800 uppercase italic border-b pb-4">Política de Desconto</h3><div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Limite Máximo de Desconto (%)</label><div className="flex items-center gap-3"><input type="number" step="1" onFocus={(e) => e.target.select()} className="w-32 border-2 rounded-xl px-4 py-3 text-red-600 font-black text-sm" value={localSettings.maxGlobalDiscount} onChange={e => setLocalSettings({...localSettings, maxGlobalDiscount: Number(e.target.value)})} /><span className="text-xs font-bold text-slate-400">Limite apenas para vendedor, administrador não se aplica.</span></div></div></div></div>
           <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6"><h3 className="text-lg font-black text-slate-800 uppercase italic border-b pb-4">Permissões do Vendedor</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[{id: 'reports_fluxo', label: 'RELATÓRIOS - ENTRADAS/SANGRIAS'}, {id: 'reports_cash', label: 'RELATÓRIOS - HISTÓRICO CAIXA'}, {id: 'stock', label: 'ESTOQUE'}, {id: 'dashboard', label: 'DASHBOARD'}, {id: 'campaigns', label: 'CAMPANHAS'}, {id: 'delete_sale', label: 'EXCLUIR VENDA'}, {id: 'exchange_sale', label: 'REALIZAR TROCA'}, {id: 'fiado', label: 'PENDENTES (F12)'}].map(v => (<label key={v.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-colors"><input type="checkbox" className="w-4 h-4 rounded text-indigo-600" checked={(localSettings.sellerPermissions || []).includes(v.id)} onChange={() => togglePermission(v.id)} /><span className="text-xs font-black text-slate-700 uppercase">{v.label}</span></label>))}</div><p className="text-[9px] font-bold text-slate-400 uppercase italic">Configure o que é relevante para o vendedor acessar.</p></div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6 flex flex-col h-full"><h3 className="text-lg font-black text-slate-800 uppercase italic border-b pb-4">Gestão de Categorias</h3><div className="flex gap-2"><input type="text" placeholder="Nova categoria..." className="flex-1 border-2 rounded-xl px-4 py-3 text-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} /><button onClick={handleAddCategory} className="bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg active:scale-95"><Plus size={18}/></button></div><div className="flex-1 overflow-auto custom-scroll pr-2 max-h-[500px] border border-slate-100 rounded-2xl p-4 bg-slate-50/50"><div className="space-y-2">{sortedCategories.map((cat: string) => (<div key={cat} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all shadow-sm"><div className="flex items-center gap-3"><Layers size={14} className="text-indigo-400 opacity-50"/><span className="text-xs font-black text-slate-700 uppercase tracking-tight">{cat}</span></div>{cat !== 'Sem Categoria' && (<button onClick={() => handleDeleteCategory(cat)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>)}</div>))}</div><div className="text-center mt-4"><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Deslize para ver todas</p></div></div></div>
      </div>
    </div>
  );
};

// --- GESTÃO DE EQUIPE ---

const TeamViewComponent = ({ currentUser, users, setUsers }: any) => {
  const [editModal, setEditModal] = useState<User | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleToggleShowPass = () => {
    if (showPass) {
      setShowPass(false);
      return;
    }
    const isMaster = currentUser.id === 0 || currentUser.email === 'master@internal';
    if (isMaster) {
      setShowPass(true);
    } else {
      const confirmPass = window.prompt("Confirme sua senha de administrador para visualizar:");
      if (confirmPass === currentUser.password) {
        setShowPass(true);
      } else if (confirmPass !== null) {
        alert("Senha incorreta!");
      }
    }
  };

  const handleDeleteUser = (id: number) => { 
    if (id === currentUser.id) return alert('Você não pode excluir seu próprio usuário!'); 
    if (window.confirm('Excluir este colaborador?')) setUsers(users.filter((u: User) => u.id !== id)); 
  };

  const handleUpdateProfile = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!editModal) return; 
    setUsers(users.map((u: User) => u.id === editModal.id ? editModal : u)); 
    setEditModal(null); 
    setShowPass(false);
    alert('Perfil atualizado!'); 
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Gestão de Equipe</h2>
        <p className="text-slate-400 font-black text-[9px] uppercase tracking-[0.2em]">Controle de acessos</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((u: User) => (
          <div key={u.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-2xl mx-auto mb-4 flex items-center justify-center border">
              <UserIcon size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase mb-1">{u.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 mb-4">{u.email}</p>
            <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              {u.role}
            </span>
            <div className="border-t border-slate-100 mt-6 pt-4 flex justify-center gap-3">
              <button onClick={() => { setEditModal(u); setShowPass(false); }} className="text-[9px] font-black uppercase text-indigo-600">Editar</button>
              {u.id !== currentUser.id && (
                <button onClick={() => handleDeleteUser(u.id)} className="text-[9px] font-black uppercase text-red-400">Excluir</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {editModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-6 z-[100] backdrop-blur-md animate-in fade-in">
          <form onSubmit={handleUpdateProfile} className="bg-white p-10 rounded-[2rem] w-full max-w-sm shadow-2xl space-y-5">
            <h3 className="text-2xl font-black text-slate-900 uppercase italic">Editar Usuário</h3>
            <div className="space-y-4">
              <input className="w-full border-2 rounded-xl px-4 py-3 text-sm" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} required placeholder="Nome" />
              <input type="email" className="w-full border-2 rounded-xl px-4 py-3 text-sm" value={editModal.email} onChange={e => setEditModal({...editModal, email: e.target.value})} required placeholder="E-mail" />
              <div className="relative">
                <input 
                  type={showPass ? "text" : "password"} 
                  className="w-full border-2 rounded-xl px-4 py-3 text-sm pr-12" 
                  value={editModal.password || ''} 
                  onChange={e => setEditModal({...editModal, password: e.target.value})} 
                  placeholder="Nova Senha" 
                />
                <button 
                  type="button" 
                  onClick={handleToggleShowPass}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <Eye size={18} className={showPass ? "text-indigo-600" : ""} />
                </button>
              </div>
              <select className="w-full border-2 rounded-xl px-4 py-3 text-sm" value={editModal.role} onChange={e => setEditModal({...editModal, role: e.target.value as UserRole})}>
                <option value="atendente">Atendente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button type="button" onClick={() => { setEditModal(null); setShowPass(false); }} className="text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
              <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px]">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- BOOTSTRAP ---
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
