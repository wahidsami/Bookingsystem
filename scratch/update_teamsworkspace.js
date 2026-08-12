const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../tenant-v2/src/components/TeamsWorkspace.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add EmployeeProfileEditor import
if (!content.includes('EmployeeProfileEditor')) {
  content = content.replace(
    `import { TeamMemberData, StaffAppPermissionKey, DEFAULT_STAFF_APP_PERMISSIONS } from '../types/employee';`,
    `import { TeamMemberData, StaffAppPermissionKey, DEFAULT_STAFF_APP_PERMISSIONS } from '../types/employee';\nimport EmployeeProfileEditor from './employee-profile/EmployeeProfileEditor';`
  );
}

// 2. Remove unneeded states
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
content = content.replace(
  /^[ \t]*const \[newSpecialty, setNewSpecialty\].*?\n[\s\S]*?const handleRemoveLanguage = \(index: number\) => {[\s\S]*?};\n/gm,
  ''
);

// 3. Update Add Member / Edit Member to not use the removed states
content = content.replace(/setActiveFormSection\('basic'\);\n/g, '');
content = content.replace(/setEmployeePhotoFile\(null\);\n/g, '');

// Make fetchStaffAppPermissions return the permissions instead of just setting state, or wait for state.
// Actually, fetchStaffAppPermissions currently does: setStaffAppPermissions({ ... })
// We can change the "Edit" click to wait for it.
// Let's modify handleSaveMember first.
content = content.replace(
  /const handleSaveMember = async \(e: React\.FormEvent\) => \{\n\s*e\.preventDefault\(\);\n/g,
  `const handleSaveMember = async (\n    submittedData: TeamMemberData,\n    photo: File | null,\n    submittedPermissions: Record<StaffAppPermissionKey, boolean>\n  ) => {\n`
);

// Inside handleSaveMember, replace formData -> submittedData, employeePhotoFile -> photo, staffAppPermissions -> submittedPermissions
// We need to be careful not to replace it everywhere, only inside handleSaveMember.
// Let's find handleSaveMember body.
const handleSaveMemberStart = content.indexOf('const handleSaveMember = async');
const handleSaveMemberEnd = content.indexOf('const handleDeleteMember = async', handleSaveMemberStart);
if (handleSaveMemberStart !== -1 && handleSaveMemberEnd !== -1) {
  let saveMemberBody = content.substring(handleSaveMemberStart, handleSaveMemberEnd);
  
  saveMemberBody = saveMemberBody.replace(/\bformData\b/g, 'submittedData');
  saveMemberBody = saveMemberBody.replace(/\bemployeePhotoFile\b/g, 'photo');
  saveMemberBody = saveMemberBody.replace(/\bstaffAppPermissions\b/g, 'submittedPermissions');
  // There might be some local references we accidentally rename?
  // formData.nameEn -> submittedData.nameEn (Good)
  // formData.id -> submittedData.id (Good)
  
  content = content.substring(0, handleSaveMemberStart) + saveMemberBody + content.substring(handleSaveMemberEnd);
}

// 4. Replace the form block with EmployeeProfileEditor
const formStartRegex = /\/\* GUIDED MULTI-SECTION ROSTER PROFILE FORM \*\/[\s\S]*?<div className="bg-white rounded-3xl border border-neutral-200\/60 shadow-md overflow-hidden animate-fade-in" id="roster-guided-form-editor">/;
const formEndIndex = content.lastIndexOf('</div>\n\n        </div>\n      )}\n\n    </div>\n  );\n}');

const match = content.match(formStartRegex);
if (match) {
  const formStartIndex = match.index;
  // The actual end of the form div is slightly before formEndIndex.
  // We can just replace everything from formStartIndex to formEndIndex with our new component and the wrapper ends.
  
  const replacement = `/* GUIDED MULTI-SECTION ROSTER PROFILE FORM */
          <EmployeeProfileEditor
            initialData={formData}
            isRtl={isRtl}
            formMode={formMode}
            onSave={handleSaveMember}
            onCancel={() => setActiveView('list')}
            initialStaffAppPermissions={staffAppPermissions}
            onAIAssist={generateAIContext}
          />
`;
  
  content = content.substring(0, formStartIndex) + replacement + content.substring(formEndIndex);
}

// 5. Update fetchStaffAppPermissions and Edit Member to work well with async initial data
// Instead of complex async/await in JSX, since EmployeeProfileEditor's key wasn't set, it doesn't remount when staffAppPermissions loads.
// We can just add a `key={formData.id + '-' + staffAppPermissions.view_earnings}` to force remount, or we can make `fetchStaffAppPermissions` return a promise and await it before `setActiveView('form')`.
// Let's modify the edit button click handler:
// `onClick={() => { ... fetchStaffAppPermissions(member.id); }}` -> we will find that and await it.
content = content.replace(
  /onClick=\{\(\) => \{\n\s*setFormData\(member\);\n\s*setFormMode\('edit'\);\n\s*setActiveView\('form'\);\n\s*fetchStaffAppPermissions\(member\.id\);\n\s*\}\}/g,
  `onClick={async () => {
                              setFormData(member);
                              setFormMode('edit');
                              await fetchStaffAppPermissions(member.id);
                              setActiveView('form');
                            }}`
);


fs.writeFileSync(filePath, content, 'utf8');
console.log('TeamsWorkspace.tsx updated successfully.');
