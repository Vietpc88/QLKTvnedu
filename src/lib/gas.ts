import { loadFromFirebase, saveToFirebase } from "./firebase";

export const loadFromGas = async (_gasUrl: string): Promise<any> => {
  try {
    const data: any = await loadFromFirebase();
    if (data && Object.keys(data).length > 0) {
      return data;
    }
    throw new Error("Không tìm thấy dữ liệu trên Firebase. Vui lòng kiểm tra lại cấu hình hoặc thực hiện Migration.");
  } catch (e: any) {
    console.error("Firebase load failed:", e);
    throw e;
  }
};

export const saveToGas = async (_gasUrl: string, payload: any, _action: string = "sync") => {
  return await saveToFirebase(payload);
};

export const migrateDataToFirebase = async (gasUrl: string) => {
  if (!gasUrl) throw new Error("Vui lòng cung cấp URL GAS để di chuyển.");
  
  try {
    const response = await fetch(gasUrl, { method: "GET", redirect: "follow" });
    const result = await response.json();
    const dataPart = result.data || result;
    
    // 1. Filter subjectColumns to remove empty or invalid ones
    if (Array.isArray(dataPart.subjectColumns)) {
      dataPart.subjectColumns = dataPart.subjectColumns.filter((s: string) => 
        s && s.trim() !== "" && !s.includes("EMPTY_") && !s.includes("Column")
      );
    }

    // 2. Process Phach_ sheets if they exist in the raw response
    const phachSheets = Object.keys(dataPart).filter(k => 
      k.startsWith("Phach_") && k.replace("Phach_", "").trim() !== "" && !k.includes("EMPTY_")
    );
    
    if (phachSheets.length > 0) {
      const mergedData: any[] = [];
      phachSheets.forEach(sheetName => {
        const rows = dataPart[sheetName];
        if (Array.isArray(rows)) {
          const subjectName = sheetName.replace("Phach_", "").trim();
          rows.forEach((row: any) => {
            mergedData.push({ ...row, subject: subjectName });
          });
        }
      });
      dataPart.mergedData = mergedData;
    }

    // Process config_json if exists
    if (dataPart.config_json && typeof dataPart.config_json === 'string') {
      try {
        const jsonStore = JSON.parse(dataPart.config_json);
        Object.assign(dataPart, jsonStore);
      } catch (e) {
        console.warn("Failed to parse config_json during migration", e);
      }
    }

    await saveToFirebase(dataPart);
    return { status: "success", message: "Di chuyển thành công!" };
  } catch (error: any) {
    throw new Error(`Di chuyển thất bại: ${error.message}`);
  }
};
