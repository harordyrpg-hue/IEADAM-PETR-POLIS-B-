import React, { useState, useMemo, useRef } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  Image as ImageIcon,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Paperclip,
  Trash2,
  Edit2,
  Download,
  Eye,
  X,
  CreditCard,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  HelpCircle,
  CalendarDays,
  PieChart,
  Tag,
  Check,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import {
  FinancialTransaction,
  FinancialBill,
  FinancialTransactionType,
  FinancialBillType,
  FinancialCategory,
  FinancialPaymentMethod,
  FinancialBillPriority,
  FinancialReceipt,
  FinancialSummary,
} from '../../types.js';
import { api } from '../../services/api.js';
import {
  exportFinancialStatementPDF,
  exportFinancialStatementImage,
  FINANCIAL_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatDateBR,
} from '../../utils/financialExport.js';

export const FinancialView: React.FC = () => {
  const {
    user,
    canAccessFinances,
    financialTransactions,
    financialBills,
    createFinancialTransaction,
    updateFinancialTransaction,
    deleteFinancialTransaction,
    createFinancialBill,
    updateFinancialBill,
    deleteFinancialBill,
    settleFinancialBill,
    notify,
  } = useApp();

  // Active inner sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'bills' | 'forecast' | 'categories'>('ledger');

  // Filter & Search
  const [periodFilter, setPeriodFilter] = useState<'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all'>('this_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [billTypeFilter, setBillTypeFilter] = useState<FinancialBillType>('a_pagar');

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txType, setTxType] = useState<FinancialTransactionType>('entrada');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategory, setTxCategory] = useState<FinancialCategory>('dizimos_ofertas');
  const [txDescription, setTxDescription] = useState('');
  const [txCounterparty, setTxCounterparty] = useState('');
  const [txPaymentMethod, setTxPaymentMethod] = useState<FinancialPaymentMethod>('pix');
  const [txReceipt, setTxReceipt] = useState<FinancialReceipt | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSavingTx, setIsSavingTx] = useState(false);

  // Bill / Future Expense Modal State
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billType, setBillType] = useState<FinancialBillType>('a_pagar');
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategory, setBillCategory] = useState<FinancialCategory>('equipamentos');
  const [billDescription, setBillDescription] = useState('');
  const [billCounterparty, setBillCounterparty] = useState('');
  const [billDueDate, setBillDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [billHasNoForecast, setBillHasNoForecast] = useState<boolean>(false);
  const [billPriority, setBillPriority] = useState<FinancialBillPriority>('media');
  const [billReceipt, setBillReceipt] = useState<FinancialReceipt | null>(null);
  const [isSavingBill, setIsSavingBill] = useState(false);

  // Settle Bill Dialog
  const [settlingBill, setSettlingBill] = useState<FinancialBill | null>(null);
  const [settleMethod, setSettleMethod] = useState<FinancialPaymentMethod>('pix');
  const [settleCreateTx, setSettleCreateTx] = useState(true);
  const [isSettling, setIsSettling] = useState(false);

  // Receipt Viewer Modal
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; name: string; type: string } | null>(null);

  // File input ref for receipt uploads
  const txFileInputRef = useRef<HTMLInputElement | null>(null);
  const billFileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Period Date Bounds Calculation
  const periodBounds = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    if (periodFilter === 'this_month') {
      const start = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const end = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      const monthName = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      return { start, end, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }

    if (periodFilter === 'last_month') {
      const start = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const end = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const monthName = lastMonthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      return { start, end, label: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
    }

    if (periodFilter === 'last_3_months') {
      const start = new Date(currentYear, currentMonth - 2, 1).toISOString().split('T')[0];
      const end = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
      return { start, end, label: 'Últimos 3 Meses' };
    }

    if (periodFilter === 'this_year') {
      const start = `${currentYear}-01-01`;
      const end = `${currentYear}-12-31`;
      return { start, end, label: `Ano ${currentYear}` };
    }

    return { start: '1970-01-01', end: '2099-12-31', label: 'Todo o Histórico' };
  }, [periodFilter]);

  // 2. Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return financialTransactions.filter((tx) => {
      // Period check
      if (tx.date < periodBounds.start || tx.date > periodBounds.end) {
        return false;
      }

      // Type check
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Category check
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchDesc = tx.description?.toLowerCase().includes(q);
        const matchCounter = tx.counterparty?.toLowerCase().includes(q);
        const matchMethod = tx.paymentMethod.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCounter && !matchMethod) {
          return false;
        }
      }

      return true;
    });
  }, [financialTransactions, periodBounds, typeFilter, categoryFilter, searchQuery]);

  // 3. Consolidated Overall Balance & Summary
  const summary: FinancialSummary = useMemo(() => {
    // Current balance is calculated from ALL confirmed transactions ever recorded in caixa
    const totalAllIncome = financialTransactions
      .filter((t) => t.type === 'entrada' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalAllExpense = financialTransactions
      .filter((t) => t.type === 'saida' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const currentBalance = totalAllIncome - totalAllExpense;

    // Period income and expense
    const periodIncome = filteredTransactions
      .filter((t) => t.type === 'entrada' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const periodExpense = filteredTransactions
      .filter((t) => t.type === 'saida' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Pending payable & receivable
    const pendingPayable = financialBills
      .filter((b) => b.type === 'a_pagar' && b.status === 'pendente')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    const pendingReceivable = financialBills
      .filter((b) => b.type === 'a_receber' && b.status === 'pendente')
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    // Future expenses with defined date
    const futureWithDate = financialBills
      .filter((b) => b.type === 'a_pagar' && b.status === 'pendente' && !b.hasNoForecast && b.dueDate)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    // Future expenses without forecast (sem previsão)
    const futureWithoutForecast = financialBills
      .filter((b) => b.type === 'a_pagar' && b.status === 'pendente' && b.hasNoForecast)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      currentBalance,
      totalIncome: periodIncome,
      totalExpense: periodExpense,
      pendingPayable,
      pendingReceivable,
      futureExpensesWithDate: futureWithDate,
      futureExpensesWithoutForecast: futureWithoutForecast,
    };
  }, [financialTransactions, filteredTransactions, financialBills]);

  // 4. Expenses by Category for Charts/Progress Bars
  const categoryExpenses = useMemo(() => {
    const map: Record<string, number> = {};
    const saidas = filteredTransactions.filter((t) => t.type === 'saida');
    let total = 0;

    saidas.forEach((tx) => {
      const cat = tx.category || 'outro';
      map[cat] = (map[cat] || 0) + (tx.amount || 0);
      total += tx.amount || 0;
    });

    const entries = Object.entries(map).map(([catKey, amount]) => ({
      category: catKey,
      label: FINANCIAL_CATEGORY_LABELS[catKey] || catKey,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }));

    entries.sort((a, b) => b.amount - a.amount);
    return { entries, total };
  }, [filteredTransactions]);

  // 5. Future Expenses separated by with-date vs without-forecast
  const futureExpensesWithDate = useMemo(() => {
    return financialBills
      .filter((b) => b.type === 'a_pagar' && !b.hasNoForecast && b.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [financialBills]);

  const futureExpensesWithoutForecast = useMemo(() => {
    return financialBills
      .filter((b) => b.type === 'a_pagar' && b.hasNoForecast)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [financialBills]);

  // Handle Receipt Upload for Transaction
  const handleTxReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingReceipt(true);
      notify('Enviando arquivo do comprovante...', 'info');
      const receipt = await api.uploadFinancialReceipt(file);
      setTxReceipt(receipt);
      notify('Comprovante anexado com sucesso!', 'success');
    } catch {
      notify('Erro ao anexar comprovante.', 'error');
    } finally {
      setIsUploadingReceipt(false);
      if (txFileInputRef.current) txFileInputRef.current.value = '';
    }
  };

  // Handle Receipt Upload for Bill
  const handleBillReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingReceipt(true);
      notify('Enviando comprovante/boleto...', 'info');
      const receipt = await api.uploadFinancialReceipt(file);
      setBillReceipt(receipt);
      notify('Comprovante anexado com sucesso!', 'success');
    } catch {
      notify('Erro ao anexar comprovante.', 'error');
    } finally {
      setIsUploadingReceipt(false);
      if (billFileInputRef.current) billFileInputRef.current.value = '';
    }
  };

  // Save Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(txAmount.replace(',', '.'));
    if (!txTitle.trim() || isNaN(amountNum) || amountNum <= 0) {
      notify('Por favor, informe um título e um valor válido maior que zero.', 'error');
      return;
    }

    try {
      setIsSavingTx(true);
      if (editingTxId) {
        await updateFinancialTransaction(editingTxId, {
          type: txType,
          title: txTitle.trim(),
          amount: amountNum,
          date: txDate,
          category: txCategory,
          description: txDescription.trim(),
          counterparty: txCounterparty.trim() || (txType === 'entrada' ? 'Origem Não Especificada' : 'Favorecido Não Especificado'),
          paymentMethod: txPaymentMethod,
          receipt: txReceipt,
        });
      } else {
        await createFinancialTransaction({
          type: txType,
          title: txTitle.trim(),
          amount: amountNum,
          date: txDate,
          category: txCategory,
          description: txDescription.trim(),
          counterparty: txCounterparty.trim() || (txType === 'entrada' ? 'Origem Não Especificada' : 'Favorecido Não Especificado'),
          paymentMethod: txPaymentMethod,
          receipt: txReceipt,
          status: 'confirmado',
        });
      }

      setIsTxModalOpen(false);
      resetTxForm();
    } catch {
      notify('Erro ao salvar lançamento.', 'error');
    } finally {
      setIsSavingTx(false);
    }
  };

  // Open Edit Transaction Modal
  const handleOpenEditTx = (tx: FinancialTransaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxTitle(tx.title);
    setTxAmount(tx.amount.toString());
    setTxDate(tx.date);
    setTxCategory((tx.category as FinancialCategory) || 'outro');
    setTxDescription(tx.description || '');
    setTxCounterparty(tx.counterparty || '');
    setTxPaymentMethod(tx.paymentMethod);
    setTxReceipt(tx.receipt || null);
    setIsTxModalOpen(true);
  };

  const resetTxForm = () => {
    setEditingTxId(null);
    setTxType('entrada');
    setTxTitle('');
    setTxAmount('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxCategory('dizimos_ofertas');
    setTxDescription('');
    setTxCounterparty('');
    setTxPaymentMethod('pix');
    setTxReceipt(null);
  };

  // Save Bill / Future Expense
  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(billAmount.replace(',', '.'));
    if (!billTitle.trim() || isNaN(amountNum) || amountNum <= 0) {
      notify('Por favor, informe uma descrição e valor válido.', 'error');
      return;
    }

    try {
      setIsSavingBill(true);
      if (editingBillId) {
        await updateFinancialBill(editingBillId, {
          type: billType,
          title: billTitle.trim(),
          amount: amountNum,
          category: billCategory,
          description: billDescription.trim(),
          counterparty: billCounterparty.trim() || 'Fornecedor / Responsável',
          dueDate: billHasNoForecast ? null : billDueDate,
          hasNoForecast: billHasNoForecast,
          priority: billPriority,
          receipt: billReceipt,
        });
      } else {
        await createFinancialBill({
          type: billType,
          title: billTitle.trim(),
          amount: amountNum,
          category: billCategory,
          description: billDescription.trim(),
          counterparty: billCounterparty.trim() || 'Fornecedor / Responsável',
          dueDate: billHasNoForecast ? null : billDueDate,
          hasNoForecast: billHasNoForecast,
          priority: billPriority,
          receipt: billReceipt,
          status: 'pendente',
        });
      }

      setIsBillModalOpen(false);
      resetBillForm();
    } catch {
      notify('Erro ao salvar conta.', 'error');
    } finally {
      setIsSavingBill(false);
    }
  };

  // Open Edit Bill Modal
  const handleOpenEditBill = (b: FinancialBill) => {
    setEditingBillId(b.id);
    setBillType(b.type);
    setBillTitle(b.title);
    setBillAmount(b.amount.toString());
    setBillCategory((b.category as FinancialCategory) || 'outro');
    setBillDescription(b.description || '');
    setBillCounterparty(b.counterparty || '');
    setBillDueDate(b.dueDate || new Date().toISOString().split('T')[0]);
    setBillHasNoForecast(!!b.hasNoForecast);
    setBillPriority(b.priority);
    setBillReceipt(b.receipt || null);
    setIsBillModalOpen(true);
  };

  const resetBillForm = () => {
    setEditingBillId(null);
    setBillType('a_pagar');
    setBillTitle('');
    setBillAmount('');
    setBillCategory('equipamentos');
    setBillDescription('');
    setBillCounterparty('');
    setBillDueDate(new Date().toISOString().split('T')[0]);
    setBillHasNoForecast(false);
    setBillPriority('media');
    setBillReceipt(null);
  };

  // Settle Bill (Dar baixa e registrar no caixa)
  const handleConfirmSettle = async () => {
    if (!settlingBill) return;

    try {
      setIsSettling(true);
      await settleFinancialBill(settlingBill, settleMethod, settleCreateTx);
      setSettlingBill(null);
    } catch {
      notify('Erro ao liquidar conta.', 'error');
    } finally {
      setIsSettling(false);
    }
  };

  // Export PDF Handler
  const handleExportPDF = () => {
    notify('Gerando Extrato Oficial em PDF...', 'info');
    exportFinancialStatementPDF({
      periodLabel: periodBounds.label,
      transactions: filteredTransactions,
      bills: financialBills,
      summary,
      generatedByName: user?.name || 'Administrador PT-B Mídia',
    });
  };

  // Export Image Handler
  const handleExportImage = async () => {
    notify('Gerando Imagem Oficial do Extrato (PNG)...', 'info');
    try {
      await exportFinancialStatementImage({
        periodLabel: periodBounds.label,
        transactions: filteredTransactions,
        bills: financialBills,
        summary,
        generatedByName: user?.name || 'Administrador PT-B Mídia',
      });
      notify('Imagem do extrato baixada com sucesso!', 'success');
    } catch {
      notify('Erro ao gerar imagem do extrato.', 'error');
    }
  };

  // Access Control Guard
  if (!canAccessFinances) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-neutral-100 mb-2">Acesso Restrito ao Livro Financeiro</h2>
        <p className="text-xs text-neutral-400 max-w-md leading-relaxed mb-6">
          O controle de caixa, movimentações financeiras e extratos da equipe de mídia são protegidos e reservados exclusivamente para Super Administradores e Administradores com autorização.
        </p>
        <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-xs flex items-center gap-2">
          <span>Seu cargo atual:</span>
          <span className="font-semibold text-neutral-200">{user?.roleLabel || 'Membro da Mídia'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
            <Building className="w-4 h-4" />
            IEADAM Petrópolis B · PT-B Mídia
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-400" />
            Livro Financeiro & Caixa
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Controle profissional de entradas, saídas, contas a pagar/receber e previsões de gastos futuros.
          </p>
        </div>

        {/* Export & New Entry Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 shadow-sm transition-colors active:scale-95 touch-manipulation"
            title="Baixar extrato completo em documento PDF"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>Extrato PDF</span>
          </button>

          <button
            onClick={handleExportImage}
            className="flex items-center gap-2 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 shadow-sm transition-colors active:scale-95 touch-manipulation"
            title="Baixar card em imagem de alta definição para envio no WhatsApp"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Extrato Imagem (PNG)</span>
          </button>

          <button
            onClick={() => {
              resetTxForm();
              setTxType('entrada');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors active:scale-95 touch-manipulation"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Nova Entrada</span>
          </button>

          <button
            onClick={() => {
              resetTxForm();
              setTxType('saida');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors active:scale-95 touch-manipulation"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>- Nova Saída</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards Grid: Saldo Atual, Entradas, Saídas, Contas a Pagar, Contas a Receber */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Atual Consolidado */}
        <div className="p-5 bg-neutral-900/90 border border-neutral-800 rounded-2xl relative overflow-hidden group">
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              summary.currentBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-2">
            <span>Saldo Atual em Caixa</span>
            <div className={`p-2 rounded-xl ${summary.currentBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono-numbers ${summary.currentBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(summary.currentBalance)}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Disponível para uso imediato
          </p>
        </div>

        {/* Card 2: Total Entradas (Período) */}
        <div className="p-5 bg-neutral-900/90 border border-neutral-800 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500/60" />
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-2">
            <span>Entradas ({periodBounds.label})</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100 font-mono-numbers">
            {formatCurrency(summary.totalIncome)}
          </div>
          <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            {filteredTransactions.filter((t) => t.type === 'entrada').length} recebimentos registrados
          </p>
        </div>

        {/* Card 3: Total Saídas (Período) */}
        <div className="p-5 bg-neutral-900/90 border border-neutral-800 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500/60" />
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-2">
            <span>Saídas ({periodBounds.label})</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100 font-mono-numbers">
            {formatCurrency(summary.totalExpense)}
          </div>
          <p className="text-[11px] text-rose-400 mt-2 flex items-center gap-1 font-semibold">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            {filteredTransactions.filter((t) => t.type === 'saida').length} despesas realizadas
          </p>
        </div>

        {/* Card 4: Contas a Pagar & Gastos Futuros */}
        <div className="p-5 bg-neutral-900/90 border border-neutral-800 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500/60" />
          <div className="flex items-center justify-between text-neutral-400 text-xs font-semibold mb-2">
            <span>Contas a Pagar Pendentes</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-400 font-mono-numbers">
            {formatCurrency(summary.pendingPayable)}
          </div>
          <p className="text-[11px] text-neutral-400 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            {financialBills.filter((b) => b.type === 'a_pagar' && b.status === 'pendente').length} contas aguardando quitação
          </p>
        </div>
      </div>

      {/* 3. Sub-Tabs Navigation (Livro Caixa, Contas a Pagar/Receber, Gastos Futuros, Categorias) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeSubTab === 'ledger'
                ? 'bg-amber-400 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Extrato / Livro Caixa</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900/40">
              {filteredTransactions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('bills')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeSubTab === 'bills'
                ? 'bg-amber-400 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Contas a Pagar & Receber</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900/40">
              {financialBills.filter((b) => b.status === 'pendente').length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('forecast')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeSubTab === 'forecast'
                ? 'bg-amber-400 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Gastos Futuros & Previsões</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900/40">
              {futureExpensesWithDate.length + futureExpensesWithoutForecast.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeSubTab === 'categories'
                ? 'bg-amber-400 text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Gastos Mensais por Categoria</span>
          </button>
        </div>

        {/* Period Selector Dropdown */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 text-xs font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="this_month">Este Mês</option>
            <option value="last_month">Mês Anterior</option>
            <option value="last_3_months">Últimos 3 Meses</option>
            <option value="this_year">Ano Atual</option>
            <option value="all">Todo o Histórico</option>
          </select>
        </div>
      </div>

      {/* 4. CONTENT SECTIONS ACCORDING TO SUB-TAB */}

      {/* SUB-TAB 1: LIVRO CAIXA & EXTRATO */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar: Search + Type + Category */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por motivo, origem, destino..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setTypeFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setTypeFilter('entrada')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                  typeFilter === 'entrada'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-emerald-400'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Entradas
              </button>
              <button
                onClick={() => setTypeFilter('saida')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                  typeFilter === 'saida'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'text-neutral-400 hover:text-rose-400'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Saídas
              </button>
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-300 focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todas Categorias</option>
                {Object.entries(FINANCIAL_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <FileText className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">Nenhum lançamento no período</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
                Não há registros de entradas ou saídas de caixa correspondentes aos filtros selecionados.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    resetTxForm();
                    setTxType('entrada');
                    setIsTxModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Registrar Entrada
                </button>
                <button
                  onClick={() => {
                    resetTxForm();
                    setTxType('saida');
                    setIsTxModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Registrar Saída
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'entrada';
                return (
                  <div
                    key={tx.id}
                    className="p-4 bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Type Icon Badge */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>

                      {/* Info & Motivo */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-neutral-100">{tx.title}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              isIncome
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {isIncome ? 'ENTRADA' : 'SAÍDA'}
                          </span>
                          <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono-numbers">
                            <Calendar className="w-3 h-3" />
                            {formatDateBR(tx.date)}
                          </span>
                        </div>

                        {/* Motivo detalhado (De onde veio ou para onde vai) */}
                        <div className="text-xs text-neutral-300 mb-1 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-neutral-200">
                            {isIncome ? 'Origem (De quem):' : 'Destino (Favorecido):'}
                          </span>
                          <span className="text-neutral-100 font-medium">{tx.counterparty}</span>
                          {tx.description && (
                            <>
                              <span className="text-neutral-600">·</span>
                              <span className="text-neutral-400 italic">Motivo: {tx.description}</span>
                            </>
                          )}
                        </div>

                        {/* Metadata badges: Categoria, Método, Comprovante */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                          <span className="px-2 py-0.5 bg-neutral-950 rounded-md border border-neutral-800 text-neutral-300">
                            {FINANCIAL_CATEGORY_LABELS[tx.category] || tx.category}
                          </span>
                          <span className="px-2 py-0.5 bg-neutral-950 rounded-md border border-neutral-800 text-neutral-300">
                            {PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod}
                          </span>
                          {tx.receipt ? (
                            <button
                              onClick={() => setViewingReceipt(tx.receipt!)}
                              className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              Ver Comprovante ({tx.receipt.type.toUpperCase()})
                            </button>
                          ) : (
                            <span className="text-neutral-400 italic">Sem comprovante anexado</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/80">
                      <div>
                        <div
                          className={`text-base sm:text-lg font-bold font-mono-numbers ${
                            isIncome ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isIncome ? '+ ' : '- '}
                          {formatCurrency(tx.amount)}
                        </div>
                        <div className="text-[10px] text-neutral-400">Lançado por {tx.createdByName}</div>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEditTx(tx)}
                          className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg transition-colors"
                          title="Editar lançamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Tem certeza que deseja excluir o lançamento "${tx.title}" de ${formatCurrency(tx.amount)}?`)) {
                              await deleteFinancialTransaction(tx.id);
                            }
                          }}
                          className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: CONTAS A PAGAR & CONTAS A RECEBER */}
      {activeSubTab === 'bills' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            {/* Toggle A Pagar vs A Receber */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-neutral-950 rounded-xl border border-neutral-800">
              <button
                onClick={() => setBillTypeFilter('a_pagar')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  billTypeFilter === 'a_pagar'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Contas a Pagar ({financialBills.filter((b) => b.type === 'a_pagar' && b.status === 'pendente').length})
              </button>
              <button
                onClick={() => setBillTypeFilter('a_receber')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  billTypeFilter === 'a_receber'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Contas a Receber ({financialBills.filter((b) => b.type === 'a_receber' && b.status === 'pendente').length})
              </button>
            </div>

            {/* New Bill Button */}
            <button
              onClick={() => {
                resetBillForm();
                setBillType(billTypeFilter);
                setIsBillModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{billTypeFilter === 'a_pagar' ? '+ Nova Conta a Pagar' : '+ Nova Conta a Receber'}</span>
            </button>
          </div>

          {/* Bills List */}
          {financialBills.filter((b) => b.type === billTypeFilter).length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <Clock className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">
                Nenhuma conta {billTypeFilter === 'a_pagar' ? 'a pagar' : 'a receber'} cadastrada
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
                Cadastre compromissos com vencimento ou previsão para manter o fluxo financeiro planejado.
              </p>
              <button
                onClick={() => {
                  resetBillForm();
                  setBillType(billTypeFilter);
                  setIsBillModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs"
              >
                Cadastrar Agora
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {financialBills
                .filter((b) => b.type === billTypeFilter)
                .map((b) => {
                  const isPaid = b.status === 'pago';
                  const isPending = b.status === 'pendente';
                  const isOverdue = isPending && b.dueDate && new Date(b.dueDate) < new Date(new Date().toISOString().split('T')[0]);

                  return (
                    <div
                      key={b.id}
                      className={`p-4 bg-neutral-900/80 border rounded-2xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isPaid
                          ? 'border-neutral-800 opacity-60'
                          : isOverdue
                          ? 'border-red-500/40 bg-red-950/10'
                          : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isPaid
                              ? 'bg-neutral-800 text-neutral-400'
                              : isOverdue
                              ? 'bg-red-500/20 text-red-400'
                              : b.type === 'a_pagar'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-neutral-100">{b.title}</span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isOverdue
                                  ? 'bg-red-500/20 text-red-400 animate-pulse'
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}
                            >
                              {isPaid ? 'PAGO / LIQUIDADO' : isOverdue ? 'VENCIDO' : 'A VENCER'}
                            </span>
                            {b.priority === 'urgente' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                                URGENTE
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-neutral-300 mb-1">
                            <span className="font-semibold text-neutral-200">
                              {b.type === 'a_pagar' ? 'Favorecido:' : 'Pagador:'}
                            </span>{' '}
                            {b.counterparty}
                            {b.description && <span className="text-neutral-400 italic"> · {b.description}</span>}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-400">
                            <span className="font-mono-numbers text-neutral-300 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-neutral-400" />
                              {b.hasNoForecast
                                ? 'Gasto sem previsão de data'
                                : `Vencimento: ${formatDateBR(b.dueDate)}`}
                            </span>
                            <span className="px-2 py-0.5 bg-neutral-950 rounded-md border border-neutral-800 text-neutral-300">
                              {FINANCIAL_CATEGORY_LABELS[b.category] || b.category}
                            </span>
                            {b.receipt && (
                              <button
                                onClick={() => setViewingReceipt(b.receipt!)}
                                className="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md font-semibold flex items-center gap-1"
                              >
                                <Paperclip className="w-2.5 h-2.5" />
                                Comprovante Anexo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Value & Settle Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                        <div className="sm:text-right">
                          <div className="text-lg font-bold font-mono-numbers text-neutral-100">
                            {formatCurrency(b.amount)}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {isPaid ? `Liquidado em ${formatDateBR(b.paidAt?.split('T')[0])}` : 'Aguardando pagamento'}
                          </div>
                        </div>

                        {/* Liquidate button */}
                        {isPending && (
                          <button
                            onClick={() => {
                              setSettlingBill(b);
                              setSettleMethod('pix');
                              setSettleCreateTx(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1 active:scale-95 touch-manipulation"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{b.type === 'a_pagar' ? 'Pagar / Baixar' : 'Receber / Baixar'}</span>
                          </button>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditBill(b)}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg transition-colors"
                            title="Editar conta"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm(`Excluir conta "${b.title}"?`)) {
                                await deleteFinancialBill(b.id);
                              }
                            }}
                            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Excluir conta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: GASTOS FUTUROS & PREVISÕES */}
      {activeSubTab === 'forecast' && (
        <div className="space-y-6">
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-400" />
                Planejamento de Gastos Futuros da Mídia
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Identifique quanto sairá do caixa para cada necessidade planejada, quando pagaremos, ou adicione itens em &ldquo;Gasto Sem Previsão&rdquo; para futuras aquisições.
              </p>
            </div>
            <button
              onClick={() => {
                resetBillForm();
                setBillType('a_pagar');
                setIsBillModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Novo Gasto Planejado</span>
            </button>
          </div>

          {/* Section 1: Gastos Futuros Com Data Definida (Quando Pagaremos) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                Gastos com Data Marcada (Quando Pagaremos)
              </h4>
              <span className="text-xs font-semibold text-emerald-400 font-mono-numbers">
                Total Previsto: {formatCurrency(summary.futureExpensesWithDate)}
              </span>
            </div>

            {futureExpensesWithDate.length === 0 ? (
              <div className="p-6 text-center bg-neutral-900/40 border border-neutral-800 rounded-xl text-neutral-400 text-xs">
                Nenhum gasto futuro com data marcada.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {futureExpensesWithDate.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-neutral-900/90 border border-neutral-800 rounded-2xl flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-neutral-100">{b.title}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold rounded-full">
                          {formatDateBR(b.dueDate)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mb-2">
                        Favorecido: <strong className="text-neutral-200">{b.counterparty}</strong>
                        {b.description && ` · ${b.description}`}
                      </p>
                      <div className="text-[10px] text-neutral-400">
                        Categoria: {FINANCIAL_CATEGORY_LABELS[b.category] || b.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-amber-400 font-mono-numbers">
                        {formatCurrency(b.amount)}
                      </div>
                      <span className="text-[10px] text-neutral-400">Sairá do caixa</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Gastos Sem Previsão (Demandas Mapeadas) */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div>
                <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  Gastos Sem Previsão (Demandas Mapeadas para o Futuro)
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Equipamentos, reformas ou compras identificadas que ainda não possuem data de pagamento agendada.
                </p>
              </div>
              <span className="text-xs font-semibold text-purple-400 font-mono-numbers">
                Estimativa: {formatCurrency(summary.futureExpensesWithoutForecast)}
              </span>
            </div>

            {futureExpensesWithoutForecast.length === 0 ? (
              <div className="p-6 text-center bg-neutral-900/40 border border-neutral-800 rounded-xl text-neutral-400 text-xs">
                Nenhum gasto sem previsão mapeado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {futureExpensesWithoutForecast.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-purple-950/20 border border-purple-500/20 rounded-2xl flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-neutral-100">{b.title}</span>
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full">
                          SEM PREVISÃO
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 mb-2">
                        {b.description || 'Necessidade identificada para a estrutura de mídia.'}
                      </p>
                      <div className="text-[10px] text-neutral-400">
                        Destino previsto: {b.counterparty} · {FINANCIAL_CATEGORY_LABELS[b.category] || b.category}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-purple-300 font-mono-numbers">
                        {formatCurrency(b.amount)}
                      </div>
                      <button
                        onClick={() => handleOpenEditBill(b)}
                        className="text-[10px] text-amber-400 hover:underline mt-1 block"
                      >
                        Definir Data
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GASTOS MENSAIS POR CATEGORIA */}
      {activeSubTab === 'categories' && (
        <div className="space-y-6">
          <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
            <h3 className="text-base font-bold text-neutral-100 mb-1 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-400" />
              Distribuição de Gastos por Categoria ({periodBounds.label})
            </h3>
            <p className="text-xs text-neutral-400 mb-6">
              Veja onde o ministério de mídia mais investiu e alocou recursos durante o período selecionado.
            </p>

            {categoryExpenses.entries.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs">
                Nenhuma despesa registrada para o período selecionado.
              </div>
            ) : (
              <div className="space-y-4">
                {categoryExpenses.entries.map((item) => (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-200">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400 font-mono-numbers">{item.percentage.toFixed(1)}%</span>
                        <span className="font-bold text-neutral-100 font-mono-numbers">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t border-neutral-800 flex items-center justify-between text-sm font-bold text-neutral-100">
                  <span>Total Geral Despesas</span>
                  <span className="text-rose-400 font-mono-numbers">{formatCurrency(categoryExpenses.total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: NOVA ENTRADA / SAÍDA / EDIÇÃO DE TRANSAÇÃO     */}
      {/* ======================================================== */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="font-bold text-neutral-100 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                {editingTxId
                  ? 'Editar Lançamento Financeiro'
                  : txType === 'entrada'
                  ? 'Registrar Entrada de Dinheiro'
                  : 'Registrar Saída de Dinheiro'}
              </h3>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setTxType('entrada')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    txType === 'entrada'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Entrada (Receita)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('saida')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                    txType === 'saida'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Saída (Despesa)
                </button>
              </div>

              {/* Título & Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Título / Identificação do Lançamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    placeholder={txType === 'entrada' ? 'Ex: Oferta Especial de Missões, Dízimos Mídia' : 'Ex: Compra de Cabos HDMI 4K, Link Internet'}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono-numbers text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Data do Lançamento
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs font-mono-numbers"
                  />
                </div>
              </div>

              {/* Origem / Favorecido (De onde veio ou para onde vai o dinheiro) */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  {txType === 'entrada'
                    ? 'De onde veio o dinheiro? (Origem / Pagador) *'
                    : 'Para onde vai o dinheiro? (Favorecido / Loja / Destino) *'}
                </label>
                <input
                  type="text"
                  required
                  value={txCounterparty}
                  onChange={(e) => setTxCounterparty(e.target.value)}
                  placeholder={
                    txType === 'entrada'
                      ? 'Ex: Membro / Doação Externa / Venda de Camisas'
                      : 'Ex: Loja Eletrônica X, Operadora de Internet, Técnico Y'
                  }
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              {/* Motivo Detalhado / Justificativa */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Motivo / Justificativa Detalhada da Operação
                </label>
                <textarea
                  rows={2}
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={
                    txType === 'entrada'
                      ? 'Ex: Oferta voluntária destinada à troca da lente da câmera principal.'
                      : 'Ex: Reposição de 3 cabos HDMI de 10 metros para o telão de LED do altar.'
                  }
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              {/* Categoria & Forma de Pagamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Categoria Financeira
                  </label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as FinancialCategory)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    {Object.entries(FINANCIAL_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={txPaymentMethod}
                    onChange={(e) => setTxPaymentMethod(e.target.value as FinancialPaymentMethod)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comprovante Anexo (PDF ou Imagem) */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Comprovante / Recibo (PDF ou Imagem)
                </label>
                <input
                  ref={txFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleTxReceiptSelect}
                  className="hidden"
                />

                {txReceipt ? (
                  <div className="flex items-center justify-between p-2.5 bg-neutral-950 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-neutral-200 truncate">
                      {txReceipt.type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate">{txReceipt.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingReceipt(txReceipt)}
                        className="p-1 hover:text-amber-400 text-neutral-400"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxReceipt(null)}
                        className="p-1 hover:text-red-400 text-neutral-400"
                        title="Remover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUploadingReceipt}
                    onClick={() => txFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-neutral-700 hover:border-amber-400 bg-neutral-950/60 rounded-xl text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Paperclip className="w-4 h-4 text-neutral-400" />
                    <span>{isUploadingReceipt ? 'Enviando comprovante...' : 'Clique para anexar comprovante (PDF ou Foto)'}</span>
                  </button>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingTx}
                  className={`px-5 py-2 font-bold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 ${
                    txType === 'entrada'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {isSavingTx ? 'Salvando...' : editingTxId ? 'Atualizar Lançamento' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: NOVA CONTA A PAGAR / RECEBER / GASTO FUTURO   */}
      {/* ======================================================== */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="font-bold text-neutral-100 text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {editingBillId
                  ? 'Editar Conta / Previsão'
                  : billType === 'a_pagar'
                  ? 'Cadastrar Conta a Pagar / Gasto Futuro'
                  : 'Cadastrar Conta a Receber'}
              </h3>
              <button
                onClick={() => setIsBillModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="p-5 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setBillType('a_pagar')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    billType === 'a_pagar'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Conta a Pagar / Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setBillType('a_receber')}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    billType === 'a_receber'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Conta a Receber
                </button>
              </div>

              {/* Título & Valor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Descrição da Conta / Gasto *
                  </label>
                  <input
                    type="text"
                    required
                    value={billTitle}
                    onChange={(e) => setBillTitle(e.target.value)}
                    placeholder="Ex: Mensalidade Streaming, Microfone sem Fio, Manutenção"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Valor Estimado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono-numbers text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Prioridade
                  </label>
                  <select
                    value={billPriority}
                    onChange={(e) => setBillPriority(e.target.value as FinancialBillPriority)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Favorecido / Pagador */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  {billType === 'a_pagar' ? 'Favorecido (Quem receberá) *' : 'Pagador (Quem pagará) *'}
                </label>
                <input
                  type="text"
                  required
                  value={billCounterparty}
                  onChange={(e) => setBillCounterparty(e.target.value)}
                  placeholder="Ex: Fornecedor de Cabos, Loja Musical, Membro"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                />
              </div>

              {/* Data ou "Gasto Sem Previsão" Checkbox */}
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                <label className="flex items-center gap-2 text-xs text-neutral-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billHasNoForecast}
                    onChange={(e) => setBillHasNoForecast(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                  />
                  <span className="font-semibold text-amber-400">Gasto sem previsão de data</span>
                  <span className="text-neutral-400 text-[11px]">(Demanda mapeada para o futuro)</span>
                </label>

                {!billHasNoForecast && (
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Data Prevista para Pagamento *
                    </label>
                    <input
                      type="date"
                      required={!billHasNoForecast}
                      value={billDueDate}
                      onChange={(e) => setBillDueDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs font-mono-numbers"
                    />
                  </div>
                )}
              </div>

              {/* Comprovante / Boleto Anexo */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Boleto / Orçamento / Comprovante (PDF ou Foto)
                </label>
                <input
                  ref={billFileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleBillReceiptSelect}
                  className="hidden"
                />

                {billReceipt ? (
                  <div className="flex items-center justify-between p-2.5 bg-neutral-950 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-neutral-200 truncate">
                      {billReceipt.type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-red-400 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{billReceipt.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewingReceipt(billReceipt)}
                        className="p-1 hover:text-amber-400 text-neutral-400"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillReceipt(null)}
                        className="p-1 hover:text-red-400 text-neutral-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUploadingReceipt}
                    onClick={() => billFileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-neutral-700 hover:border-amber-400 bg-neutral-950/60 rounded-xl text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Paperclip className="w-4 h-4 text-neutral-400" />
                    <span>{isUploadingReceipt ? 'Enviando...' : 'Anexar Boleto / Orçamento (PDF ou Foto)'}</span>
                  </button>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBill}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50"
                >
                  {isSavingBill ? 'Salvando...' : editingBillId ? 'Atualizar Conta' : 'Salvar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: LIQUIDAR / DAR BAIXA EM CONTA                   */}
      {/* ======================================================== */}
      {settlingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-neutral-100 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Confirmar Liquidação / Pagamento
              </h3>
              <button onClick={() => setSettlingBill(null)} className="text-neutral-400 hover:text-neutral-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-1">
              <div className="text-xs text-neutral-400">Conta a liquidar:</div>
              <div className="font-bold text-sm text-neutral-100">{settlingBill.title}</div>
              <div className="text-lg font-bold text-amber-400 font-mono-numbers">
                {formatCurrency(settlingBill.amount)}
              </div>
              <div className="text-[11px] text-neutral-400">
                Favorecido: {settlingBill.counterparty}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Forma de Pagamento Utilizada
              </label>
              <select
                value={settleMethod}
                onChange={(e) => setSettleMethod(e.target.value as FinancialPaymentMethod)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
              >
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settleCreateTx}
                onChange={(e) => setSettleCreateTx(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-neutral-900 border-neutral-700"
              />
              <span>
                Lançar automaticamente como{' '}
                <strong className={settlingBill.type === 'a_pagar' ? 'text-rose-400' : 'text-emerald-400'}>
                  {settlingBill.type === 'a_pagar' ? 'Saída de Caixa' : 'Entrada de Caixa'}
                </strong>{' '}
                no Livro Caixa
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setSettlingBill(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSettling}
                onClick={handleConfirmSettle}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs shadow-md disabled:opacity-50"
              >
                {isSettling ? 'Confirmando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VISUALIZADOR DE COMPROVANTE (IMAGEM OU PDF)     */}
      {/* ======================================================== */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                {viewingReceipt.type === 'pdf' ? (
                  <FileText className="w-5 h-5 text-red-400" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                )}
                <span className="font-bold text-sm text-neutral-100 truncate max-w-sm sm:max-w-md">
                  {viewingReceipt.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingReceipt.url}
                  download={viewingReceipt.name}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </a>
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="text-neutral-400 hover:text-neutral-200 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-neutral-950">
              {viewingReceipt.type === 'image' ? (
                <img
                  src={viewingReceipt.url}
                  alt={viewingReceipt.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : viewingReceipt.type === 'pdf' ? (
                <div className="w-full h-[65vh] flex flex-col items-center justify-center space-y-4 text-center">
                  <FileText className="w-16 h-16 text-red-400" />
                  <div className="text-neutral-200 font-semibold text-sm">
                    Documento PDF de Comprovante
                  </div>
                  <p className="text-xs text-neutral-400 max-w-md">
                    Clique abaixo para visualizar o PDF completo em uma nova aba ou salvar diretamente em seu dispositivo.
                  </p>
                  <a
                    href={viewingReceipt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Abrir / Baixar Documento PDF
                  </a>
                </div>
              ) : (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  Arquivo anexado. Clique em &ldquo;Baixar&rdquo; acima para abrir.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
