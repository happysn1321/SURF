import React, { useState, useMemo, useEffect } from "react";

interface Item {
  id: string;
  cage: string | null;
  timestamp: string;
  status: 'In Cage' | 'Completed' | 'Cancelled'; // Added status field
}

// Initial default cages
const defaultCages = [
  "A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07", "A-08", "A-09", "A-10",
  "A-11", "A-12", "A-13", "A-14", "A-15",
  "B-01", "B-02",
  "C-01", "C-02",
];

const App: React.FC = () => {
  const [orderId, setOrderId] = useState("");
  // Use a state variable for cages to allow dynamic updates
  const [availableCages, setAvailableCages] = useState(defaultCages);
  const [cage, setCage] = useState(availableCages[0]); // Initialize with the first available cage
  const [items, setItems] = useState<Item[]>([]); // Data stored locally in state
  const [loading, setLoading] = useState(false); // No longer loading from external source
  const [error, setError] = useState<string | null>(null);
  const [xlsxLoaded, setXlsxLoaded] = useState(false); // State to track XLSX library loading

  // New states for bulk add feature
  const [targetCage, setTargetCage] = useState(availableCages[0]); // Use availableCages
  const [targetCount, setTargetCount] = useState<number>(0);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [bulkAddError, setBulkAddError] = useState<string | null>(null);

  // New states for date range filtering
  const [filterStartDate, setFilterStartDate] = useState<string>(''); // YYYY-MM-DD format
  const [filterEndDate, setFilterEndDate] = useState<string>(''); // YYYY-MM-DD format

  // New states for reset functionality (all data)
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [resetAllError, setResetAllError] = useState<string | null>(null);

  // New states for single cage reset functionality
  const [showResetCageConfirm, setShowResetCageConfirm] = useState(false);
  const [resettingCageId, setResettingCageId] = useState<string | null>(null);
  const [isResettingSingle, setIsResettingSingle] = useState(false);
  const [resetSingleError, setResetSingleError] = useState<string | null>(null);

  // New states for single item deletion
  const [showDeleteItemConfirm, setShowDeleteItemConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);

  // New states for managing cages
  const [newCageName, setNewCageName] = useState(''); // For adding new cage
  const [cageManagementError, setCageManagementError] = useState<string | null>(null);

  // New states for renaming cages
  const [oldCageToRename, setOldCageToRename] = useState(availableCages[0]);
  const [newCageNameForRename, setNewCageNameForRename] = useState('');
  const [isRenamingCage, setIsRenamingCage] = useState(false);
  const [renameCageError, setRenameCageError] = useState<string | null>(null);

  // New state for confirming reset cages to default
  const [showResetCagesToDefaultConfirm, setShowResetCagesToDefaultConfirm] = useState(false);
  const [isResettingCagesToDefault, setIsResettingCagesToDefault] = useState(false);
  const [resetCagesToDefaultError, setResetCagesToDefaultError] = useState<string | null>(null);


  // Load XLSX library dynamically for Excel export
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      setXlsxLoaded(true);
      console.log("XLSX library loaded successfully.");
    };
    script.onerror = () => {
      console.error("Failed to load XLSX library.");
      setError("Failed to load Excel export functionality.");
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Ensure selected cage is valid if availableCages changes
  useEffect(() => {
    if (!availableCages.includes(cage)) {
      setCage(availableCages[0] || ''); // Set to first available or empty if none
    }
    if (!availableCages.includes(targetCage)) {
      setTargetCage(availableCages[0] || ''); // Set to first available or empty if none
    }
    if (!availableCages.includes(oldCageToRename)) {
      setOldCageToRename(availableCages[0] || ''); // Set to first available or empty if none
    }
  }, [availableCages, cage, targetCage, oldCageToRename]);


  const handleAdd = () => {
    const value = orderId.trim();
    if (!value) {
      setError("Order ID cannot be empty.");
      return;
    }

    // Check for duplicate order ID regardless of its status
    const existingItem = items.find(item => item.id === value);
    if (existingItem) {
      const timestampDate = new Date(existingItem.timestamp);
      const formattedTimestamp = timestampDate.toLocaleString();
      setError(`รหัสคำสั่งซื้อ/บาร์โค้ดนี้มีอยู่แล้วในระบบ: พบในกรง ${existingItem.cage || 'ไม่ได้ระบุ'} เมื่อ ${formattedTimestamp} (สถานะ: ${existingItem.status})`);
      return;
    }

    setError(null); // Clear previous errors
    const newItem: Item = {
      id: value,
      cage: cage,
      timestamp: new Date().toISOString(), // Use local timestamp
      status: 'In Cage', // Set initial status
    };
    setItems(prevItems => {
      const updatedItems = [newItem, ...prevItems]; // Add new item to the top
      // Sort items by timestamp in descending order (most recent first)
      updatedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return updatedItems;
    });
    setOrderId(""); // Clear the input after successful add
  };

  const cageCounts = useMemo(() => {
    const counts = availableCages.reduce<Record<string, number>>((acc, c) => { // Use availableCages
        acc[c] = 0; // Initialize all cages to 0
        return acc;
    }, {});
    items.forEach(item => {
        // Only count items that are assigned to a cage AND have 'In Cage' status
        if (item.cage !== null && item.status === 'In Cage') {
            counts[item.cage] = (counts[item.cage] || 0) + 1;
        }
    });
    return counts;
  }, [items, availableCages]); // Depend on availableCages

  // Filtered items based on selected date range
  const filteredItems = useMemo(() => {
    if (!filterStartDate && !filterEndDate) {
      return items; // If no filter dates, return all items
    }

    let filtered = items;

    if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0); // Set to start of the day
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.getTime() >= start.getTime();
      });
    }

    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999); // Set to end of the day
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate.getTime() <= end.getTime();
      });
    }

    return filtered;
  }, [items, filterStartDate, filterEndDate]);

  const exportFilteredToExcel = () => {
    if (!xlsxLoaded) {
      setError("Excel export functionality is still loading or failed to load.");
      return;
    }
    if (filteredItems.length === 0) {
      setError("ไม่มีรายการให้ส่งออกสำหรับวันที่เลือก"); // No items to export for the selected date
      return;
    }
    setError(null);
    const XLSX = (window as any).XLSX;
    const ws = XLSX.utils.json_to_sheet(filteredItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Items");
    const filenameDateRange = `${filterStartDate || 'start'}_to_${filterEndDate || 'end'}`;
    XLSX.writeFile(wb, `scaleup_items_filtered_${filenameDateRange}.xlsx`); // Add date range to filename
  };

  const exportAllToExcel = () => {
    if (!xlsxLoaded) {
      setError("Excel export functionality is still loading or failed to load.");
      return;
    }
    if (items.length === 0) {
      setError("ไม่มีรายการทั้งหมดให้ส่งออก"); // No total items to export
      return;
    }
    setError(null);
    const XLSX = (window as any).XLSX;
    const ws = XLSX.utils.json_to_sheet(items); // Export all items
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "All_Items");
    XLSX.writeFile(wb, `scaleup_items_all_${new Date().toISOString().slice(0,10)}.xlsx`); // Add current date to filename
  };

  const handleBulkAdd = () => {
    if (targetCount <= 0) {
      setBulkAddError("จำนวนที่ต้องการเพิ่มต้องมากกว่า 0.");
      return;
    }

    setIsAddingBulk(true);
    setBulkAddError(null);

    const newBulkItems: Item[] = [];
    for (let i = 0; i < targetCount; i++) {
      const newBulkItemId = `Bulk-${targetCage}-${Date.now()}-${i}`;
      newBulkItems.push({
        id: newBulkItemId,
        cage: targetCage,
        timestamp: new Date().toISOString(),
        status: 'In Cage',
      });
    }
    setItems(prevItems => {
      const updatedItems = [...newBulkItems, ...prevItems]; // Add new items to the top
      // Sort items by timestamp in descending order (most recent first)
      updatedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return updatedItems;
    });
    setTargetCount(0);
    setIsAddingBulk(false);
  };

  const handleResetAllData = () => {
    setResetAllError(null);
    setIsResettingAll(true);

    if (items.length === 0) {
      setResetAllError("ไม่มีข้อมูลให้รีเซ็ต");
      setIsResettingAll(false);
      setShowResetAllConfirm(false);
      return;
    }

    setItems([]); // Clear all items
    console.log("All data reset successfully.");
    setIsResettingAll(false);
    setShowResetAllConfirm(false); // Close modal after attempt
  };

  const handleResetSingleCage = () => {
    if (!resettingCageId) {
      setResetSingleError(`No cage selected.`);
      return;
    }
    setResetSingleError(null);
    setIsResettingSingle(true);

    const itemsInCageToReset = items.filter(item => item.cage === resettingCageId && item.status === 'In Cage');

    if (itemsInCageToReset.length === 0) {
      setResetSingleError(`ไม่มีรายการที่อยู่ในกรง ${resettingCageId} ที่มีสถานะ 'In Cage' ให้รีเซ็ต`);
      setIsResettingSingle(false);
      setShowResetCageConfirm(false);
      return;
    }

    setItems(prevItems => {
      return prevItems.map(item =>
        item.cage === resettingCageId && item.status === 'In Cage'
          ? { ...item, status: 'Completed' }
          : item
      );
    });

    console.log(`Cage ${resettingCageId} reset successfully (items status updated to Completed).`);
    setIsResettingSingle(false);
    setShowResetCageConfirm(false); // Close modal after attempt
    setResettingCageId(null); // Clear the resetting cage ID
  };

  const handleDeleteItem = () => {
    if (!itemToDelete) {
      setDeleteItemError("ไม่มีรายการให้ลบ");
      return;
    }
    setDeleteItemError(null);
    setIsDeletingItem(true);

    setItems(prevItems => prevItems.filter(item => item.id !== itemToDelete.id || item.timestamp !== itemToDelete.timestamp));
    console.log(`Item with ID ${itemToDelete.id} deleted successfully.`);
    setIsDeletingItem(false);
    setShowDeleteItemConfirm(false);
    setItemToDelete(null);
  };

  const handleAddNewCage = () => {
    const trimmedCageName = newCageName.trim();
    if (!trimmedCageName) {
      setCageManagementError("ชื่อกรงใหม่ต้องไม่ว่างเปล่า");
      return;
    }
    if (availableCages.includes(trimmedCageName)) {
      setCageManagementError("ชื่อกรงนี้มีอยู่แล้ว");
      return;
    }
    setAvailableCages(prevCages => [...prevCages, trimmedCageName]);
    setNewCageName('');
    setCageManagementError(null);
  };

  // Function to perform the actual reset of cages to default
  const performResetCagesToDefault = () => {
    setResetCagesToDefaultError(null);
    setIsResettingCagesToDefault(true);
    setAvailableCages(defaultCages);
    // Also reset selected cages in input fields if they are no longer in defaultCages
    setCage(defaultCages[0] || '');
    setTargetCage(defaultCages[0] || '');
    setOldCageToRename(defaultCages[0] || '');
    console.log("Cages reset to default successfully.");
    setIsResettingCagesToDefault(false);
    setShowResetCagesToDefaultConfirm(false); // Close modal after attempt
  };

  const handleRenameCage = () => {
    const trimmedNewCageName = newCageNameForRename.trim();
    if (!oldCageToRename || !trimmedNewCageName) {
      setRenameCageError("กรุณาเลือกกรงเดิมและป้อนชื่อกรงใหม่");
      return;
    }
    if (oldCageToRename === trimmedNewCageName) {
      setRenameCageError("ชื่อกรงใหม่ต้องไม่ซ้ำกับชื่อกรงเดิม");
      return;
    }
    if (availableCages.includes(trimmedNewCageName)) {
      setRenameCageError("ชื่อกรงใหม่นี้มีอยู่แล้ว");
      return;
    }

    setIsRenamingCage(true);
    setRenameCageError(null);

    // Update availableCages
    setAvailableCages(prevCages =>
      prevCages.map(c => (c === oldCageToRename ? trimmedNewCageName : c))
    );

    // Update items that were in the old cage
    setItems(prevItems =>
      prevItems.map(item =>
        item.cage === oldCageToRename ? { ...item, cage: trimmedNewCageName } : item
      )
    );

    setOldCageToRename(trimmedNewCageName); // Set selected cage to the new name
    setNewCageNameForRename(''); // Clear the new name input
    setIsRenamingCage(false);
  };


  // Memoize table rows to prevent unnecessary re-renders and potential whitespace issues
  const tableRows = useMemo(() => {
    if (filteredItems.length === 0 && !loading) {
      return (
        <tr>
          <td colSpan={6} className="p-6 text-center text-gray-500 bg-white"> {/* Updated colspan to 6 */}
            {!filterStartDate && !filterEndDate ? "ยังไม่มีรายการที่ติดตาม" : "ไม่พบรายการสำหรับช่วงวันที่เลือก"}
          </td>
        </tr>
      );
    } else {
      return filteredItems.map((item, i) => (
        <tr
          key={item.id + item.timestamp} // Use a combination of id and timestamp for unique key
          className="even:bg-gray-50 odd:bg-white transition-colors duration-150 ease-in-out hover:bg-blue-50"
        >
          <td className="p-4 border-b border-gray-200 text-gray-700">{i + 1}</td>
          <td className="p-4 border-b border-gray-200 font-medium text-gray-900">{item.id}</td>
          <td className="p-4 border-b border-gray-200 text-gray-700">{item.cage || 'ไม่ได้ระบุ'}</td>
          <td className="p-4 border-b border-gray-200 text-gray-700">
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
              item.status === 'In Cage' ? 'bg-blue-100 text-blue-700' :
              item.status === 'Completed' ? 'bg-green-100 text-green-700' :
              'bg-red-100 text-red-700'
            }`}>
              {item.status || 'ไม่ได้ระบุ'}
            </span>
          </td>
          <td className="p-4 border-b border-gray-200 text-sm text-gray-500">
            {new Date(item.timestamp).toLocaleString()}
          </td>
          <td className="p-4 border-b border-gray-200 text-center">
            <button
              onClick={() => {
                setItemToDelete(item);
                setShowDeleteItemConfirm(true);
              }}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition-colors duration-200 text-sm"
              title="ลบรายการนี้"
            >
              ลบ
            </button>
          </td>
        </tr>
      ));
    }
  }, [filteredItems, loading, filterStartDate, filterEndDate]);


  return (
    <div
      className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 grid gap-6 font-sans text-gray-800"
    >
      {/* Logo and Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl shadow-lg border border-blue-100 mb-4">
        <div className="h-16 w-auto flex items-center justify-center text-4xl font-extrabold text-blue-700 rounded-full bg-blue-100 p-3 shadow-inner">
          ✨ ScaleUP
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 mt-3 sm:mt-0 sm:ml-4 text-center sm:text-right">Fulfillment Tracker</h1>
      </div>

      {/* Removed User ID Display as it's not relevant without Firebase Auth */}

      {/* Loading and Error Messages */}
      {loading && (
        <div className="text-center text-blue-600 font-medium p-4 bg-blue-100 rounded-xl shadow-sm">กำลังโหลดข้อมูล...</div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative shadow-md" role="alert">
          <strong className="font-bold">ข้อผิดพลาด!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Input Section */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <label htmlFor="orderId" className="font-semibold text-gray-700 text-lg">คำสั่งซื้อ / บาร์โค้ด</label>
            <input
              id="orderId"
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="สแกนหรือพิมพ์หมายเลขคำสั่งซื้อ"
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="cageSelect" className="font-semibold text-gray-700 text-lg">กรง</label>
            <select
              id="cageSelect"
              value={cage}
              onChange={(e) => setCage(e.target.value)}
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-lg appearance-none cursor-pointer"
            >
              {availableCages.map((c) => ( // Use availableCages
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end mt-4">
            <button
              onClick={handleAdd}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              <span className="text-2xl leading-none">➕</span> เพิ่ม
            </button>
          </div>
        </div>
      </div>

      {/* Cage Management Section */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">จัดการกรง</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add New Cage */}
          <div className="grid gap-2">
            <label htmlFor="newCageName" className="font-semibold text-gray-700 text-lg">ชื่อกรงใหม่</label>
            <input
              id="newCageName"
              type="text"
              value={newCageName}
              onChange={(e) => setNewCageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddNewCage();
                }
              }}
              placeholder="ป้อนชื่อกรงใหม่ (เช่น Z-01)"
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
            />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <button
              onClick={handleAddNewCage}
              className="w-full px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              <span className="text-2xl leading-none">✨</span> เพิ่มกรงใหม่
            </button>
          </div>

          {/* Rename Existing Cage */}
          <div className="grid gap-2 mt-4 md:mt-0">
            <label htmlFor="oldCageToRename" className="font-semibold text-gray-700 text-lg">เลือกกรงที่ต้องการเปลี่ยนชื่อ</label>
            <select
              id="oldCageToRename"
              value={oldCageToRename}
              onChange={(e) => setOldCageToRename(e.target.value)}
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-lg appearance-none cursor-pointer"
            >
              {availableCages.map((c) => (
                <option key={`rename-${c}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 mt-4 md:mt-0">
            <label htmlFor="newCageNameForRename" className="font-semibold text-gray-700 text-lg">ชื่อกรงใหม่</label>
            <input
              id="newCageNameForRename"
              type="text"
              value={newCageNameForRename}
              onChange={(e) => setNewCageNameForRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRenameCage();
                }
              }}
              placeholder="ป้อนชื่อกรงใหม่"
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
            />
          </div>
          <div className="md:col-span-2 flex justify-end mt-4">
            <button
              onClick={handleRenameCage}
              disabled={isRenamingCage}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              {isRenamingCage ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังเปลี่ยนชื่อ...
                </>
              ) : (
                <>
                  <span className="text-2xl leading-none">✏️</span> เปลี่ยนชื่อกรง
                </>
              )}
            </button>
          </div>

          {(cageManagementError || renameCageError) && (
            <div className="md:col-span-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mt-2 shadow-md" role="alert">
              <strong className="font-bold">ข้อผิดพลาดในการจัดการกรง!</strong>
              <span className="block sm:inline"> {cageManagementError || renameCageError}</span>
            </div>
          )}

          <div className="md:col-span-2 flex justify-end mt-4">
            <button
              onClick={() => setShowResetCagesToDefaultConfirm(true)} // Show confirmation modal
              className="w-full sm:w-auto px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              <span className="text-2xl leading-none">🔄</span> รีเซ็ตกรงเป็นค่าเริ่มต้น
            </button>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="grid gap-4">
          <h2 className="text-2xl font-bold text-gray-800">จำนวนกรง</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableCages.map((c) => ( // Use availableCages
              <div
                key={c}
                className="flex flex-col items-center justify-center bg-blue-50 rounded-xl shadow-sm p-4 border border-blue-200 transition-transform duration-200 hover:scale-105 relative" // Added relative for button positioning
              >
                <span className="text-blue-700 font-semibold text-xl">{c}</span>
                <span className="font-bold text-3xl text-blue-800 mt-1">{cageCounts[c] || 0}</span>
                {cageCounts[c] > 0 && ( // Show reset button only if count is greater than 0
                  <button
                    onClick={() => {
                      setResettingCageId(c);
                      setShowResetCageConfirm(true);
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-200 hover:bg-red-300 rounded-full text-red-700 text-xs opacity-75 hover:opacity-100 transition-opacity"
                    title={`รีเซ็ตจำนวนในกรง ${c}`}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Add Section */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <h2 className="text-2xl font-bold text-gray-800 md:col-span-2">เพิ่มสินค้าจำนวนมาก</h2>
          <div className="grid gap-2">
            <label htmlFor="targetCageSelect" className="font-semibold text-gray-700 text-lg">เลือกกรง</label>
            <select
              id="targetCageSelect"
              value={targetCage}
              onChange={(e) => setTargetCage(e.target.value)}
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-lg appearance-none cursor-pointer"
            >
              {availableCages.map((c) => ( // Use availableCages
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="targetCountInput" className="font-semibold text-gray-700 text-lg">จำนวนเป้าหมาย</label>
            <input
              id="targetCountInput"
              type="number"
              value={targetCount === 0 ? '' : targetCount} // Display empty string for 0
              onChange={(e) => setTargetCount(parseInt(e.target.value) || 0)}
              placeholder="ป้อนจำนวนเป้าหมาย"
              className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
            />
          </div>
          <div className="md:col-span-2 flex justify-end mt-4">
            <button
              onClick={handleBulkAdd}
              disabled={isAddingBulk}
              className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
            >
              {isAddingBulk ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังเพิ่ม...
                </>
              ) : (
                <>
                  <span className="text-2xl leading-none">➕</span> เพิ่มจำนวนมาก
                </>
              )}
            </button>
          </div>
          {bulkAddError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mt-4 shadow-md" role="alert">
              <strong className="font-bold">ข้อผิดพลาดในการเพิ่มจำนวนมาก!</strong>
              <span className="block sm:inline"> {bulkAddError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="p-4 overflow-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">รายการทั้งหมด</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="grid gap-2">
              <label htmlFor="filterStartDate" className="font-semibold text-gray-700 text-lg">กรองตามวันที่ (จาก)</label>
              <input
                id="filterStartDate"
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="filterEndDate" className="font-semibold text-gray-700 text-lg">ถึงวันที่</label>
              <input
                id="filterEndDate"
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-left border-collapse">
              <thead><tr>
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold rounded-tl-xl">#</th><th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">รหัสคำสั่งซื้อ</th><th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">กรง</th><th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">สถานะ</th><th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">เวลา</th><th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold rounded-tr-xl">จัดการ</th>
                </tr></thead>
              <tbody>
                {tableRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-start gap-4 mt-4">
        <button
          onClick={exportFilteredToExcel}
          className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
        >
          <span className="text-2xl leading-none">⬇️</span> ส่งออกรายการที่กรอง (Excel / CSV)
        </button>
        <button
          onClick={exportAllToExcel}
          className="w-full sm:w-auto px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
        >
          <span className="text-2xl leading-none">⬇️</span> ส่งออกข้อมูลทั้งหมด (Excel / CSV)
        </button>
      </div>
      <p className="max-w-4xl mx-auto w-full text-sm text-gray-600 mt-2">
        <span className="font-semibold">หมายเหตุ:</span> การส่งออกรายการที่กรองจะรวมเฉพาะข้อมูลที่แสดงในตารางเท่านั้น ส่วนการส่งออกข้อมูลทั้งหมดจะรวมข้อมูลทั้งหมดในระบบ
      </p>

      {/* Reset All Data Button */}
      <div className="max-w-4xl mx-auto w-full flex justify-center mt-8">
        <button
          onClick={() => setShowResetAllConfirm(true)}
          className="w-full sm:w-auto px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
        >
          <span className="text-2xl leading-none">🗑️</span> รีเซ็ตข้อมูลทั้งหมด (ลบถาวร)
        </button>
      </div>

      {/* Reset All Data Confirmation Modal */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ยืนยันการรีเซ็ตข้อมูลทั้งหมด</h3>
            <p className="text-gray-700 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด? การดำเนินการนี้ไม่สามารถยกเลิกได้ และจะลบข้อมูลออกจากระบบ</p>
            {resetAllError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <strong className="font-bold">ข้อผิดพลาด!</strong>
                <span className="block sm:inline"> {resetAllError}</span>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowResetAllConfirm(false)}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
                disabled={isResettingAll}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetAllData}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isResettingAll}
              >
                {isResettingAll ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังรีเซ็ต...
                  </>
                ) : (
                  "ยืนยันการรีเซ็ตทั้งหมด"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Single Cage Confirmation Modal */}
      {showResetCageConfirm && resettingCageId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ยืนยันการรีเซ็ตจำนวนในกรง {resettingCageId}</h3>
            <p className="text-gray-700 mb-6">คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตจำนวนออเดอร์ในกรง **{resettingCageId}**? การดำเนินการนี้จะเปลี่ยนสถานะของรายการในกรงนี้เป็น "ดำเนินการแล้ว" เพื่อให้ไม่ถูกนับรวมในกรงอีกต่อไป แต่ข้อมูลรายการจะยังคงอยู่ในระบบ</p>
            {resetSingleError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <strong className="font-bold">ข้อผิดพลาด!</strong>
                <span className="block sm:inline"> {resetSingleError}</span>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowResetCageConfirm(false);
                  setResettingCageId(null);
                }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
                disabled={isResettingSingle}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetSingleCage}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isResettingSingle}
              >
                {isResettingSingle ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังรีเซ็ต...
                  </>
                ) : (
                  "ยืนยันการรีเซ็ต"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {showDeleteItemConfirm && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ยืนยันการลบรายการ</h3>
            <p className="text-gray-700 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบรายการ Order ID: **{itemToDelete.id}**?</p>
            {deleteItemError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <strong className="font-bold">ข้อผิดพลาด!</strong>
                <span className="block sm:inline"> {deleteItemError}</span>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowDeleteItemConfirm(false);
                  setItemToDelete(null);
                }}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
                disabled={isDeletingItem}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteItem}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isDeletingItem}
              >
                {isDeletingItem ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังลบ...
                  </>
                ) : (
                  "ยืนยันการลบ"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Cages to Default Confirmation Modal */}
      {showResetCagesToDefaultConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">ยืนยันการรีเซ็ตกรงเป็นค่าเริ่มต้น</h3>
            <p className="text-gray-700 mb-6">คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตรายชื่อกรงทั้งหมดกลับเป็นค่าเริ่มต้น? กรงที่คุณเพิ่มเข้ามาเองจะถูกลบออก และกรงทั้งหมดจะกลับไปเป็นรายชื่อกรงตั้งต้น</p>
            {resetCagesToDefaultError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <strong className="font-bold">ข้อผิดพลาด!</strong>
                <span className="block sm:inline"> {resetCagesToDefaultError}</span>
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowResetCagesToDefaultConfirm(false)}
                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors duration-200"
                disabled={isResettingCagesToDefault}
              >
                ยกเลิก
              </button>
              <button
                onClick={performResetCagesToDefault}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                disabled={isResettingCagesToDefault}
              >
                {isResettingCagesToDefault ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังรีเซ็ต...
                  </>
                ) : (
                  "ยืนยันการรีเซ็ต"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
