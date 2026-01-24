# 📊 Employee Data Flow Analysis - Frontend to Database

**Date**: 2025-11-28  
**Goal**: Verify data sent from frontend matches database schema

---

## 1️⃣ **FRONTEND SENDS** (FormData)

From `tenant/src/app/[locale]/dashboard/employees/new/page.tsx`:

```javascript
submitData.append("name", formData.name);                    // ✅ String
submitData.append("email", formData.email);                  // ✅ String (optional)
submitData.append("phone", formData.phone);                  // ✅ String (optional)
submitData.append("nationality", formData.nationality);     // ✅ String (optional)
submitData.append("bio", formData.bio);                      // ✅ String (optional)
submitData.append("experience", formData.experience);        // ✅ String (optional)
submitData.append("skills", JSON.stringify(formData.skills)); // ⚠️ JSON STRING!
submitData.append("salary", formData.salary);                // ✅ String
submitData.append("commissionRate", formData.commissionRate || "0"); // ✅ String
submitData.append("isActive", formData.isActive.toString());  // ✅ String ("true"/"false")
submitData.append("workingHours", JSON.stringify(formData.workingHours)); // ⚠️ JSON STRING!
submitData.append("photo", photoFile);                      // ✅ File (optional)
```

**Example values sent:**
- `skills`: `"[\"nails\",\"hair\"]"` (JSON string)
- `workingHours`: `"{\"sunday\":{\"isWorking\":false,...}}"` (JSON string)
- `isActive`: `"true"` (string)

---

## 2️⃣ **DATABASE EXPECTS** (Staff Model)

From `server/src/models/Staff.js`:

| Column | Type | Required | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | ✅ | auto | Auto-generated |
| `tenantId` | UUID | ✅ | - | From auth middleware |
| `name` | STRING | ✅ | - | ✅ Matches frontend |
| `email` | STRING | ❌ | null | ✅ Matches frontend |
| `phone` | STRING | ❌ | null | ✅ Matches frontend |
| `nationality` | STRING | ❌ | null | ✅ Matches frontend |
| `bio` | TEXT | ❌ | null | ✅ Matches frontend |
| `experience` | STRING | ❌ | null | ✅ Matches frontend |
| `skills` | **JSON** | ❌ | `[]` | ⚠️ **Expects JavaScript array, not JSON string!** |
| `photo` | STRING | ❌ | null | ✅ Path (from file upload) |
| `rating` | DECIMAL(3,2) | ❌ | 5.0 | Not sent from frontend |
| `totalBookings` | INTEGER | ❌ | 0 | Not sent from frontend |
| `salary` | DECIMAL(10,2) | ✅ | 0.00 | ✅ Matches frontend (needs parsing) |
| `commissionRate` | DECIMAL(5,2) | ❌ | 0.00 | ✅ Matches frontend (needs parsing) |
| `workingHours` | **JSON** | ❌ | `{}` | ⚠️ **Expects JavaScript object, not JSON string!** |
| `isActive` | BOOLEAN | ❌ | true | ⚠️ **Expects boolean, not string!** |
| `createdAt` | DATE | ✅ | auto | Auto-generated |
| `updatedAt` | DATE | ✅ | auto | Auto-generated |

---

## 3️⃣ **THE PROBLEM** 🐛

### **Issue 1: Skills Array**
- **Frontend sends**: `"[\"nails\",\"hair\"]"` (JSON string)
- **Database expects**: `["nails","hair"]` (JavaScript array)
- **Current backend**: Tries to parse, but PostgreSQL still receives string
- **Error**: `malformed array literal: "["nails","hair"]"`

### **Issue 2: Working Hours Object**
- **Frontend sends**: `"{\"sunday\":{...}}"` (JSON string)
- **Database expects**: `{sunday: {...}}` (JavaScript object)
- **Current backend**: Tries to parse, but might have same issue

### **Issue 3: isActive Boolean**
- **Frontend sends**: `"true"` (string)
- **Database expects**: `true` (boolean)
- **Current backend**: ✅ Already handles this correctly

---

## 4️⃣ **SOLUTION** ✅

The backend **MUST** parse the JSON strings before passing to Sequelize:

```javascript
// ✅ CORRECT
const skills = JSON.parse(req.body.skills);        // ["nails","hair"] (array)
const workingHours = JSON.parse(req.body.workingHours); // {sunday: {...}} (object)

await db.Staff.create({
  skills: skills,              // JavaScript array
  workingHours: workingHours,   // JavaScript object
  isActive: req.body.isActive === 'true'  // Boolean
});
```

```javascript
// ❌ WRONG
await db.Staff.create({
  skills: req.body.skills,              // "[\"nails\",\"hair\"]" (string) ❌
  workingHours: req.body.workingHours,  // "{\"sunday\":{...}}" (string) ❌
  isActive: req.body.isActive           // "true" (string) ❌
});
```

---

## 5️⃣ **VERIFICATION CHECKLIST** ✅

- ✅ Frontend sends all required fields
- ✅ Database has all expected columns
- ✅ Field names match (camelCase vs snake_case handled by Sequelize)
- ⚠️ **Data types need conversion:**
  - `skills`: JSON string → JavaScript array
  - `workingHours`: JSON string → JavaScript object
  - `isActive`: String → Boolean
  - `salary`: String → Decimal
  - `commissionRate`: String → Decimal

---

## 6️⃣ **NEXT STEPS** 🎯

1. ✅ Verify backend is parsing JSON strings correctly
2. ✅ Ensure parsed values are JavaScript arrays/objects (not strings)
3. ✅ Test with backend console logs to see what Sequelize receives
4. ✅ If still failing, check if Sequelize JSON type needs special handling

---

**Report Generated**: 2025-11-28

