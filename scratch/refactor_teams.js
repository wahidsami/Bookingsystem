const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../Tenant-v2/src/components/TeamsWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const importsToInject = `import { 
  TeamMemberData, 
  TeamSubTab, 
  EmployeePosition, 
  EMPLOYEE_POSITION_OPTIONS, 
  EMPLOYEE_POSITION_LOOKUP,
  STAFF_APP_PERMISSION_KEYS,
  StaffAppPermissionKey,
  DEFAULT_STAFF_APP_PERMISSIONS,
  WEEKDAY_ROWS,
  WEEKDAY_KEYS,
  canonicalEmployeePosition
} from '../types/employee';
import EmployeeProfileEditor from './employee-profile/EmployeeProfileEditor';\n`;

content = content.replace(
  `import { Language, QuickLaunchRequest } from '../types';\n`,
  `import { Language, QuickLaunchRequest } from '../types';\n${importsToInject}`
);

// 2. Remove duplicate declarations
const startRemove = content.indexOf('const EMPLOYEE_POSITION_OPTIONS = [');
const endRemoveMatch = content.indexOf('export default function TeamsWorkspace');
if (startRemove > 0 && endRemoveMatch > startRemove) {
  content = content.substring(0, startRemove) + content.substring(endRemoveMatch);
}

// 3. Remove unneeded states
content = content.replace(
  /^[ \t]*\/\/ Guided form editor active section[\s\S]*?useState<'basic' \| 'bio' \| 'finance' \| 'schedule' \| 'access'>\('basic'\);\n/gm,
  ''
);
content = content.replace(
  /^[ \t]*const \[employeePhotoFile, setEmployeePhotoFile\].*\n/gm,
  ''
);
content = content.replace(
  /^[ \t]*const employeePhotoInputRef = useRef<HTMLInputElement \| null>\(null\);\n/gm,
  ''
);

// Specialty/Lang adders are inside the component. We can find them.
const specialtyStart = content.indexOf('// Specialty Helper Adders');
if (specialtyStart > 0) {
  const langEndSearch = content.indexOf('const handleRemoveLanguage', specialtyStart);
  if (langEndSearch > 0) {
    const endSpecialtyBlock = content.indexOf('  };\n', langEndSearch) + 5;
    content = content.substring(0, specialtyStart) + content.substring(endSpecialtyBlock);
  }
}

// 4. Update Add/Edit Member state logic
content = content.replace(/setActiveFormSection\('basic'\);\n/g, '');
content = content.replace(/setEmployeePhotoFile\(null\);\n/g, '');

content = content.replace(
  /onClick=\{\(\) => \{\n\s*setFormData\(member\);\n\s*setFormMode\('edit'\);\n\s*setActiveView\('form'\);\n\s*fetchStaffAppPermissions\(member\.id\);\n\s*\}\}/g,
  `onClick={async () => {
                              setFormData(member);
                              setFormMode('edit');
                              await fetchStaffAppPermissions(member.id);
                              setActiveView('form');
                            }}`
);

// 5. handleSaveMember signature update
const handleSaveMemberStart = content.indexOf('const handleSaveMember = async');
const handleSaveMemberEnd = content.indexOf('const handleDeleteMember = async', handleSaveMemberStart);
if (handleSaveMemberStart !== -1 && handleSaveMemberEnd !== -1) {
  let saveMemberBody = content.substring(handleSaveMemberStart, handleSaveMemberEnd);
  
  saveMemberBody = saveMemberBody.replace(
    /const handleSaveMember = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n/g,
    `const handleSaveMember = async (\n    submittedData: TeamMemberData,\n    photo: File | null,\n    submittedPermissions: Record<StaffAppPermissionKey, boolean>\n  ) => {\n`
  );

  saveMemberBody = saveMemberBody.replace(/\bformData\b/g, 'submittedData');
  saveMemberBody = saveMemberBody.replace(/\bemployeePhotoFile\b/g, 'photo');
  saveMemberBody = saveMemberBody.replace(/\bstaffAppPermissions\b/g, 'submittedPermissions');
  
  content = content.substring(0, handleSaveMemberStart) + saveMemberBody + content.substring(handleSaveMemberEnd);
}

// 6. Replace form body
const formStartRegex = /\/\* GUIDED MULTI-SECTION ROSTER PROFILE FORM \*\/[\s\S]*?<div className="bg-white rounded-3xl border border-neutral-200\/60 shadow-md overflow-hidden animate-fade-in" id="roster-guided-form-editor">/;
const formEndIndex = content.lastIndexOf('</div>\n\n        </div>\n      )}\n\n    </div>\n  );\n}');

const match = content.match(formStartRegex);
if (match) {
  const formStartIndex = match.index;
  const replacement = `/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */
          <EmployeeProfileEditor
            initialData={formData}
            isRtl={isRtl}
            formMode={formMode}
            onSave={handleSaveMember}
            onCancel={() => setActiveView('list')}
            initialStaffAppPermissions={staffAppPermissions}
            onAIAssist={generateAIContext}
          />\n`;
  content = content.substring(0, formStartIndex) + replacement + content.substring(formEndIndex);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
