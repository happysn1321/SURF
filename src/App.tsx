import React, { useState, useMemo, useEffect } from "react";
// Removed imports for Input, Button, Card, CardContent from ./components/ui
// Removed import for Download, PlusCircle from "lucide-react"; // Removed lucide-react import
// Removed import for motion from "framer-motion"; // Removed framer-motion import

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, getDocs, writeBatch, doc, where } from 'firebase/firestore'; // Added getDocs, writeBatch, doc, where

interface Item {
  id: string;
  cage: string | null;
  timestamp: string;
  status: 'In Cage' | 'Completed' | 'Cancelled'; // Added status field
}

// Updated cages array to include A-01 to A-15
const cages = [
  "A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "A-07", "A-08", "A-09", "A-10",
  "A-11", "A-12", "A-13", "A-14", "A-15",
  "B-01", "B-02",
  "C-01", "C-02",
];

const App: React.FC = () => {
  const [orderId, setOrderId] = useState("");
  const [cage, setCage] = useState(cages[0]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [xlsxLoaded, setXlsxLoaded] = useState(false); // State to track XLSX library loading

  // New states for bulk add feature
  const [targetCage, setTargetCage] = useState(cages[0]);
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


  // Firebase instances
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);

  // Load XLSX library dynamically
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

  // Initialize Firebase and authenticate
  useEffect(() => {
    try {
      // START: Firebase Configuration - Updated with user's provided config
      const firebaseConfig = {
        apiKey: "AIzaSyAzgJBarv5XeTWXF2nZ30adfzpp-9q6ttc",
        authDomain: "fulfillment-784f6.firebaseapp.com",
        projectId: "fulfillment-784f6",
        storageBucket: "fulfillment-784f6.firebasestorage.app",
        messagingSenderId: "53295786928",
        appId: "1:53295786928:web:d31c26dfcbdc187326c475",
        measurementId: "G-VKF1PT49EV"
      };
      // END: Firebase Configuration

      // IMPORTANT: For local development, __app_id is undefined.
      // We need to explicitly use firebaseConfig.appId for the collection path.
      const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.appId; // Use firebaseConfig.appId as fallback

      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey) { // Added check for apiKey presence
        setError("Firebase configuration not found or incomplete. Please ensure firebaseConfig is correctly set.");
        setLoading(false);
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      // Sign in with custom token or anonymously
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
          } else {
            await signInAnonymously(firebaseAuth);
          }
        } catch (e: any) {
          console.error("Firebase authentication error:", e);
          setError(`Authentication failed: ${e.message}`);
        } finally {
          setLoading(false);
        }
      };

      signIn();

      // Listen for auth state changes to get the user ID
      const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(crypto.randomUUID()); // Fallback for unauthenticated state or if auth fails
        }
      });

      return () => {
        unsubscribeAuth(); // Clean up auth listener
      };

    } catch (e: any) {
      console.error("Firebase initialization error:", e);
      setError(`Failed to initialize Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Run once on component mount

  // Listen for real-time updates from Firestore
  useEffect(() => {
    if (!db || !userId) {
      // Wait for db and userId to be initialized
      return;
    }

    setLoading(true);
    setError(null);

    // Define the collection path for public data
    // Use the 'appId' determined in the first useEffect, which now correctly falls back to firebaseConfig.appId
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : (db && db.app && db.app.options && db.app.options.appId) ? db.app.options.appId : 'default-app-id';
    const itemsCollectionRefPath = `artifacts/${currentAppId}/public/data/scaleup_items`; // Define path
    console.log("Firestore Collection Path:", itemsCollectionRefPath); // Log the path for debugging
    const itemsCollectionRef = collection(db, itemsCollectionRefPath);
    // Query to get all items, including those with null cage for filtering later
    const q = query(itemsCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: Item[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedItems.push({
          id: data.id,
          cage: data.cage === undefined ? null : data.cage, // Ensure cage is null if not set
          timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString(), // Convert Firestore Timestamp to ISO string
          status: data.status || 'In Cage', // Default to 'In Cage' if status is not present
        });
      });
      // Sort items by timestamp in descending order (most recent first)
      fetchedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setItems(fetchedItems);
      setLoading(false);
    }, (e) => {
      console.error("Error fetching items from Firestore:", e);
      // Enhanced error message for permission denied
      if (e.code === 'permission-denied') {
        setError(`ไม่สามารถโหลดรายการได้: ข้อผิดพลาดในการอนุญาต. โปรดตรวจสอบกฎความปลอดภัยของ Firebase ของคุณเพื่อให้แน่ใจว่าอนุญาตให้ผู้ใช้ที่ตรวจสอบสิทธิ์แล้วสามารถอ่านและเขียนข้อมูลในคอลเลกชัน '${itemsCollectionRefPath}' ได้`);
      } else {
        setError(`ไม่สามารถโหลดรายการได้: ${e.message}`);
      }
      setLoading(false);
    });

    return () => unsubscribe(); // Clean up listener on unmount
  }, [db, userId]); // Re-run when db or userId changes

  const handleAdd = async () => {
    const value = orderId.trim();
    if (!value || !db) {
      if (!value) setError("Order ID cannot be empty.");
      if (!db) setError("Database not initialized.");
      return;
    }

    // Check for duplicate order ID that is currently 'In Cage'
    if (items.some(item => item.id === value && item.status === 'In Cage')) {
      setError("รหัสคำสั่งซื้อ/บาร์โค้ดนี้มีอยู่แล้วในกรงอื่นหรือกำลังดำเนินการอยู่"); // Updated message
      return;
    }

    setError(null); // Clear previous errors
    try {
      // Use the correct appId from the initialized Firebase app
      const currentAppId = (db && db.app && db.app.options && db.app.options.appId) ? db.app.options.appId : 'default-app-id';
      const itemsCollectionRefPath = `artifacts/${currentAppId}/public/data/scaleup_items`;
      const itemsCollectionRef = collection(db, itemsCollectionRefPath);
      await addDoc(itemsCollectionRef, {
        id: value,
        cage: cage,
        timestamp: serverTimestamp(), // Use Firestore server timestamp
        status: 'In Cage', // Set initial status
      });
      setOrderId(""); // Clear the input after successful add
    } catch (e: any) {
      console.error("Error adding document to Firestore:", e);
      if (e.code === 'permission-denied') {
        setError(`ไม่สามารถเพิ่มรายการได้: ข้อผิดพลาดในการอนุญาต. โปรดตรวจสอบกฎความปลอดภัยของ Firebase ของคุณเพื่อให้แน่ใจว่าอนุญาตให้ผู้ใช้ที่ตรวจสอบสิทธิ์แล้วสามารถอ่านและเขียนข้อมูลในคอลเลกชัน '${itemsCollectionRefPath}' ได้`);
      } else {
        setError(`ไม่สามารถเพิ่มรายการได้: ${e.message}`);
      }
    }
  };

  const cageCounts = useMemo(() => {
    const counts = cages.reduce<Record<string, number>>((acc, c) => {
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
  }, [items]);

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

  const handleBulkAdd = async () => {
    if (!db) {
      setBulkAddError("Database not initialized.");
      return;
    }
    // The user wants to add exactly 'targetCount' items.
    // So, 'targetCount' should be the number of items to add.
    // It must be greater than 0.
    if (targetCount <= 0) {
      setBulkAddError("จำนวนที่ต้องการเพิ่มต้องมากกว่า 0."); // Updated message
      return;
    }

    setIsAddingBulk(true);
    setBulkAddError(null);

    // No need for currentCount or itemsToAdd calculation based on existing items.
    // The loop will simply run 'targetCount' times.

    try {
      // Use the correct appId from the initialized Firebase app
      const currentAppId = (db && db.app && db.app.options && db.app.options.appId) ? db.app.options.appId : 'default-app-id';
      const itemsCollectionRefPath = `artifacts/${currentAppId}/public/data/scaleup_items`;
      const itemsCollectionRef = collection(db, itemsCollectionRefPath);

      // Add items one by one for the specified targetCount
      for (let i = 0; i < targetCount; i++) { // Loop directly uses targetCount
        // Generate a unique ID for each bulk added item to avoid duplicates
        const newBulkItemId = `Bulk-${targetCage}-${Date.now()}-${i}`;
        await addDoc(itemsCollectionRef, {
          id: newBulkItemId,
          cage: targetCage,
          timestamp: serverTimestamp(),
          status: 'In Cage', // Set status for bulk added items
        });
      }
      setTargetCount(0); // Reset target count after successful bulk add
    } catch (e: any) {
      console.error("Error during bulk add:", e);
      if (e.code === 'permission-denied') {
        setBulkAddError(`ไม่สามารถเพิ่มจำนวนมากได้: ข้อผิดพลาดในการอนุญาต. โปรดตรวจสอบกฎความปลอดภัยของ Firebase ของคุณเพื่อให้แน่ใจว่าอนุญาตให้ผู้ใช้ที่ตรวจสอบสิทธิ์แล้วสามารถอ่านและเขียนข้อมูลในคอลเลกชัน '${itemsCollectionRefPath}' ได้`);
      } else {
        setBulkAddError(`ไม่สามารถเพิ่มจำนวนมากได้: ${e.message}`);
      }
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleResetAllData = async () => {
    if (!db) {
      setResetAllError("Database not initialized.");
      return;
    }
    setResetAllError(null);
    setIsResettingAll(true);

    try {
      // Use the correct appId from the initialized Firebase app
      const currentAppId = (db && db.app && db.app.options && db.app.options.appId) ? db.app.options.appId : 'default-app-id';
      const itemsCollectionRefPath = `artifacts/${currentAppId}/public/data/scaleup_items`;
      const itemsCollectionRef = collection(db, itemsCollectionRefPath);
      const q = query(itemsCollectionRef);
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setResetAllError("ไม่มีข้อมูลให้รีเซ็ต");
        setIsResettingAll(false);
        setShowResetAllConfirm(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(doc(db, itemsCollectionRefPath, d.id));
      });

      await batch.commit();
      setItems([]); // Clear items in state immediately
      console.log("All data reset successfully.");
    } catch (e: any) {
      console.error("Error resetting all data:", e);
      if (e.code === 'permission-denied') {
        setResetAllError(`ไม่สามารถรีเซ็ตข้อมูลทั้งหมดได้: ข้อผิดพลาดในการอนุญาต. โปรดตรวจสอบกฎความปลอดภัยของ Firebase ของคุณเพื่อให้แน่ใจว่าอนุญาตให้ผู้ใช้ที่ตรวจสอบสิทธิ์แล้วสามารถลบข้อมูลในคอลเลกชัน '${itemsCollectionRefPath}' ได้`);
      } else {
        setResetAllError(`ไม่สามารถรีเซ็ตข้อมูลทั้งหมดได้: ${e.message}`);
      }
    } finally {
      setIsResettingAll(false);
      setShowResetAllConfirm(false); // Close modal after attempt
    }
  };

  const handleResetSingleCage = async () => {
    if (!db || !resettingCageId) {
      setResetSingleError(`Database not initialized or no cage selected.`);
      return;
    }
    setResetSingleError(null);
    setIsResettingSingle(true);

    try {
      // Use the correct appId from the initialized Firebase app
      const currentAppId = (db && db.app && db.app.options && db.app.options.appId) ? db.app.options.appId : 'default-app-id';
      const itemsCollectionRefPath = `artifacts/${currentAppId}/public/data/scaleup_items`;
      const itemsCollectionRef = collection(db, itemsCollectionRefPath);
      // Query items specifically within the cage to be reset and are currently 'In Cage'
      const q = query(itemsCollectionRef, where("cage", "==", resettingCageId), where("status", "==", "In Cage"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setResetSingleError(`ไม่มีรายการที่อยู่ในกรง ${resettingCageId} ที่มีสถานะ 'In Cage' ให้รีเซ็ต`); // Updated message
        setIsResettingSingle(false);
        setShowResetCageConfirm(false);
        return;
      }

      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        // Update the 'status' field to 'Completed' instead of changing 'cage' to null
        batch.update(doc(db, itemsCollectionRefPath, d.id), { status: 'Completed' });
      });

      await batch.commit();
      console.log(`Cage ${resettingCageId} reset successfully (items status updated to Completed).`);
    } catch (e: any) {
      console.error(`Error resetting cage ${resettingCageId}:`, e);
      if (e.code === 'permission-denied') {
        setResetSingleError(`ไม่สามารถรีเซ็ตกรงได้: ข้อผิดพลาดในการอนุญาต. โปรดตรวจสอบกฎความปลอดภัยของ Firebase ของคุณเพื่อให้แน่ใจว่าอนุญาตให้ผู้ใช้ที่ตรวจสอบสิทธิ์แล้วสามารถอัปเดตข้อมูลในคอลเลกชัน '${itemsCollectionRefPath}' ได้`);
      } else {
        setResetSingleError(`ไม่สามารถรีเซ็ตกรงได้: ${e.message}`);
      }
    } finally {
      setIsResettingSingle(false);
      setShowResetCageConfirm(false); // Close modal after attempt
      setResettingCageId(null); // Clear the resetting cage ID
    }
  };

  // Memoize table rows to prevent unnecessary re-renders and potential whitespace issues
  const tableRows = useMemo(() => {
    if (filteredItems.length === 0 && !loading) {
      return (
        <tr>
          <td colSpan={5} className="p-6 text-center text-gray-500 bg-white"> {/* Updated colspan to 5 */}
            {!filterStartDate && !filterEndDate ? "ยังไม่มีรายการที่ติดตาม" : "ไม่พบรายการสำหรับช่วงวันที่เลือก"}
          </td>
        </tr>
      );
    } else {
      return filteredItems.map((item, i) => (
        <tr
          key={item.id + item.timestamp}
          className="even:bg-gray-50 odd:bg-white transition-colors duration-150 ease-in-out hover:bg-blue-50"
        >
          <td className="p-4 border-b border-gray-200 text-gray-700">{i + 1}</td>
          <td className="p-4 border-b border-gray-200 font-medium text-gray-900">{item.id}</td>
          <td className="p-4 border-b border-gray-200 text-gray-700">{item.cage || 'ไม่ได้ระบุ'}</td> {/* Display 'ไม่ได้ระบุ' if cage is null */}
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

      {/* User ID Display */}
      {userId && (
        <div className="max-w-4xl mx-auto w-full bg-blue-50 p-4 rounded-xl shadow-md border border-blue-200">
          <div className="text-blue-800 text-sm font-medium">
            <span className="font-semibold">รหัสผู้ใช้ของคุณ:</span> <span className="break-all">{userId}</span>
          </div>
        </div>
      )}

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
              {cages.map((c) => (
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

      {/* Summary Section */}
      <div className="max-w-4xl mx-auto w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="grid gap-4">
          <h2 className="text-2xl font-bold text-gray-800">จำนวนกรง</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {cages.map((c) => ( // Ensure all cages are displayed, even if count is 0
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
              {cages.map((c) => (
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
              <thead>
                <tr>{/* No whitespace between tr and th tags */}
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold rounded-tl-xl">#</th>
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">รหัสคำสั่งซื้อ</th>
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">กรง</th>
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold">สถานะ</th> {/* New column for Status */}
                  <th className="p-4 border-b border-blue-200 text-blue-800 text-lg font-semibold rounded-tr-xl">เวลา</th>
                </tr>
              </thead>
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
            <p className="text-gray-700 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมด? การดำเนินการนี้ไม่สามารถยกเลิกได้ และจะลบข้อมูลออกจากฐานข้อมูลอย่างถาวร</p>
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
    </div>
  );
};

export default App;
