import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot,
  setDoc
} from "firebase/firestore";
import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Settings, 
  List, 
  Download, 
  Trash2, 
  Save,
  CheckCircle2,
  Receipt,
  CreditCard,
  Banknote,
  Building2,
  Home,
  Edit,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

const AccountingApp = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState('form');
  const [spenders, setSpenders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [records, setRecords] = useState([]);
  const [successMsg, setSuccessMsg] = useState(''); // 修改為字串，方便顯示不同訊息
  const [vendors, setVendors] = useState([]); // 廠商清單
  // 新增狀態：編輯功能與匯出日期篩選
  const [editingId, setEditingId] = useState(null); 
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  // 新增狀態：匯入功能
  const [importPreview, setImportPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [importFile, setImportFile] = useState(null);
  
  // 新增狀態：排序功能
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [categories, setCategories] = useState([]); // 消費種類清單
  const [newCategoryName, setNewCategoryName] = useState(''); // 設定頁新增種類輸入框
  const [newSpenderName, setNewSpenderName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newCreditCardName, setNewCreditCardName] = useState('');
  const [newBankAccountName, setNewBankAccountName] = useState('');
  const [newVendorName, setNewVendorName] = useState(''); // 設定頁面用的輸入框
// 更新篩選器狀態：鎖定你指定的 4 個核心檢視分類
  const [filterConfig, setFilterConfig] = useState({
    spender: '',
    category: '',
    projectName: '',
    isReimbursable: '' // '' 全部, 'true' 需報帳, 'false' 不需報帳
  });
  // 預設表單資料
  const initialFormData = {
    spender: '',
    date: new Date().toISOString().split('T')[0], // 今天日期
    category: '',       // ✨ 新增消費種類
    barcode: '',
    itemName: '',
    amount: '',
    tax: '',
    vendor: '',
    paymentMethod: '現金',
    paymentDetail: '',
    usageType: '公司用',
    projectName: '',
    isReimbursable: false,
    remark: ''
  };
  
  const [formData, setFormData] = useState(initialFormData);

  // 初始化時自動選擇第一個花費人員
  useEffect(() => {
    if (spenders.length > 0 && !formData.spender) {
      setFormData(prev => ({ ...prev, spender: spenders[0] }));
    }
  }, [spenders]);

  // 新增：監聽 Firebase 資料庫的變動
  useEffect(() => {
    // 設定查詢：目標是 "records" 集合，並依照日期 (date) 降序排列
    const q = query(collection(db, "records"), orderBy("date", "desc"));
    
    // onSnapshot 會持續監聽，只要雲端有資料新增、修改、刪除，這裡就會自動更新
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id // Firebase 給每個資料的專屬 ID
      }));
      setRecords(recordsData); // 把雲端抓下來的資料放進畫面的狀態裡
    });

    // 離開頁面時停止監聽，節省效能
    return () => unsubscribe();
  }, []);

// 2. 新增：監聽系統設定 (人員、專案、信用卡、帳號)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSpenders(data.spenders || []);
        setProjects(data.projects || []);
        setCreditCards(data.creditCards || []);
        setBankAccounts(data.bankAccounts || []);
        setVendors(data.vendors || []);
        setCategories(data.categories || []); // ✨ 新增這行，從資料庫讀取分類
      } else {
        // 如果雲端沒有設定，初始化一份預設值
        setDoc(doc(db, "config", "settings"), {
          spenders: ['自己', '老闆', '採購人員A'],
          projects: ['專案A', '專案B'],
          creditCards: ['公司國泰卡', '個人玉山卡'],
          bankAccounts: ['公司中信帳戶', '個人台新帳戶']
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 輔助函式：更新設定到雲端
  const updateCloudSettings = async (key, newList) => {
    try {
      await setDoc(doc(db, "config", "settings"), { [key]: newList }, { merge: true });
    } catch (error) {
      console.error("更新設定失敗", error);
      alert("設定更新失敗，請檢查權限！");
    }
  };

  // 處理表單變更
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;

    if (name === 'paymentMethod') {
      setFormData(prev => ({ ...prev, [name]: newValue, paymentDetail: '' }));
    } else if (name === 'usageType' && value === '家用') {
      setFormData(prev => ({ ...prev, [name]: newValue, projectName: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: newValue }));
    }
  };

  // 提交表單 (寫入雲端)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.spender || !formData.itemName || !formData.amount || !formData.category) return;
    const payload = {
      ...formData,
      amount: Number(formData.amount),
      tax: formData.tax ? Number(formData.tax) : 0,
      // 順手加上這行，確保「是否報帳」存進資料庫時絕對是乾淨的 true / false 布林值
      isReimbursable: Boolean(formData.isReimbursable) 
    };
    try {
      if (editingId) {
        // 編輯：更新雲端現有紀錄
        const recordRef = doc(db, "records", editingId);
        await updateDoc(recordRef, payload);
        setSuccessMsg('紀錄已成功更新至雲端！');
        setEditingId(null); // 更新完畢後退出編輯模式
      } else {
        // 新增：推送新紀錄到雲端
        await addDoc(collection(db, "records"), payload);
        setSuccessMsg('紀錄已成功儲存至雲端！');
      }
      
      // 重置表單 (保留日期和人員，清空其他)
      setFormData(prev => ({
        ...initialFormData,
        spender: prev.spender,
        date: prev.date,
      }));
    } catch (error) {
      console.error("寫入失敗: ", error);
      alert("儲存失敗！請檢查網路連線或 Firebase 權限設定。");
    }

    // 顯示成功訊息
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // 進入編輯模式
  const handleEdit = (record) => {
    setFormData(record);
    setEditingId(record.id);
    setActiveTab('form'); // 自動切回表單分頁
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingId(null);
    setFormData(prev => ({
      ...initialFormData,
      spender: prev.spender,
      date: prev.date,
    }));
  };

  // 處理排序邏輯
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  // ✨ 核心邏輯：先過濾資料，再進行排序 ✨
  const displayRecords = React.useMemo(() => {
    // 1. 先進行篩選
    let result = records.filter(record => {
      // 比對消費人員
      const matchSpender = !filterConfig.spender || record.spender === filterConfig.spender;
      
      // ✨ 新增：比對消費種類
      const matchCategory = !filterConfig.category || record.category === filterConfig.category;
      
      // 比對專案名稱
      const matchProject = !filterConfig.projectName || record.projectName === filterConfig.projectName;
      
      // ✨ 新增：比對是否報帳 (因為 filterConfig 存的是字串 'true'/'false'，但 record 存的是布林值 true/false，所以要轉換)
      let matchReimbursable = true;
      if (filterConfig.isReimbursable === 'true') matchReimbursable = record.isReimbursable === true;
      if (filterConfig.isReimbursable === 'false') matchReimbursable = record.isReimbursable === false;
      
      // 必須四個條件都符合才顯示
      return matchSpender && matchCategory && matchProject && matchReimbursable;
    });

    // 2. 再進行排序 (延用你原本的排序邏輯，完全不動)
    if (sortConfig.key !== null) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'amount') {
          const totalA = (Number(a.amount) || 0) + (Number(a.tax) || 0);
          const totalB = (Number(b.amount) || 0) + (Number(b.tax) || 0);
          return sortConfig.direction === 'asc' 
            ? totalA - totalB 
            : totalB - totalA;
        }

        const strA = String(aValue || '').toLowerCase();
        const strB = String(bValue || '').toLowerCase();
        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [records, sortConfig, filterConfig]);
  // 取得排序後的紀錄 (使用 useMemo 增進效能)
  // const sortedRecords = React.useMemo(() => {
  //   let sortableItems = [...records];
  //   if (sortConfig.key !== null) {
  //     sortableItems.sort((a, b) => {
  //       let aValue = a[sortConfig.key];
  //       let bValue = b[sortConfig.key];

  //       // 處理布林值 (報帳)
  //       if (sortConfig.key === 'isReimbursable') {
  //         aValue = aValue ? '1' : '0';
  //         bValue = bValue ? '1' : '0';
  //       }

  //       // 處理數字 (金額)
  //       if (sortConfig.key === 'amount') {
  //         return sortConfig.direction === 'asc' 
  //           ? Number(aValue || 0) - Number(bValue || 0) 
  //           : Number(bValue || 0) - Number(aValue || 0);
  //       }

  //       // 處理字串 (預設皆為字串比較)
  //       const strA = String(aValue || '').toLowerCase();
  //       const strB = String(bValue || '').toLowerCase();
        
  //       if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
  //       if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
  //       return 0;
  //     });
  //   }
  //   return sortableItems;
  // }, [records, sortConfig]);

  // CSV 欄位跳脫處理 (防止內容包含逗號導致欄位錯位)
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // 如果內容包含逗號、雙引號或換行，就必須用雙引號包起來
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // 匯出 Excel (CSV)
  const handleExport = (onlyReimbursable = false) => {
    // 根據選擇的日期區間進行篩選，並套用目前的排序 (displayRecords)
    let filteredRecords = displayRecords;
    if (exportStartDate) {
      filteredRecords = filteredRecords.filter(r => r.date >= exportStartDate);
    }
    if (exportEndDate) {
      filteredRecords = filteredRecords.filter(r => r.date <= exportEndDate);
    }

    // 若為報帳專用，進一步篩選
    if (onlyReimbursable) {
      filteredRecords = filteredRecords.filter(r => r.isReimbursable);
    }

    if (filteredRecords.length === 0) {
      alert(onlyReimbursable ? '該日期區間內沒有符合「公司用」且「需報帳」的紀錄！' : '該日期區間內沒有可匯出的紀錄！');
      return;
    }

    const headers = ['花費人員', '日期', '消費種類', '發票條碼', '品名', '未稅金額', '稅金', '總金額', '消費形式', '付款細節', '公司/家用/其他', '專案名稱', '廠商', '需報帳', '備註'];
    const csvRows = filteredRecords.map(r => [
      escapeCSV(r.spender || '無'),
      escapeCSV(r.date || '無'),
      escapeCSV(r.category || '未分類'), // 補上消費種類
      escapeCSV(r.barcode || '無'),
      escapeCSV(r.itemName || '無'),
      escapeCSV(r.amount || '0'), // 未稅金額
      escapeCSV(r.tax || '0'),    // 稅金
      escapeCSV(Number(r.amount || 0) + Number(r.tax || 0)), // 總金額
      escapeCSV(r.paymentMethod || '無'),
      escapeCSV(r.paymentDetail || '無'),
      escapeCSV(r.usageType || '無'),
      escapeCSV(r.projectName || '無'),
      escapeCSV(r.vendor || '無'),
      escapeCSV(r.isReimbursable ? '是' : '否'),
      escapeCSV(r.remark || '無')
    ]);

    const csvContent = '\uFEFF' + [headers, ...csvRows].map(e => e.join(',')).join('\n'); // \uFEFF 避免中文亂碼
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const fileName = onlyReimbursable ? '報帳專用紀錄' : '帳務紀錄';
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 刪除紀錄 (從雲端刪除)
  const deleteRecord = async (id) => {
    if (confirm('確定要從雲端永久刪除這筆紀錄嗎？此動作無法復原。')) {
      try {
        await deleteDoc(doc(db, "records", id));
        // 注意：這裡不需要寫 setRecords(...) 來更新畫面
        // 因為我們上面寫了 onSnapshot，雲端一刪除，畫面就會自動同步消失！
      } catch (error) {
        console.error("刪除失敗: ", error);
        alert("刪除失敗！請檢查權限。");
      }
    }
  };

// 修改：設定功能全部改為更新 Firebase
// --- 統一的新增設定函式 (帶有防呆與錯誤提示) ---
  const handleAddSetting = async (e, firebaseKey, value, resetValue, currentList) => {
    e.preventDefault();
    try {
      // 1. 防呆：確保 currentList 一定是陣列，如果不是就當作空陣列
      const safeList = Array.isArray(currentList) ? currentList : [];
      const trimmedValue = value ? value.trim() : '';

      // 2. 如果沒輸入東西，直接結束
      if (!trimmedValue) return;

      // 3. 檢查是否重複
      if (safeList.includes(trimmedValue)) {
        alert('這個選項已經存在囉！請換一個名稱。');
        return;
      }

      // 4. 寫入 Firebase
      await updateCloudSettings(firebaseKey, [...safeList, trimmedValue]);
      
      // 5. 清空輸入框
      resetValue('');

    } catch (error) {
      console.error("新增設定發生錯誤: ", error);
      alert('新增失敗！請按 F12 查看錯誤訊息。');
    }
  };

  // --- 統一的刪除設定函式 ---
  const deleteSetting = async (name, firebaseKey, formDataKey, currentList) => {
    const safeList = Array.isArray(currentList) ? currentList : [];
    const newList = safeList.filter(item => item !== name);
    
    if (newList.length === 0) { 
      alert('至少需要保留一個選項喔！'); 
      return; 
    }
    
    try {
      await updateCloudSettings(firebaseKey, newList);
      // 如果目前表單正好選中這個被刪除的項目，就把它清空
      if (formData[formDataKey] === name) {
        setFormData(prev => ({ ...prev, [formDataKey]: '' }));
      }
    } catch (error) {
      console.error("刪除設定發生錯誤: ", error);
      alert('刪除失敗！');
    }
  };

  // 解析單行 CSV (考慮引號與自動分隔符號)
  const parseCSVLine = (line, delimiter = ',') => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // 跳過跳脫的引號
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // 處理上傳檔案
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    setImportError('');
    setImportPreview([]);

    const tryParse = (text, isFallback = false) => {
      // 移除可能存在的 BOM (\uFEFF)
      const cleanText = text.replace(/^\uFEFF/, '');
      // 分割行，並移除完全空白的行
      const lines = cleanText.split(/\r?\n/).filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        if (!isFallback) readWithEncoding('big5');
        else setImportError('檔案格式錯誤或沒有資料！');
        return;
      }

      // 自動偵測分隔符號 (支援逗號、Tab、分號)
      let delimiter = ',';
      if (lines[0].split('\t').length >= 5) {
        delimiter = '\t';
      } else if (lines[0].split(';').length >= 5) {
        delimiter = ';';
      }

      // 取得標題並移除可能多餘的引號
      const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      
      // 動態建立欄位對應表 (防呆：不怕 Excel 欄位被移動或刪除)
      const headerMap = {};
      headers.forEach((h, idx) => { headerMap[h] = idx; });

      const getCol = (names) => {
        for (let name of names) {
          if (headerMap[name] !== undefined) return headerMap[name];
        }
        return -1;
      };

      const cols = {
        spender: getCol(['花費人員', '人員']),
        date: getCol(['日期', '時間']),
        category: getCol(['消費種類', '種類']), // ✨ 新增這行：自動抓取消費種類欄位
        barcode: getCol(['發票條碼', '條碼']),
        itemName: getCol(['品名', '名稱']),
        amount: getCol(['未稅金額', '金額', '花費']),
        tax: getCol(['稅金']),
        paymentMethod: getCol(['消費形式', '付款方式', '方式']),
        paymentDetail: getCol(['付款細節', '細節', '卡片', '帳號']),
        usageType: getCol(['公司/家用/其他', '公司用/家用/其他', '屬性', '分類']),
        projectName: getCol(['專案名稱', '專案']),
        isReimbursable: getCol(['需報帳', '報帳']),
        remark: getCol(['備註', '其他'])
      };

      // 驗證標題列 (只要抓得到最基本的幾個欄位就放行)
      const isHeaderValid = cols.spender !== -1 || cols.date !== -1 || cols.itemName !== -1;

      if (!isHeaderValid) {
        if (!isFallback) {
          // 如果 UTF-8 解析失敗，自動嘗試 Big5 (台灣 Excel 預設)
          readWithEncoding('big5');
        } else {
          // 判斷是否誤傳了 Excel (.xlsx) 檔案
          const preview = headers.join(', ');
          if (preview.includes('PK')) {
            setImportError('偵測到此為 Excel (.xlsx) 檔。請在 Excel 中「另存新檔」為「CSV (逗號分隔)」後再上傳！');
          } else {
            setImportError(`欄位無法辨識！(目前讀取到: ${preview.substring(0, 30)}...) 請確保您上傳的是原本匯出的 CSV 格式。`);
          }
        }
        return;
      }

      const parsedRecords = [];
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], delimiter);
        
        // 只要這行有任何內容，就算後面都是空格也照樣讀取
        if (row.join('').trim() === '') continue;

        try {
          // 確保所有欄位即使是 undefined 或是完全空白，都會被安全處理
          const safeTrim = (val) => (val === undefined || val === null ? '' : String(val).trim());

          // 使用動態欄位讀取資料
          let rawSpender = cols.spender !== -1 ? safeTrim(row[cols.spender]) : '';
          let rawDate = cols.date !== -1 ? safeTrim(row[cols.date]) : '';
          let rawCategory = cols.category !== -1 ? safeTrim(row[cols.category]) : ''; // ✨ 新增這行
          let rawBarcode = cols.barcode !== -1 ? safeTrim(row[cols.barcode]) : '';
          let rawItemName = cols.itemName !== -1 ? safeTrim(row[cols.itemName]) : '';
          let rawAmount = cols.amount !== -1 ? safeTrim(row[cols.amount]) : '';
          let rawTax = cols.tax !== -1 ? safeTrim(row[cols.tax]) : '';
          let rawPaymentMethod = cols.paymentMethod !== -1 ? safeTrim(row[cols.paymentMethod]) : '';
          let rawPaymentDetail = cols.paymentDetail !== -1 ? safeTrim(row[cols.paymentDetail]) : '';
          let rawUsageType = cols.usageType !== -1 ? safeTrim(row[cols.usageType]) : '';
          let rawProjectName = cols.projectName !== -1 ? safeTrim(row[cols.projectName]) : '';
          let rawIsReimbursable = cols.isReimbursable !== -1 ? safeTrim(row[cols.isReimbursable]) : '';
          let rawRemark = cols.remark !== -1 ? safeTrim(row[cols.remark]) : '';

          // 處理 Excel 可能改變的日期格式
          if (!rawDate || rawDate === '無') {
            rawDate = new Date().toISOString().split('T')[0];
          } else {
            rawDate = rawDate.replace(/\//g, '-');
            const dateParts = rawDate.split('-');
            if (dateParts.length === 3) {
               rawDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
            }
          }

          // 處理 Excel 可能加入的金錢千分位逗號，並處理空白欄位
          if (!rawAmount || rawAmount === '無') rawAmount = '0';
          rawAmount = rawAmount.replace(/,/g, '');
          if (isNaN(Number(rawAmount))) rawAmount = '0';
          
          if (!rawTax || rawTax === '無') rawTax = '0';
          rawTax = rawTax.replace(/,/g, '');
          if (isNaN(Number(rawTax))) rawTax = '0';

          parsedRecords.push({
            id: Date.now().toString() + '-' + i,
            spender: rawSpender || '無',
            date: rawDate,
            category: rawCategory || '未分類', // ✨ 新增這行
            barcode: rawBarcode === '無' ? '' : rawBarcode,
            itemName: rawItemName || '無',
            amount: rawAmount,
            tax: rawTax,
            paymentMethod: rawPaymentMethod || '現金',
            paymentDetail: rawPaymentDetail === '無' ? '' : rawPaymentDetail,
            usageType: rawUsageType || '公司用',
            projectName: rawProjectName === '無' ? '' : rawProjectName,
            isReimbursable: rawIsReimbursable === '是',
            remark: rawRemark === '無' ? '' : rawRemark
          });
        } catch (err) {
          console.error('匯入單行解析錯誤:', err);
        }
      }

      if (parsedRecords.length === 0) {
        setImportError('找不到有效的紀錄資料！');
      } else {
        setImportPreview(parsedRecords);
      }
    };

    const readWithEncoding = (encoding) => {
      const reader = new FileReader();
      reader.onload = (event) => tryParse(event.target.result, encoding !== 'utf-8');
      reader.onerror = () => setImportError('讀取檔案時發生錯誤！');
      reader.readAsText(file, encoding);
    };

    // 預設先以 UTF-8 讀取，若失敗會自動 fallback 到 Big5
    readWithEncoding('utf-8');
  };

  // 確認匯入
const confirmImport = async () => {
    if (importPreview.length === 0) return;

    const newSpenders = new Set(spenders);
    const newProjects = new Set(projects);
    const newCreditCards = new Set(creditCards);
    const newBankAccounts = new Set(bankAccounts);
    const newCategories = new Set(categories); // ✨ 新增這行：自動同步消費種類清單

    importPreview.forEach(r => {
      if (r.spender && r.spender !== '無') newSpenders.add(r.spender);
      if (r.projectName && r.projectName !== '無') newProjects.add(r.projectName);
      if (r.paymentMethod === '信用卡' && r.paymentDetail && r.paymentDetail !== '無') newCreditCards.add(r.paymentDetail);
      if (r.paymentMethod === '轉帳' && r.paymentDetail && r.paymentDetail !== '無') newBankAccounts.add(r.paymentDetail);
      if (r.category && r.category !== '未分類') newCategories.add(r.category); // ✨ 新增這行
    });

    // 修改：匯入的新設定也同步寫入雲端
    await setDoc(doc(db, "config", "settings"), {
      spenders: Array.from(newSpenders),
      projects: Array.from(newProjects),
      creditCards: Array.from(newCreditCards),
      bankAccounts: Array.from(newBankAccounts),
      categories: Array.from(newCategories) // ✨ 新增這行
    }, { merge: true });

    setRecords(prev => [...importPreview, ...prev]);
    setSuccessMsg(`成功匯入 ${importPreview.length} 筆紀錄！`);
    
    setImportPreview([]);
    setImportFile(null);
    setImportError('');
    setActiveTab('records');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // 取消匯入
  const cancelImport = () => {
    setImportPreview([]);
    setImportFile(null);
    setImportError('');
  };

  // --- Render Helpers ---

  // 渲染可排序的表頭組件
  const SortableHeader = ({ label, sortKey, minWidth = '' }) => (
    <th 
      className={`p-4 font-semibold whitespace-nowrap cursor-pointer hover:bg-gray-100 transition select-none ${minWidth}`}
      onClick={() => handleSort(sortKey)}
      title={`點擊以依據「${label}」排序`}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <div className="flex flex-col items-center">
          {sortConfig.key === sortKey ? (
            sortConfig.direction === 'asc' 
              ? <ArrowUp size={14} className="text-blue-600 font-bold" /> 
              : <ArrowDown size={14} className="text-blue-600 font-bold" />
          ) : (
            <ArrowUpDown size={14} className="text-gray-300" />
          )}
        </div>
      </div>
    </th>
  );

  const renderForm = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Receipt className="text-blue-600" />
        {editingId ? '編輯帳務紀錄' : '新增帳務紀錄'}
      </h2>
      
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* 花費人員 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">花費人員</label>
            <select
              name="spender"
              value={formData.spender}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            >
              <option value="" disabled>請選擇人員</option>
              {spenders.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 日期 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">日期</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* 日期下方，可以新增一個獨立的網格區塊 */}
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">消費種類 *</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
            >
              <option value="" disabled>請選擇消費種類 (如：雜費、進貨...)</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 發票條碼 (選填) - 移至品名前面 */}
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">發票條碼 (選填)</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleInputChange}
              placeholder="掃描或輸入條碼"
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* 品名 */}
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">品名</label>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleInputChange}
              placeholder="請輸入物品名稱"
              required
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          {/* 未稅金額與稅金 (並排設計) */}
          <div className="space-y-2 sm:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* 未稅金額 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">未稅金額 *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                    required
                    className="w-full p-3 pl-8 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              {/* 稅金 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">稅金 (選填)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="tax"
                    value={formData.tax}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="預設為 0"
                    className="w-full p-3 pl-8 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 消費形式 */}
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">消費形式</label>
            <div className="grid grid-cols-3 gap-3">
              {['現金', '信用卡', '轉帳'].map((method) => (
                <label 
                  key={method} 
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all ${
                    formData.paymentMethod === method 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={formData.paymentMethod === method}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  {method === '現金' && <Banknote size={20} className="mb-1" />}
                  {method === '信用卡' && <CreditCard size={20} className="mb-1" />}
                  {method === '轉帳' && <Receipt size={20} className="mb-1" />}
                  <span className="text-sm font-medium">{method}</span>
                </label>
              ))}
            </div>

            {/* 動態顯示信用卡或轉帳的細節選項 */}
            {formData.paymentMethod === '信用卡' && (
              <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-fade-in">
                <label className="block text-sm font-medium text-blue-800 mb-2">選擇卡片</label>
                <select
                  name="paymentDetail"
                  value={formData.paymentDetail}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2.5 rounded-lg border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>請選擇卡片種類</option>
                  {creditCards.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {formData.paymentMethod === '轉帳' && (
              <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 animate-fade-in">
                <label className="block text-sm font-medium text-blue-800 mb-2">選擇帳號</label>
                <select
                  name="paymentDetail"
                  value={formData.paymentDetail}
                  onChange={handleInputChange}
                  required
                  className="w-full p-2.5 rounded-lg border border-blue-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="" disabled>請選擇轉出帳號</option>
                  {bankAccounts.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* 屬性 (公司用/家用) */}
          <div className="space-y-2 sm:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-3">使用分類</label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="usageType" value="公司用" checked={formData.usageType === '公司用'} onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
                <Building2 size={18} className="text-gray-500" />
                <span>公司用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="usageType" value="家用" checked={formData.usageType === '家用'} onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
                <Home size={18} className="text-gray-500" />
                <span>家用</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="usageType" value="其他" checked={formData.usageType === '其他'} onChange={handleInputChange} className="w-4 h-4 text-blue-600" />
                <List size={18} className="text-gray-500" />
                <span>其他</span>
              </label>
            </div>

            {formData.usageType === '公司用' && (
              <div className="pt-4 border-t border-gray-200 mb-4 space-y-4">
                {/* 專案名稱 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">專案名稱</label>
                  <select name="projectName" value={formData.projectName} onChange={handleInputChange} required className="w-full p-2.5 rounded-lg border border-gray-300 bg-white">
                    <option value="" disabled>請選擇專案</option>
                    {projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {/* ✨ 新增：廠商 (選填) ✨ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">廠商 (選填)</label>
                  <select 
                    name="vendor" 
                    value={formData.vendor || ''} 
                    onChange={handleInputChange} 
                    className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
                  >
                    <option value="">-- 不指定廠商 --</option>
                    {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* 修改：將報帳按鈕獨立出來，讓公司用和家用都能顯示並勾選 */}
            <div className="pt-4 border-t border-gray-200 mt-2">
              <label className="flex items-center gap-2 cursor-pointer w-fit p-2 rounded hover:bg-gray-100">
                <input type="checkbox" name="isReimbursable" checked={formData.isReimbursable} onChange={handleInputChange} className="w-4 h-4 rounded text-blue-600" />
                <span className="font-medium text-blue-800">這筆花費需要報帳</span>
              </label>
            </div>
          </div>

          {/* 備註 (選填) */}
          <div className="space-y-2 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">備註 (選填)</label>
            <textarea
              name="remark"
              value={formData.remark}
              onChange={handleInputChange}
              placeholder="輸入其他備註事項..."
              rows="2"
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none"
            />
          </div>
        </div>

        <div className="flex gap-4">
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="w-1/3 bg-gray-200 text-gray-700 font-semibold p-4 rounded-xl shadow-sm hover:bg-gray-300 focus:ring-4 focus:ring-gray-100 transition flex items-center justify-center gap-2"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            className={`${editingId ? 'w-2/3' : 'w-full'} bg-blue-600 text-white font-semibold p-4 rounded-xl shadow-md hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition flex items-center justify-center gap-2`}
          >
            <Save size={20} />
            {editingId ? '更新紀錄' : '儲存紀錄'}
          </button>
        </div>
      </form>
    </div>
  );

const renderRecords = () => (
    <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 border border-gray-100 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <List className="text-blue-600" />
          帳務紀錄清單
        </h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg border border-gray-200">
            <span className="text-gray-600 font-medium whitespace-nowrap hidden lg:inline">匯出區間：</span>
            <input 
              type="date" 
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="p-1.5 rounded border border-gray-300 outline-none focus:border-blue-500 bg-white"
              title="開始日期"
            />
            <span className="text-gray-400">~</span>
            <input 
              type="date" 
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="p-1.5 rounded border border-gray-300 outline-none focus:border-blue-500 bg-white"
              title="結束日期"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleExport(true)}
              disabled={records.length === 0}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-auto whitespace-nowrap"
              title="僅匯出公司用且需報帳的紀錄"
            >
              <Download size={18} />
              匯出報帳用
            </button>
            <button
              onClick={() => handleExport(false)}
              disabled={records.length === 0}
              className="bg-green-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-green-700 focus:ring-4 focus:ring-green-300 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-auto whitespace-nowrap"
              title="匯出所有顯示的紀錄"
            >
              <Download size={18} />
              匯出全部
            </button>
          </div>
        </div>
      </div>

      {/* ✨ 1. 更新篩選控制列：改成你要的 4 個分類 ✨ */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          
          {/* 分類一：消費人員 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">消費人員</label>
            <select 
              value={filterConfig.spender}
              onChange={(e) => setFilterConfig({...filterConfig, spender: e.target.value})}
              className="w-full p-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全部人員</option>
              {spenders.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 分類二：消費種類 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">消費種類</label>
            <select 
              value={filterConfig.category}
              onChange={(e) => setFilterConfig({...filterConfig, category: e.target.value})}
              className="w-full p-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全部種類</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 分類三：所屬專案 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">所屬專案</label>
            <select 
              value={filterConfig.projectName}
              onChange={(e) => setFilterConfig({...filterConfig, projectName: e.target.value})}
              className="w-full p-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全部專案</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* 分類四：是否報帳 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 ml-1">是否報帳</label>
            <select 
              value={filterConfig.isReimbursable}
              onChange={(e) => setFilterConfig({...filterConfig, isReimbursable: e.target.value})}
              className="w-full p-2 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">全部狀態</option>
              <option value="true">需報帳 💰</option>
              <option value="false">不需報帳 ❌</option>
            </select>
          </div>

          {/* 重置按鈕 */}
          <div className="flex items-end col-span-2 md:col-span-1">
            <button 
              onClick={() => setFilterConfig({ spender: '', category: '', projectName: '', isReimbursable: '' })}
              className="w-full p-2 text-sm text-blue-600 font-medium hover:bg-blue-100 rounded-lg transition border border-transparent hover:border-blue-200"
            >
              清除篩選
            </button>
          </div>
        </div>
      )}

      {/* ✨ 2. 新增防呆：如果有紀錄，但「篩選後」找不到資料時的提示 ✨ */}
      {records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">目前尚無紀錄</h3>
          <p className="text-gray-500">請前往「記帳」頁面新增您的第一筆帳務。</p>
        </div>
      ) : displayRecords.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
           <h3 className="text-lg font-medium text-gray-900">找不到符合條件的紀錄</h3>
           <p className="text-gray-500">請嘗試調整上方的檢視分類。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                <SortableHeader label="日期" sortKey="date" />
                <SortableHeader label="人員" sortKey="spender" />
                <SortableHeader label="種類" sortKey="category" /> {/* ✨ 3. 新增這行：種類表頭 ✨ */}
                <SortableHeader label="品名" sortKey="itemName" minWidth="min-w-[150px]" />
                <SortableHeader label="廠商" sortKey="vendor" />
                <SortableHeader label="總金額" sortKey="amount" />
                <SortableHeader label="方式" sortKey="paymentMethod" />
                <SortableHeader label="屬性" sortKey="usageType" />
                <SortableHeader label="報帳" sortKey="isReimbursable" />
                <SortableHeader label="備註" sortKey="remark" minWidth="min-w-[100px]" />
                <th className="p-4 font-semibold text-center whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-700 whitespace-nowrap">{record.date || '無'}</td>
                  <td className="p-4 text-gray-700 whitespace-nowrap">{record.spender || '無'}</td>
                  
                  {/* ✨ 4. 新增這區塊：顯示消費種類 ✨ */}
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-semibold">
                      {record.category || '未分類'}
                    </span>
                  </td>

                  <td className="p-4 text-gray-900 font-medium">
                    {record.itemName || '無'}
                    <div className="text-xs text-gray-400 mt-1">條碼: {record.barcode || '無'}</div>
                  </td>
                  <td className="p-4 whitespace-nowrap text-sm text-gray-600">
                    {record.vendor ? (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium">
                        {record.vendor}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="text-gray-900 font-bold">
                      ${(Number(record.amount || 0) + Number(record.tax || 0)).toLocaleString()}
                    </div>
                    {Number(record.tax) > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        (未稅 ${Number(record.amount || 0).toLocaleString()} / 稅 ${Number(record.tax || 0).toLocaleString()})
                      </div>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {record.paymentMethod || '無'}
                      </span>
                      {record.paymentMethod !== '現金' && record.paymentDetail && record.paymentDetail !== '無' && (
                        <span className="text-xs text-gray-500">{record.paymentDetail}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        record.usageType === '公司用' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {record.usageType || '無'}
                      </span>
                      {record.usageType === '公司用' && record.projectName && record.projectName !== '無' && (
                        <span className="text-xs text-blue-600 font-medium">{record.projectName}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {/* 若原本是公司用還是家用都可以報帳，這邊判斷可以簡化成只看 isReimbursable */}
                    {record.isReimbursable ? 
                      <span className="text-green-600 text-sm font-medium">是</span> : 
                      <span className="text-gray-400 text-sm">否</span>
                    }
                  </td>
                  <td className="p-4 text-gray-500 text-sm max-w-[150px] truncate" title={record.remark || '無'}>
                    {record.remark || '無'}
                  </td>
                  <td className="p-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(record)}
                      className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition mr-1"
                      title="編輯紀錄"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                      title="刪除紀錄"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderImport = () => (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <UploadCloud className="text-blue-600" />
        匯入 Excel (CSV) 檔案
      </h2>

      <div className="space-y-6">
        <div className="p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-center hover:bg-gray-100 transition relative">
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="點擊或拖曳檔案至此"
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <FileSpreadsheet size={48} className="text-gray-400" />
            <h3 className="text-lg font-medium text-gray-700">點擊選擇或拖曳 CSV 檔案至此</h3>
            <p className="text-sm text-gray-500">請使用系統「紀錄」頁面匯出的 CSV 格式檔案，以確保欄位正確對應</p>
            {importFile && (
              <div className="mt-2 text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full">
                已選擇：{importFile.name}
              </div>
            )}
          </div>
        </div>

        {importError && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 animate-fade-in">
            <AlertCircle size={20} />
            <span>{importError}</span>
          </div>
        )}

        {importPreview.length > 0 && (
          <div className="animate-fade-in space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-green-50 p-4 rounded-lg border border-green-100 gap-4">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <CheckCircle2 size={20} className="text-green-600" />
                成功解析 {importPreview.length} 筆紀錄，準備好匯入！
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={cancelImport}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  取消
                </button>
                <button
                  onClick={confirmImport}
                  className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <UploadCloud size={16} />
                  確認匯入
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4 max-h-96">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 sticky top-0">
                    <th className="p-3 font-semibold whitespace-nowrap">日期</th>
                    <th className="p-3 font-semibold whitespace-nowrap">人員</th>
                    <th className="p-3 font-semibold min-w-[150px]">品名</th>
                    <th className="p-3 font-semibold whitespace-nowrap">金額</th>
                    <th className="p-3 font-semibold whitespace-nowrap">消費形式</th>
                    <th className="p-3 font-semibold whitespace-nowrap">付款細節</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {importPreview.slice(0, 50).map((record, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-700 whitespace-nowrap text-sm">{record.date || '無'}</td>
                      <td className="p-3 text-gray-700 whitespace-nowrap text-sm">{record.spender || '無'}</td>
                      <td className="p-3 text-gray-900 font-medium text-sm">{record.itemName || '無'}</td>
                      <td className="p-3 text-gray-900 font-bold whitespace-nowrap text-sm">${((Number(record.amount) || 0) + (Number(record.tax) || 0)).toLocaleString()}</td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-600">{record.paymentMethod || '無'}</td>
                      <td className="p-3 whitespace-nowrap text-sm text-gray-500">{record.paymentDetail || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importPreview.length > 50 && (
                <div className="p-3 text-center text-sm text-gray-500 bg-gray-50 border-t border-gray-200">
                  為避免畫面卡頓，僅預覽前 50 筆紀錄...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 sm:p-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Settings className="text-blue-600" />
        系統設定
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 花費人員管理 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">花費人員管理</h3>
          <form onSubmit={(e) => handleAddSetting(e, 'spenders', newSpenderName, setNewSpenderName, spenders)} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSpenderName}
              onChange={(e) => setNewSpenderName(e.target.value)}
              placeholder="輸入新人員名稱"
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button type="submit" disabled={!newSpenderName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm flex items-center gap-1">
              <PlusCircle size={16} /> 新增
            </button>
          </form>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {spenders.map((item) => (
              <li key={item} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">{item}</span>
                <button onClick={() => deleteSetting(item, 'spenders', 'spender', spenders)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>

        {/* 專案名稱管理 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">專案名稱管理</h3>
          <form onSubmit={(e) => handleAddSetting(e, 'projects', newProjectName, setNewProjectName, projects)} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="輸入新專案名稱"
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button type="submit" disabled={!newProjectName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm flex items-center gap-1">
              <PlusCircle size={16} /> 新增
            </button>
          </form>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {projects.map((item) => (
              <li key={item} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">{item}</span>
                <button onClick={() => deleteSetting(item, 'projects', 'projectName', projects)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
        
        {/* ✨ 新增：消費種類管理區塊 ✨ */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <List size={20} className="text-teal-600" />
            消費種類設定
          </h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="輸入新種類 (如：車馬交通費)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 p-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={async () => {
                if (!newCategoryName.trim()) return;
                if (categories.includes(newCategoryName.trim())) {
                  alert('此種類已存在！');
                  return;
                }
                const updated = [...categories, newCategoryName.trim()];
                await updateDoc(doc(db, "config", "settings"), { categories: updated });
                setNewCategoryName('');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              新增
            </button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
            {categories.length === 0 ? (
              <span className="text-sm text-gray-400">目前尚無自訂種類，請由上方新增。</span>
            ) : (
              categories.map(c => (
                <div key={c} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 pl-3 pr-2 py-1 rounded-full text-sm font-medium border border-gray-200">
                  {c}
                  <button
                    onClick={async () => {
                      if (confirm(`確定要刪除「${c}」這個種類嗎？`)) {
                        const updated = categories.filter(item => item !== c);
                        await updateDoc(doc(db, "config", "settings"), { categories: updated });
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 廠商管理 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">廠商管理</h3>
          <form onSubmit={(e) => handleAddSetting(e, 'vendors', newVendorName, setNewVendorName, vendors)} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newVendorName}
              onChange={(e) => setNewVendorName(e.target.value)}
              placeholder="輸入新廠商名稱"
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button type="submit" disabled={!newVendorName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm flex items-center gap-1">
              <PlusCircle size={16} /> 新增
            </button>
          </form>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {vendors.map((item) => (
              <li key={item} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">{item}</span>
                <button onClick={() => deleteSetting(item, 'vendors', 'vendor', vendors)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>

        {/* 信用卡管理 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">信用卡管理</h3>
          <form onSubmit={(e) => handleAddSetting(e, 'creditCards', newCreditCardName, setNewCreditCardName, creditCards)} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCreditCardName}
              onChange={(e) => setNewCreditCardName(e.target.value)}
              placeholder="輸入新信用卡名稱"
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button type="submit" disabled={!newCreditCardName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm flex items-center gap-1">
              <PlusCircle size={16} /> 新增
            </button>
          </form>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {creditCards.map((item) => (
              <li key={item} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">{item}</span>
                <button onClick={() => deleteSetting(item, 'creditCards', 'paymentDetail', creditCards)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>

        {/* 轉帳帳號管理 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">轉帳帳號管理</h3>
          <form onSubmit={(e) => handleAddSetting(e, 'bankAccounts', newBankAccountName, setNewBankAccountName, bankAccounts)} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newBankAccountName}
              onChange={(e) => setNewBankAccountName(e.target.value)}
              placeholder="輸入新帳號名稱"
              className="flex-1 p-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button type="submit" disabled={!newBankAccountName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition text-sm flex items-center gap-1">
              <PlusCircle size={16} /> 新增
            </button>
          </form>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {bankAccounts.map((item) => (
              <li key={item} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                <span className="font-medium text-gray-700">{item}</span>
                <button onClick={() => deleteSetting(item, 'bankAccounts', 'paymentDetail', bankAccounts)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* 頂部導覽列 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl text-blue-700 flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            <span>龍昇記帳系統</span>
          </div>
          
          <nav className="flex gap-1 sm:gap-4">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition ${
                activeTab === 'form' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">記帳</span>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition ${
                activeTab === 'records' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <List size={18} />
              <span className="hidden sm:inline">紀錄</span>
              {records.length > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full ml-1">
                  {records.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition ${
                activeTab === 'import' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <UploadCloud size={18} />
              <span className="hidden sm:inline">匯入</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium transition ${
                activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings size={18} />
              <span className="hidden sm:inline">設定</span>
            </button>
          </nav>
        </div>
      </header>

      {/* 內容區塊 */}
      <main className="p-4 sm:p-8">
        {activeTab === 'form' && renderForm()}
        {activeTab === 'records' && renderRecords()}
        {activeTab === 'import' && renderImport()}
        {activeTab === 'settings' && renderSettings()}
      </main>
    </div>
  );
};

export default AccountingApp;

